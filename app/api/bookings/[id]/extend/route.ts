import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/** POST /api/bookings/[id]/extend — create extension booking */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: parentBookingId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 });
  }

  const { pricing_package_id } = body;
  if (!pricing_package_id) {
    return NextResponse.json({ error: 'pricing_package_id wajib diisi' }, { status: 400 });
  }

  // Get parent booking
  const { data: parentBooking, error: parentError } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', parentBookingId)
    .eq('status', 'confirmed')
    .single();

  if (parentError || !parentBooking) {
    return NextResponse.json(
      { error: 'Booking induk tidak ditemukan atau belum confirmed' },
      { status: 404 }
    );
  }

  // Get pricing package
  const { data: pkg } = await supabaseAdmin
    .from('pricing_packages')
    .select('*')
    .eq('id', pricing_package_id)
    .eq('is_active', true)
    .single();

  if (!pkg) {
    return NextResponse.json({ error: 'Paket harga tidak valid' }, { status: 400 });
  }

  // Create new booking via RPC (check_in = parent check_out)
  const { data, error } = await supabaseAdmin.rpc('create_booking_hold', {
    p_room_id: parentBooking.room_id,
    p_pricing_package_id: pricing_package_id,
    p_check_in: parentBooking.check_out,
    p_customer_name: parentBooking.customer_name,
    p_whatsapp: parentBooking.whatsapp_number,
    p_notes: `Perpanjangan dari booking ${parentBooking.booking_code}`,
    p_payment_type: 'full' as const,
    p_payment_channel: parentBooking.payment_channel,
    p_claimed_amount: Number(pkg.price),
    p_parent_booking_id: parentBookingId,
  });

  if (error) {
    if (error.message.includes('room_not_available')) {
      return NextResponse.json(
        { error: 'Kamar tidak tersedia untuk periode perpanjangan' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data }, { status: 201 });
}
