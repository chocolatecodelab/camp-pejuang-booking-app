import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { rejectBookingSchema } from '@/lib/validation';

/** PATCH /api/admin/bookings/[id]/reject — reject a pending booking */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const parsed = rejectBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Alasan penolakan wajib diisi (minimal 5 karakter)' },
      { status: 400 }
    );
  }

  const { reason, admin_email } = parsed.data;

  // Get booking
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, status, room_id')
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  if (booking.status !== 'pending_verification' && booking.status !== 'hold') {
    return NextResponse.json(
      { error: `Booking dengan status "${booking.status}" tidak bisa ditolak` },
      { status: 400 }
    );
  }

  // Update status to rejected
  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'rejected',
      rejected_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Delete booking lock to release room
  await supabaseAdmin
    .from('booking_locks')
    .delete()
    .eq('booking_id', id);

  // Log status change
  await supabaseAdmin.from('booking_status_history').insert({
    booking_id: id,
    old_status: booking.status,
    new_status: 'rejected',
    changed_by: admin_email || 'admin',
    reason,
  });

  return NextResponse.json({ success: true, status: 'rejected' });
}
