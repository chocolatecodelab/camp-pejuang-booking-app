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
        { error: 'Kamar tidak tersedia untuk periode yang dipilih' },
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
