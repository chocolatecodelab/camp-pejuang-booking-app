import { supabaseAdmin } from './supabase/server';

/**
 * Executes system-wide maintenance tasks:
 * 1. Expire booking holds that have passed their 24-hour limit.
 * 2. Set priority extension windows for tenants checkout out in H-7.
 * 3. Expire extension offers that have passed their response window.
 */
export async function runMaintenance() {
  try {
    const nowStr = new Date().toISOString();
    const todayStr = nowStr.split('T')[0];

    // -------------------------------------------------------------
    // 1. Expire Holds (Release locked rooms if payment not uploaded)
    // -------------------------------------------------------------
    const { data: expiredBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, room_id')
      .eq('status', 'hold')
      .lt('hold_expires_at', nowStr);

    if (expiredBookings && expiredBookings.length > 0) {
      const expiredIds = expiredBookings.map((b) => b.id);
      const roomIds = Array.from(new Set(expiredBookings.map((b) => b.room_id).filter(Boolean)));
      
      // Delete locks to release rooms
      await supabaseAdmin
        .from('booking_locks')
        .delete()
        .in('booking_id', expiredIds);

      // Set booking status to expired
      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'expired',
          updated_at: nowStr,
        })
        .in('id', expiredIds);

      // Insert status history logs
      const logs = expiredIds.map((id) => ({
        booking_id: id,
        old_status: 'hold' as const,
        new_status: 'expired' as const,
        changed_by: 'system',
        reason: 'Hold sewa kedaluwarsa (tidak upload bukti bayar dalam batas waktu 1 jam)',
      }));
      await supabaseAdmin.from('booking_status_history').insert(logs);

      // Reset room tier if room has no active bookings left
      for (const rId of roomIds) {
        const { data: remainingActive } = await supabaseAdmin
          .from('bookings')
          .select('id')
          .eq('room_id', rId)
          .in('status', ['hold', 'pending_verification', 'confirmed'])
          .or(`hold_expires_at.gt.${nowStr},status.neq.hold`);

        if (!remainingActive || remainingActive.length === 0) {
          await supabaseAdmin
            .from('rooms')
            .update({
              active_occupancy_limit: null,
              active_occupancy_tier: null,
            })
            .eq('id', rId);
        }
      }
    }

    // -------------------------------------------------------------
    // 2. Offer Extensions (Open Priority Window at H-7 checkout)
    // -------------------------------------------------------------
    const { data: confirmedBookings } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, booking_code, check_out, status,
        rooms (
          name,
          camps (
            name, extension_window_days, extension_response_hours
          )
        )
      `)
      .eq('status', 'confirmed')
      .is('extension_offer_expires_at', null);

    if (confirmedBookings && confirmedBookings.length > 0) {
      const todayDate = new Date(todayStr + 'T00:00:00');
      const bookingsToUpdate = [];

      for (const b of confirmedBookings) {
        const room = b.rooms as any;
        const camp = room?.camps;
        const extensionWindow = camp?.extension_window_days ?? 7;
        const responseHours = camp?.extension_response_hours ?? 72;

        const checkOutDate = new Date(b.check_out + 'T00:00:00');
        const diffDays = Math.round((checkOutDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        // If checkout date is exactly extensionWindow days away, open extension window
        if (diffDays === extensionWindow) {
          const offerExpiresAt = new Date(new Date().getTime() + responseHours * 60 * 60 * 1000).toISOString();
          bookingsToUpdate.push({
            id: b.id,
            extension_offer_expires_at: offerExpiresAt,
          });
        }
      }

      for (const item of bookingsToUpdate) {
        await supabaseAdmin
          .from('bookings')
          .update({
            extension_offer_expires_at: item.extension_offer_expires_at,
            updated_at: nowStr,
          })
          .eq('id', item.id);
      }
    }

    // -------------------------------------------------------------
    // 3. Expire Extension Offers (Close windows that timed out)
    // -------------------------------------------------------------
    const closedSentinel = new Date(0).toISOString(); // 1970-01-01
    const { data: expiredOffers } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('status', 'confirmed')
      .not('extension_offer_expires_at', 'is', null)
      .neq('extension_offer_expires_at', closedSentinel)
      .lt('extension_offer_expires_at', nowStr);

    if (expiredOffers && expiredOffers.length > 0) {
      const expiredIds = expiredOffers.map((b) => b.id);

      await supabaseAdmin
        .from('bookings')
        .update({
          extension_offer_expires_at: closedSentinel,
          updated_at: nowStr,
        })
        .in('id', expiredIds);

      const logs = expiredIds.map((id) => ({
        booking_id: id,
        old_status: 'confirmed' as const,
        new_status: 'confirmed' as const,
        changed_by: 'system',
        reason: 'Priority extension window closed (expired without customer action)',
      }));
      await supabaseAdmin.from('booking_status_history').insert(logs);
    }

    return { success: true };
  } catch (err: any) {
    console.error('runMaintenance failed:', err);
    return { success: false, error: err.message };
  }
}
