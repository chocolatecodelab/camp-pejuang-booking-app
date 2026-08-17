import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { formatRupiah } from '@/lib/utils/helpers';

/** PATCH /api/admin/bookings/[id]/settle — Catat pelunasan sisa pembayaran di lokasi */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;

    // Fetch target booking
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: `Pelunasan hanya dapat dicatat untuk sewa dengan status confirmed. Status saat ini: ${booking.status}` },
        { status: 400 }
      );
    }

    const remaining = booking.total_price - booking.claimed_amount;

    if (remaining <= 0) {
      return NextResponse.json(
        { error: 'Booking ini sudah LUNAS 100%.' },
        { status: 400 }
      );
    }

    // Update claimed_amount to 100% full (total_price)
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        claimed_amount: booking.total_price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Record audit history
    await supabaseAdmin.from('booking_status_history').insert({
      booking_id: bookingId,
      old_status: 'confirmed',
      new_status: 'confirmed',
      changed_by: 'admin',
      reason: `Pelunasan sisa sebesar ${formatRupiah(remaining)} telah diterima di lokasi oleh Admin`,
    });

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      remaining_settled: remaining,
    });
  } catch (err: any) {
    console.error('Error settling balance:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
