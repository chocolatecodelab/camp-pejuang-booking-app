import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { trackBookingSchema } from '@/lib/validation';
import { runMaintenance } from '@/lib/maintenance';

/** GET /api/bookings/track?name=&code= */
export async function GET(request: NextRequest) {
  await runMaintenance();
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name') || '';
  const code = searchParams.get('code') || '';

  const parsed = trackBookingSchema.safeParse({ name, code });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Nama dan kode booking wajib diisi dengan format yang benar' },
      { status: 400 }
    );
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      id, booking_code, status, customer_name, whatsapp_number,
      check_in, check_out, payment_type, payment_channel,
      claimed_amount, total_price, hold_expires_at,
      extension_offer_expires_at, rejected_reason, cancelled_reason,
      created_at, updated_at, parent_booking_id,
      rooms (
        id, name, floor_label,
        camps (id, name, slug, type)
      ),
      pricing_packages (id, label, occupancy_label, occupancy_tier, duration_days),
      booking_status_history (
        old_status, new_status, changed_by, reason, changed_at
      )
    `)
    .eq('booking_code', code.toUpperCase())
    .ilike('customer_name', name)
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: 'Booking tidak ditemukan. Pastikan nama dan kode booking sudah benar.' },
      { status: 404 }
    );
  }

  // Check if extension is available
  const room = (booking as any).rooms;
  const camp = room?.camps;
  const canExtend =
    booking.status === 'confirmed' &&
    booking.extension_offer_expires_at !== null &&
    new Date(booking.extension_offer_expires_at) > new Date();

  return NextResponse.json({
    booking_code: booking.booking_code,
    status: booking.status,
    customer_name: booking.customer_name,
    room_name: room?.name || '',
    room_id: room?.id || '',
    floor_label: room?.floor_label || '',
    camp_name: camp?.name || '',
    camp_slug: camp?.slug || '',
    camp_type: camp?.type || '',
    check_in: booking.check_in,
    check_out: booking.check_out,
    payment_type: booking.payment_type,
    payment_channel: booking.payment_channel,
    claimed_amount: booking.claimed_amount,
    total_price: booking.total_price,
    hold_expires_at: booking.hold_expires_at,
    extension_offer_expires_at: booking.extension_offer_expires_at,
    rejected_reason: booking.rejected_reason,
    cancelled_reason: booking.cancelled_reason,
    package_label: (booking as any).pricing_packages?.label || '',
    occupancy_label: (booking as any).pricing_packages?.occupancy_label || '',
    occupancy_tier: (booking as any).pricing_packages?.occupancy_tier || null,
    duration_days: (booking as any).pricing_packages?.duration_days || 0,
    can_extend: canExtend,
    booking_id: booking.id,
    parent_booking_id: booking.parent_booking_id,
    history: ((booking as any).booking_status_history || []).sort(
      (a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    ),
    created_at: booking.created_at,
  });
}
