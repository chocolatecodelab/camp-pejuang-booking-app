'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatRupiah, formatDateRange, getStatusLabel, getStatusColor } from '@/lib/utils/helpers';
import { waContactAdmin } from '@/lib/whatsapp';

interface Booking {
  id: string;
  booking_code: string;
  customer_name: string;
  check_in: string;
  check_out: string;
  payment_type: 'dp' | 'full';
  claimed_amount: number;
  total_price: number;
  status: string;
  rooms: {
    name: string;
    camps: {
      name: string;
    }
  }
}

export default function BookingSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params?.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [adminWhatsapp, setAdminWhatsapp] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return;

    async function fetchData() {
      try {
        // Fetch booking info using server-side API endpoint
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (!res.ok) {
          router.replace('/');
          return;
        }
        const data = await res.json();
        setBooking(data.booking as Booking);

        // Fetch dynamic admin whatsapp number
        const { data: sData } = await supabase
          .from('system_settings')
          .select('admin_whatsapp')
          .single();
        if (sData?.admin_whatsapp) {
          setAdminWhatsapp(sData.admin_whatsapp);
        }
      } catch (err) {
        console.error('Error fetching success booking:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [bookingId, router]);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background-warm selection:bg-primary/10 selection:text-primary">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full bg-surface-cream/80 backdrop-blur-md border-b border-border-subtle shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl font-bold">home</span>
            <span className="text-label-md font-semibold text-on-surface hover:text-primary transition-colors">Beranda</span>
          </Link>
          <span className="font-headline-sm text-sm font-bold text-primary">Booking Sukses</span>
        </div>
      </header>

      <main className="flex-grow max-w-2xl mx-auto px-4 py-12 flex flex-col items-center">
        <div className="bg-surface-cream p-8 rounded-xl border border-border-subtle shadow-sm w-full text-center space-y-6">
          
          {/* Success Check Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 animate-bounce">
            <span className="material-symbols-outlined text-4xl font-bold">check_circle</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-headline-md font-bold text-on-surface">Pemesanan Berhasil Terkirim!</h1>
            <p className="text-body-md text-on-surface-variant">
              Terima kasih, data booking dan bukti pembayaran Anda telah kami terima untuk proses verifikasi.
            </p>
          </div>

          {/* Booking Code Card */}
          <div className="p-5 bg-background-warm rounded-lg border border-border-subtle space-y-3">
            <p className="text-label-sm text-outline uppercase tracking-wider">KODE BOOKING ANDA</p>
            <p className="text-headline-md font-bold text-primary tracking-widest select-all">{booking.booking_code}</p>
            <p className="text-xs text-outline">Simpan kode di atas untuk melacak pesanan Anda di kemudian hari.</p>
          </div>

          {/* Status Details */}
          <div className="border-t border-b border-border-subtle py-4 space-y-3 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-on-surface-variant font-medium">Nama Penghuni</span>
              <span className="font-bold text-on-surface">{booking.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant font-medium">Camp & Kamar</span>
              <span className="font-semibold text-on-surface">
                {booking.rooms?.camps.name} - {booking.rooms?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant font-medium">Masa Tinggal</span>
              <span className="font-semibold text-on-surface">
                {formatDateRange(booking.check_in, booking.check_out)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant font-medium">Status Pembayaran</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                {getStatusLabel(booking.status)}
              </span>
            </div>
            <div className="flex justify-between text-primary font-bold border-t border-dashed border-border-subtle pt-3">
              <span>Nominal Ditransfer</span>
              <span className="text-base">{formatRupiah(booking.claimed_amount)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link
              href={`/cek-pesanan?name=${encodeURIComponent(booking.customer_name)}&code=${booking.booking_code}`}
              className="flex-grow px-5 py-3 border border-primary text-primary hover:bg-primary/5 rounded-md text-center font-bold text-sm transition-colors"
            >
              Lacak & Perpanjang Sewa
            </Link>
            
            <a
              href={waContactAdmin(booking.booking_code, booking.customer_name, adminWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-grow px-5 py-3 bg-success-green hover:bg-green-600 text-white rounded-md text-center font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">chat</span>
              Hubungi Admin via WA
            </a>
          </div>

          <div className="pt-4">
            <Link href="/" className="text-label-sm text-outline hover:text-primary transition-colors">
              Kembali ke Halaman Utama
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-inverse-surface text-inverse-on-surface py-8 border-t border-border-subtle mt-20">
        <div className="max-w-2xl mx-auto px-4 text-center text-label-sm text-inverse-on-surface/50">
          © {new Date().getFullYear()} Camp Pejuang Booking App. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
