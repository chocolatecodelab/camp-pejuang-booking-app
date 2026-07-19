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

  // 1. Fetch current booking details
  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from('bookings')
    .select('id, room_id, check_in, check_out, status')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  // If room is the same, no action needed
  if (booking.room_id === newRoomId) {
    return NextResponse.json({ success: true, message: 'Kamar tidak berubah' });
  }

  // 2. Check availability of the new room during the stay period (excluding current booking locks!)
  const { data: conflictingLocks, error: lockErr } = await supabaseAdmin
    .from('booking_locks')
    .select('id')
    .eq('room_id', newRoomId)
    .neq('booking_id', bookingId)
    .filter('stay_period', 'ov', `[${booking.check_in},${booking.check_out})`);

  if (lockErr) {
    return NextResponse.json({ error: lockErr.message }, { status: 500 });
  }

  if (conflictingLocks && conflictingLocks.length > 0) {
    return NextResponse.json(
      { error: 'Kamar baru tidak tersedia (sudah di-book oleh pengguna lain pada periode tersebut)' },
      { status: 400 }
    );
  }

  // 3. Update the booking's room_id
  const { error: updateBookingErr } = await supabaseAdmin
    .from('bookings')
    .update({ room_id: newRoomId, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (updateBookingErr) {
    return NextResponse.json({ error: updateBookingErr.message }, { status: 500 });
  }

  // 4. Update the corresponding booking lock's room_id
  const { error: updateLockErr } = await supabaseAdmin
    .from('booking_locks')
    .update({ room_id: newRoomId })
    .eq('booking_id', bookingId);

  if (updateLockErr) {
    return NextResponse.json({ error: updateLockErr.message }, { status: 500 });
  }

  // 5. Log change history
  await supabaseAdmin.from('booking_status_history').insert({
    booking_id: bookingId,
    old_status: booking.status,
    new_status: booking.status,
    changed_by: 'admin',
    reason: `Pindah kamar dari Room ID ${booking.room_id} ke Room ID ${newRoomId}`,
  });

  return NextResponse.json({ success: true });
}
