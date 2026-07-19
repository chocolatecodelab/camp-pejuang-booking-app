import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { runMaintenance } from '@/lib/maintenance';

/** GET /api/camps/[slug] — camp detail with rooms and availability */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await runMaintenance();
  const { slug } = await params;

  const { data: camp, error } = await supabaseAdmin
    .from('camps')
    .select(`
      *,
      rooms (
        id, name, floor_label, room_photo_urls, is_active,
        pricing_packages (
          id, label, duration_days, price, min_dp_amount, sort_order, is_active
        )
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !camp) {
    return NextResponse.json({ error: 'Camp tidak ditemukan' }, { status: 404 });
  }

  // Filter active rooms and their active pricing packages
  const rooms = (camp.rooms || [])
    .filter((r: any) => r.is_active)
    .map((room: any) => ({
      ...room,
      pricing_packages: (room.pricing_packages || [])
        .filter((p: any) => p.is_active)
        .sort((a: any, b: any) => a.sort_order - b.sort_order),
    }));

  // Get active booking locks for all rooms in this camp
  const roomIds = rooms.map((r: any) => r.id);
  const { data: locks } = await supabaseAdmin
    .from('booking_locks')
    .select('room_id, stay_period')
    .in('room_id', roomIds);

  return NextResponse.json({
    camp: {
      ...camp,
      rooms: undefined, // remove nested rooms from camp level
    },
    rooms,
    booking_locks: locks || [],
  });
}
