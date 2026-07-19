import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { runMaintenance } from '@/lib/maintenance';

/** GET /api/bookings/[id] — fetch booking details by ID (using admin client to bypass RLS) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await runMaintenance();
  const { id } = await params;

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      *,
      rooms (
        name,
        camps (name)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json({ booking });
}
