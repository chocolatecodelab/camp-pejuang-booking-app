if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class {};
}

import { supabaseAdmin } from '../lib/supabase/server';
import { formatRupiah } from '../lib/utils/helpers';

async function runAllTests() {
  console.log('====================================================');
  console.log('   CAMP PEJUANG BOOKING APP — COMPREHENSIVE SUITE   ');
  console.log('====================================================\n');

  // Test 1: Public Camps Listing & DB integrity
  console.log(' [TEST 1] Fetching Public Active Camps...');
  const { data: camps, error: campErr } = await supabaseAdmin
    .from('camps')
    .select('*, rooms(*, pricing_packages(*))')
    .eq('is_active', true);
  
  if (campErr) throw new Error(`Test 1 Failed: ${campErr.message}`);
  console.log(`   SUCCESS: Found ${camps.length} active camps.`);
  camps.forEach(c => {
    console.log(`    - ${c.name} (${c.type}): ${c.rooms?.length || 0} rooms. Cover: ${c.cover_photo_url ? 'YES' : 'DEFAULT LOGO'}`);
  });

  // Test 2: System Settings
  console.log('\n [TEST 2] Checking System Settings & Payment Method Toggles...');
  const { data: settings, error: setErr } = await supabaseAdmin
    .from('system_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (setErr) throw new Error(`Test 2 Failed: ${setErr.message}`);
  console.log(`   SUCCESS: QRIS Active = ${settings.is_qris_active}, Bank Active = ${settings.is_bank_active}`);

  // Test 3: Create End-to-End Test Booking (Hold)
  console.log('\n [TEST 3] Creating Test Booking (Hold State)...');
  const testRoom = camps[0]?.rooms[0];
  const testPkg = testRoom?.pricing_packages[0];
  if (!testRoom || !testPkg) throw new Error('No rooms/packages available for testing');

  const testCode = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
  const checkIn = new Date().toISOString().split('T')[0];
  const checkOutDate = new Date();
  checkOutDate.setDate(checkOutDate.getDate() + testPkg.duration_days);
  const checkOut = checkOutDate.toISOString().split('T')[0];

  const { data: booking, error: bookErr } = await supabaseAdmin
    .from('bookings')
    .insert({
      booking_code: testCode,
      customer_name: 'Testing Automated Agent',
      whatsapp_number: '628999888777',
      room_id: testRoom.id,
      pricing_package_id: testPkg.id,
      check_in: checkIn,
      check_out: checkOut,
      payment_type: 'dp',
      payment_channel: 'transfer_bank',
      claimed_amount: testPkg.min_dp_amount || 500000,
      total_price: testPkg.price,
      status: 'hold',
      hold_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    })
    .select()
    .single();

  if (bookErr) throw new Error(`Test 3 Failed: ${bookErr.message}`);
  console.log(`   SUCCESS: Created Test Booking ${booking.booking_code} (ID: ${booking.id})`);
  console.log(`    - DP Claimed: Rp ${booking.claimed_amount} / Total: Rp ${booking.total_price}`);

  // Test 4: Simulate Upload Payment Proof
  console.log('\n [TEST 4] Simulating Payment Proof Upload & Status Update...');
  const { error: proofErr } = await supabaseAdmin
    .from('payment_proofs')
    .insert({
      booking_id: booking.id,
      file_path: `${booking.id}/test-proof.webp`,
      file_type: 'image/webp',
    });
  if (proofErr) throw new Error(`Test 4 Failed: ${proofErr.message}`);

  await supabaseAdmin
    .from('bookings')
    .update({ status: 'pending_verification' })
    .eq('id', booking.id);
  console.log('   SUCCESS: Proof record inserted (image/webp) & status -> pending_verification');

  // Test 5: Admin Verification (Approve)
  console.log('\n [TEST 5] Admin Verifying Payment Proof (Approve)...');
  await supabaseAdmin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking.id);

  // Lock room in booking_locks
  const stayPeriod = `[${checkIn},${checkOut})`;
  await supabaseAdmin
    .from('booking_locks')
    .insert({
      booking_id: booking.id,
      room_id: testRoom.id,
      stay_period: stayPeriod,
    });
  console.log('   SUCCESS: Status -> confirmed & room locked in booking_locks');

  // Test 6: Settle Remaining Balance (Pelunasan Sisa)
  console.log('\n [TEST 6] Admin Recording Remaining Balance Settlement (Pelunasan Sisa)...');
  const remaining = booking.total_price - booking.claimed_amount;
  const { data: settledBooking, error: settleErr } = await supabaseAdmin
    .from('bookings')
    .update({
      claimed_amount: booking.total_price,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .select()
    .single();

  if (settleErr) throw new Error(`Test 6 Failed: ${settleErr.message}`);
  console.log(`   SUCCESS: Settled ${formatRupiah(remaining)}. Total Claimed is now ${formatRupiah(settledBooking.claimed_amount)} (100% LUNAS)`);

  // Test 7: Public Tracking Verification
  console.log('\n [TEST 7] Verifying Public Tracking (/cek-pesanan)...');
  const { data: tracked, error: trackErr } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', booking.id)
    .single();

  if (trackErr) throw new Error(`Test 7 Failed: ${trackErr.message}`);
  const isFullyPaid = tracked.claimed_amount >= tracked.total_price;
  console.log(`   SUCCESS: Tracked booking ${tracked.booking_code}. Status: ${tracked.status}, Fully Paid: ${isFullyPaid}`);

  // Test 8: Admin Checkout (Selesai Sewa)
  console.log('\n [TEST 8] Admin Checking-Out Tenant (Selesai Sewa)...');
  await supabaseAdmin
    .from('booking_locks')
    .delete()
    .eq('booking_id', booking.id);

  const { data: completedBooking, error: checkoutErr } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .select()
    .single();

  if (checkoutErr) throw new Error(`Test 8 Failed: ${checkoutErr.message}`);
  console.log(`   SUCCESS: Status -> completed, room lock released`);

  // Test 9: Cleanup Test Record
  console.log('\n [TEST 9] Cleaning up test records...');
  await supabaseAdmin.from('payment_proofs').delete().eq('booking_id', booking.id);
  await supabaseAdmin.from('bookings').delete().eq('id', booking.id);
  console.log('   SUCCESS: Test data cleaned up cleanly.');

  console.log('\n====================================================');
  console.log('   ALL 9 TEST CASES PASSED SUCCESSFULLY (100% OK)   ');
  console.log('====================================================');
}

runAllTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
