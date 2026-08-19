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

  // Fetch room capacity
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, capacity')
    .eq('id', roomId)
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: 'Kamar tidak ditemukan' }, { status: 404 });
  }

  const roomCapacity = room.capacity || 1;

  // Query active overlapping bookings
  const nowIso = new Date().toISOString();
  const { data: activeBookings } = await supabaseAdmin
    .from('bookings')
    .select('id, slots_reserved, pricing_package_id, pricing_packages(occupancy_tier, occupancy_label)')
    .eq('room_id', roomId)
    .in('status', ['hold', 'pending_verification', 'confirmed'])
    .or(`hold_expires_at.gt.${nowIso},status.neq.hold`)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  const usedSlots = (activeBookings || []).reduce((acc, b) => acc + (b.slots_reserved || 1), 0);
  const remainingSlots = Math.max(0, roomCapacity - usedSlots);

  if (remainingSlots <= 0) {
    return NextResponse.json({
      available: false,
      reason: 'booked',
      capacity: roomCapacity,
      used_slots: usedSlots,
      remaining_slots: 0,
    });
  }

  // Check 2: Extension window — is there a confirmed booking with an active extension offer?
  if (whatsapp) {
    const { data: extensionBlocks } = await supabaseAdmin
      .from('bookings')
      .select('id, whatsapp_number, check_out, extension_offer_expires_at')
      .eq('room_id', roomId)
      .eq('status', 'confirmed')
      .not('extension_offer_expires_at', 'is', null)
      .gt('extension_offer_expires_at', nowIso);

    if (extensionBlocks && extensionBlocks.length > 0) {
      const blocked = extensionBlocks.some(
        (b) => b.whatsapp_number !== whatsapp && new Date(checkIn) >= new Date(b.check_out)
      );
      if (blocked) {
        return NextResponse.json({
          available: false,
          reason: 'extension_window',
          capacity: roomCapacity,
          used_slots: usedSlots,
          remaining_slots: remainingSlots,
        });
      }
    }
  }

  // Active occupancy tier info if room has existing occupants
  const activePackage = activeBookings && activeBookings.length > 0 ? activeBookings[0].pricing_packages : null;

  return NextResponse.json({
    available: true,
    capacity: roomCapacity,
    used_slots: usedSlots,
    remaining_slots: remainingSlots,
    active_occupancy_tier: activePackage ? (activePackage as any).occupancy_tier : null,
    active_occupancy_label: activePackage ? (activePackage as any).occupancy_label : null,
  });
}
