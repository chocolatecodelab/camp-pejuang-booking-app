import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uploadPaymentProof } from '@/lib/storage';

/** POST /api/bookings/[id]/upload-proof — upload bukti bayar */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;

  // Verify booking exists and is in hold status
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }

  if (booking.status !== 'hold' && booking.status !== 'pending_verification') {
    return NextResponse.json(
      { error: `Tidak bisa upload bukti untuk booking dengan status ${booking.status}` },
      { status: 400 }
    );
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'File bukti pembayaran wajib diupload' }, { status: 400 });
  }

  // Validate file
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran file maksimal 5MB' }, { status: 400 });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Format file harus JPG, PNG, atau PDF' }, { status: 400 });
  }

  // Upload to storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await uploadPaymentProof(bookingId, buffer, file.name, file.type);

  // Insert payment proof record
  await supabaseAdmin.from('payment_proofs').insert({
    booking_id: bookingId,
    file_path: filePath,
    file_type: file.type,
  });

  // Update booking status to pending_verification
  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'pending_verification',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log status change
  await supabaseAdmin.from('booking_status_history').insert({
    booking_id: bookingId,
    old_status: booking.status,
    new_status: 'pending_verification',
    changed_by: 'system',
    reason: 'Bukti pembayaran diupload',
  });

  return NextResponse.json({ success: true, file_path: filePath });
}
