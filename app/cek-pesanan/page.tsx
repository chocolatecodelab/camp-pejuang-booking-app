'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatRupiah, formatDateRange, getStatusLabel, getStatusColor, getCampTypeLabel, getCampTypeColor, formatTimeRemaining } from '@/lib/utils/helpers';
import { waContactAdmin } from '@/lib/whatsapp';
import Swal from 'sweetalert2';

interface HistoryItem {
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
}

interface PricingPackage {
  id: string;
  label: string;
  duration_days: number;
}

interface TrackedBooking {
  booking_id: string;
  booking_code: string;
  status: string;
  customer_name: string;
  room_name: string;
  room_id: string;
  floor_label: string;
  camp_name: string;
  camp_slug: string;
  camp_type: string;
  check_in: string;
  check_out: string;
  payment_type: 'dp' | 'full';
  payment_channel: 'qris' | 'transfer_bank';
  claimed_amount: number;
  total_price: number;
  hold_expires_at: string | null;
  extension_offer_expires_at: string | null;
  rejected_reason: string | null;
  cancelled_reason: string | null;
  package_label: string;
  duration_days: number;
  can_extend: boolean;
  history: HistoryItem[];
}

function TrackBookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customerName, setCustomerName] = useState('');
  const [bookingCode, setBookingCode] = useState('');

  const [booking, setBooking] = useState<TrackedBooking | null>(null);
  const [pricingPackages, setPricingPackages] = useState<PricingPackage[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [adminWhatsapp, setAdminWhatsapp] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [extending, setExtending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch admin WhatsApp settings dynamically
  useEffect(() => {
    async function fetchSettings() {
      const { supabase } = await import('@/lib/supabase/client');
      const { data } = await supabase.from('system_settings').select('admin_whatsapp').single();
      if (data?.admin_whatsapp) {
        setAdminWhatsapp(data.admin_whatsapp);
      }
    }
    fetchSettings();
  }, []);

  // Auto-run if URL query params exist
  useEffect(() => {
    const nameParam = searchParams.get('name') || '';
    const codeParam = searchParams.get('code') || '';
    if (nameParam && codeParam) {
      setCustomerName(nameParam);
      setBookingCode(codeParam);
      handleTrack(nameParam, codeParam);
    }
  }, [searchParams]);

  // Fetch pricing packages for extension if booking changes and can extend
  useEffect(() => {
    if (booking?.can_extend) {
      async function fetchPricing() {
        try {
          const res = await fetch(`/api/rooms/${booking?.room_id}/pricing`);
          const data = await res.json();
          setPricingPackages(data.pricing_packages || []);
          if (data.pricing_packages?.length > 0) {
            setSelectedPkgId(data.pricing_packages[0].id);
          }
        } catch (err) {
          console.error('Error fetching extension pricing:', err);
        }
      }
      fetchPricing();
    }
  }, [booking]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTrack(customerName, bookingCode);
  };

  const handleTrack = async (name: string, code: string) => {
    setErrorMsg('');
    setBooking(null);
    if (!name || !code) {
      setErrorMsg('Nama dan kode booking wajib diisi');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/bookings/track?name=${encodeURIComponent(name.trim())}&code=${code.trim().toUpperCase()}`);
      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.error || 'Pemesanan tidak ditemukan. Periksa nama & kode booking Anda.');
        setLoading(false);
        return;
      }

      setBooking(result);
    } catch (err) {
      console.error('Track booking failed:', err);
      setErrorMsg('Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !selectedPkgId) return;

    setExtending(true);

    try {
      const res = await fetch(`/api/bookings/${booking.booking_id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing_package_id: selectedPkgId }),
      });

      const result = await res.json();

      if (!res.ok) {
        Swal.fire({
          icon: 'error',
          title: 'Perpanjangan Gagal',
          text: result.error || 'Terjadi kesalahan saat memproses perpanjangan',
          confirmButtonColor: '#b52330',
        });
        setExtending(false);
        return;
      }

      Swal.fire({
        icon: 'success',
        title: 'Form Perpanjangan Dibuat',
        text: 'Pesanan perpanjangan berhasil di-hold. Silakan lakukan pembayaran untuk menyelesaikan proses perpanjangan.',
        confirmButtonColor: '#b52330',
      }).then(() => {
        router.push(`/booking/${result.booking.id}/bayar`);
      });

    } catch (err) {
      console.error('Extend request failed:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal terhubung ke server',
        confirmButtonColor: '#b52330',
      });
      setExtending(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-warm selection:bg-primary/10 selection:text-primary">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full bg-surface-cream/80 backdrop-blur-md border-b border-border-subtle shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl font-bold">arrow_back</span>
            <span className="text-label-md font-semibold text-on-surface hover:text-primary transition-colors">Kembali</span>
          </Link>
          <span className="font-headline-sm text-sm font-bold text-primary">Lacak Pemesanan</span>
        </div>
      </header>

      <main className="flex-grow max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Track Form Card */}
        <section className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-headline-sm font-bold">Lacak Status Pesanan Anda</h2>
            <p className="text-body-md text-on-surface-variant text-sm">Masukkan nama lengkap pemesan dan kode booking unik Anda.</p>
          </div>

          <form onSubmit={handleTrackSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-error/10 text-error rounded-md text-sm font-semibold flex items-center gap-2 border border-error/20">
                <span className="material-symbols-outlined text-lg">error</span>
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Nama Pemesan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Fauzi"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Kode Booking</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CP-0719-7XQ2"
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm font-medium tracking-widest uppercase transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-md text-sm font-bold shadow-md hover:shadow-lg transition-standard disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Melacak...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">search</span>
                  Cari Pesanan
                </>
              )}
            </button>
          </form>
        </section>

        {/* Search Results */}
        {booking && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">

            {/* Booking Detail Column */}
            <div className="lg:col-span-7 space-y-6">

              {/* Main Detail Card */}
              <div className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-border-subtle pb-4">
                  <div className="space-y-1">
                    <p className="text-label-sm text-outline uppercase tracking-wider">KODE BOOKING</p>
                    <p className="text-headline-sm font-bold text-primary tracking-widest">{booking.booking_code}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusColor(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-1">
                    <p className="text-label-sm text-outline uppercase tracking-wider">Nama Pemesan</p>
                    <p className="font-bold text-on-surface">{booking.customer_name}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-label-sm text-outline uppercase tracking-wider">Camp & Lantai</p>
                    <p className="font-bold text-on-surface">
                      {booking.camp_name} ({booking.floor_label || 'Lantai 1'})
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getCampTypeColor(booking.camp_type)}`}>
                      Camp {getCampTypeLabel(booking.camp_type)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-label-sm text-outline uppercase tracking-wider">Nomor Kamar</p>
                    <p className="font-bold text-on-surface">{booking.room_name}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-label-sm text-outline uppercase tracking-wider">Paket Durasi</p>
                    <p className="font-bold text-on-surface">{booking.package_label} ({booking.duration_days} Hari)</p>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-label-sm text-outline uppercase tracking-wider">Periode Tinggal</p>
                    <p className="font-bold text-on-surface text-base">
                      {formatDateRange(booking.check_in, booking.check_out)}
                    </p>
                  </div>
                </div>

                {/* Sub-instructions based on status */}
                {booking.status === 'hold' && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-1 text-center sm:text-left text-sm">
                      <p className="font-bold text-amber-900">Uang Muka/Sewa Belum Dibayar</p>
                      <p className="text-amber-800 text-xs">Silakan upload bukti transfer agar kamar tidak di-release.</p>
                    </div>
                    <Link
                      href={`/booking/${booking.booking_id}/bayar`}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      Bayar Sekarang
                    </Link>
                  </div>
                )}

                {booking.status === 'rejected' && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-1 text-center sm:text-left text-sm">
                      <p className="font-bold text-red-900">Bukti Transfer Ditolak Admin</p>
                      {booking.rejected_reason && (
                        <p className="text-red-800 text-xs italic">Alasan: "{booking.rejected_reason}"</p>
                      )}
                      <p className="text-red-700 text-xs">Silakan upload ulang bukti transfer yang valid agar sewa dapat diproses.</p>
                    </div>
                    <Link
                      href={`/booking/${booking.booking_id}/bayar`}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold shadow transition-colors flex items-center gap-1 shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      Upload Ulang Bukti
                    </Link>
                  </div>
                )}

                {booking.status === 'cancelled' && booking.cancelled_reason && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm space-y-1">
                    <p className="font-bold text-gray-900">Alasan Pembatalan Sewa:</p>
                    <p className="text-gray-800 italic leading-relaxed">"{booking.cancelled_reason}"</p>
                  </div>
                )}
              </div>

              {/* Status History Audit Trail */}
              <div className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-4">
                <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Riwayat Status Pesanan</h3>
                <div className="relative pl-6 border-l-2 border-border-subtle space-y-6">
                  {booking.history && booking.history.length > 0 ? (
                    booking.history.map((h, i) => (
                      <div key={i} className="relative space-y-1">
                        <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-primary bg-white"></div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(h.new_status)}`}>
                            {getStatusLabel(h.new_status)}
                          </span>
                          <span className="text-xs text-outline">
                            {new Date(h.changed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        {h.reason && <p className="text-xs text-on-surface-variant italic">"{h.reason}"</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-outline">Belum ada riwayat aktivitas.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Column: Payment Details or Extension Window Form */}
            <div className="lg:col-span-5 space-y-6">

              {/* Payment Summary */}
              <div className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
                <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Rincian Pembayaran</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-border-subtle pb-2">
                    <span className="text-on-surface-variant">Jenis Pembayaran</span>
                    <span className="font-semibold text-on-surface capitalize">{booking.payment_type === 'dp' ? 'DP (Uang Muka)' : 'Penuh (Lunas)'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-subtle pb-2">
                    <span className="text-on-surface-variant">Metode Bayar</span>
                    <span className="font-semibold text-on-surface capitalize">{booking.payment_channel.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-subtle pb-2">
                    <span className="text-on-surface-variant">Total Nilai Kontrak</span>
                    <span className="font-bold text-on-surface">{formatRupiah(booking.total_price)}</span>
                  </div>
                  <div className="flex justify-between text-primary font-bold border-b border-border-subtle pb-2 text-base">
                    <span>Nominal Ditransfer</span>
                    <span>{formatRupiah(booking.claimed_amount)}</span>
                  </div>
                  {booking.status === 'confirmed' && (
                    booking.claimed_amount < booking.total_price ? (
                      <div className="flex justify-between text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-semibold">
                        <span>Sisa Pelunasan di Camp</span>
                        <span>{formatRupiah(booking.total_price - booking.claimed_amount)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-semibold">
                        <span className="flex items-center gap-1 text-emerald-700 font-bold">
                          <span className="material-symbols-outlined text-base text-emerald-600">verified</span>
                          Status Pembayaran
                        </span>
                        <span className="text-emerald-700 font-extrabold bg-emerald-100 px-2 py-0.5 rounded">LUNAS (100%)</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Priority Extension Form (if eligible) */}
              {booking.can_extend && (
                <div className="bg-surface-cream p-6 rounded-xl border-2 border-primary shadow-md space-y-6 animate-pulse">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary rounded-full">
                      <span className="material-symbols-outlined text-xs font-bold">celebration</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Priority Extension</span>
                    </div>
                    <h3 className="text-headline-sm font-bold">Perpanjang Masa Sewa</h3>
                    <p className="text-xs text-on-surface-variant">
                      Kamar Anda di-lock khusus untuk Anda perpanjang sewa sebelum dibuka untuk pendaftaran publik.
                    </p>
                  </div>

                  <form onSubmit={handleExtend} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Pilih Paket Durasi</label>
                      <select
                        value={selectedPkgId}
                        onChange={(e) => setSelectedPkgId(e.target.value)}
                        className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm font-medium"
                      >
                        {pricingPackages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.label} ({pkg.duration_days} Hari)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={extending || !selectedPkgId}
                      className="w-full py-3 bg-primary text-white rounded-md text-sm font-bold shadow-md hover:shadow-lg transition-standard hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {extending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Memproses...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">autorenew</span>
                          Perpanjang Sewa Sekarang
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Contact Admin Help */}
              <div className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm text-center space-y-4">
                <span className="material-symbols-outlined text-primary text-3xl">support_agent</span>
                <div className="space-y-1">
                  <p className="text-label-md font-bold">Butuh Bantuan Admin?</p>
                  <p className="text-xs text-on-surface-variant">Hubungi admin langsung jika ada kendala pembayaran atau verifikasi.</p>
                </div>
                <a
                  href={waContactAdmin(booking.booking_code, booking.customer_name, adminWhatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-success-green hover:bg-green-600 text-white rounded-md text-sm font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>
                  WhatsApp Admin
                </a>
              </div>

            </div>

          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-inverse-surface text-inverse-on-surface py-8 border-t border-border-subtle mt-20">
        <div className="max-w-5xl mx-auto px-4 text-center text-label-sm text-inverse-on-surface/50">
          © {new Date().getFullYear()} Camp Pejuang Booking App. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default function TrackBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-warm">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <TrackBookingContent />
    </Suspense>
  );
}
