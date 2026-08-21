'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatRupiah, getTodayStr, calculateCheckoutDate, formatDateRange, validateWhatsApp, normalizeWhatsApp } from '@/lib/utils/helpers';

interface PricingPackage {
  id: string;
  label: string;
  occupancy_label?: string | null;
  occupancy_tier?: number;
  duration_days: number;
  price: number;
  min_dp_amount: number | null;
}

interface Room {
  id: string;
  name: string;
  floor_label: string;
  camp_id: string;
  camps: {
    id: string;
    name: string;
    type: string;
    address: string;
  };
}

function BookingFormContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomId = params?.bookingId as string;
  const initialCheckIn = searchParams.get('check_in') || '';
  const initialPackageId = searchParams.get('package_id') || '';

  const [room, setRoom] = useState<Room | null>(null);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PricingPackage | null>(null);

  // Form states
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'dp' | 'full'>('full');
  const [paymentChannel, setPaymentChannel] = useState<'qris' | 'transfer_bank'>('qris');

  // Payment method visibility settings
  const [settings, setSettings] = useState<{ is_qris_active: boolean; is_bank_active: boolean }>({
    is_qris_active: true,
    is_bank_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!roomId) return;
    async function fetchData() {
      try {
        // Fetch room info first (we will simulate joins by fetching the camp)
        const roomRes = await fetch(`/api/rooms/${roomId}/pricing`);
        const pricingData = await roomRes.json();
        setPackages(pricingData.pricing_packages || []);

        // Fetch camp through slug/id by getting camp detail
        // For simple lookup, let's fetch /api/camps first to find our camp
        const campsRes = await fetch('/api/camps');
        const campsData = await campsRes.json();

        // Let's query room details from a mock or we can just fetch camp details for the specific camp
        // Since we don't have a direct /api/rooms/[id] endpoint, we search camps
        let foundRoom: Room | null = null;
        for (const c of campsData.camps || []) {
          const detailRes = await fetch(`/api/camps/${c.slug}`);
          const detailData = await detailRes.json();
          const r = detailData.rooms.find((rm: any) => rm.id === roomId);
          if (r) {
            foundRoom = {
              id: r.id,
              name: r.name,
              floor_label: r.floor_label,
              camp_id: c.id,
              camps: {
                id: c.id,
                name: c.name,
                type: c.type,
                address: c.address,
              }
            };
            break;
          }
        }

        if (!foundRoom) {
          router.replace('/');
          return;
        }

        setRoom(foundRoom);

        // Pre-select package
        const pkg = pricingData.pricing_packages.find((p: any) => p.id === initialPackageId) || pricingData.pricing_packages[0];
        setSelectedPackage(pkg || null);

        // Pre-select check-in
        setCheckInDate(initialCheckIn || getTodayStr());

        // Fetch system settings for active payment method visibility
        const { data: sData } = await supabase
          .from('system_settings')
          .select('is_qris_active, is_bank_active')
          .single();

        if (sData) {
          const isQris = (sData as any).is_qris_active ?? true;
          const isBank = (sData as any).is_bank_active ?? true;
          setSettings({ is_qris_active: isQris, is_bank_active: isBank });

          if (!isQris && isBank) {
            setPaymentChannel('transfer_bank');
          } else if (isQris && !isBank) {
            setPaymentChannel('qris');
          }
        }

      } catch (err) {
        console.error('Error fetching booking data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [roomId, initialPackageId, initialCheckIn, router]);

  // Adjust payment type availability based on selected pricing package
  useEffect(() => {
    if (selectedPackage && !selectedPackage.min_dp_amount) {
      setPaymentType('full');
    }
  }, [selectedPackage]);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!room || !selectedPackage) return null;

  const checkOutDate = calculateCheckoutDate(checkInDate, selectedPackage.duration_days);
  const totalAmount = selectedPackage.price;
  const paymentAmount = paymentType === 'full' ? totalAmount : (selectedPackage.min_dp_amount || totalAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName || customerName.trim().length < 2) {
      setErrorMsg('Nama lengkap minimal 2 karakter');
      return;
    }

    if (!whatsappNumber) {
      setErrorMsg('Nomor WhatsApp wajib diisi');
      return;
    }

    if (!validateWhatsApp(whatsappNumber)) {
      setErrorMsg('Nomor WhatsApp tidak valid (Gunakan format 62xxxxxxxxxx atau 08xxxxxxxxxx)');
      return;
    }

    setSubmitting(true);

    try {
      const normalizedWa = normalizeWhatsApp(whatsappNumber);

      const payload = {
        room_id: room.id,
        pricing_package_id: selectedPackage.id,
        check_in: checkInDate,
        customer_name: customerName.trim(),
        whatsapp_number: normalizedWa,
        notes: notes.trim() || null,
        payment_type: paymentType,
        payment_channel: paymentChannel,
        claimed_amount: Number(paymentAmount),
        parent_booking_id: null,
      };

      const res = await fetch('/api/bookings/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.error || 'Terjadi kesalahan saat memproses booking');
        setSubmitting(false);
        return;
      }

      // Redirect to payment instructions page
      router.push(`/booking/${result.booking.id}/bayar`);

    } catch (err) {
      console.error('Submit booking failed:', err);
      setErrorMsg('Gagal terhubung ke server');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-warm selection:bg-primary/10 selection:text-primary">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full bg-surface-cream/80 backdrop-blur-md border-b border-border-subtle shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl font-bold">arrow_back</span>
            <span className="text-label-md font-semibold text-on-surface hover:text-primary transition-colors">Kembali</span>
          </button>
          <span className="font-headline-sm text-sm font-bold text-primary">Form Booking Kamar</span>
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Main Form Fields */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
              <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Data Diri Penghuni</h3>

              {errorMsg && (
                <div className="p-3.5 bg-error/10 text-error rounded-md text-sm font-semibold flex items-center gap-2 border border-error/20">
                  <span className="material-symbols-outlined text-lg">error</span>
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant font-semibold">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Masukkan nama lengkap sesuai KTP"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant font-semibold">Nomor WhatsApp</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 08123456789"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm transition-colors"
                  />
                  <p className="text-label-sm text-outline">Nomor akan digunakan admin untuk konfirmasi & reminder sewa.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant font-semibold">Catatan Tambahan (Opsional)</label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan jika ada permintaan khusus atau catatan lainnya"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Fields */}
            <div className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
              <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Metode Pembayaran</h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant font-semibold">Jenis Pembayaran</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentType('full')}
                      className={`p-3 rounded-lg border text-sm font-bold text-center transition-all ${paymentType === 'full'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-outline-variant bg-white text-on-surface-variant hover:bg-background-warm'
                        }`}
                    >
                      Bayar Penuh (100%)
                    </button>
                    <button
                      type="button"
                      disabled={!selectedPackage.min_dp_amount}
                      onClick={() => setPaymentType('dp')}
                      className={`p-3 rounded-lg border text-sm font-bold text-center transition-all ${!selectedPackage.min_dp_amount
                        ? 'opacity-40 cursor-not-allowed border-outline-variant bg-surface-container-low text-outline'
                        : paymentType === 'dp'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-outline-variant bg-white text-on-surface-variant hover:bg-background-warm'
                        }`}
                    >
                      Uang Muka (DP)
                    </button>
                  </div>
                  {!selectedPackage.min_dp_amount && (
                    <p className="text-label-sm text-outline">Paket durasi ini tidak melayani pembayaran Uang Muka (DP).</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant font-semibold">Channel Pembayaran</label>
                  <div className={`grid gap-4 ${settings.is_qris_active && settings.is_bank_active ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {settings.is_qris_active && (
                      <button
                        type="button"
                        onClick={() => setPaymentChannel('qris')}
                        className={`p-3 rounded-lg border text-sm font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${paymentChannel === 'qris'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-outline-variant bg-white text-on-surface-variant hover:bg-background-warm'
                          }`}
                      >
                        <span className="material-symbols-outlined">qr_code_2</span>
                        QRIS Statis
                      </button>
                    )}
                    {settings.is_bank_active && (
                      <button
                        type="button"
                        onClick={() => setPaymentChannel('transfer_bank')}
                        className={`p-3 rounded-lg border text-sm font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${paymentChannel === 'transfer_bank'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-outline-variant bg-white text-on-surface-variant hover:bg-background-warm'
                          }`}
                      >
                        <span className="material-symbols-outlined">account_balance</span>
                        Transfer Bank Manual
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Summary Sidebar */}
          <div className="lg:col-span-4 bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
            <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Ringkasan Pesanan</h3>

            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-label-sm text-outline uppercase tracking-wider">Camp</p>
                <p className="font-bold text-on-surface">{room.camps.name}</p>
                <p className="text-label-sm text-on-surface-variant">{room.camps.address}</p>
              </div>

              <div className="space-y-1">
                <p className="text-label-sm text-outline uppercase tracking-wider">Kamar & Lantai</p>
                <p className="font-bold text-on-surface">{room.name} ({room.floor_label || 'Lantai 1'})</p>
              </div>

              <div className="space-y-1">
                <p className="text-label-sm text-outline uppercase tracking-wider">Opsi Hunian & Durasi</p>
                <div className="p-2.5 bg-background-warm rounded-md border border-border-subtle space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-on-surface">
                      {selectedPackage.occupancy_label || (selectedPackage.occupancy_tier === 1 ? 'Private 1 Kamar' : `Sharing ${selectedPackage.occupancy_tier || 3} Orang`)}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {selectedPackage.label} ({selectedPackage.duration_days} Hari)
                    </span>
                  </div>
                  <p className="text-[11px] text-outline font-semibold">
                    {formatDateRange(checkInDate, checkOutDate)}
                  </p>
                </div>
              </div>

              <div className="border-t border-dashed border-border-subtle pt-4 space-y-2">
                <div className="flex justify-between items-center w-full font-medium">
                  <span className="text-on-surface-variant">Harga Sewa</span>
                  <span>{formatRupiah(totalAmount)}</span>
                </div>

                <div className="flex justify-between items-center w-full font-bold text-base text-primary pt-1">
                  <span>Nominal Bayar</span>
                  <span>{formatRupiah(paymentAmount)}</span>
                </div>

                {paymentType === 'dp' && (
                  <div className="flex justify-between items-center w-full text-xs text-outline pt-1">
                    <span>Sisa Pelunasan</span>
                    <span>{formatRupiah(totalAmount - paymentAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary text-white rounded-md text-sm font-bold shadow-md hover:shadow-lg transition-standard hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Memproses...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">local_mall</span>
                  Booking Sekarang
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="bg-inverse-surface text-inverse-on-surface py-8 border-t border-border-subtle mt-20">
        <div className="max-w-4xl mx-auto px-4 text-center text-label-sm text-inverse-on-surface/50">
          © {new Date().getFullYear()} Camp Pejuang Booking App. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default function BookingFormPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-warm">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <BookingFormContent />
    </Suspense>
  );
}
