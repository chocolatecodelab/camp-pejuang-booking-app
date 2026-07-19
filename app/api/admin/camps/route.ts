import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { campSchema } from '@/lib/validation';

/** GET /api/admin/camps — list all camps */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('camps')
    .select(`
      *,
      rooms (id)
    `)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const camps = (data || []).map((c: any) => ({
    ...c,
    room_count: (c.rooms || []).length,
    rooms: undefined,
  }));

  return NextResponse.json({ camps });
}

/** POST /api/admin/camps — create new camp */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = campSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('camps')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    if (error.message.includes('duplicate key') && error.message.includes('slug')) {
      return NextResponse.json({ error: 'Slug sudah dipakai camp lain' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ camp: data }, { status: 201 });
}

/** PATCH /api/admin/camps — update camp (expects id in body) */
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: 'Camp ID wajib diisi' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('camps')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ camp: data });
}

/** DELETE /api/admin/camps — soft delete (set is_active=false) */
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'Camp ID wajib diisi' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('camps')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
