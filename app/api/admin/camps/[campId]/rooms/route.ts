import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { roomSchema } from '@/lib/validation';

/** GET /api/admin/camps/[campId]/rooms — list rooms in a camp */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const { campId } = await params;

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('camp_id', campId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rooms: data || [] });
}

/** POST /api/admin/camps/[campId]/rooms — create a new room */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const { campId } = await params;
  const body = await request.json().catch(() => ({}));

  const parsed = roomSchema.safeParse({ ...body, camp_id: campId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ room: data }, { status: 201 });
}

/** PATCH /api/admin/camps/[campId]/rooms — update a room */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const body = await request.json().catch(() => ({}));
  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: 'Room ID wajib diisi' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ room: data });
}

/** DELETE /api/admin/camps/[campId]/rooms — soft delete (set is_active = false) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const body = await request.json().catch(() => ({}));
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'Room ID wajib diisi' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('rooms')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
