import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { formatRupiah } from '@/lib/utils/helpers';

/** PATCH /api/admin/rooms/[roomId]/upgrade — Upgrade tipe keterisian kamar bagi penghuni aktif */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { new_package_id } = body;

    if (!new_package_id) {
      return NextResponse.json({ error: 'new_package_id wajib diisi' }, { status: 400 });
    }

    // 1. Fetch target room
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Kamar tidak ditemukan' }, { status: 404 });
    }

    // 2. Fetch new pricing package
    const { data: newPackage, error: pkgErr } = await supabaseAdmin
      .from('pricing_packages')
      .select('*')
      .eq('id', new_package_id)
      .single();

    if (pkgErr || !newPackage) {
      return NextResponse.json({ error: 'Paket harga baru tidak ditemukan' }, { status: 404 });
    }

    // 3. Fetch active bookings in this room
    const nowIso = new Date().toISOString();
    const { data: activeBookings, error: bookErr } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['hold', 'pending_verification', 'confirmed'])
      .or(`hold_expires_at.gt.${nowIso},status.neq.hold`);

    if (bookErr) {
      return NextResponse.json({ error: bookErr.message }, { status: 500 });
    }

    let updatedCount = 0;
    const priceAdjustments: { booking_code: string; diff: number }[] = [];

    // 4. Update each active booking with the upgraded package price
    if (activeBookings && activeBookings.length > 0) {
      for (const b of activeBookings) {
        const diff = newPackage.price - b.total_price;

        const { error: updateErr } = await supabaseAdmin
          .from('bookings')
          .update({
            pricing_package_id: newPackage.id,
            total_price: newPackage.price,
            slots_reserved: newPackage.slots_consumed || 1,
            updated_at: nowIso,
          })
          .eq('id', b.id);

        if (!updateErr) {
          updatedCount++;
          priceAdjustments.push({ booking_code: b.booking_code, diff });

          // Audit trail log
          await supabaseAdmin.from('booking_status_history').insert({
            booking_id: b.id,
            old_status: b.status,
            new_status: b.status,
            changed_by: 'admin',
            reason: `Upgrade kamar ke ${newPackage.occupancy_label || newPackage.label}. Penyesuaian tagihan +${formatRupiah(Math.max(0, diff))}`,
          });
        }
      }
    }

    // 5. Update room active occupancy limit & tier label
    await supabaseAdmin
      .from('rooms')
      .update({
        active_occupancy_limit: newPackage.occupancy_tier || room.capacity,
        active_occupancy_tier: newPackage.occupancy_label || newPackage.label,
      })
      .eq('id', roomId);

    return NextResponse.json({
      success: true,
      updated_bookings_count: updatedCount,
      package_name: newPackage.occupancy_label || newPackage.label,
      new_price: newPackage.price,
      price_adjustments: priceAdjustments,
    });
  } catch (err: any) {
    console.error('Error upgrading room occupancy:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
