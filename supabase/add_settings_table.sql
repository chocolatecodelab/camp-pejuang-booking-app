-- ============================================================
-- SQL Migration: Create System Settings Table & Storage Policies
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Create system_settings table (Enforced single-row table)
CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  admin_whatsapp TEXT NOT NULL DEFAULT '6281234567890',
  qris_image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_single_row CHECK (id = 1)
);

-- 2. Insert default settings seed row
INSERT INTO system_settings (id, admin_whatsapp, qris_image_url)
VALUES (1, '6281234567890', null)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 4. Set Policies
DROP POLICY IF EXISTS "Public read settings" ON system_settings;
DROP POLICY IF EXISTS "Manage settings" ON system_settings;

CREATE POLICY "Public read settings" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Manage settings" ON system_settings
  FOR ALL USING (true);
