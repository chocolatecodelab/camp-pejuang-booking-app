'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatRupiah } from '@/lib/utils/helpers';

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [prices, setPrices] = useState<{ [key: string]: number }>({
    futsal: 50000,
    badminton: 50000,
    'tenis-meja': 50000,
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const { data: dataPrices, error } = await supabase
          .from('sport_prices')
          .select('*');
        const data = dataPrices as any[] | null;
        if (data && !error) {
          const priceMap: { [key: string]: number } = {};
          data.forEach(item => {
            priceMap[item.sport_type] = item.base_price;
          });
          setPrices(prev => ({ ...prev, ...priceMap }));
        }
      } catch (err) {
        console.error('Error fetching prices:', err);
      }
    };
    fetchPrices();
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('button, a');
      if (target) {
        (target as HTMLElement).style.opacity = '0.8';
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('button, a');
      if (target) {
        (target as HTMLElement).style.opacity = '1';
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* TopNavBar */}
      <header className={`bg-surface dark:bg-background docked full-width top-0 border-b border-outline-variant dark:border-outline flat no-shadows z-50 sticky transition-all duration-300 ${isScrolled ? 'shadow-md' : ''}`}>
        <nav className="flex justify-between items-center px-container-margin w-full h-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <span className="font-headline-md text-headline-md font-bold text-[#0052ff] dark:text-[#0052ff]">Holiday Sport</span>
          </div>
          <div className="hidden md:flex gap-10">
            <a className="font-body-md text-body-md text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed transition-all duration-200" href="#">Futsal</a>
            <a className="font-body-md text-body-md text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed transition-all duration-200" href="#">Badminton</a>
            <a className="font-body-md text-body-md text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed transition-all duration-200" href="#">Table Tennis</a>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative w-full h-[870px] min-h-[600px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat transform scale-105"
              data-alt="A high-angle professional photography shot of a multi-purpose indoor sports complex with polished wooden floors and vibrant blue court markings."
              style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA_5WDIUe8WS_G-E1aRqVvI2-COanusUOcJtxCqps3fUshDkmuyKBegRxCouWcfn-ghmvxy1Mpo7r7CkVbdXTFnFPIUM15eChxZc0VHhzDn0zK5H3nIiq_pLJzr7ytnndKo-qRCSDT0kGpwaoMwIpys5bYm2wRKlSkrnHymh9xTpWggCAIF2uYd1Iy8O4tBuih_02H6KYHREKHhzCRcHl2RzaIBNm422qHN4f0r9KKfQqhHgHPCo-6fQw')" }}
            >
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent"></div>
          </div>
          <div className="relative z-10 w-full max-w-7xl mx-auto px-container-margin">
            <div className="max-w-2xl space-y-stack-md">
              <span className="inline-block py-1 px-3 bg-secondary-container text-on-secondary-container font-label-caps text-label-caps rounded-sm uppercase tracking-wider">
                Premium Facility
              </span>
              <h1 className="font-headline-xl text-headline-xl md:text-[60px] leading-none text-on-surface font-extrabold select-none">
                Holiday Sport <br /><span className="text-[#0052ff] dark:text-[#0052ff] font-black">Reservation Online</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
                Platform reservasi lapangan futsal, badminton, dan tenis meja terlengkap. Pilih jadwal, bayar instan, dan amankan slot permainan Anda dalam hitungan detik.
              </p>
              <div className="pt-stack-md flex gap-4">
                <Link href="/booking/badminton" className="px-8 py-4 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-standard text-white flex items-center justify-center cursor-pointer">
                  Cek Jadwal Sekarang
                </Link>
                <button className="px-8 py-4 border-2 border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-standard">
                  Lihat Fasilitas
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sport Selection Section */}
        <section className="py-stack-lg bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-container-margin">
            <div className="flex flex-col md:flex-row justify-between items-end mb-stack-lg gap-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Pilih Cabang Olahraga</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">Temukan lapangan terbaik untuk pertandinganmu hari ini.</p>
              </div>
              {/* <a className="text-primary font-bold flex items-center gap-2 hover:underline" href="#">
                Lihat Semua <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
              </a> */}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Futsal Card */}
              <div className="court-card group bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm transition-standard hover:shadow-md hover:border-primary">
                <div className="relative h-64 overflow-hidden">
                  <div
                    className="court-image w-full h-full bg-cover bg-center transition-standard"
                    data-alt="A close-up view of a professional synthetic turf futsal pitch."
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDulY5_FBWFL5ELo-M3PEGZFKUvac347E2nG4NI3ne5mVOfNt-hXIFjbZS_5x2dEHrPD-ZSCtMeJw4V7hC6HzK9lLTyMZnt_eoXYezOCXBamxXpcFK4fOIQS-BNxJrUFSHivnlsxCgY6PgskHFufQ2E7QzsfX0P9i-ZxMRnVRh5IDRwixJaxGd3iTveRXxw8e6QE602Gj4i_otu4727fDqMxXoSElsr_SYotQZzySk0_-c5EQ7e2rcV2A')" }}
                  >
                  </div>
                  <span className="absolute top-4 right-4 bg-primary text-on-primary font-label-caps text-label-caps px-3 py-1 rounded-full text-white">FUTSAL</span>
                </div>
                <div className="p-stack-md space-y-base">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined" data-icon="sports_soccer">sports_soccer</span>
                    <h3 className="font-headline-md text-headline-md">Futsal</h3>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">Lapangan vinyl standar internasional dengan pencahayaan optimal.</p>
                  <div className="pt-4 flex justify-between items-center border-t border-outline-variant">
                    <span className="font-price-display text-price-display text-primary">{formatRupiah(prices['futsal'])}<span className="text-body-sm font-normal text-on-surface-variant">/jam</span></span>
                    <Link href="/booking/futsal" className="p-2 bg-primary-container text-on-primary-container rounded-lg group-hover:bg-primary group-hover:text-on-primary transition-standard flex items-center justify-center cursor-pointer">
                      <span className="material-symbols-outlined text-white" data-icon="calendar_month">calendar_month</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Badminton Card */}
              <div className="court-card group bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm transition-standard hover:shadow-md hover:border-primary">
                <div className="relative h-64 overflow-hidden">
                  <div
                    className="court-image w-full h-full bg-cover bg-center transition-standard"
                    data-alt="A perspective shot of a professional badminton court."
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCAg9OnmdBLJR9hP-XsotH_xM55fHLox9I2AJS30sX7Vt3_uMejkOfxar9mBFG7wX5Aqfe1I6HFhnvQtJSP5mHffUGaL2lzaq3DNuzbY52wJGbyZzIXQh_cvawpP-vVmcgZG2HSLZGnowxGcZeMj_8HrhhfS8XW9yfDZMtQ3mnWFzocpn8D8m0aGu-iH9TO5EYvJ-if819G8LvR27AbglzqaQSIUP-fr00Rl18p_ctw06xuRtEqqlH2GA')" }}
                  >
                  </div>
                  <span className="absolute top-4 right-4 bg-primary text-on-primary font-label-caps text-label-caps px-3 py-1 rounded-full text-white">BADMINTON</span>
                </div>
                <div className="p-stack-md space-y-base">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined" data-icon="sports_tennis">sports_tennis</span>
                    <h3 className="font-headline-md text-headline-md">Badminton</h3>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">Lantai karpet karet premium, sirkulasi udara baik, dan plafon tinggi.</p>
                  <div className="pt-4 flex justify-between items-center border-t border-outline-variant">
                    <span className="font-price-display text-price-display text-primary">{formatRupiah(prices['badminton'])}<span className="text-body-sm font-normal text-on-surface-variant">/jam</span></span>
                    <Link href="/booking/badminton" className="p-2 bg-primary-container text-on-primary-container rounded-lg group-hover:bg-primary group-hover:text-on-primary transition-standard flex items-center justify-center cursor-pointer">
                      <span className="material-symbols-outlined text-white" data-icon="calendar_month">calendar_month</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Tenis Meja Card */}
              <div className="court-card group bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm transition-standard hover:shadow-md hover:border-primary">
                <div className="relative h-64 overflow-hidden">
                  <div
                    className="court-image w-full h-full bg-cover bg-center transition-standard"
                    data-alt="A close-up of a high-end competition table tennis table."
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBbzCY-LTxxYDxpRKDK6ISyB_lRJk29h_IE6xJXretPssbc-YCTKDmz6x6hRE-D2DiyKf5c8n-FOYHUBVO2w94S_E4uBojYcToFjME9v3oMIFi5aWNghtuQXIygSSlcN9lmOxpWbOb7A9sWQ2s1EQBSkZ2Mu7cTOo02FeTQNd-lO1NIJzNb-DKXB-KGSfgTQIgBSHhelq7KBN2cOq3LgGH8mC-aI8p5MvpsuWB6bEqj3Tnsc1-PNv2QEQ')" }}
                  >
                  </div>
                  <span className="absolute top-4 right-4 bg-primary text-on-primary font-label-caps text-label-caps px-3 py-1 rounded-full text-white">TENIS MEJA</span>
                </div>
                <div className="p-stack-md space-y-base">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined" data-icon="table">table</span>
                    <h3 className="font-headline-md text-headline-md">Tenis Meja</h3>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">Meja standar ITTF dengan ruang gerak luas dan lantai anti-slip.</p>
                  <div className="pt-4 flex justify-between items-center border-t border-outline-variant">
                    <span className="font-price-display text-price-display text-primary">{formatRupiah(prices['tenis-meja'])}<span className="text-body-sm font-normal text-on-surface-variant">/jam</span></span>
                    <Link href="/booking/tenis-meja" className="p-2 bg-primary-container text-on-primary-container rounded-lg group-hover:bg-primary group-hover:text-on-primary transition-standard flex items-center justify-center cursor-pointer">
                      <span className="material-symbols-outlined text-white" data-icon="calendar_month">calendar_month</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-stack-lg bg-primary text-on-primary">
          <div className="max-w-7xl mx-auto px-container-margin flex flex-col md:flex-row items-center justify-between gap-stack-md">
            <div className="text-center md:text-left">
              <h2 className="font-headline-lg text-headline-lg mb-2 text-white">Siap untuk Berolahraga?</h2>
              <p className="font-body-lg text-body-lg opacity-90 text-white">Daftar sekarang dan nikmati kemudahan booking dalam hitungan detik.</p>
            </div>
            <Link href="/booking/badminton" className="px-10 py-5 bg-secondary-container text-on-secondary-container font-bold text-lg rounded-xl hover:scale-105 transition-standard flex items-center justify-center text-center cursor-pointer">
              Mulai Booking
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-high dark:bg-inverse-surface full-width">
        <div className="w-full py-stack-lg px-container-margin flex flex-col md:flex-row justify-between items-start gap-stack-md max-w-7xl mx-auto">
          <div className="space-y-4 max-w-xs">
            <span className="font-headline-sm text-headline-sm font-bold text-[#0052ff] dark:text-[#0052ff]">Holiday Sport</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant dark:text-surface-variant text-white">
              Platform pemesanan sarana olahraga terpercaya. Memudahkan reservasi lapangan favorit Anda secara instan, aman, dan transparan.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full md:w-auto">
            <div className="flex flex-col gap-2">
              <span className="font-label-caps text-label-caps text-primary mb-2">LOKASI</span>
              <a className="font-body-sm text-body-sm text-on-surface dark:text-inverse-on-surface hover:text-[#0052ff] underline transition-all duration-200" href="#">Jl. Olahraga No. 123</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-label-caps text-label-caps text-primary mb-2">KONTAK</span>
              <a className="font-body-sm text-body-sm text-on-surface dark:text-inverse-on-surface hover:text-[#0052ff] underline transition-all duration-200" href="https://wa.me/6281234567890">WhatsApp: 0812-3456-7890</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-label-caps text-label-caps text-primary mb-2">JAM OPERASIONAL</span>
              <span className="font-body-sm text-body-sm text-on-surface dark:text-inverse-on-surface">Daily: 07:00 - 23:00</span>
            </div>
          </div>
        </div>
        <div className="w-full border-t border-outline-variant/30 py-6 px-container-margin text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant dark:text-surface-variant opacity-75 text-white">
            © 2024 Holiday Sport. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
