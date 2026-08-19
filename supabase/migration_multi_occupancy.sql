-- ============================================================
-- Migration: Multi-Occupancy (Sharing Room & Bed Slot Capacity)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add capacity and active occupancy state to ROOMS
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS active_occupancy_limit INT,
ADD COLUMN IF NOT EXISTS active_occupancy_tier TEXT;

-- 2. Add occupancy fields to PRICING_PACKAGES
ALTER TABLE pricing_packages 
ADD COLUMN IF NOT EXISTS occupancy_tier INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS slots_consumed INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS occupancy_label TEXT;

-- 3. Add slots_reserved to BOOKINGS
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS slots_reserved INT NOT NULL DEFAULT 1;

-- 4. Drop strict 1-booking-per-room constraint on booking_locks if exists
-- (Allows multiple bookings per room as long as total slots_reserved <= capacity)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_locks_room_id_stay_period_excl'
  ) THEN
    ALTER TABLE booking_locks DROP CONSTRAINT booking_locks_room_id_stay_period_excl;
  END IF;
END $$;

-- 5. Updated RPC for multi-occupancy hold creation
CREATE OR REPLACE FUNCTION create_booking_hold(
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
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings;
  v_package pricing_packages;
  v_room rooms;
  v_code text;
  v_check_out date;
  v_used_slots int;
  v_slots_consumed int;
  v_effective_limit int;
BEGIN
  -- Fetch package
  SELECT * INTO v_package FROM pricing_packages WHERE id = p_pricing_package_id;
  IF v_package IS NULL THEN
    RAISE EXCEPTION 'invalid_pricing_package';
  END IF;

  -- Fetch room
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN
    RAISE EXCEPTION 'invalid_room';
  END IF;

  v_check_out := p_check_in + v_package.duration_days;
  v_slots_consumed := COALESCE(v_package.slots_consumed, 1);

  -- Calculate existing occupied slots for overlapping active bookings
  SELECT COALESCE(SUM(COALESCE(b.slots_reserved, 1)), 0) INTO v_used_slots
  FROM bookings b
  WHERE b.room_id = p_room_id
    AND b.status IN ('hold', 'pending_verification', 'confirmed')
    AND (b.status != 'hold' OR b.hold_expires_at > NOW())
    AND b.check_in < v_check_out
    AND b.check_out > p_check_in;

  -- Determine effective occupancy limit
  v_effective_limit := COALESCE(v_room.active_occupancy_limit, v_room.capacity, 1);

  IF (v_used_slots + v_slots_consumed) > v_effective_limit THEN
    RAISE EXCEPTION 'room_not_available';
  END IF;

  -- Generate booking code: CP-MMDD-XXXX
  v_code := 'CP-' || to_char(NOW(),'MMDD') || '-' || upper(substr(md5(random()::text),1,4));

  INSERT INTO bookings (
    booking_code, room_id, pricing_package_id, parent_booking_id, slots_reserved,
    customer_name, whatsapp_number, notes,
    check_in, check_out,
    payment_type, payment_channel, claimed_amount, total_price,
    status, hold_expires_at
  ) VALUES (
    v_code,
    p_room_id, p_pricing_package_id, p_parent_booking_id, v_slots_consumed,
    p_customer_name, p_whatsapp, p_notes,
    p_check_in, v_check_out,
    p_payment_type, p_payment_channel, p_claimed_amount, v_package.price,
    'hold', NOW() + INTERVAL '24 hours'
  ) RETURNING * INTO v_booking;

  -- Insert into booking_locks
  INSERT INTO booking_locks (booking_id, room_id, stay_period)
  VALUES (v_booking.id, p_room_id, daterange(v_booking.check_in, v_booking.check_out, '[)'));

  -- Lock active occupancy tier on room if this is the first occupant
  IF v_used_slots = 0 THEN
    UPDATE rooms
    SET active_occupancy_limit = (
      CASE 
        WHEN v_slots_consumed >= v_room.capacity THEN v_room.capacity 
        ELSE COALESCE(v_package.occupancy_tier, v_room.capacity) 
      END
    ),
    active_occupancy_tier = v_package.occupancy_label
    WHERE id = p_room_id;
  END IF;

  INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by)
  VALUES (v_booking.id, NULL, 'hold', 'system');

  RETURN jsonb_build_object(
    'id', v_booking.id,
    'booking_code', v_booking.booking_code,
    'check_in', v_booking.check_in,
    'check_out', v_booking.check_out,
    'total_price', v_booking.total_price,
    'hold_expires_at', v_booking.hold_expires_at,
    'status', v_booking.status
  );
END;
$$;
