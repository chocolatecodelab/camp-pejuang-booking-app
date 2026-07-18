'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TrackSearchPage() {
  const router = useRouter();
  const [bookingCode, setBookingCode] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = bookingCode.trim().toUpperCase();
    const cleanWA = whatsapp.trim().replace(/[^0-9]/g, '');

    if (!cleanCode) {
      setError('Kode booking wajib diisi');
      return;
    }
    if (!cleanWA) {
      setError('Nomor WhatsApp wajib diisi');
      return;
    }

    setLoading(true);
    // Redirect to the dynamic status page, passing the WhatsApp number as query param for verification
    router.push(`/booking/track/${cleanCode}?wa=${cleanWA}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-on-surface">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-outline-variant z-40 w-full shrink-0 select-none">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-[#0052ff] hover:text-[#003ec7] font-bold">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="text-sm font-semibold">Beranda</span>
          </Link>
          <h1 className="text-sm font-black tracking-wide text-slate-800 uppercase">Lacak Pemesanan</h1>
          <div className="w-6"></div>
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-grow max-w-md mx-auto w-full px-4 py-12 flex flex-col justify-center">
        <div className="bg-white border border-outline-variant/60 rounded-3xl p-8 shadow-md space-y-6">
          <div className="text-center space-y-2 select-none">
            <div className="w-16 h-16 bg-[#F0F4FF] rounded-full flex items-center justify-center mx-auto text-[#0052ff] border-2 border-white shadow-sm mb-2">
              <span className="material-symbols-outlined text-3xl">track_changes</span>
            </div>
            <h2 className="font-headline-lg text-xl font-black text-[#191b25]">
              Cari Pemesanan
            </h2>
            <p className="font-body-sm text-xs text-on-surface-variant/85 max-w-xs mx-auto leading-relaxed">
              Masukkan nomor booking dan nomor WhatsApp yang digunakan saat memesan untuk melihat status terkini.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Booking Code Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="booking-code" className="text-xs font-bold text-on-surface select-none">
                Nomor Booking / Kode Booking <span className="text-[#ff3b30]">*</span>
              </label>
              <input
                type="text"
                id="booking-code"
                placeholder="CONTOH: AG-BAD-20260718-4910"
                value={bookingCode}
                onChange={(e) => setBookingCode(e.target.value)}
                className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-white uppercase placeholder:normal-case focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] outline-none transition-all"
                disabled={loading}
              />
            </div>

            {/* WhatsApp Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="whatsapp" className="text-xs font-bold text-on-surface select-none">
                Nomor WhatsApp Pemesan <span className="text-[#ff3b30]">*</span>
              </label>
              <input
                type="tel"
                id="whatsapp"
                placeholder="CONTOH: 081234567890"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-white focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] outline-none transition-all"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-xs text-[#ff3b30] bg-[#fff5f5] p-2.5 rounded-lg border border-[#ffcdcd] flex items-center gap-1.5 select-none">
                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0052ff] hover:bg-[#003ec7] disabled:bg-slate-200 text-white font-bold text-sm uppercase rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">search</span>
                  Cari Pesanan
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-on-surface-variant/60 shrink-0 border-t border-outline-variant bg-white select-none">
        &copy; {new Date().getFullYear()} ActiveGrid Arena. All rights reserved.
      </footer>
    </div>
  );
}
