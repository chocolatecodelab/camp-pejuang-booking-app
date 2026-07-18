-- ============================================================
-- ActiveGrid Database Schema — Full Migration
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- ========================
-- 1. VENUES (Jenis Olahraga)
-- ========================
CREATE TABLE IF NOT EXISTS venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_type TEXT NOT NULL CHECK (sport_type IN ('badminton', 'futsal', 'tenis-meja')),
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'sports',
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- 2. COURTS (Lapangan Fisik)
-- ========================
CREATE TABLE IF NOT EXISTS courts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  badge TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- 3. SPORT PRICES (Harga per Olahraga)
-- ========================
CREATE TABLE IF NOT EXISTS sport_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_type TEXT NOT NULL UNIQUE CHECK (sport_type IN ('badminton', 'futsal', 'tenis-meja')),
  base_price INT NOT NULL DEFAULT 50000,
  peak_hour_extra INT NOT NULL DEFAULT 10000,
  peak_hour_start INT NOT NULL DEFAULT 18,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- 4. BOOKINGS (Transaksi Booking)
-- ========================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_code TEXT NOT NULL UNIQUE,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  sport_type TEXT NOT NULL,
  booking_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  notes TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('qris', 'onsite')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('hold', 'pending', 'confirmed', 'cancelled', 'expired', 'maintenance')),
  total_price INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

-- ========================
-- 5. BOOKING SLOTS (Detail Jam per Booking)
-- ========================
CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  booking_date DATE NOT NULL,
  hour_slot TEXT NOT NULL,
  UNIQUE(court_id, booking_date, hour_slot)
);

-- ========================
-- 6. INDEXES
-- ========================
CREATE INDEX IF NOT EXISTS idx_bookings_court_date ON bookings(court_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_sport ON bookings(sport_type);
CREATE INDEX IF NOT EXISTS idx_booking_slots_lookup ON booking_slots(court_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_courts_venue ON courts(venue_id);

-- ========================
-- 7. RLS (Row Level Security)
-- ========================
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;

-- Public access policies for MVP (tighten in production with auth)
CREATE POLICY "Public read venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Public manage venues" ON venues FOR ALL USING (true);
CREATE POLICY "Public read courts" ON courts FOR SELECT USING (true);
CREATE POLICY "Public manage courts" ON courts FOR ALL USING (true);
CREATE POLICY "Public read prices" ON sport_prices FOR SELECT USING (true);
CREATE POLICY "Public manage prices" ON sport_prices FOR ALL USING (true);
CREATE POLICY "Public read bookings" ON bookings FOR SELECT USING (true);
CREATE POLICY "Public insert bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update bookings" ON bookings FOR UPDATE USING (true);
CREATE POLICY "Public delete bookings" ON bookings FOR DELETE USING (true);
CREATE POLICY "Public read slots" ON booking_slots FOR SELECT USING (true);
CREATE POLICY "Public insert slots" ON booking_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public manage slots" ON booking_slots FOR ALL USING (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Venues
INSERT INTO venues (sport_type, name, icon, description, image_url) VALUES
  ('badminton', 'Badminton', 'sports_tennis', 'Lantai karpet karet premium, sirkulasi udara baik, dan plafon tinggi.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCAg9OnmdBLJR9hP-XsotH_xM55fHLox9I2AJS30sX7Vt3_uMejkOfxar9mBFG7wX5Aqfe1I6HFhnvQtJSP5mHffUGaL2lzaq3DNuzbY52wJGbyZzIXQh_cvawpP-vVmcgZG2HSLZGnowxGcZeMj_8HrhhfS8XW9yfDZMtQ3mnWFzocpn8D8m0aGu-iH9TO5EYvJ-if819G8LvR27AbglzqaQSIUP-fr00Rl18p_ctw06xuRtEqqlH2GA'),
  ('futsal', 'Futsal', 'sports_soccer', 'Lapangan vinyl standar internasional dengan pencahayaan optimal.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDulY5_FBWFL5ELo-M3PEGZFKUvac347E2nG4NI3ne5mVOfNt-hXIFjbZS_5x2dEHrPD-ZSCtMeJw4V7hC6HzK9lLTyMZnt_eoXYezOCXBamxXpcFK4fOIQS-BNxJrUFSHivnlsxCgY6PgskHFufQ2E7QzsfX0P9i-ZxMRnVRh5IDRwixJaxGd3iTveRXxw8e6QE602Gj4i_otu4727fDqMxXoSElsr_SYotQZzySk0_-c5EQ7e2rcV2A'),
  ('tenis-meja', 'Tenis Meja', 'table', 'Meja standar ITTF dengan ruang gerak luas dan lantai anti-slip.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbzCY-LTxxYDxpRKDK6ISyB_lRJk29h_IE6xJXretPssbc-YCTKDmz6x6hRE-D2DiyKf5c8n-FOYHUBVO2w94S_E4uBojYcToFjME9v3oMIFi5aWNghtuQXIygSSlcN9lmOxpWbOb7A9sWQ2s1EQBSkZ2Mu7cTOo02FeTQNd-lO1NIJzNb-DKXB-KGSfgTQIgBSHhelq7KBN2cOq3LgGH8mC-aI8p5MvpsuWB6bEqj3Tnsc1-PNv2QEQ');

-- Courts (Badminton)
INSERT INTO courts (venue_id, name, badge, description, image_url, sort_order) VALUES
  ((SELECT id FROM venues WHERE sport_type='badminton'), 'Lapangan 1: Court Premium', 'PRO ARENA QUALITY', 'Lantai vinyl bersertifikat BWF dengan pencahayaan anti-glare.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCAg9OnmdBLJR9hP-XsotH_xM55fHLox9I2AJS30sX7Vt3_uMejkOfxar9mBFG7wX5Aqfe1I6HFhnvQtJSP5mHffUGaL2lzaq3DNuzbY52wJGbyZzIXQh_cvawpP-vVmcgZG2HSLZGnowxGcZeMj_8HrhhfS8XW9yfDZMtQ3mnWFzocpn8D8m0aGu-iH9TO5EYvJ-if819G8LvR27AbglzqaQSIUP-fr00Rl18p_ctw06xuRtEqqlH2GA', 1),
  ((SELECT id FROM venues WHERE sport_type='badminton'), 'Lapangan 2: Court Standard A', 'BWF APPROVED', 'Lantai karpet interlock standar nasional, sirkulasi udara sangat baik.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCAg9OnmdBLJR9hP-XsotH_xM55fHLox9I2AJS30sX7Vt3_uMejkOfxar9mBFG7wX5Aqfe1I6HFhnvQtJSP5mHffUGaL2lzaq3DNuzbY52wJGbyZzIXQh_cvawpP-vVmcgZG2HSLZGnowxGcZeMj_8HrhhfS8XW9yfDZMtQ3mnWFzocpn8D8m0aGu-iH9TO5EYvJ-if819G8LvR27AbglzqaQSIUP-fr00Rl18p_ctw06xuRtEqqlH2GA', 2),
  ((SELECT id FROM venues WHERE sport_type='badminton'), 'Lapangan 3: Court Standard B', 'COMFORT GRIP', 'Lantai karpet kayu karet premium, letak dekat dengan area tribun penonton.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCAg9OnmdBLJR9hP-XsotH_xM55fHLox9I2AJS30sX7Vt3_uMejkOfxar9mBFG7wX5Aqfe1I6HFhnvQtJSP5mHffUGaL2lzaq3DNuzbY52wJGbyZzIXQh_cvawpP-vVmcgZG2HSLZGnowxGcZeMj_8HrhhfS8XW9yfDZMtQ3mnWFzocpn8D8m0aGu-iH9TO5EYvJ-if819G8LvR27AbglzqaQSIUP-fr00Rl18p_ctw06xuRtEqqlH2GA', 3);

-- Courts (Futsal)
INSERT INTO courts (venue_id, name, badge, description, image_url, sort_order) VALUES
  ((SELECT id FROM venues WHERE sport_type='futsal'), 'Lapangan 1: Synthetic Turf Premium', 'PRO ARENA QUALITY', 'Rumput sintetis monofilament tebal standar FIFA dengan sirkulasi udara optimal.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDulY5_FBWFL5ELo-M3PEGZFKUvac347E2nG4NI3ne5mVOfNt-hXIFjbZS_5x2dEHrPD-ZSCtMeJw4V7hC6HzK9lLTyMZnt_eoXYezOCXBamxXpcFK4fOIQS-BNxJrUFSHivnlsxCgY6PgskHFufQ2E7QzsfX0P9i-ZxMRnVRh5IDRwixJaxGd3iTveRXxw8e6QE602Gj4i_otu4727fDqMxXoSElsr_SYotQZzySk0_-c5EQ7e2rcV2A', 1),
  ((SELECT id FROM venues WHERE sport_type='futsal'), 'Lapangan 2: Standard Synthetic', 'EXCELLENT GRIP', 'Rumput sintetis dengan peredaman kejut maksimal untuk melindungi sendi pemain.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDulY5_FBWFL5ELo-M3PEGZFKUvac347E2nG4NI3ne5mVOfNt-hXIFjbZS_5x2dEHrPD-ZSCtMeJw4V7hC6HzK9lLTyMZnt_eoXYezOCXBamxXpcFK4fOIQS-BNxJrUFSHivnlsxCgY6PgskHFufQ2E7QzsfX0P9i-ZxMRnVRh5IDRwixJaxGd3iTveRXxw8e6QE602Gj4i_otu4727fDqMxXoSElsr_SYotQZzySk0_-c5EQ7e2rcV2A', 2),
  ((SELECT id FROM venues WHERE sport_type='futsal'), 'Lapangan 3: Vinyl Tournament Court', 'FAST PACED', 'Lantai vinyl datar berukuran standar kompetisi nasional untuk pergerakan bola lebih cepat.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDulY5_FBWFL5ELo-M3PEGZFKUvac347E2nG4NI3ne5mVOfNt-hXIFjbZS_5x2dEHrPD-ZSCtMeJw4V7hC6HzK9lLTyMZnt_eoXYezOCXBamxXpcFK4fOIQS-BNxJrUFSHivnlsxCgY6PgskHFufQ2E7QzsfX0P9i-ZxMRnVRh5IDRwixJaxGd3iTveRXxw8e6QE602Gj4i_otu4727fDqMxXoSElsr_SYotQZzySk0_-c5EQ7e2rcV2A', 3);

-- Courts (Tenis Meja)
INSERT INTO courts (venue_id, name, badge, description, image_url, sort_order) VALUES
  ((SELECT id FROM venues WHERE sport_type='tenis-meja'), 'Meja Pro 1: ITTF Certified', 'PRO ARENA QUALITY', 'Meja standar ITTF 25mm dengan ruang gerak luas 14m x 7m.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbzCY-LTxxYDxpRKDK6ISyB_lRJk29h_IE6xJXretPssbc-YCTKDmz6x6hRE-D2DiyKf5c8n-FOYHUBVO2w94S_E4uBojYcToFjME9v3oMIFi5aWNghtuQXIygSSlcN9lmOxpWbOb7A9sWQ2s1EQBSkZ2Mu7cTOo02FeTQNd-lO1NIJzNb-DKXB-KGSfgTQIgBSHhelq7KBN2cOq3LgGH8mC-aI8p5MvpsuWB6bEqj3Tnsc1-PNv2QEQ', 1),
  ((SELECT id FROM venues WHERE sport_type='tenis-meja'), 'Meja Pro 2: Double Fish', 'TOURNAMENT TABLE', 'Meja standar ITTF 25mm, pencahayaan vertikal anti silau terdedikasi.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbzCY-LTxxYDxpRKDK6ISyB_lRJk29h_IE6xJXretPssbc-YCTKDmz6x6hRE-D2DiyKf5c8n-FOYHUBVO2w94S_E4uBojYcToFjME9v3oMIFi5aWNghtuQXIygSSlcN9lmOxpWbOb7A9sWQ2s1EQBSkZ2Mu7cTOo02FeTQNd-lO1NIJzNb-DKXB-KGSfgTQIgBSHhelq7KBN2cOq3LgGH8mC-aI8p5MvpsuWB6bEqj3Tnsc1-PNv2QEQ', 2),
  ((SELECT id FROM venues WHERE sport_type='tenis-meja'), 'Meja Standard 3: Training Table', 'SPACIOUS AREA', 'Meja latihan premium dengan pembatas jaring di sekeliling area meja.', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbzCY-LTxxYDxpRKDK6ISyB_lRJk29h_IE6xJXretPssbc-YCTKDmz6x6hRE-D2DiyKf5c8n-FOYHUBVO2w94S_E4uBojYcToFjME9v3oMIFi5aWNghtuQXIygSSlcN9lmOxpWbOb7A9sWQ2s1EQBSkZ2Mu7cTOo02FeTQNd-lO1NIJzNb-DKXB-KGSfgTQIgBSHhelq7KBN2cOq3LgGH8mC-aI8p5MvpsuWB6bEqj3Tnsc1-PNv2QEQ', 3);

-- Sport Prices
INSERT INTO sport_prices (sport_type, base_price, peak_hour_extra, peak_hour_start) VALUES
  ('badminton', 50000, 10000, 18),
  ('futsal', 50000, 15000, 18),
  ('tenis-meja', 50000, 5000, 18);
