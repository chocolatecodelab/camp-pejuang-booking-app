import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPaymentProofSignedUrl } from '@/lib/storage';

/** GET /api/admin/bookings/[id] — booking detail with signed proof URLs */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      *,
      rooms (
        id, name, floor_label,
        camps (id, name, slug, type, address)
      ),
      pricing_packages (id, label, duration_days, price, min_dp_amount),
      payment_proofs (id, file_path, file_type, uploaded_at),
      booking_status_history (
        id, old_status, new_status, changed_by, reason, changed_at
      )
    `)
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  // Generate signed URLs for payment proofs
  const proofs = (booking as any).payment_proofs || [];
  const proofsWithUrls = await Promise.all(
    proofs.map(async (proof: any) => {
      try {
        const signedUrl = await getPaymentProofSignedUrl(proof.file_path);
        return { ...proof, signed_url: signedUrl };
      } catch {
        return { ...proof, signed_url: null };
      }
    })
  );

  return NextResponse.json({
    ...booking,
    payment_proofs: proofsWithUrls,
    booking_status_history: ((booking as any).booking_status_history || []).sort(
      (a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    ),
  });
}

/** PATCH /api/admin/bookings/[id] — update booking details (e.g. reassign/change room) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const body = await request.json().catch(() => ({}));
  const { room_id: newRoomId } = body;

  if (!newRoomId) {
    return NextResponse.json({ error: 'Kamar baru wajib ditentukan' }, { status: 400 });
  }

  // 1. Fetch current booking details with package info
  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select(`
      id, room_id, pricing_package_id, slots_reserved, check_in, check_out, status,
      rooms (id, name),
      pricing_packages (id, label, occupancy_label, occupancy_tier, slots_consumed)
    `)
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  const oldRoomId = booking.room_id;

  // If room is the same, no action needed
  if (oldRoomId === newRoomId) {
    return NextResponse.json({ success: true, message: 'Kamar tidak berubah' });
  }

  // 2. Fetch new target room details
  const { data: newRoom, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, name, capacity, active_occupancy_limit, active_occupancy_tier')
    .eq('id', newRoomId)
    .single();

  if (roomErr || !newRoom) {
    return NextResponse.json({ error: 'Kamar tujuan tidak ditemukan' }, { status: 404 });
  }

  // 3. Check overlapping active bookings in the new target room
  const nowIso = new Date().toISOString();
  const { data: targetBookings, error: targetErr } = await supabaseAdmin
    .from('bookings')
    .select('id, slots_reserved')
    .eq('room_id', newRoomId)
    .neq('id', bookingId)
    .in('status', ['hold', 'pending_verification', 'confirmed'])
    .or(`hold_expires_at.gt.${nowIso},status.neq.hold`)
    .lt('check_in', booking.check_out)
    .gt('check_out', booking.check_in);

  if (targetErr) {
    return NextResponse.json({ error: targetErr.message }, { status: 500 });
  }

  const usedSlots = (targetBookings || []).reduce((acc: number, b: any) => acc + (b.slots_reserved || 1), 0);
  const slotsToMove = (booking as any).slots_reserved || (booking as any).pricing_packages?.slots_consumed || 1;
  const capacity = newRoom.capacity || 1;

  if (usedSlots + slotsToMove > capacity) {
    return NextResponse.json(
      { error: `Kamar tujuan penuh/tidak cukup kuota (Kapasitas: ${capacity} Orang, Sudah Terisi: ${usedSlots} Orang)` },
      { status: 400 }
    );
  }

  // 4. Update the booking's room_id
  const { error: updateBookingErr } = await supabaseAdmin
    .from('bookings')
    .update({ room_id: newRoomId, updated_at: nowIso })
    .eq('id', bookingId);

  if (updateBookingErr) {
    return NextResponse.json({ error: updateBookingErr.message }, { status: 500 });
  }

  // 5. Update corresponding booking lock's room_id
  await supabaseAdmin
    .from('booking_locks')
    .update({ room_id: newRoomId })
    .eq('booking_id', bookingId);

  // 6. Update target room tier if it was empty
  if (usedSlots === 0) {
    const pkg = (booking as any).pricing_packages;
    await supabaseAdmin
      .from('rooms')
      .update({
        active_occupancy_limit: pkg?.occupancy_tier || capacity,
        active_occupancy_tier: pkg?.occupancy_label || pkg?.label || 'Sharing',
      })
      .eq('id', newRoomId);
  }

  // 7. Check if source room is now completely empty, if so reset its lock tier
  const { data: remainingSourceBookings } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('room_id', oldRoomId)
    .neq('id', bookingId)
    .in('status', ['hold', 'pending_verification', 'confirmed'])
    .or(`hold_expires_at.gt.${nowIso},status.neq.hold`);

  if (!remainingSourceBookings || remainingSourceBookings.length === 0) {
    await supabaseAdmin
      .from('rooms')
      .update({
        active_occupancy_limit: null,
        active_occupancy_tier: null,
      })
      .eq('id', oldRoomId);
  }

  // 8. Log change history
  const oldRoomName = (booking as any).rooms?.name || oldRoomId;
  await supabaseAdmin.from('booking_status_history').insert({
    booking_id: bookingId,
    old_status: booking.status,
    new_status: booking.status,
    changed_by: 'admin',
    reason: `Pindah kamar dari ${oldRoomName} ke ${newRoom.name}`,
  });

  return NextResponse.json({
    success: true,
    message: `Berhasil memindahkan pemesan ke ${newRoom.name}`,
  });
}
