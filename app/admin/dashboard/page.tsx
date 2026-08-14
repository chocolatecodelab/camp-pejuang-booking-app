'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatRupiah, formatDateRange, getStatusLabel, getStatusColor } from '@/lib/utils/helpers';

interface DashboardStats {
  total_revenue: number;
  booking_counts: {
    hold: number;
    pending_verification: number;
    confirmed: number;
    completed: number;
    rejected: number;
    expired: number;
    cancelled: number;
  };
  occupancy_by_camp: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    room_count: number;
    occupancy_rate: number;
  }>;
}

interface RecentBooking {
  id: string;
  booking_code: string;
  customer_name: string;
  check_in: string;
  check_out: string;
  status: string;
  total_price: number;
  created_at: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        // 1. Fetch reports
        const repRes = await fetch('/api/admin/reports');
        const repData = await repRes.json();
        if (repData.report) {
          setStats(repData.report);
        }

        // 2. Fetch recent bookings
        const bRes = await fetch('/api/admin/bookings?limit=5');
        const bData = await bRes.json();
        if (bData.bookings) {
          setRecentBookings(bData.bookings);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeOccupancyRate = stats?.occupancy_by_camp.length
    ? Math.round(stats.occupancy_by_camp.reduce((sum, c) => sum + c.occupancy_rate, 0) / stats.occupancy_by_camp.length)
    : 0;

  const totalCampsCount = stats?.occupancy_by_camp.length || 0;
  const totalRoomsCount = stats?.occupancy_by_camp.reduce((sum, c) => sum + c.room_count, 0) || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-headline-md font-bold text-on-surface">Dashboard Admin</h1>
        <p className="text-body-md text-on-surface-variant">Ikhtisar hunian camp dan rekapitulasi transaksi Camp Pejuang.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-[#EAEAEA] shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-primary/10 rounded-lg text-primary">
            <span className="material-symbols-outlined text-2xl font-bold">payments</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium">Omzet (30 Hari Terakhir)</p>
            <p className="text-headline-sm font-bold text-on-surface">{formatRupiah(stats?.total_revenue || 0)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#EAEAEA] shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-secondary/10 rounded-lg text-secondary">
            <span className="material-symbols-outlined text-2xl font-bold">room_preferences</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium">Rata-rata Okupansi Kamar</p>
            <p className="text-headline-sm font-bold text-on-surface">{activeOccupancyRate}%</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#EAEAEA] shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-500/10 rounded-lg text-amber-600">
            <span className="material-symbols-outlined text-2xl font-bold">pending_actions</span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-medium">Menunggu Verifikasi</p>
            <p className="text-headline-sm font-bold text-on-surface">{stats?.booking_counts.pending_verification || 0}</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Camp Occupancy Status */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-[#EAEAEA] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
            <h3 className="text-headline-sm text-base font-bold">Status Hunian per Camp</h3>
            <span className="text-xs text-outline">{totalCampsCount} Camp ({totalRoomsCount} Kamar)</span>
          </div>

          <div className="space-y-4">
            {stats?.occupancy_by_camp.map((camp) => (
              <div key={camp.id} className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-on-surface">{camp.name}</span>
                  <span className="text-on-surface-variant">{camp.occupancy_rate}%</span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${camp.occupancy_rate}%` }}
                  ></div>
                </div>
                
                <p className="text-xs text-outline">Kapasitas: {camp.room_count} kamar aktif</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recent Bookings */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#EAEAEA] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
            <h3 className="text-headline-sm text-base font-bold">Pemesanan Terbaru</h3>
            <Link href="/admin/transactions" className="text-xs text-primary font-bold hover:underline">
              Lihat Semua
            </Link>
          </div>

          <div className="divide-y divide-[#EAEAEA] space-y-4">
            {recentBookings.length === 0 ? (
              <p className="text-sm text-outline py-4 text-center">Belum ada pemesanan masuk</p>
            ) : (
              recentBookings.map((b) => (
                <div key={b.id} className="pt-4 first:pt-0 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-on-surface hover:text-primary transition-colors">
                      <Link href={`/admin/transactions?code=${b.booking_code}`}>{b.customer_name}</Link>
                    </p>
                    <p className="text-xs text-outline font-semibold tracking-wider">{b.booking_code}</p>
                    <p className="text-xs text-on-surface-variant">
                      {formatDateRange(b.check_in, b.check_out)}
                    </p>
                  </div>
                  <div className="text-right space-y-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(b.status)}`}>
                      {getStatusLabel(b.status)}
                    </span>
                    <p className="text-xs font-bold text-on-surface">{formatRupiah(b.total_price)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
