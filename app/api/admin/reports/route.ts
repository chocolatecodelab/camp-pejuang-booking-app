import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/** GET /api/admin/reports?from=&to= — occupancy and revenue reports */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default H-30
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0]; // Default today

  // Query 1: Total Revenue (Confirmed & Completed bookings)
  const { data: revenueData, error: revenueError } = await supabaseAdmin
    .from('bookings')
    .select('claimed_amount, total_price, status')
    .in('status', ['confirmed', 'completed'])
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`);

  if (revenueError) {
    return NextResponse.json({ error: revenueError.message }, { status: 500 });
  }

  const totalRevenue = (revenueData || []).reduce(
    (sum, b) => sum + Number(b.claimed_amount),
    0
  );

  // Query 2: Booking counts by status
  const { data: countData, error: countError } = await supabaseAdmin
    .from('bookings')
    .select('status')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const counts = (countData || []).reduce(
    (acc: Record<string, number>, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    },
    { hold: 0, pending_verification: 0, confirmed: 0, completed: 0, rejected: 0, expired: 0, cancelled: 0 }
  );

  // Query 3: Occupancy breakdown by camp
  // Fetch camps and rooms
  const { data: camps, error: campsError } = await supabaseAdmin
    .from('camps')
    .select(`
      id, name, slug, type,
      rooms (id, name, is_active)
    `)
    .eq('is_active', true);

  if (campsError) {
    return NextResponse.json({ error: campsError.message }, { status: 500 });
  }

  // Fetch all confirmed & completed bookings that overlap the period to calculate occupancy
  const { data: confirmedBookings, error: bookingsError } = await supabaseAdmin
    .from('bookings')
    .select('room_id, check_in, check_out')
    .in('status', ['confirmed', 'completed']);

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // Calculate occupancy per camp
  // Total days in filter range
  const startDate = new Date(from);
  const endDate = new Date(to);
  const totalPeriodDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const occupancyByCamp = (camps || []).map((camp: any) => {
    const activeRooms = (camp.rooms || []).filter((r: any) => r.is_active);
    const roomIds = activeRooms.map((r: any) => r.id);

    if (roomIds.length === 0) {
      return {
        id: camp.id,
        name: camp.name,
        slug: camp.slug,
        type: camp.type,
        room_count: 0,
        occupancy_rate: 0,
      };
    }

    // Filter bookings for this camp's rooms
    const campBookings = (confirmedBookings || []).filter((b) =>
      roomIds.includes(b.room_id)
    );

    // Calculate total booked days within the filter range
    let totalBookedDays = 0;
    campBookings.forEach((booking) => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);

      // Overlap calculation
      const overlapStart = new Date(Math.max(startDate.getTime(), checkIn.getTime()));
      const overlapEnd = new Date(Math.min(endDate.getTime(), checkOut.getTime()));

      const overlapDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
      if (overlapDays > 0) {
        totalBookedDays += overlapDays;
      }
    });

    // Total available room days = roomCount * totalPeriodDays
    const totalAvailableDays = roomIds.length * totalPeriodDays;
    const occupancyRate = Math.min(100, Math.round((totalBookedDays / totalAvailableDays) * 100));

    return {
      id: camp.id,
      name: camp.name,
      slug: camp.slug,
      type: camp.type,
      room_count: roomIds.length,
      occupancy_rate: occupancyRate,
    };
  });

  return NextResponse.json({
    report: {
      from,
      to,
      total_revenue: totalRevenue,
      booking_counts: counts,
      occupancy_by_camp: occupancyByCamp,
    },
  });
}
