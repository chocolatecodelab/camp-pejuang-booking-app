import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { cancelBookingSchema } from '@/lib/validation';

/** PATCH /api/admin/bookings/[id]/cancel — cancel a confirmed booking */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const parsed = cancelBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Alasan pembatalan wajib diisi (minimal 5 karakter)' },
      { status: 400 }
    );
  }

  const { reason, admin_email } = parsed.data;

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  if (booking.status !== 'confirmed') {
    return NextResponse.json(
      { error: 'Hanya booking yang sudah confirmed yang bisa dibatalkan' },
      { status: 400 }
    );
  }

  // Update status
  await supabaseAdmin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Delete booking lock
  await supabaseAdmin
    .from('booking_locks')
    .delete()
    .eq('booking_id', id);

  // Log
  await supabaseAdmin.from('booking_status_history').insert({
    booking_id: id,
    old_status: 'confirmed',
    new_status: 'cancelled',
    changed_by: admin_email || 'admin',
    reason,
  });

  return NextResponse.json({ success: true, status: 'cancelled' });
}
