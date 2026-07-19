import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/** GET /api/rooms/[id]/pricing — active pricing packages for a room */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params;

  const { data, error } = await supabaseAdmin
    .from('pricing_packages')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pricing_packages: data || [] });
}
