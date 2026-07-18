# PRD: Sistem Booking Lapangan Olahraga Online
**(Futsal, Badminton, Tenis Meja)**

| Field | Detail |
|---|---|
| Versi Dokumen | 1.0 |
| Tanggal | 15 Juli 2026 |
| Status | Draft |
| Tech Stack Target | Next.js/Node.js (Vercel) + Supabase (Postgres) |

---

## 1. Latar Belakang & Tujuan

### 1.1 Latar Belakang
Pengelola lapangan olahraga (futsal, badminton, tenis meja) saat ini masih mengelola booking secara manual (WhatsApp/catatan), yang rawan bentrok jadwal, sulit dilacak, dan tidak efisien untuk pelanggan maupun admin.

### 1.2 Tujuan Produk
- Memungkinkan pelanggan booking lapangan secara online, mandiri, tanpa perlu chat admin dulu.
- Menghindari double booking jam yang sama.
- Mempermudah pembayaran (QRIS otomatis atau bayar di tempat).
- Memberi visibility jadwal real-time kepada pelanggan dan admin.

### 1.3 Goals & Non-Goals
**Goals (MVP):**
- User bisa lihat jadwal kosong per cabang olahraga, per hari, per jam (07.00–23.00).
- User bisa booking 1 atau lebih slot jam sekaligus.
- User bisa bayar via QRIS atau pilih "bayar di lapangan".
- Slot otomatis terkunci begitu pembayaran QRIS berhasil (atau begitu booking dibuat, tergantung kebijakan — dibahas di bagian 5).
- Admin punya panel untuk melihat & mengelola booking.

**Non-Goals (di luar MVP awal):**
- Multi-cabang/multi-lokasi (beda kota) — bisa jadi fase 2.
- Member/loyalty program, promo/diskon otomatis.
- Refund otomatis, reschedule otomatis.
- Aplikasi mobile native (cukup web responsive dulu).

---

## 2. User Persona & Role

| Role | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Pelanggan (Guest)** | Umum, tidak perlu akun/login | Cari & booking jadwal secepat mungkin |
| **Admin/Owner** | Pemilik/pengelola lapangan | Kelola jadwal, harga, verifikasi booking bayar-di-tempat, lihat laporan |
| **Kasir (opsional)** | Petugas di lokasi | Tandai booking "sudah datang/bayar" |

> Catatan: Untuk MVP, pelanggan **tidak perlu registrasi/login** — cukup isi nama & nomor WhatsApp saat booking. Ini menurunkan friction secara signifikan.

---

## 3. Alur Bisnis (User Flow)

```
1. User buka website
      │
2. Pilih jenis olahraga (Futsal / Badminton / Tenis Meja)
      │
3. Pilih tanggal → sistem tampilkan grid jam 07.00–23.00
      → status tiap slot: Tersedia / Terisi / Milik Sendiri (pending)
      │
4. User pilih 1 atau lebih slot jam (bisa non-berurutan)
      │
5. Klik "Lanjut Booking" → sistem HOLD slot sementara (lihat bagian 5.3)
      │
6. Isi form: Nama, No. WhatsApp, Metode Bayar (QRIS / Bayar di Tempat)
      │
   ┌──────────────┴──────────────┐
   │                             │
QRIS                      Bayar di Tempat
   │                             │
Tampilkan QR code           Booking langsung
tunggu webhook               berstatus
pembayaran sukses            "Menunggu Konfirmasi"
   │                             │
Slot → CONFIRMED             Slot → PENDING (hold sampai
   │                          jam H atau batas waktu tertentu)
   │                             │
7. Notifikasi WhatsApp/halaman sukses berisi ringkasan booking
```

---

## 4. Functional Requirements

### 4.1 Halaman Publik (User)
| ID | Requirement |
|---|---|
| FR-1 | Landing page menampilkan 3 pilihan olahraga dengan info singkat & harga/jam |
| FR-2 | Halaman jadwal: pilih tanggal (default hari ini), tampil grid 16 slot jam (07–23) |
| FR-3 | Slot yang sudah `booked`/`paid` ditandai tidak bisa diklik |
| FR-4 | User bisa pilih multiple slot (bisa tidak berurutan), total harga terhitung otomatis |
| FR-5 | Form data diri: Nama, No. WhatsApp (wajib, format divalidasi), catatan (opsional) |
| FR-6 | Pilihan metode bayar: QRIS (otomatis) atau Bayar di Tempat |
| FR-7 | Jika QRIS: tampilkan QR code dinamis + timer (mis. 10 menit), auto-update status begitu bayar sukses |
| FR-8 | Jika Bayar di Tempat: langsung buat booking status "Menunggu Konfirmasi/Unpaid", tanpa hold lama (lihat 5.3) |
| FR-9 | Halaman konfirmasi berisi ringkasan: olahraga, tanggal, jam, total, metode bayar, nomor booking |
| FR-10 | (Opsional, direkomendasikan) Kirim notifikasi WA otomatis via API (Fonnte/WA Business API) berisi bukti booking |

### 4.2 Panel Admin
| ID | Requirement |
|---|---|
| FR-11 | Login admin (email/password via Supabase Auth) |
| FR-12 | Dashboard kalender/list semua booking per cabang olahraga & tanggal |
| FR-13 | Admin bisa manual mark "Lunas" untuk booking bayar di tempat |
| FR-14 | Admin bisa cancel/block slot (misal untuk maintenance lapangan) |
| FR-15 | Admin bisa atur harga per jam, per jenis olahraga (bisa beda harga jam reguler vs prime time) |
| FR-16 | Laporan sederhana: total booking & omzet per hari/minggu/bulan |

### 4.3 Sistem/Background
| ID | Requirement |
|---|---|
| FR-17 | Auto-release slot yang berstatus "hold/pending" jika user tidak bayar QRIS dalam batas waktu |
| FR-18 | Webhook payment gateway untuk update status booking otomatis saat QRIS dibayar |
| FR-19 | Mencegah race condition — 2 user tidak boleh berhasil booking slot yang sama di waktu bersamaan |

---

## 5. Detail Penting yang Sering Terlewat (Baca Ini Baik-Baik)

### 5.1 Model Data (Skema Supabase — usulan awal)

**`venues`** (lapangan/cabang olahraga)
```
id, name, sport_type (futsal|badminton|tenis_meja), price_per_hour, is_active
```
> Jika ada beberapa lapangan fisik untuk 1 jenis olahraga (misal 3 lapangan badminton), tambahkan tabel `courts` (id, venue_id, court_name) — booking sebenarnya per **court**, bukan per sport saja. Ini penting supaya bisa scale kalau lapangan lebih dari satu.

**`courts`**
```
id, venue_id, name (contoh: "Lapangan Badminton 1")
```

**`bookings`**
```
id, court_id, booking_date, customer_name, whatsapp_number,
payment_method (qris|onsite), status (hold|pending_payment|confirmed|cancelled|expired),
total_price, created_at, expires_at
```

**`booking_slots`** (detail per jam, karena 1 booking bisa multi-jam)
```
id, booking_id, court_id, booking_date, hour_slot (07,08,...,22),
UNIQUE(court_id, booking_date, hour_slot)  ← KUNCI ANTI DOUBLE BOOKING
```

**`payments`**
```
id, booking_id, provider (midtrans/xendit/dll), qris_ref_id,
amount, status (pending|paid|failed|expired), paid_at, raw_webhook_payload
```

> **Kenapa dipisah `bookings` dan `booking_slots`?**
> Karena satu transaksi booking bisa mencakup beberapa jam (misal jam 19–21 = 2 slot), tapi statusnya harus dikelola sebagai satu kesatuan. Constraint `UNIQUE(court_id, booking_date, hour_slot)` di level database adalah pengaman utama supaya dua orang tidak bisa "memiliki" jam yang sama — ini jauh lebih aman daripada hanya mengecek di sisi aplikasi (Node.js), karena race condition tetap bisa lolos kalau hanya dicek di kode.

### 5.2 Race Condition (Dua Orang Booking Jam yang Sama Bersamaan)
Ini adalah risiko teknis paling krusial di sistem booking. Rekomendasi:
1. Gunakan **UNIQUE constraint** di database (`booking_slots`) sebagai garis pertahanan terakhir — kalau dua request masuk bersamaan, database akan menolak salah satu secara otomatis.
2. Saat user klik "Lanjut Booking", buat row `booking_slots` dengan status `hold` dalam satu **transaction** (bukan sekadar insert biasa) supaya insert-nya atomic.
3. Tangani error unique-violation di kode Node.js → tampilkan pesan "Maaf, slot ini baru saja dibooking orang lain" dan minta user pilih ulang.

### 5.3 Kapan Slot Dianggap "Terkunci"?
Ini keputusan bisnis penting yang perlu didiskusikan:
- **Opsi A (direkomendasikan):** Begitu user klik "Lanjut Booking" (masuk ke halaman isi data), slot berstatus `hold` selama misal **10–15 menit**. Kalau tidak diselesaikan (baik bayar QRIS maupun konfirmasi bayar-di-tempat), slot otomatis dilepas lagi (`expired`). Ini mencegah orang iseng "menyandera" slot tanpa niat bayar.
- **Opsi B:** Untuk metode "Bayar di Tempat", slot langsung `confirmed` tanpa hold pendek — tapi berisiko slot penuh oleh orang yang akhirnya tidak datang (no-show). Mitigasi: batasi jumlah booking bayar-di-tempat per nomor WA per hari, atau wajibkan DP kecil via QRIS.

### 5.4 Auto-Expire Hold
Karena Vercel bersifat serverless (tidak ada background worker terus-menerus), auto-release hold yang kedaluwarsa bisa dilakukan dengan:
- **Cara simpel:** saat query jadwal, filter slot yang `status=hold` dan `expires_at < now()` dianggap sebagai tersedia lagi (soft-expire secara lazy), lalu ada Vercel Cron Job (`vercel.json` → cron) yang jalan tiap 1–5 menit untuk update status jadi `expired` di database.

### 5.5 Integrasi Pembayaran QRIS
Untuk QRIS otomatis, **jangan bangun sendiri dari nol** — gunakan payment gateway yang sudah punya izin resmi (agar QRIS legal & dapat verifikasi otomatis via webhook):
- Pilihan populer di Indonesia: **Midtrans**, **Xendit**, **Tripay**, atau **Duitku** — semua sudah support QRIS dan webhook notifikasi.
- Alur: Node.js request "create QRIS charge" → dapat `qr_string`/URL gambar QR → tampilkan ke user → gateway kirim webhook ke endpoint Node.js Anda saat pembayaran sukses → update `payments.status = paid` dan `booking_slots.status = confirmed`.
- **Penting:** Selalu verifikasi signature/token webhook dari gateway (jangan percaya begitu saja payload masuk) untuk mencegah orang memalsukan notifikasi "sudah bayar".

### 5.6 Notifikasi WhatsApp
Karena data yang diminta adalah nomor WhatsApp, akan sangat meningkatkan pengalaman user jika ada auto-notifikasi konfirmasi booking. Bisa pakai API pihak ketiga seperti **Fonnte**, **Wablas**, atau resmi **WhatsApp Business Cloud API** (Meta). Ini bisa jadi fitur fase 2 jika ingin MVP lebih cepat rilis.

---

## 6. Non-Functional Requirements

| Aspek | Kebutuhan |
|---|---|
| Performa | Halaman jadwal harus load < 2 detik (grid sederhana, query ringan) |
| Ketersediaan | Uptime tinggi — Vercel + Supabase sudah cukup andal untuk skala UMKM |
| Keamanan | Validasi input di server (bukan hanya di frontend), rate-limit endpoint booking untuk cegah spam/bot |
| Skalabilitas | Skema DB dirancang agar mudah menambah lapangan/court baru tanpa ubah struktur |
| Mobile-friendly | Mayoritas user akan akses dari HP — wajib responsive |
| Audit trail | Simpan `raw_webhook_payload` dan riwayat perubahan status booking untuk keperluan investigasi jika ada komplain |

---

## 7. Tech Stack & Arsitektur (Sesuai Rencana Anda)

```
Frontend + Backend : Next.js (App Router) — di-deploy di Vercel
                      (API routes Next.js sudah cukup, tidak perlu server Node terpisah)
Database            : Supabase (Postgres) + Supabase Auth (untuk admin)
Realtime (opsional) : Supabase Realtime — agar grid jadwal auto-update
                      tanpa refresh saat slot lain dibooking orang lain
Payment             : Midtrans/Xendit (QRIS) — dipanggil dari API routes
Cron (auto-expire)  : Vercel Cron Jobs
Notifikasi WA       : Fonnte/Wablas API (fase 2)
```

**Kenapa Next.js, bukan Express murni?**
Karena Anda deploy ke Vercel, Next.js API Routes/Route Handlers lebih native untuk serverless function di Vercel dibanding Express biasa (yang butuh setup tambahan). Tapi jika Anda sudah nyaman dengan Express + Vercel serverless wrapper, itu juga tetap bisa jalan — pilihan ini murni preferensi, bukan blocker.

---

## 8. MVP Scope — Prioritas Pembangunan

**Fase 1 (MVP inti, wajib ada sebelum launch):**
1. Skema database (`venues/courts`, `bookings`, `booking_slots`, `payments`)
2. Halaman pilih olahraga → pilih tanggal → grid jam
3. Flow booking + form data diri
4. Integrasi QRIS (1 payment gateway saja dulu, misal Midtrans)
5. Auto-expire hold via Vercel Cron
6. Halaman konfirmasi booking
7. Panel admin sederhana (login, lihat list booking, mark lunas manual)

**Fase 2 (setelah MVP jalan & divalidasi user nyata):**
- Notifikasi WhatsApp otomatis
- Laporan/analytics lebih lengkap
- Multi-cabang/lokasi
- Harga dinamis (prime time vs reguler)
- Realtime update grid jadwal (Supabase Realtime)

**Fase 3 (nice-to-have):**
- Sistem membership/poin loyalitas
- Reschedule & refund self-service
- Aplikasi mobile

---

## 9. Best Practice — Ringkasan Rekomendasi

1. **Jangan andalkan validasi bentrok jadwal hanya di kode aplikasi** — selalu pasang UNIQUE constraint di database sebagai pengaman utama.
2. **Gunakan payment gateway resmi** untuk QRIS, jangan coba generate QRIS sendiri — selain soal legalitas, webhook & rekonsiliasi pembayaran jauh lebih aman dan reliable.
3. **Beri batas waktu (hold/expiry)** untuk booking yang belum dibayar, supaya slot tidak "disandera" tanpa niat bayar.
4. **Pisahkan status "booking" dan status "pembayaran"** (tabel terpisah) — satu booking bisa punya beberapa kali percobaan pembayaran (misal QR expired lalu generate ulang).
5. **Mulai tanpa sistem login untuk pelanggan** — cukup nama & WhatsApp, supaya conversion booking tinggi (kurangi friction). Login hanya untuk admin.
6. **Validasi nomor WhatsApp** dengan format yang jelas (mis. auto-format ke `62xxx`) agar notifikasi tidak gagal kirim.
7. **Log semua webhook payment mentah** (`raw_webhook_payload`) — sangat membantu saat ada dispute "saya sudah bayar tapi status masih pending".
8. **Rancang skema untuk multi-court sejak awal** walau saat ini baru 1 lapangan per olahraga — migrasi skema di kemudian hari jauh lebih menyakitkan daripada merancang sedikit lebih general dari awal.
9. **Gunakan Vercel Cron**, bukan `setTimeout` di dalam function — karena serverless function tidak "hidup" terus-menerus, `setTimeout` tidak akan reliable untuk auto-expire.

---

## 10. Langkah Simpel Memulai Development

1. **Setup project**: `create-next-app` → hubungkan ke Supabase project (buat tabel sesuai skema di bagian 5.1).
2. **Bangun halaman grid jadwal** dulu (read-only) — pastikan query "slot mana yang available" sudah benar, karena ini jantung dari seluruh sistem.
3. **Bangun flow booking + hold slot** dengan transaction & unique constraint — test dengan skenario 2 tab browser klik slot yang sama bersamaan.
4. **Integrasikan 1 payment gateway** (mulai dari sandbox/testing mode) untuk QRIS + webhook handler.
5. **Tambahkan Vercel Cron** untuk auto-expire hold yang kedaluwarsa.
6. **Bangun panel admin minimal** (login + list booking + tombol "mark lunas").
7. **Testing end-to-end**: booking QRIS sukses, booking bayar di tempat, booking gagal (expired), booking bentrok (concurrency test).
8. **Deploy ke Vercel**, uji coba nyata dengan skala kecil (1 lapangan dulu) sebelum rollout penuh.
9. Baru setelah itu tambahkan fitur fase 2 (notifikasi WA, laporan, dsb).

---

*Dokumen ini adalah draft awal dan disarankan untuk direview bersama tim/stakeholder sebelum development dimulai, terutama pada bagian keputusan bisnis di 5.3 (kapan slot dianggap terkunci) dan pemilihan payment gateway di 5.5.*
