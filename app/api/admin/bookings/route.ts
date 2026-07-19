import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/** GET /api/admin/bookings — list bookings with filters */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const campId = searchParams.get('camp_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('bookings')
    .select(`
      *,
      rooms (
        id, name, floor_label,
        camps (id, name, slug, type)
      ),
      pricing_packages (id, label, duration_days),
      payment_proofs (id, file_path, file_type, uploaded_at)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status as any);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to + 'T23:59:59');

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by camp_id if provided (through rooms relation)
  let bookings = data || [];
  if (campId) {
    bookings = bookings.filter((b: any) => b.rooms?.camps?.id === campId);
  }

  return NextResponse.json({
    bookings,
    total: count || 0,
    page,
    limit,
  });
}
