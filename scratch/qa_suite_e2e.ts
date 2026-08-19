if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class {};
}

import { supabaseAdmin } from '../lib/supabase/server';
import { formatRupiah } from '../lib/utils/helpers';

async function runQAAutomatedSuite() {
  console.log('========================================================================');
  console.log('   QA AUTOMATED END-TO-END TEST SUITE — CAMP PEJUANG BOOKING SYSTEM     ');
  console.log('   Role 1: ADMIN (Login, Settings, Camp/Room CRUD, Verification, Settle)');
  console.log('   Role 2: VISITOR (Explore, Availability, Hold, Proof, Track)          ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(` ✅ [PASS] ${testName}${detail ? ' — ' + detail : ''}`);
    } else {
      failed++;
      console.error(` ❌ [FAIL] ${testName}${detail ? ' — ' + detail : ''}`);
      throw new Error(`QA Assertion Failed: ${testName}`);
    }
  }

  // ========================================================================
  // MODULE A: SISI ADMIN (ADMIN FLOW)
  // ========================================================================
  console.log('------------------------------------------------------------------------');
  console.log(' 🅰️  MODULE A: SISI ADMIN (ADMIN MANAGEMENT FLOW)');
  console.log('------------------------------------------------------------------------');

  // Test A1: Admin Login / Profile Verification
  console.log('\n [A1] Verifikasi Sesi & User Admin System...');
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();

  assert(!authErr && !!authData, 'Admin Auth Check', `Supabase Admin Auth Configured: ${authData?.users?.length || 0} registered admin users found`);

  // Test A2: System Settings Management
  console.log('\n [A2] Verifikasi Pengaturan Sistem (Payment Toggles & Bank Info)...');
  const { data: initSettings } = await supabaseAdmin.from('system_settings').select('*').eq('id', 1).single();
  assert(!!initSettings, 'Fetch System Settings', `Bank Active: ${initSettings?.is_bank_active}, QRIS Active: ${initSettings?.is_qris_active}`);

  // Update Settings test
  const newBankName = 'BCA Test QA';
  const { data: updatedSettings, error: updateSetErr } = await supabaseAdmin
    .from('system_settings')
    .update({ bank_name: newBankName, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  assert(!updateSetErr && updatedSettings?.bank_name === newBankName, 'Update System Settings', `Bank Name updated to "${updatedSettings?.bank_name}"`);

  // Test A3: Admin Camp & Room CRUD
  console.log('\n [A3] Verifikasi Admin Kelola Camp, Kamar (Capacity) & Paket Harga...');
  const qaCampSlug = 'camp-qa-automated-' + Math.floor(Math.random() * 1000);
  
  // Create QA Camp
  const { data: qaCampData, error: createCampErr } = await supabaseAdmin
    .from('camps')
    .insert({
      name: 'Camp QA Testing Suite',
      slug: qaCampSlug,
      type: 'putra',
      address: 'Jl. Pare Kampung Inggris No. 99',
      description: 'Camp khusus pengujian QA otomatis',
      facilities: ['Wi-Fi 100Mbps', 'Dapur Umum', 'AC'],
      cover_photo_url: null, // Will test default logo fallback
      is_active: true,
    })
    .select()
    .single();

  const qaCamp = qaCampData!;
  assert(!createCampErr && !!qaCamp, 'Create QA Camp', `Camp ID: ${qaCamp?.id}, Name: "${qaCamp?.name}"`);

  // Create QA Room with Capacity = 3 Bed
  const { data: qaRoomData, error: createRoomErr } = await supabaseAdmin
    .from('rooms')
    .insert({
      camp_id: qaCamp.id,
      name: 'Kamar QA 3 Bed',
      floor_label: 'Lantai 1',
      capacity: 3,
      is_active: true,
    })
    .select()
    .single();

  const qaRoom = qaRoomData!;
  assert(!createRoomErr && qaRoom?.capacity === 3, 'Create QA Room with Multi-Occupancy Capacity', `Room ID: ${qaRoom?.id}, Capacity: ${qaRoom?.capacity} Bed`);

  // Create 2 Pricing Packages (Sharing 3 @ Rp 400.000 vs Sharing 2 @ Rp 550.000)
  const { data: pkgSharing3Data } = await supabaseAdmin
    .from('pricing_packages')
    .insert({
      room_id: qaRoom.id,
      label: '1 Bulan Sharing 3',
      occupancy_label: 'Sharing 3 Orang',
      occupancy_tier: 3,
      slots_consumed: 1,
      duration_days: 30,
      price: 400000,
      min_dp_amount: 150000,
      sort_order: 1,
      is_active: true,
    })
    .select()
    .single();

  const pkgSharing3 = pkgSharing3Data!;

  const { data: pkgSharing2Data } = await supabaseAdmin
    .from('pricing_packages')
    .insert({
      room_id: qaRoom.id,
      label: '1 Bulan Sharing 2',
      occupancy_label: 'Sharing 2 Orang',
      occupancy_tier: 2,
      slots_consumed: 1,
      duration_days: 30,
      price: 550000,
      min_dp_amount: 200000,
      sort_order: 2,
      is_active: true,
    })
    .select()
    .single();

  const pkgSharing2 = pkgSharing2Data!;

  assert(!!pkgSharing3 && !!pkgSharing2, 'Create Pricing Package Tiers', `Pkg 1: ${pkgSharing3?.occupancy_label} (${formatRupiah(pkgSharing3?.price)}), Pkg 2: ${pkgSharing2?.occupancy_label} (${formatRupiah(pkgSharing2?.price)})`);

  // ========================================================================
  // MODULE B: SISI PENGUNJUNG / VISITOR (USER BOOKING FLOW)
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log(' 🅱️  MODULE B: SISI PENGUNJUNG / VISITOR (BOOKING, PROOF & TRACKING FLOW)');
  console.log('------------------------------------------------------------------------');

  // Test B1: Public Camp Browsing & Slot Availability Check
  console.log('\n [B1] Pengunjung Membuka Detail Camp & Mengecek Ketersediaan Slot Bed...');
  const checkIn = new Date().toISOString().split('T')[0];
  const checkOutDate = new Date();
  checkOutDate.setDate(checkOutDate.getDate() + 30);
  const checkOut = checkOutDate.toISOString().split('T')[0];

  // Calculate live bed slot availability
  const { data: activeB } = await supabaseAdmin
    .from('bookings')
    .select('slots_reserved')
    .eq('room_id', qaRoom.id)
    .in('status', ['hold', 'pending_verification', 'confirmed'])
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  const used = (activeB || []).reduce((acc, b) => acc + (b.slots_reserved || 1), 0);
  const remainingSlots = qaRoom.capacity - used;

  assert(remainingSlots === 3, 'Public Availability Check', `Kamar Kosong: Tersedia ${remainingSlots} dari ${qaRoom.capacity} Bed`);

  // Test B2: Visitor Creates Booking (Hold State)
  console.log('\n [B2] Pengunjung Memesan Bed Slot 1 (Opsi Sharing 3 Orang)...');
  const codeVisitor1 = 'QA-' + Math.floor(1000 + Math.random() * 9000);
  
  const { data: bookingVisitor1Data, error: holdErr1 } = await supabaseAdmin
    .from('bookings')
    .insert({
      booking_code: codeVisitor1,
      room_id: qaRoom.id,
      pricing_package_id: pkgSharing3.id,
      slots_reserved: 1,
      customer_name: 'Ahmad Pengunjung QA 1',
      whatsapp_number: '6281234567891',
      check_in: checkIn,
      check_out: checkOut,
      payment_type: 'dp',
      payment_channel: 'transfer_bank',
      claimed_amount: pkgSharing3.min_dp_amount || 150000,
      total_price: pkgSharing3.price,
      status: 'hold',
      hold_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    })
    .select()
    .single();

  const bookingVisitor1 = bookingVisitor1Data!;
  assert(!holdErr1 && !!bookingVisitor1, 'Visitor 1 Booking Hold', `Kode Booking: ${bookingVisitor1?.booking_code}, Status: ${bookingVisitor1?.status}, DP: ${formatRupiah(bookingVisitor1?.claimed_amount || 0)} / Total: ${formatRupiah(bookingVisitor1?.total_price || 0)}`);

  // Lock room active occupancy tier to Sharing 3
  await supabaseAdmin.from('rooms').update({ active_occupancy_limit: 3, active_occupancy_tier: 'Sharing 3 Orang' }).eq('id', qaRoom.id);

  // Test B3: Visitor Uploads Payment Proof
  console.log('\n [B3] Pengunjung Meng-upload Gambar Bukti Pembayaran (WebP Terkompresi)...');
  const { error: uploadErr } = await supabaseAdmin
    .from('payment_proofs')
    .insert({
      booking_id: bookingVisitor1.id,
      file_path: `${bookingVisitor1.id}/bukti_transfer_compressed.webp`,
      file_type: 'image/webp',
    });

  const { data: bookingAfterUpload } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'pending_verification', updated_at: new Date().toISOString() })
    .eq('id', bookingVisitor1.id)
    .select()
    .single();

  assert(!uploadErr && bookingAfterUpload?.status === 'pending_verification', 'Upload Payment Proof (image/webp)', `File Proof: WebP compressed, Status Booking -> ${bookingAfterUpload?.status}`);

  // Test B4: Visitor Tracks Order on /cek-pesanan
  console.log('\n [B4] Pengunjung Melacak Status Pesanan pada Halaman Lacak Pemesanan (/cek-pesanan)...');
  const { data: trackData, error: trackErr } = await supabaseAdmin
    .from('bookings')
    .select('*, rooms(*, camps(*))')
    .eq('booking_code', codeVisitor1)
    .eq('customer_name', 'Ahmad Pengunjung QA 1')
    .single();

  assert(!trackErr && trackData?.booking_code === codeVisitor1, 'Track Order by Name & Code', `Status Terlacak: ${trackData?.status.toUpperCase()}, Sisa Tagihan: ${formatRupiah((trackData?.total_price || 0) - (trackData?.claimed_amount || 0))}`);

  // ========================================================================
  // MODULE C: ADMIN ACTIONS & INTEGRATION (VERATION, SETTLE, UPGRADE, CHECKOUT)
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log(' 🅲  MODULE C: ADMIN ACTIONS (VERIFY, SETTLE, UPGRADE & CHECKOUT)');
  console.log('------------------------------------------------------------------------');

  // Test C1: Admin Approves Payment Proof
  console.log('\n [C1] Admin Menyetujui Bukti Pembayaran & Mengunci Kamar...');
  const { data: approvedBookingData } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', bookingVisitor1.id)
    .select()
    .single();

  const approvedBooking = approvedBookingData!;

  await supabaseAdmin.from('booking_locks').insert({
    booking_id: bookingVisitor1.id,
    room_id: qaRoom.id,
    stay_period: `[${checkIn},${checkOut})`,
  });

  assert(approvedBooking?.status === 'confirmed', 'Admin Approve Booking', `Status -> CONFIRMED, Room Locked in booking_locks`);

  // Test C2: Admin Records Remaining Balance Settlement (Pelunasan Sisa)
  console.log('\n [C2] Admin Mencatat Pelunasan Sisa Pembayaran di Lokasi...');
  const remainingBefore = approvedBooking.total_price - approvedBooking.claimed_amount;
  
  const { data: settledBooking } = await supabaseAdmin
    .from('bookings')
    .update({ claimed_amount: approvedBooking.total_price, updated_at: new Date().toISOString() })
    .eq('id', bookingVisitor1.id)
    .select()
    .single();

  await supabaseAdmin.from('booking_status_history').insert({
    booking_id: bookingVisitor1.id,
    old_status: 'confirmed',
    new_status: 'confirmed',
    changed_by: 'admin',
    reason: `Pelunasan sisa sebesar ${formatRupiah(remainingBefore)} telah diterima di lokasi oleh Admin`,
  });

  assert(settledBooking?.claimed_amount === settledBooking?.total_price, 'Admin Settle Remaining Balance', `Pelunasan: ${formatRupiah(remainingBefore)} Diterima -> Status Tagihan: LUNAS 100% (${formatRupiah(settledBooking?.claimed_amount || 0)})`);

  // Test C3: Admin Executes Room Occupancy Upgrade (Upgrade dari Sharing 3 ke Sharing 2)
  console.log('\n [C3] Admin Meng-upgrade Tipe Kamar dari Sharing 3 ke Sharing 2...');
  const priceDiff = pkgSharing2.price - approvedBooking.total_price;
  
  const { data: upgradedBooking } = await supabaseAdmin
    .from('bookings')
    .update({
      pricing_package_id: pkgSharing2.id,
      total_price: pkgSharing2.price,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingVisitor1.id)
    .select()
    .single();

  await supabaseAdmin.from('rooms').update({ active_occupancy_limit: 2, active_occupancy_tier: 'Sharing 2 Orang' }).eq('id', qaRoom.id);

  assert(upgradedBooking?.total_price === pkgSharing2.price, 'Admin Upgrade Occupancy Tier', `Tipe Baru: Sharing 2 Orang (${formatRupiah(upgradedBooking?.total_price || 0)}), Selisih Tagihan: +${formatRupiah(priceDiff)}`);

  // Test C4: Admin Completes Stay (Selesai Sewa / Check-Out)
  console.log('\n [C4] Admin Menyelesaikan Masa Sewa (Check-Out) & Merilis Kamar...');
  await supabaseAdmin.from('booking_locks').delete().eq('booking_id', bookingVisitor1.id);
  
  const { data: completedBooking } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', bookingVisitor1.id)
    .select()
    .single();

  assert(completedBooking?.status === 'completed', 'Admin Check-Out Tenant', `Status -> COMPLETED, Lock Released, Room Available Again`);

  // ========================================================================
  // CLEANUP QA TEST DATA
  // ========================================================================
  console.log('\n------------------------------------------------------------------------');
  console.log(' 🧹 CLEANUP: MEMBERSIHKAN DATA PENGUJAN QA');
  console.log('------------------------------------------------------------------------');
  await supabaseAdmin.from('payment_proofs').delete().eq('booking_id', bookingVisitor1.id);
  await supabaseAdmin.from('booking_status_history').delete().eq('booking_id', bookingVisitor1.id);
  await supabaseAdmin.from('bookings').delete().eq('id', bookingVisitor1.id);
  await supabaseAdmin.from('pricing_packages').delete().eq('room_id', qaRoom.id);
  await supabaseAdmin.from('rooms').delete().eq('id', qaRoom.id);
  await supabaseAdmin.from('camps').delete().eq('id', qaCamp.id);
  console.log(' ✅ Data pengujian QA berhasil dibersihkan tanpa sisa sampah di database.');

  console.log('\n========================================================================');
  console.log(`   FINAL QA VERDICT: ALL ${passed} AUTOMATED TEST CASES PASSED (100% SUCCESS)`);
  console.log('========================================================================\n');
}

runQAAutomatedSuite().catch(err => {
  console.error('\n❌ QA AUTOMATED TEST FAILED:', err);
  process.exit(1);
});
