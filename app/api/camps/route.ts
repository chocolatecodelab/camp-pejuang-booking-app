import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { runMaintenance } from '@/lib/maintenance';

/** GET /api/camps — list all active camps */
export async function GET() {
  await runMaintenance();

  const { data, error } = await supabaseAdmin
    .from('camps')
    .select(`
      *,
      rooms!inner (
        id,
        pricing_packages (price)
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute min price and room count per camp
  const camps = (data || []).map((camp: any) => {
    const rooms = camp.rooms || [];
    const allPrices = rooms.flatMap((r: any) =>
      (r.pricing_packages || []).map((p: any) => Number(p.price))
    );
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;

    return {
      id: camp.id,
      name: camp.name,
      slug: camp.slug,
      type: camp.type,
      address: camp.address,
      description: camp.description,
      facilities: camp.facilities,
      cover_photo_url: camp.cover_photo_url,
      room_count: rooms.length,
      min_price: minPrice,
    };
  });

  return NextResponse.json({ camps });
}
