import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkoutBookingSchema } from '@/lib/validation';

/** PATCH /api/admin/bookings/[id]/checkout — mark a confirmed booking as completed (early checkout / vacant room) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const parsed = checkoutBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Format data checkout tidak valid' },
        { status: 400 }
      );
    }

    const { notes, admin_email } = parsed.data;

    // 1. Fetch current booking details
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('id, status, check_in, check_out, customer_name, whatsapp_number, booking_code')
      .eq('id', id)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
    }

    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: `Hanya booking dengan status "Terkonfirmasi" (confirmed) yang bisa di-checkout. Status saat ini: ${booking.status}` },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    // Update check_out to today ONLY if today is strictly after check_in,
    // guaranteeing check_out > check_in to satisfy PostgreSQL constraint chk_dates 100% of the time.
    const updatedCheckOut = (booking.check_out > todayStr && todayStr > booking.check_in)
      ? todayStr
      : booking.check_out;

    // 2. Update booking status to completed and check_out date
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'completed',
        check_out: updatedCheckOut,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Checkout update error:', updateError);
      if (updateError.message.includes('booking_status') || updateError.message.includes('completed')) {
        return NextResponse.json(
          { error: 'Tipe ENUM booking_status di Supabase belum memiliki nilai "completed". Silakan jalankan SQL: ALTER TYPE booking_status ADD VALUE IF NOT EXISTS \'completed\';' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Delete booking lock to release the room instantly for new bookings
    await supabaseAdmin
      .from('booking_locks')
      .delete()
      .eq('booking_id', id);

    // 4. Log status change history
    const logReason = notes
      ? `Selesai sewa / check-out: ${notes}`
      : 'Penyewa telah selesai sewa / check-out awal (kamar kosong)';

    await supabaseAdmin.from('booking_status_history').insert({
      booking_id: id,
      old_status: 'confirmed',
      new_status: 'completed',
      changed_by: admin_email || 'admin',
      reason: logReason,
    });

    return NextResponse.json({
      success: true,
      status: 'completed',
      check_out: updatedCheckOut,
      booking_code: booking.booking_code,
      customer_name: booking.customer_name,
      whatsapp_number: booking.whatsapp_number,
    });
  } catch (err: any) {
    console.error('Checkout API unhandled exception:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan pada server saat checkout' }, { status: 500 });
  }
}
