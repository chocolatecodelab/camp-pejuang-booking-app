import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { holdBookingSchema } from '@/lib/validation';

/** POST /api/bookings/hold — create a booking hold via RPC */
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 });
  }

  const parsed = holdBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // 1. Fetch room and package for multi-occupancy validation
  const { data: room } = await supabaseAdmin
    .from('rooms')
    .select('id, capacity, active_occupancy_limit, active_occupancy_tier')
    .eq('id', input.room_id)
    .single();

  const { data: pkg } = await supabaseAdmin
    .from('pricing_packages')
    .select('id, occupancy_tier, occupancy_label, slots_consumed, duration_days')
    .eq('id', input.pricing_package_id)
    .single();

  if (!room || !pkg) {
    return NextResponse.json({ error: 'Kamar atau Paket harga tidak valid' }, { status: 400 });
  }

  // Calculate check_out
  const checkInDate = new Date(input.check_in);
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + pkg.duration_days);
  const checkOutStr = checkOutDate.toISOString().split('T')[0];

  // 2. Check active overlapping bookings
  const nowIso = new Date().toISOString();
  const { data: activeBookings } = await supabaseAdmin
    .from('bookings')
    .select('id, slots_reserved, pricing_packages(occupancy_tier)')
    .eq('room_id', input.room_id)
    .in('status', ['hold', 'pending_verification', 'confirmed'])
    .or(`hold_expires_at.gt.${nowIso},status.neq.hold`)
    .lt('check_in', checkOutStr)
    .gt('check_out', input.check_in);

  const usedSlots = (activeBookings || []).reduce((acc: number, b: any) => acc + (b.slots_reserved || 1), 0);
  const pTier = pkg.occupancy_tier || 1;
  const isPrivate = pTier === 1 || (pkg.occupancy_label && pkg.occupancy_label.toLowerCase().includes('private'));

  // Validation A: If room already has occupants, private booking is rejected
  if (usedSlots > 0 && isPrivate) {
    return NextResponse.json(
      { error: 'Kamar ini sudah memiliki penghuni sharing dan tidak dapat disewa secara privat' },
      { status: 409 }
    );
  }

  // Validation B: If room is already locked to a tier, differing tier is rejected
  if (usedSlots > 0 && room.active_occupancy_limit && pTier !== room.active_occupancy_limit) {
    return NextResponse.json(
      { error: `Tipe paket tidak sesuai. Kamar ini sudah diformat untuk ${room.active_occupancy_tier || `Sharing ${room.active_occupancy_limit} Orang`}` },
      { status: 409 }
    );
  }

  // Validation C: Capacity limit check
  const effectiveLimit = room.active_occupancy_limit || room.capacity || 1;
  const slotsToConsume = isPrivate ? (room.capacity || 1) : (pkg.slots_consumed || 1);
  if (usedSlots + slotsToConsume > effectiveLimit) {
    return NextResponse.json(
      { error: 'Kamar tidak tersedia / kuota kamar penuh untuk periode yang dipilih' },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc('create_booking_hold', {
    p_room_id: input.room_id,
    p_pricing_package_id: input.pricing_package_id,
    p_check_in: input.check_in,
    p_customer_name: input.customer_name,
    p_whatsapp: input.whatsapp_number,
    p_notes: input.notes || null,
    p_payment_type: input.payment_type,
    p_payment_channel: input.payment_channel,
    p_claimed_amount: input.claimed_amount,
    p_parent_booking_id: input.parent_booking_id || null,
  });

  if (error) {
    if (error.message.includes('room_not_available')) {
      return NextResponse.json(
        { error: 'Kamar tidak tersedia / kuota kamar penuh untuk periode yang dipilih' },
        { status: 409 }
      );
    }
    if (error.message.includes('room_already_shared')) {
      return NextResponse.json(
        { error: 'Kamar ini sudah memiliki penghuni sharing dan tidak dapat disewa secara privat' },
        { status: 409 }
      );
    }
    if (error.message.includes('tier_mismatch')) {
      return NextResponse.json(
        { error: 'Tipe paket tidak sesuai dengan format keterisian kamar yang telah terkunci' },
        { status: 409 }
      );
    }
    if (error.message.includes('invalid_pricing_package')) {
      return NextResponse.json(
        { error: 'Paket harga tidak valid' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data }, { status: 201 });
}
