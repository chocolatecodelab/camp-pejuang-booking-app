# Technical Design Document
## Sistem Booking Kost/Camp Online

| Field | Detail |
|---|---|
| Versi | 1.0 |
| Tanggal | 19 Juli 2026 |
| Terkait | PRD-Booking-Kost-Camp.md |
| Stack | Next.js (Vercel) + Supabase (Postgres + Storage) |

---

## 1. Tujuan Dokumen

Menerjemahkan PRD (termasuk keputusan final: **1 kamar = 1 penghuni**, dan mekanisme **priority extension window**) menjadi rancangan teknis konkret — skema database, arsitektur, kontrak API, dan alur konkurensi.

---

## 2. Arsitektur Sistem

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Browser (User)       │        │   Browser (Admin)         │
│  Landing → Detail Camp │        │  Dashboard, Verifikasi,    │
│  → Booking → Tracking  │        │  CRUD Camp/Kamar/Harga     │
└──────────┬───────────┘        └──────────────┬────────────┘
           │ HTTPS                              │ HTTPS (auth)
           ▼                                      ▼
┌──────────────────────────────────────────────────────────┐
│                 Next.js API Routes (Vercel)                │
│  /api/camps  /api/rooms/availability  /api/bookings         │
│  /api/bookings/[code]/track  /api/admin/*  /api/cron/*      │
└───────────┬───────────────────────────┬────────────────────┘
            │                            │
            ▼                            ▼
   ┌─────────────────┐        ┌───────────────────────┐
   │ Supabase Postgres │        │ Supabase Storage        │
   │ (service role key,  │        │ bucket privat:            │
   │  server-side only)   │        │ payment-proofs, camp-photos│
   └─────────────────┘        └───────────────────────┘
            ▲
            │ cron trigger
   ┌─────────────────────────────────────┐
   │  Vercel Cron Jobs                      │
   │  1. expire-holds (tiap 15 menit)         │
   │  2. offer-extensions (harian, H-7)       │
   │  3. expire-extension-offers (tiap jam)    │
   └─────────────────────────────────────┘
```

**Prinsip kunci (sama seperti sistem booking lapangan):**
- Semua write ke Supabase lewat API Routes dengan `service_role` key — browser tidak pernah menulis langsung.
- Bukti pembayaran & foto disimpan di **bucket privat**, diakses admin lewat signed URL sementara.
- Tiga cron job berjalan independen — masing-masing tanggung jawab tunggal (single responsibility), memudahkan debug.

---

## 3. Skema Database (Supabase / PostgreSQL)

### 3.1 Diagram Relasi

```
camps (1) ──< rooms (N) ──< bookings (N) ──< payment_proofs (N)
                                  │
                                  └── parent_booking_id (self-reference, untuk extend)

camps (1) ──< pricing_packages (N)  [durasi & harga per kamar]
```

### 3.2 Extension Wajib

```sql
-- Wajib untuk EXCLUDE constraint berbasis range tanggal
create extension if not exists btree_gist;
```

### 3.3 DDL

```sql
-- ENUM Types
create type camp_type as enum ('putra', 'putri', 'campuran');
create type booking_status as enum (
  'hold',                 -- baru pilih kamar, belum upload bukti
  'pending_verification', -- sudah upload bukti, menunggu admin
  'confirmed',            -- disetujui admin
  'rejected',             -- ditolak admin
  'expired',              -- hold kedaluwarsa, tidak upload bukti
  'cancelled'             -- dibatalkan admin setelah confirmed
);
create type payment_type as enum ('dp', 'full');
create type payment_channel as enum ('qris', 'transfer_bank');

-- 1. camps
create table camps (
  id uuid primary key default gen_random_uuid(),
  name text not null,                      -- "Camp UB (3)"
  slug text not null unique,                -- "camp-3-putra"
  type camp_type not null,
  address text not null,
  description text,
  facilities text[],                        -- ['Wi-Fi Cepat','Dapur Umum','Air Minum']
  cover_photo_url text,
  gallery_photo_urls text[],
  latitude numeric(10,7),
  longitude numeric(10,7),
  extension_window_days int not null default 7,  -- H-berapa sebelum checkout, priority window dibuka
  extension_response_hours int not null default 72, -- berapa lama penghuni lama boleh merespons
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. rooms (1 kamar = 1 penghuni)
create table rooms (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references camps(id) on delete cascade,
  name text not null,                      -- "Kamar 1"
  floor_label text,                        -- "Lantai 1"
  room_photo_urls text[],
  is_active boolean not null default true, -- non-aktifkan tanpa hapus data historis
  created_at timestamptz not null default now()
);

-- 3. pricing_packages (harga per kombinasi kamar + durasi)
create table pricing_packages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  label text not null,                     -- "2 Minggu" | "1 Bulan" | "3 Bulan"
  duration_days int not null,              -- 14 | 30 | 90 -> dipakai hitung check_out
  price numeric(12,2) not null,
  min_dp_amount numeric(12,2),             -- nominal DP minimum (nullable jika wajib full)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 4. bookings
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,       -- "CP-0719-7XQ2"
  room_id uuid not null references rooms(id),
  pricing_package_id uuid references pricing_packages(id), -- null jika custom (fase 2)
  parent_booking_id uuid references bookings(id),           -- untuk kasus extend

  customer_name text not null,
  whatsapp_number text not null,
  notes text,

  check_in date not null,
  check_out date not null,
  stay_period daterange generated always as (
    daterange(check_in, check_out, '[)')
  ) stored,

  payment_type payment_type not null,
  payment_channel payment_channel not null,
  claimed_amount numeric(12,2) not null,   -- nominal yang diklaim user sudah ditransfer
  total_price numeric(12,2) not null,

  status booking_status not null default 'hold',
  hold_expires_at timestamptz,             -- diisi saat status='hold'

  -- Kolom untuk priority extension window (lihat 3.5)
  extension_offer_expires_at timestamptz,

  rejected_reason text,
  cancelled_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_dates check (check_out > check_in)
);

-- INI CONSTRAINT UTAMA ANTI-TABRAKAN KAMAR
-- Hanya berlaku untuk booking yang statusnya "aktif" (hold/pending/confirmed)
-- booking yang rejected/expired/cancelled TIDAK ikut dihitung
create table booking_locks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  room_id uuid not null references rooms(id),
  stay_period daterange not null,
  exclude using gist (room_id with =, stay_period with &&)
);

-- 5. payment_proofs (riwayat upload, tidak menimpa)
create table payment_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  file_path text not null,                 -- path di Supabase Storage (bucket privat)
  file_type text not null,                 -- 'image/jpeg' | 'image/png' | 'application/pdf'
  uploaded_at timestamptz not null default now()
);

-- 6. booking_status_history (audit trail)
create table booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  old_status booking_status,
  new_status booking_status not null,
  changed_by text,                          -- admin email, atau 'system' untuk cron
  reason text,
  changed_at timestamptz not null default now()
);

-- 7. admin_profiles
create table admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'admin'
);

-- Indexes
create index idx_rooms_camp on rooms (camp_id) where is_active = true;
create index idx_pricing_room on pricing_packages (room_id) where is_active = true;
create index idx_bookings_status_hold on bookings (status, hold_expires_at) where status = 'hold';
create index idx_bookings_status_ext on bookings (status, check_out, extension_offer_expires_at) where status = 'confirmed';
create index idx_bookings_code on bookings (booking_code);
create index idx_bookings_room_period on bookings using gist (room_id, stay_period);
create index idx_payment_proofs_booking on payment_proofs (booking_id);
```

> **Kenapa dipisah `bookings` dan `booking_locks`?**
> Karena `daterange` dengan `generated always as stored` tidak selalu bisa langsung dipakai di `EXCLUDE` constraint bersamaan dengan kolom lain yang sering update (mis. `status`) tanpa menimbulkan sedikit kerumitan trigger. Memisahkan "kunci tanggal" ke tabel sendiri (`booking_locks`) membuat aturan sangat eksplisit: **baris di `booking_locks` HANYA ada selama booking berstatus hold/pending_verification/confirmed**. Begitu status jadi `rejected`/`expired`/`cancelled`, baris di `booking_locks` dihapus dalam transaction yang sama — otomatis membuka kembali periode itu untuk publik. Ini pola yang sama seperti `booking_slots` di sistem booking lapangan, hanya bertipe `daterange` alih-alih `hour_slot`.

### 3.4 Row Level Security (RLS)

```sql
alter table camps enable row level security;
alter table rooms enable row level security;
alter table pricing_packages enable row level security;
alter table bookings enable row level security;
alter table booking_locks enable row level security;
alter table payment_proofs enable row level security;

-- Publik boleh baca camp, kamar, harga yang aktif
create policy "public read active camps" on camps for select using (is_active = true);
create policy "public read active rooms" on rooms for select using (is_active = true);
create policy "public read active pricing" on pricing_packages for select using (is_active = true);

-- booking_locks: publik boleh baca HANYA room_id + stay_period (untuk render kalender ketersediaan)
-- tanpa data pelanggan sama sekali
create policy "public read locks" on booking_locks for select using (true);

-- bookings & payment_proofs: TIDAK ada policy publik.
-- Semua akses lewat API Route dengan service_role key.
```

### 3.5 Mekanisme Priority Extension Window

Ini bagian paling krusial yang menjawab pertanyaan Anda soal extend. Implementasi sepenuhnya lewat kolom `extension_offer_expires_at` di `bookings` + logic di query ketersediaan + cron.

**Langkah 1 — Cron harian membuka window (dijalankan tiap pagi):**
```sql
-- Cari booking confirmed yang check_out-nya H-7 (extension_window_days per camp)
update bookings b
set extension_offer_expires_at = now() + (c.extension_response_hours || ' hours')::interval
from rooms r
join camps c on c.id = r.camp_id
where b.room_id = r.id
  and b.status = 'confirmed'
  and b.check_out = current_date + c.extension_window_days
  and b.extension_offer_expires_at is null; -- belum pernah ditawarkan

-- Baris yang ter-update di atas -> trigger kirim reminder WA (dari API Route, bukan SQL)
```

**Langkah 2 — Query ketersediaan publik menyembunyikan periode yang masih dalam window:**
```sql
-- Saat cek apakah room X available untuk periode [p_check_in, p_check_out):
select not exists (
  select 1 from booking_locks bl
  join bookings b on b.id = bl.booking_id
  where bl.room_id = p_room_id
    and bl.stay_period && daterange(p_check_in, p_check_out, '[)')
) and not exists (
  -- tambahan: periode SETELAH checkout booking yang masih dalam extension window
  -- dianggap "reserved" untuk penghuni lama, kecuali requester = penghuni yang sama
  select 1 from bookings b2
  where b2.room_id = p_room_id
    and b2.status = 'confirmed'
    and b2.extension_offer_expires_at > now()
    and daterange(b2.check_out, b2.check_out + 3650, '[)') && daterange(p_check_in, p_check_out, '[)')
    and b2.whatsapp_number <> p_requester_whatsapp  -- penghuni lama sendiri tetap boleh lihat & klik extend
) as is_available;
```

**Langkah 3 — Penghuni klik "Extend" di halaman Cek Pesanan:**
```
POST /api/bookings/:id/extend
Body: { pricing_package_id }
→ Buat booking baru: parent_booking_id = booking lama, check_in = check_out booking lama,
  check_out = check_in + duration_days paket, status = 'hold'
→ Insert ke booking_locks (otomatis tervalidasi EXCLUDE constraint)
→ Lanjut ke flow upload bukti bayar seperti booking normal
```

**Langkah 4 — Cron per jam melepas window yang kedaluwarsa tanpa aksi:**
```sql
update bookings
set extension_offer_expires_at = null
where status = 'confirmed'
  and extension_offer_expires_at < now();
-- Begitu extension_offer_expires_at null lagi, periode setelah check_out
-- otomatis kembali muncul available untuk publik (lihat query langkah 2)
```

> **Catatan penting:** window prioritas TIDAK membuat baris baru di `booking_locks` (karena belum ada booking baru yang benar-benar dibuat) — ia hanya "menyembunyikan" periode itu dari hasil query ketersediaan publik lewat kondisi tambahan. Ini sengaja dipisah dari mekanisme lock utama, supaya kalau penghuni lama tidak jadi extend, tidak perlu proses "hapus lock" tambahan — cukup biarkan `extension_offer_expires_at` kedaluwarsa secara alami.

---

## 4. Kontrak API (Next.js API Routes)

### 4.1 Public Endpoints

**`GET /api/camps`** — daftar semua camp aktif (untuk landing page).

**`GET /api/camps/:slug`** — detail camp + daftar kamar + status ketersediaan ringkas.

**`GET /api/rooms/:id/availability?check_in=&check_out=&whatsapp=`**
```json
{ "available": true }
```
atau
```json
{ "available": false, "reason": "booked" }
```
Parameter `whatsapp` opsional — dipakai untuk deteksi kasus "penghuni lama sendiri yang sedang dalam extension window".

**`GET /api/rooms/:id/pricing`** — daftar paket durasi & harga aktif untuk kamar tsb.

**`POST /api/bookings/hold`**
```json
{
  "room_id": "uuid",
  "pricing_package_id": "uuid",
  "check_in": "2026-08-01",
  "customer_name": "Budi",
  "whatsapp_number": "6281234567890",
  "notes": "",
  "payment_type": "dp",
  "payment_channel": "qris"
}
```
Server-side: hitung `check_out` dari `duration_days` paket → insert `bookings` (status `hold`, `hold_expires_at = now() + 24 jam`) + insert `booking_locks` dalam 1 transaction. Jika `EXCLUDE` constraint gagal → `409 Conflict`.

**`POST /api/bookings/:id/upload-proof`** (multipart/form-data)
Upload ke Supabase Storage bucket privat → insert `payment_proofs` → update `bookings.status = 'pending_verification'`.

**`POST /api/bookings/:id/extend`** — lihat 3.5 langkah 3.

**`GET /api/bookings/track?name=&code=`**
```json
{
  "booking_code": "CP-0719-7XQ2",
  "status": "confirmed",
  "room_name": "Kamar 1",
  "camp_name": "Camp UB (3)",
  "check_in": "2026-08-01",
  "check_out": "2026-08-31",
  "can_extend": true,
  "extension_offer_expires_at": null
}
```

### 4.2 Admin Endpoints

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/admin/bookings?status=&camp_id=` | List transaksi + filter |
| GET | `/api/admin/bookings/:id` | Detail booking + signed URL bukti bayar |
| PATCH | `/api/admin/bookings/:id/approve` | Set `confirmed`, log history, trigger notif WA |
| PATCH | `/api/admin/bookings/:id/reject` | Set `rejected` + alasan, hapus `booking_locks`, trigger notif WA |
| PATCH | `/api/admin/bookings/:id/cancel` | Cancel booking confirmed + alasan |
| GET/POST/PATCH/DELETE | `/api/admin/camps` | CRUD Camp |
| GET/POST/PATCH/DELETE | `/api/admin/camps/:campId/rooms` | CRUD Kamar nested |
| GET/POST/PATCH/DELETE | `/api/admin/rooms/:roomId/pricing` | CRUD Harga per paket durasi |
| GET | `/api/admin/reports?from=&to=` | Rekap okupansi & omzet |

### 4.3 Cron Endpoints (diproteksi header `CRON_SECRET`)

| Path | Jadwal | Fungsi |
|---|---|---|
| `/api/cron/expire-holds` | Tiap 15 menit | Hapus `booking_locks` + set `status='expired'` untuk `hold` yang lewat `hold_expires_at` |
| `/api/cron/offer-extensions` | Harian (pagi) | Jalankan query 3.5 langkah 1 + kirim reminder WA |
| `/api/cron/expire-extension-offers` | Tiap jam | Jalankan query 3.5 langkah 4 |

---

## 5. Fungsi Database untuk Atomicity (RPC)

```sql
create or replace function create_booking_hold(
  p_room_id uuid,
  p_pricing_package_id uuid,
  p_check_in date,
  p_customer_name text,
  p_whatsapp text,
  p_notes text,
  p_payment_type payment_type,
  p_payment_channel payment_channel,
  p_claimed_amount numeric,
  p_parent_booking_id uuid default null
) returns bookings
language plpgsql
as $$
declare
  v_booking bookings;
  v_package pricing_packages;
begin
  select * into v_package from pricing_packages where id = p_pricing_package_id;
  if v_package is null then
    raise exception 'invalid_pricing_package';
  end if;

  insert into bookings (
    booking_code, room_id, pricing_package_id, parent_booking_id,
    customer_name, whatsapp_number, notes,
    check_in, check_out,
    payment_type, payment_channel, claimed_amount, total_price,
    status, hold_expires_at
  ) values (
    'CP-' || to_char(now(),'MMDD') || '-' || upper(substr(md5(random()::text),1,4)),
    p_room_id, p_pricing_package_id, p_parent_booking_id,
    p_customer_name, p_whatsapp, p_notes,
    p_check_in, p_check_in + v_package.duration_days,
    p_payment_type, p_payment_channel, p_claimed_amount, v_package.price,
    'hold', now() + interval '24 hours'
  ) returning * into v_booking;

  -- Baris ini akan gagal (raise exception) otomatis jika EXCLUDE constraint terlanggar
  insert into booking_locks (booking_id, room_id, stay_period)
  values (v_booking.id, p_room_id, daterange(v_booking.check_in, v_booking.check_out, '[)'));

  insert into booking_status_history (booking_id, old_status, new_status, changed_by)
  values (v_booking.id, null, 'hold', 'system');

  return v_booking;
exception
  when exclusion_violation then
    raise exception 'room_not_available';
end;
$$;
```

Dipanggil dari API Route via `supabase.rpc('create_booking_hold', {...})`. Kalau `EXCLUDE` constraint di `booking_locks` gagal (periode bentrok dengan booking lain yang masih aktif), seluruh function rollback otomatis dan API Route menangkap error `room_not_available` untuk dikembalikan sebagai `409` ke frontend.

---

## 6. Struktur Folder Proyek

```
/app
  /(public)
    /page.tsx                        → landing, daftar camp
    /camp/[slug]/page.tsx             → detail camp + daftar kamar
    /booking/[roomId]/page.tsx        → pilih paket durasi + form data diri
    /booking/[bookingId]/bayar/page.tsx → tampilkan QRIS/rekening + upload bukti
    /booking/[bookingId]/sukses/page.tsx
    /cek-pesanan/page.tsx             → form tracking (nama + kode)
  /admin
    /login/page.tsx
    /dashboard/page.tsx
    /transaksi/page.tsx
    /transaksi/[id]/page.tsx          → detail + lihat bukti bayar + approve/reject
    /camp/page.tsx                    → CRUD camp
    /camp/[id]/kamar/page.tsx         → CRUD kamar nested
    /camp/[id]/harga/page.tsx         → CRUD paket harga
  /api
    /camps/route.ts
    /camps/[slug]/route.ts
    /rooms/[id]/availability/route.ts
    /rooms/[id]/pricing/route.ts
    /bookings/hold/route.ts
    /bookings/[id]/upload-proof/route.ts
    /bookings/[id]/extend/route.ts
    /bookings/track/route.ts
    /admin/bookings/route.ts
    /admin/bookings/[id]/approve/route.ts
    /admin/bookings/[id]/reject/route.ts
    /admin/camps/route.ts
    /admin/camps/[campId]/rooms/route.ts
    /admin/rooms/[roomId]/pricing/route.ts
    /admin/reports/route.ts
    /cron/expire-holds/route.ts
    /cron/offer-extensions/route.ts
    /cron/expire-extension-offers/route.ts
/lib
  /supabase/server.ts     → client service_role (server only)
  /supabase/client.ts     → client anon key (browser, read-only)
  /storage.ts             → wrapper upload & signed URL Supabase Storage
  /whatsapp.ts            → generator wa.me link bertemplate (MVP)
  /validation.ts          → skema zod semua input API
/components
  CampCard.tsx
  RoomAvailabilityCalendar.tsx
  PricingPackagePicker.tsx
  BookingForm.tsx
  ProofUpload.tsx
  TrackingResult.tsx
  AdminBookingDetail.tsx
  AdminRoomCrudForm.tsx
```

---

## 7. Validasi Input (zod)

```ts
const holdBookingSchema = z.object({
  room_id: z.string().uuid(),
  pricing_package_id: z.string().uuid(),
  check_in: z.string().date(),
  customer_name: z.string().min(2).max(100),
  whatsapp_number: z.string().regex(/^62\d{8,13}$/, "Format nomor harus 62xxxxxxxxxx"),
  notes: z.string().max(500).optional(),
  payment_type: z.enum(["dp", "full"]),
  payment_channel: z.enum(["qris", "transfer_bank"]),
  claimed_amount: z.number().positive(),
});

const uploadProofSchema = z.object({
  file: z.instanceof(File)
    .refine(f => f.size <= 5 * 1024 * 1024, "Maksimal 5MB")
    .refine(f => ["image/jpeg", "image/png", "application/pdf"].includes(f.type), "Format tidak didukung"),
});

const trackBookingSchema = z.object({
  name: z.string().min(2),
  code: z.string().regex(/^CP-\d{4}-[A-Z0-9]{4}$/),
});
```

---

## 8. Vercel Cron Configuration

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/expire-holds", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/offer-extensions", "schedule": "0 6 * * *" },
    { "path": "/api/cron/expire-extension-offers", "schedule": "0 * * * *" }
  ]
}
```

---

## 9. Supabase Storage — Struktur Bucket

```
payment-proofs/          (privat)
  {booking_id}/
    {timestamp}-{filename}

camp-assets/              (publik, read-only — foto camp & kamar boleh publik)
  {camp_id}/cover.jpg
  {camp_id}/gallery/{n}.jpg
  {camp_id}/rooms/{room_id}/{n}.jpg
```
> Bukti pembayaran (`payment-proofs`) **wajib privat**. Foto camp/kamar (`camp-assets`) boleh publik karena memang untuk ditampilkan ke calon penghuni.

---

## 10. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
NEXT_PUBLIC_OWNER_WHATSAPP=6285xxxxxxx     # untuk tombol "Hubungi Admin"
WA_TEMPLATE_LOCALE=id
```

---

## 11. Testing Checklist

| Skenario | Cara Uji |
|---|---|
| Dua booking bentrok tanggal di kamar sama | Booking Kamar A 1–31 Jan, lalu coba booking Kamar A 15–20 Jan → harus ditolak `409` |
| Booking tidak bentrok (berurutan pas) | Booking Kamar A 1–31 Jan, lalu booking Kamar A 31 Jan–28 Feb → harus **berhasil** (checkout=checkin boleh sama, karena `[)` half-open range) |
| Hold expired otomatis | Buat hold, jangan upload bukti, tunggu cron jalan setelah 24 jam → kamar available lagi |
| Priority extension window | Set `extension_window_days=7` pada camp test, mundurkan tanggal sistem (atau ubah `check_out` booking test jadi H+7), jalankan cron `offer-extensions` manual → cek `extension_offer_expires_at` terisi & kamar hilang dari listing publik untuk WA lain |
| Penghuni lama tetap bisa lihat & extend | Query availability dengan `whatsapp` yang sama dengan booking existing → harus tetap `available: true` untuk keperluan extend |
| Extension window kedaluwarsa tanpa aksi | Jalankan cron `expire-extension-offers` setelah window lewat → kamar kembali available untuk publik |
| Reject booking | Admin reject → `booking_locks` terkait terhapus, kamar available lagi, `booking_status_history` tercatat |
| Upload bukti tidak valid | File >5MB atau bukan JPG/PNG/PDF → ditolak sebelum masuk storage |
| Tracking hanya dengan kode tanpa nama benar | Harus gagal — kombinasi nama+kode wajib cocok |

---

## 12. Hal yang Sengaja Belum Dirancang (Out of Scope Fase 1)

- Custom date range di luar paket durasi tetap (fase 2 — akan butuh logic prorata harga harian).
- Notifikasi WA otomatis penuh via API (MVP masih pakai wa.me link semi-manual, lihat PRD 5.6).
- Multi-admin dengan role berbeda per camp.
- Payment gateway otomatis (tetap manual sesuai requirement).
