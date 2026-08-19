-- ============================================================
-- Camp Pejuang Booking App — Full Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Wajib untuk EXCLUDE constraint berbasis range tanggal
create extension if not exists btree_gist;

-- ========================
-- ENUM Types
-- ========================
create type camp_type as enum ('putra', 'putri', 'campuran');
create type booking_status as enum (
  'hold',                 -- baru pilih kamar, belum upload bukti
  'pending_verification', -- sudah upload bukti, menunggu admin
  'confirmed',            -- disetujui admin
  'completed',            -- sewa selesai / check-out awal oleh admin
  'rejected',             -- ditolak admin
  'expired',              -- hold kedaluwarsa, tidak upload bukti
  'cancelled'             -- dibatalkan admin setelah confirmed
);
create type payment_type as enum ('dp', 'full');
create type payment_channel as enum ('qris', 'transfer_bank');

-- ========================
-- 1. CAMPS
-- ========================
create table camps (
  id uuid primary key default gen_random_uuid(),
  name text not null,                      -- "Camp UB (3)"
  slug text not null unique,                -- "camp-3-putra"
  type camp_type not null,
  address text not null,
  description text,
  facilities text[],                        -- ['Wi-Fi Cepat','Dapur Umum','Air Minum']
  cover_photo_url text,
  youtube_video_url text,
  gallery_photo_urls text[],
  latitude numeric(10,7),
  longitude numeric(10,7),
  extension_window_days int not null default 7,
  extension_response_hours int not null default 72,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ========================
-- 2. ROOMS (1 kamar = 1 penghuni)
-- ========================
create table rooms (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references camps(id) on delete cascade,
  name text not null,                      -- "Kamar 1"
  floor_label text,                        -- "Lantai 1"
  capacity int not null default 1,         -- Kapasitas bed kamar (1, 2, 3, 4, dll)
  active_occupancy_limit int,              -- Limit keterisian saat kamar sedang terisi
  active_occupancy_tier text,             -- Tipe keterisian aktif (sharing_3, sharing_2, private)
  room_photo_urls text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ========================
-- 3. PRICING PACKAGES (harga per kombinasi kamar + durasi + keterisian)
-- ========================
create table pricing_packages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  label text not null,                     -- "2 Minggu" | "1 Bulan" | "3 Bulan"
  occupancy_label text,                    -- "Sharing 3 Orang" | "Sharing 2 Orang" | "Private Sendiri"
  occupancy_tier int not null default 1,   -- 1 = Private, 2 = Sharing 2, 3 = Sharing 3
  slots_consumed int not null default 1,   -- Slot bed yang dikonsumsi (1 untuk sharing, capacity untuk private)
  duration_days int not null,              -- 14 | 30 | 90
  price numeric(12,2) not null,
  min_dp_amount numeric(12,2),             -- nominal DP minimum (nullable jika wajib full)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ========================
-- 4. BOOKINGS
-- ========================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,       -- "CP-0719-7XQ2"
  room_id uuid not null references rooms(id),
  pricing_package_id uuid references pricing_packages(id),
  parent_booking_id uuid references bookings(id),
  slots_reserved int not null default 1,   -- Slot bed yang dipesan (biasanya 1)

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
  claimed_amount numeric(12,2) not null,
  total_price numeric(12,2) not null,

  status booking_status not null default 'hold',
  hold_expires_at timestamptz,

  extension_offer_expires_at timestamptz,

  rejected_reason text,
  cancelled_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_dates check (check_out > check_in)
);

-- ========================
-- 5. BOOKING LOCKS (anti-tabrakan kamar)
-- ========================
create table booking_locks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  room_id uuid not null references rooms(id),
  stay_period daterange not null,
  exclude using gist (room_id with =, stay_period with &&)
);

-- ========================
-- 6. PAYMENT PROOFS (riwayat upload bukti bayar)
-- ========================
create table payment_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

-- ========================
-- 7. BOOKING STATUS HISTORY (audit trail)
-- ========================
create table booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  old_status booking_status,
  new_status booking_status not null,
  changed_by text,
  reason text,
  changed_at timestamptz not null default now()
);

-- ========================
-- 8. ADMIN PROFILES
-- ========================
create table admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'admin'
);

-- ========================
-- 9. SYSTEM SETTINGS (QRIS, rekening, WhatsApp admin)
-- ========================
create table system_settings (
  id int primary key default 1 check (id = 1),
  admin_whatsapp text not null default '6281234567890',
  qris_image_url text,
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  is_qris_active boolean not null default true,
  is_bank_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ========================
-- INDEXES
-- ========================
create index idx_rooms_camp on rooms (camp_id) where is_active = true;
create index idx_pricing_room on pricing_packages (room_id) where is_active = true;
create index idx_bookings_status_hold on bookings (status, hold_expires_at) where status = 'hold';
create index idx_bookings_status_ext on bookings (status, check_out, extension_offer_expires_at) where status = 'confirmed';
create index idx_bookings_code on bookings (booking_code);
create index idx_bookings_room_period on bookings using gist (room_id, stay_period);
create index idx_payment_proofs_booking on payment_proofs (booking_id);

-- ========================
-- ROW LEVEL SECURITY
-- ========================
alter table camps enable row level security;
alter table rooms enable row level security;
alter table pricing_packages enable row level security;
alter table bookings enable row level security;
alter table booking_locks enable row level security;
alter table payment_proofs enable row level security;
alter table booking_status_history enable row level security;
alter table system_settings enable row level security;

-- Public read policies
create policy "public read active camps" on camps for select using (is_active = true);
create policy "public read active rooms" on rooms for select using (is_active = true);
create policy "public read active pricing" on pricing_packages for select using (is_active = true);
create policy "public read locks" on booking_locks for select using (true);
create policy "public read settings" on system_settings for select using (true);

-- Admin full access policies (authenticated users)
create policy "admin all camps" on camps for all using (auth.role() = 'authenticated');
create policy "admin all rooms" on rooms for all using (auth.role() = 'authenticated');
create policy "admin all pricing" on pricing_packages for all using (auth.role() = 'authenticated');
create policy "admin all bookings" on bookings for all using (auth.role() = 'authenticated');
create policy "admin all locks" on booking_locks for all using (auth.role() = 'authenticated');
create policy "admin all proofs" on payment_proofs for all using (auth.role() = 'authenticated');
create policy "admin all history" on booking_status_history for all using (auth.role() = 'authenticated');
create policy "admin all settings" on system_settings for all using (auth.role() = 'authenticated');

-- ========================
-- RPC: CREATE BOOKING HOLD (atomic)
-- ========================
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
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking bookings;
  v_package pricing_packages;
  v_code text;
begin
  select * into v_package from pricing_packages where id = p_pricing_package_id;
  if v_package is null then
    raise exception 'invalid_pricing_package';
  end if;

  -- Generate booking code: CP-MMDD-XXXX
  v_code := 'CP-' || to_char(now(),'MMDD') || '-' || upper(substr(md5(random()::text),1,4));

  insert into bookings (
    booking_code, room_id, pricing_package_id, parent_booking_id,
    customer_name, whatsapp_number, notes,
    check_in, check_out,
    payment_type, payment_channel, claimed_amount, total_price,
    status, hold_expires_at
  ) values (
    v_code,
    p_room_id, p_pricing_package_id, p_parent_booking_id,
    p_customer_name, p_whatsapp, p_notes,
    p_check_in, p_check_in + v_package.duration_days,
    p_payment_type, p_payment_channel, p_claimed_amount, v_package.price,
    'hold', now() + interval '24 hours'
  ) returning * into v_booking;

  -- This will fail automatically if EXCLUDE constraint is violated
  insert into booking_locks (booking_id, room_id, stay_period)
  values (v_booking.id, p_room_id, daterange(v_booking.check_in, v_booking.check_out, '[)'));

  insert into booking_status_history (booking_id, old_status, new_status, changed_by)
  values (v_booking.id, null, 'hold', 'system');

  return jsonb_build_object(
    'id', v_booking.id,
    'booking_code', v_booking.booking_code,
    'check_in', v_booking.check_in,
    'check_out', v_booking.check_out,
    'total_price', v_booking.total_price,
    'hold_expires_at', v_booking.hold_expires_at,
    'status', v_booking.status
  );
exception
  when exclusion_violation then
    raise exception 'room_not_available';
end;
$$;

-- ========================
-- SEED DATA
-- ========================

-- System settings
insert into system_settings (admin_whatsapp) values ('6281234567890');

-- Camp 1: Camp Putra
insert into camps (name, slug, type, address, description, facilities, cover_photo_url)
values (
  'Camp Pejuang Putra 1',
  'camp-putra-1',
  'putra',
  'Jl. Brawijaya No. 10, Pare, Kediri',
  'Camp putra nyaman dengan fasilitas lengkap, lokasi strategis dekat lembaga kursus populer di Kampung Inggris Pare.',
  ARRAY['Wi-Fi Cepat', 'Dapur Umum', 'Air Minum Gratis', 'Laundry', 'Parkir Motor', 'Kamar Mandi Dalam'],
  null
);

-- Rooms for Camp 1
insert into rooms (camp_id, name, floor_label) values
  ((select id from camps where slug = 'camp-putra-1'), 'Kamar 1', 'Lantai 1'),
  ((select id from camps where slug = 'camp-putra-1'), 'Kamar 2', 'Lantai 1'),
  ((select id from camps where slug = 'camp-putra-1'), 'Kamar 3', 'Lantai 1'),
  ((select id from camps where slug = 'camp-putra-1'), 'Kamar 4', 'Lantai 2'),
  ((select id from camps where slug = 'camp-putra-1'), 'Kamar 5', 'Lantai 2'),
  ((select id from camps where slug = 'camp-putra-1'), 'Kamar 6', 'Lantai 2');

-- Pricing packages for each room in Camp 1
insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '2 Minggu', 14, 200000.00, 100000.00, 1
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putra-1';

insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '1 Bulan', 30, 350000.00, 150000.00, 2
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putra-1';

insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '2 Bulan', 60, 650000.00, 200000.00, 3
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putra-1';

insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '3 Bulan', 90, 900000.00, 300000.00, 4
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putra-1';

-- Camp 2: Camp Putri
insert into camps (name, slug, type, address, description, facilities, cover_photo_url)
values (
  'Camp Pejuang Putri 1',
  'camp-putri-1',
  'putri',
  'Jl. Anyelir No. 5, Pare, Kediri',
  'Camp putri eksklusif dengan keamanan 24 jam, lingkungan bersih dan tenang, ideal untuk fokus belajar bahasa Inggris.',
  ARRAY['Wi-Fi Cepat', 'Dapur Umum', 'Air Minum Gratis', 'Laundry', 'Keamanan 24 Jam', 'Kamar Mandi Dalam', 'Taman'],
  null
);

-- Rooms for Camp 2
insert into rooms (camp_id, name, floor_label) values
  ((select id from camps where slug = 'camp-putri-1'), 'Kamar 1', 'Lantai 1'),
  ((select id from camps where slug = 'camp-putri-1'), 'Kamar 2', 'Lantai 1'),
  ((select id from camps where slug = 'camp-putri-1'), 'Kamar 3', 'Lantai 1'),
  ((select id from camps where slug = 'camp-putri-1'), 'Kamar 4', 'Lantai 2'),
  ((select id from camps where slug = 'camp-putri-1'), 'Kamar 5', 'Lantai 2');

-- Pricing packages for Camp 2
insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '2 Minggu', 14, 250000.00, 125000.00, 1
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putri-1';

insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '1 Bulan', 30, 400000.00, 175000.00, 2
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putri-1';

insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '2 Bulan', 60, 750000.00, 250000.00, 3
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putri-1';

insert into pricing_packages (room_id, label, duration_days, price, min_dp_amount, sort_order)
select r.id, '3 Bulan', 90, 1050000.00, 350000.00, 4
from rooms r join camps c on r.camp_id = c.id where c.slug = 'camp-putri-1';
