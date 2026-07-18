'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { BookingWithDetails, Court } from '@/lib/supabase/types';
import { HOURS } from '@/lib/data/constants';
import { formatRupiah, formatDateLong, getEndTime, getTodayStr, sportDisplayName } from '@/lib/utils/helpers';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    occupancyRate: 0,
    activeBookingsCount: 0,
  });
  const [recentBookings, setRecentBookings] = useState<BookingWithDetails[]>([]);
  const [sportDataStats, setSportDataStats] = useState<{ sport: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      const todayStr = getTodayStr();

      try {
        // 1. Fetch active courts count
        const { data: courtsData } = await supabase
          .from('courts')
          .select('id')
          .eq('is_active', true);
        const activeCourtsCount = courtsData?.length || 0;

        // 2. Fetch today's bookings and slots
        const { data: dataBookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('booking_date', todayStr)
          .not('status', 'in', '("cancelled","expired")');
        const todayBookings = dataBookings as any[] | null;

        // Revenue calculations (confirmed today)
        const confirmedToday = todayBookings?.filter(b => b.status === 'confirmed') || [];
        const revenue = confirmedToday.reduce((sum, b) => sum + b.total_price, 0);

        // Occupancy calculation
        const todayBookingIds = todayBookings?.map(b => b.id) || [];
        let occupiedCount = 0;
        if (todayBookingIds.length > 0) {
          const { data: todaySlots } = await supabase
            .from('booking_slots')
            .select('*')
            .in('booking_id', todayBookingIds);
          occupiedCount = todaySlots?.length || 0;
        }

        const totalCapacity = activeCourtsCount * HOURS.length;
        const occupancy = totalCapacity > 0 ? Math.round((occupiedCount / totalCapacity) * 100) : 0;

        // Active bookings count
        const activeCount = todayBookings?.length || 0;

        setStats({
          totalRevenue: revenue,
          occupancyRate: occupancy,
          activeBookingsCount: activeCount,
        });

        // 3. Fetch recent 10 bookings
        const { data: dataList } = await supabase
          .from('bookings')
          .select('*, courts(*)')
          .order('created_at', { ascending: false })
          .limit(10);
        const bookingsList = dataList as any[] | null;

        if (bookingsList) {
          // Fetch slots for these bookings to show range
          const bookingIds = bookingsList.map(b => b.id);
          const { data: dataSlots } = await supabase
            .from('booking_slots')
            .select('*')
            .in('booking_id', bookingIds);
          const slotsList = dataSlots as any[] | null;

          const fullBookings = bookingsList.map(b => ({
            ...b,
            booking_slots: slotsList?.filter(s => s.booking_id === b.id) || [],
          }));

          setRecentBookings(fullBookings as any);
        }

        // 4. Fetch sport booking distribution (all time or current month)
        const { data: dataAll } = await supabase
          .from('bookings')
          .select('sport_type')
          .not('status', 'in', '("cancelled","expired")');
        const allBookings = dataAll as any[] | null;

        const counts: Record<string, number> = { badminton: 0, futsal: 0, 'tenis-meja': 0 };
        allBookings?.forEach(b => {
          if (counts[b.sport_type] !== undefined) {
            counts[b.sport_type]++;
          }
        });

        setSportDataStats([
          { sport: 'badminton', count: counts.badminton },
          { sport: 'futsal', count: counts.futsal },
          { sport: 'tenis-meja', count: counts['tenis-meja'] },
        ]);

      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-body-md text-on-surface-variant animate-pulse">Memuat Ringkasan Dashboard...</p>
      </div>
    );
  }

  const maxSportCount = Math.max(...sportDataStats.map(s => s.count), 1);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="font-headline-lg text-2xl text-on-surface font-bold">Overview Dashboard</h1>
        <p className="font-body-sm text-sm text-on-surface-variant">Laporan bisnis, metrik okupansi lapangan, dan daftar pemesanan terbaru.</p>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue */}
        <div className="bg-white border border-outline-variant/60 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-[#f3f2ff] text-[#0052ff] rounded-xl flex items-center justify-center select-none">
            <span className="material-symbols-outlined text-2xl" data-icon="payments">payments</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-on-surface-variant/80 font-medium select-none mb-1">Total Omzet Hari Ini</span>
            <span className="font-headline-lg text-2xl font-black text-on-surface select-all">
              {formatRupiah(stats.totalRevenue)}
            </span>
            <span className="text-[10px] text-[#00C853] font-semibold mt-1 flex items-center gap-1 select-none">
              ● Transaksi Lunas
            </span>
          </div>
        </div>

        {/* Occupancy */}
        <div className="bg-white border border-outline-variant/60 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-[#eefaf2] text-[#00c853] rounded-xl flex items-center justify-center select-none">
            <span className="material-symbols-outlined text-2xl" data-icon="percent">percent</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-on-surface-variant/80 font-medium select-none mb-1">Tingkat Okupansi Lapangan</span>
            <span className="font-headline-lg text-2xl font-black text-on-surface select-none">
              {stats.occupancyRate}%
            </span>
            <span className="text-[10px] text-on-surface-variant mt-1 select-none">
              Dari kapasitas total 9 lapangan aktif
            </span>
          </div>
        </div>

        {/* Active Bookings */}
        <div className="bg-white border border-outline-variant/60 rounded-2xl p-6 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-[#fff4e6] text-[#ff9200] rounded-xl flex items-center justify-center select-none">
            <span className="material-symbols-outlined text-2xl" data-icon="confirmation_number">confirmation_number</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-on-surface-variant/80 font-medium select-none mb-1">Pemesanan Aktif Hari Ini</span>
            <span className="font-headline-lg text-2xl font-black text-on-surface select-none">
              {stats.activeBookingsCount}
            </span>
            <span className="text-[10px] text-on-surface-variant mt-1 select-none">
              Termasuk pending &amp; hold
            </span>
          </div>
        </div>
      </div>

      {/* CHARTS & STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sport distribution chart */}
        <div className="lg:col-span-4 bg-white border border-outline-variant/60 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="font-headline-md text-base font-bold text-on-surface select-none">Distribusi Olahraga</h3>
          
          <div className="space-y-4 pt-2">
            {sportDataStats.map(item => {
              const percentage = Math.round((item.count / maxSportCount) * 100);
              return (
                <div key={item.sport} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-on-surface capitalize">{sportDisplayName(item.sport)}</span>
                    <span className="font-label-caps text-on-surface-variant">{item.count} Booking</span>
                  </div>
                  <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden w-full">
                    <div 
                      className="h-full bg-[#0052ff] rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-on-surface-variant/80 select-none bg-slate-50 p-3 rounded-lg border border-outline-variant/30 leading-relaxed">
            * Grafik menunjukkan total pemesanan aktif kumulatif untuk masing-masing cabang olahraga.
          </div>
        </div>

        {/* Recent Bookings List */}
        <div className="lg:col-span-8 bg-white border border-outline-variant/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-outline-variant flex justify-between items-center select-none">
            <h3 className="font-headline-md text-base font-bold text-on-surface">Pemesanan Terbaru</h3>
            <Link href="/admin/transactions" className="text-xs font-bold text-[#0052ff] hover:underline flex items-center gap-1">
              Lihat Semua <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          <div className="flex-grow overflow-x-auto">
            {recentBookings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-on-surface-variant/60">
                <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                <p className="text-sm">Belum ada pemesanan masuk.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-outline-variant text-[10px] text-on-surface-variant/80 font-label-caps tracking-wider select-none">
                    <th className="py-3.5 px-6">KODE</th>
                    <th className="py-3.5 px-4">PEMESAN</th>
                    <th className="py-3.5 px-4">LAPANGAN</th>
                    <th className="py-3.5 px-4">TANGGAL &amp; WAKTU</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-6 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBookings.map((b) => {
                    const sortedSlots = b.booking_slots?.map(s => s.hour_slot).sort() || [];
                    const timeRange = sortedSlots.length > 0
                      ? `${sortedSlots[0]} - ${getEndTime(sortedSlots[sortedSlots.length - 1])}`
                      : 'N/A';

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-6 font-label-caps font-bold text-[#003ec7] select-all">
                          {b.booking_code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-on-surface">
                          {b.customer_name}
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant">
                          {b.courts?.name || `Lapangan ${b.court_id}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col text-xs">
                            <span className="font-semibold text-on-surface">{b.booking_date}</span>
                            <span className="text-on-surface-variant">{timeRange}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase select-none ${
                              b.status === 'confirmed' ? 'bg-[#eefaf2] text-[#00c853]' :
                              b.status === 'pending' ? 'bg-[#fff4e6] text-[#ff9200]' :
                              b.status === 'hold' ? 'bg-sky-50 text-sky-600' :
                              b.status === 'maintenance' ? 'bg-slate-100 text-slate-500' :
                              'bg-[#ffdad6] text-[#ba1a1a]'
                            }`}>
                              {b.status === 'confirmed' ? 'Lunas' :
                               b.status === 'pending' ? 'Pending' :
                               b.status === 'hold' ? 'Hold' :
                               b.status === 'maintenance' ? 'Block' :
                               b.status}
                            </span>
                            {b.payment_proof_url && (
                              <span className="ml-1.5 text-[#0052ff] flex items-center" title="Ada bukti transfer (Upload)">
                                <span className="material-symbols-outlined text-[15px]">image</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-right font-bold text-on-surface">
                          <div className="flex flex-col items-end">
                            <span>{formatRupiah(b.total_price)}</span>
                            {b.unique_code > 0 && (
                              <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                                Unik: {b.unique_code}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
