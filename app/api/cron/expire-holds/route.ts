import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/cron/expire-holds
 * Runs every 15 minutes to release expired booking holds.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const nowStr = new Date().toISOString();

  // 1. Get all bookings that are in 'hold' status and have expired
  const { data: expiredBookings, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('status', 'hold')
    .lt('hold_expires_at', nowStr);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!expiredBookings || expiredBookings.length === 0) {
    return NextResponse.json({ success: true, expired_count: 0 });
  }

  const expiredIds = expiredBookings.map((b) => b.id);

  // 2. Delete booking locks to free up rooms
  const { error: deleteLocksError } = await supabaseAdmin
    .from('booking_locks')
    .delete()
    .in('booking_id', expiredIds);

  if (deleteLocksError) {
    return NextResponse.json({ error: deleteLocksError.message }, { status: 500 });
  }

  // 3. Update bookings status to 'expired'
  const { error: updateBookingsError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'expired',
      updated_at: nowStr,
    })
    .in('id', expiredIds);

  if (updateBookingsError) {
    return NextResponse.json({ error: updateBookingsError.message }, { status: 500 });
  }

  // 4. Log status history for all expired bookings
  const logs = expiredBookings.map((b) => ({
    booking_id: b.id,
    old_status: 'hold' as const,
    new_status: 'expired' as const,
    changed_by: 'system',
    reason: 'Hold sewa kedaluwarsa (tidak upload bukti bayar dalam 24 jam)',
  }));

  const { error: historyError } = await supabaseAdmin
    .from('booking_status_history')
    .insert(logs);

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    expired_count: expiredIds.length,
  });
}
