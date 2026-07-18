-- ============================================================
-- SQL Migration: Add Unique Code, Payment Proof Column, and Storage Setup
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Add new columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unique_code INT DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- 2. Create Storage Bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Security Policies (Allow anonymous uploads & public reads)
-- Drop existing policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete" ON storage.objects;

CREATE POLICY "Allow public upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs');

CREATE POLICY "Allow public delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'payment-proofs');
