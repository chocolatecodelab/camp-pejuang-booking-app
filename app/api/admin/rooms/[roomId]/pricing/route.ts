import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { pricingPackageSchema } from '@/lib/validation';

/** GET /api/admin/rooms/[roomId]/pricing — list pricing packages for a room */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const { data, error } = await supabaseAdmin
    .from('pricing_packages')
    .select('*')
    .eq('room_id', roomId)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pricing_packages: data || [] });
}

/** POST /api/admin/rooms/[roomId]/pricing — create a pricing package */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));

  const parsed = pricingPackageSchema.safeParse({ ...body, room_id: roomId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('pricing_packages')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pricing_package: data }, { status: 201 });
}

/** PATCH /api/admin/rooms/[roomId]/pricing — update a pricing package */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const body = await request.json().catch(() => ({}));
  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: 'Pricing Package ID wajib diisi' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('pricing_packages')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pricing_package: data });
}

/** DELETE /api/admin/rooms/[roomId]/pricing — soft delete (set is_active = false) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const body = await request.json().catch(() => ({}));
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'Pricing Package ID wajib diisi' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('pricing_packages')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
