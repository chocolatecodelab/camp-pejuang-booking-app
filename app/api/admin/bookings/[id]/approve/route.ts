import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/** PATCH /api/admin/bookings/[id]/approve — confirm a pending booking */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const adminEmail = body.admin_email || 'admin';

  // Get booking
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, status, booking_code')
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  if (booking.status !== 'pending_verification') {
    return NextResponse.json(
      { error: `Hanya booking dengan status "Menunggu Verifikasi" yang bisa di-approve. Status saat ini: ${booking.status}` },
      { status: 400 }
    );
  }

  // Update status to confirmed
  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log status change
  await supabaseAdmin.from('booking_status_history').insert({
    booking_id: id,
    old_status: 'pending_verification',
    new_status: 'confirmed',
    changed_by: adminEmail,
    reason: 'Bukti pembayaran disetujui',
  });

  return NextResponse.json({ success: true, status: 'confirmed' });
}
