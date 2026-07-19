import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/cron/offer-extensions
 * Runs daily to check for bookings nearing checkout (H-7) and open their priority extension window.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Fetch confirmed bookings that don't have an extension offer set yet
  const { data: bookings, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select(`
      id, booking_code, check_out, status,
      rooms!inner (
        name,
        camps!inner (
          name, extension_window_days, extension_response_hours
        )
      )
    `)
    .eq('status', 'confirmed')
    .is('extension_offer_expires_at', null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ success: true, offered_count: 0 });
  }

  const todayDate = new Date(todayStr + 'T00:00:00');
  const now = new Date();
  const bookingsToUpdate = [];

  for (const b of bookings) {
    const room = b.rooms as any;
    const camp = room?.camps;
    const extensionWindow = camp?.extension_window_days ?? 7;
    const responseHours = camp?.extension_response_hours ?? 72;

    const checkOutDate = new Date(b.check_out + 'T00:00:00');
    const diffDays = Math.round((checkOutDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    // If checkout is exactly extensionWindow days away, open the extension offer
    if (diffDays === extensionWindow) {
      const offerExpiresAt = new Date(now.getTime() + responseHours * 60 * 60 * 1000).toISOString();
      bookingsToUpdate.push({
        id: b.id,
        extension_offer_expires_at: offerExpiresAt,
      });
    }
  }

  if (bookingsToUpdate.length === 0) {
    return NextResponse.json({ success: true, offered_count: 0 });
  }

  // 2. Update bookings in bulk
  for (const item of bookingsToUpdate) {
    await supabaseAdmin
      .from('bookings')
      .update({
        extension_offer_expires_at: item.extension_offer_expires_at,
        updated_at: now.toISOString(),
      })
      .eq('id', item.id);
  }

  return NextResponse.json({
    success: true,
    offered_count: bookingsToUpdate.length,
    offered_bookings: bookingsToUpdate.map((item) => item.id),
  });
}
