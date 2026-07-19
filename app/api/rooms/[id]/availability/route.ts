import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { runMaintenance } from '@/lib/maintenance';

/** GET /api/rooms/[id]/availability?check_in=&check_out=&whatsapp= */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await runMaintenance();
  const { id: roomId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const checkIn = searchParams.get('check_in');
  const checkOut = searchParams.get('check_out');
  const whatsapp = searchParams.get('whatsapp') || '';

  if (!checkIn || !checkOut) {
    return NextResponse.json(
      { error: 'check_in dan check_out wajib diisi' },
      { status: 400 }
    );
  }

  // Check 1: Any existing booking lock that overlaps the requested period
  const { data: conflictingLocks } = await supabaseAdmin
    .from('booking_locks')
    .select('id')
    .eq('room_id', roomId)
    .filter('stay_period', 'ov', `[${checkIn},${checkOut})`);

  if (conflictingLocks && conflictingLocks.length > 0) {
    return NextResponse.json({ available: false, reason: 'booked' });
  }

  // Check 2: Extension window — is there a confirmed booking with an active
  // extension offer that covers the requested period?
  if (whatsapp) {
    const { data: extensionBlocks } = await supabaseAdmin
      .from('bookings')
      .select('id, whatsapp_number, check_out, extension_offer_expires_at')
      .eq('room_id', roomId)
      .eq('status', 'confirmed')
      .not('extension_offer_expires_at', 'is', null)
      .gt('extension_offer_expires_at', new Date().toISOString());

    if (extensionBlocks && extensionBlocks.length > 0) {
      // Check if the requester is not the current tenant
      const blocked = extensionBlocks.some(
        (b) => b.whatsapp_number !== whatsapp && new Date(checkIn) >= new Date(b.check_out)
      );
      if (blocked) {
        return NextResponse.json({
          available: false,
          reason: 'extension_window',
        });
      }
    }
  } else {
    // No whatsapp provided — check extension window for any block
    const { data: extensionBlocks } = await supabaseAdmin
      .from('bookings')
      .select('id, check_out, extension_offer_expires_at')
      .eq('room_id', roomId)
      .eq('status', 'confirmed')
      .not('extension_offer_expires_at', 'is', null)
      .gt('extension_offer_expires_at', new Date().toISOString());

    if (extensionBlocks && extensionBlocks.length > 0) {
      const blocked = extensionBlocks.some(
        (b) => new Date(checkIn) >= new Date(b.check_out)
      );
      if (blocked) {
        return NextResponse.json({
          available: false,
          reason: 'extension_window',
        });
      }
    }
  }

  return NextResponse.json({ available: true });
}
