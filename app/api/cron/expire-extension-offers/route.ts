import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/cron/expire-extension-offers
 * Runs hourly to close expired priority extension windows (setting them to a past sentinel date).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const nowStr = new Date().toISOString();
  // Sentinel date representing that the extension offer has expired and is closed
  const closedSentinel = new Date(0).toISOString(); // 1970-01-01T00:00:00.000Z

  // 1. Find all active extension offers that have expired
  const { data: expiredOffers, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('status', 'confirmed')
    .not('extension_offer_expires_at', 'is', null)
    .neq('extension_offer_expires_at', closedSentinel)
    .lt('extension_offer_expires_at', nowStr);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!expiredOffers || expiredOffers.length === 0) {
    return NextResponse.json({ success: true, expired_count: 0 });
  }

  const expiredIds = expiredOffers.map((b) => b.id);

  // 2. Set extension_offer_expires_at to the closed sentinel date
  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      extension_offer_expires_at: closedSentinel,
      updated_at: nowStr,
    })
    .in('id', expiredIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 3. Log status change history for auditing
  const logs = expiredIds.map((id) => ({
    booking_id: id,
    old_status: 'confirmed' as const,
    new_status: 'confirmed' as const,
    changed_by: 'system',
    reason: 'Priority extension window closed (expired without customer action)',
  }));

  await supabaseAdmin.from('booking_status_history').insert(logs);

  return NextResponse.json({
    success: true,
    expired_count: expiredIds.length,
    expired_bookings: expiredIds,
  });
}
