'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatRupiah, getCampTypeLabel, getCampTypeColor, getYouTubeEmbedUrl } from '@/lib/utils/helpers';

interface CampListing {
  id: string;
  name: string;
  slug: string;
  type: 'putra' | 'putri' | 'campuran';
  address: string;
  description: string;
  facilities: string[];
  cover_photo_url: string | null;
  youtube_video_url: string | null;
  room_count: number;
  min_price: number;
}

export default function Home() {
  const [camps, setCamps] = useState<CampListing[]>([]);
  const [filteredType, setFilteredType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCamps() {
      try {
        const res = await fetch('/api/camps');
        const data = await res.json();
        if (data.camps) {
          setCamps(data.camps);
        }
      } catch (err) {
        console.error('Error fetching camps:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCamps();
  }, []);

  const filteredCamps = camps.filter((c) => {
    if (filteredType === 'all') return true;
    return c.type === filteredType;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background-warm selection:bg-primary/10 selection:text-primary">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full bg-surface-cream/80 backdrop-blur-md border-b border-border-subtle shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-camp-pejuang.png" alt="Camp Pejuang Logo" className="h-10 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6">
              <a href="#daftar-camp" className="text-label-md hover:text-primary transition-colors text-on-surface/80">Daftar Camp</a>
              <a href="#fasilitas" className="text-label-md hover:text-primary transition-colors text-on-surface/80">Keunggulan</a>
              <a href="#testimoni" className="text-label-md hover:text-primary transition-colors text-on-surface/80 font-medium">Alumni</a>
            </nav>

            <Link
              href="/cek-pesanan"
              className="px-4 py-2 border border-primary text-primary hover:bg-primary/5 rounded-md text-sm font-semibold transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">search</span>
              Cek Pesanan
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-surface-cream via-background-warm to-surface-cream py-20 border-b border-border-subtle">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#ff5a5f_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-12 items-center relative z-10">
            <div className="md:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full">
                <span className="text-eyebrow">Selamat Datang di Pare</span>
              </div>
              <h1 className="text-headline-lg text-foreground tracking-tight">
                Hunian Terbaik untuk <span className="text-primary font-bold">Pejuang Impian</span> di Kampung Inggris
              </h1>
              <p className="text-body-lg text-on-surface-variant max-w-xl">
                Temukan kost & camp nyaman terintegrasi yang didesain khusus bagi kenyamanan belajar Anda selama menempuh kursus bahasa Inggris di Pare, Kediri.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a
                  href="#daftar-camp"
                  className="px-6 py-3.5 bg-primary text-white rounded-md text-center font-bold shadow-md hover:shadow-lg transition-standard hover:-translate-y-0.5"
                >
                  Cari Kamar Sekarang
                </a>
                <a
                  href="#fasilitas"
                  className="px-6 py-3.5 border border-outline-variant text-on-surface bg-surface-cream rounded-md text-center font-semibold hover:bg-surface-container-low transition-standard"
                >
                  Pelajari Fasilitas
                </a>
              </div>
            </div>

            <div className="md:col-span-5 relative">
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden shadow-2xl relative border-4 border-white">
                <img
                  src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&q=80&w=800"
                  alt="Camp Pejuang Interior"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-6">
                  <div className="text-white">
                    <p className="text-label-sm uppercase tracking-widest text-primary-container">Unggulan</p>
                    <p className="text-headline-sm">Camp Pejuang Putra 1</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-lg shadow-xl border border-border-subtle hidden lg:block">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success-green/10 rounded-full text-success-green">
                    <span className="material-symbols-outlined text-2xl font-bold">verified</span>
                  </div>
                  <div>
                    <p className="text-label-sm text-on-surface-variant">Kamar Tersedia</p>
                    <p className="text-headline-sm font-bold text-success-green">Siap Dihuni</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section id="fasilitas" className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-cream p-8 rounded-lg border border-border-subtle text-center space-y-3">
              <span className="material-symbols-outlined text-primary text-4xl">home_pin</span>
              <h3 className="text-headline-sm font-bold">Lokasi Strategis</h3>
              <p className="text-body-md text-on-surface-variant">Dekat dengan berbagai lembaga kursus utama di Pare (hanya 3-5 menit berkendara).</p>
            </div>
            <div className="bg-surface-cream p-8 rounded-lg border border-border-subtle text-center space-y-3">
              <span className="material-symbols-outlined text-primary text-4xl">security</span>
              <h3 className="text-headline-sm font-bold">Lingkungan Aman</h3>
              <p className="text-body-md text-on-surface-variant">Dukungan lingkungan khusus putra/putri terpisah untuk kenyamanan dan keamanan Anda.</p>
            </div>
            <div className="bg-surface-cream p-8 rounded-lg border border-border-subtle text-center space-y-3">
              <span className="material-symbols-outlined text-primary text-4xl">payments</span>
              <h3 className="text-headline-sm font-bold">Pembayaran Fleksibel</h3>
              <p className="text-body-md text-on-surface-variant">Tersedia opsi pembayaran DP (Uang Muka) atau Bayar Penuh via QRIS / Transfer Bank.</p>
            </div>
          </div>
        </section>

        {/* Camp Listings Section */}
        <section id="daftar-camp" className="bg-surface-container-lowest py-20 border-t border-b border-border-subtle">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div className="space-y-2">
                <span className="text-eyebrow text-primary">PILIHAN TERBAIK</span>
                <h2 className="text-headline-md">Daftar Pilihan Camp Pejuang</h2>
                <p className="text-body-md text-on-surface-variant">Pilih camp dengan lingkungan terpisah yang paling sesuai dengan kebutuhan belajar Anda.</p>
              </div>

              {/* Filters */}
              <div className="flex items-center bg-background-warm p-1 rounded-md border border-border-subtle self-start md:self-end">
                <button
                  onClick={() => setFilteredType('all')}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${filteredType === 'all'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setFilteredType('putra')}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${filteredType === 'putra'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  Putra
                </button>
                <button
                  onClick={() => setFilteredType('putri')}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${filteredType === 'putri'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  Putri
                </button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="animate-pulse bg-surface-cream rounded-xl border border-border-subtle h-96"></div>
                ))}
              </div>
            ) : filteredCamps.length === 0 ? (
              <div className="text-center py-16 bg-background-warm rounded-lg border border-dashed border-border-subtle">
                <span className="material-symbols-outlined text-5xl text-outline-variant">home_work</span>
                <p className="mt-4 text-headline-sm text-on-surface-variant">Belum ada camp tersedia</p>
                <p className="text-body-md text-outline">Mohon hubungi admin atau cek kembali nanti.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {filteredCamps.map((camp) => (
                  <div key={camp.id} className="card-level-1 flex flex-col h-full">
                    {/* Camp Image */}
                    <div className="relative h-56 sm:h-84 w-full overflow-hidden rounded-t-xl bg-surface-container-high">
                      <img
                        src={camp.cover_photo_url || "https://images.unsplash.com/photo-1596276122653-651a3898309f?auto=format&fit=crop&q=80&w=600"}
                        alt={camp.name}
                        className="w-full h-full object-cover"
                      />
                      <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-label-sm font-bold ${getCampTypeColor(camp.type)}`}>
                        Camp {getCampTypeLabel(camp.type)}
                      </span>
                      {camp.youtube_video_url && getYouTubeEmbedUrl(camp.youtube_video_url) && (
                        <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-label-sm font-bold bg-red-600 text-white shadow flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">play_circle</span>
                          Video Tur
                        </span>
                      )}
                    </div>

                    {/* Camp Details */}
                    <div className="p-6 flex flex-col flex-grow space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-headline-sm font-bold text-on-surface line-clamp-1">{camp.name}</h3>
                        <p className="text-label-sm text-outline flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">location_on</span>
                          {camp.address}
                        </p>
                      </div>

                      <p className="text-body-md text-on-surface-variant line-clamp-3">
                        {camp.description || "Nyaman, tenang, cocok untuk siswa yang fokus belajar intensif di Kampung Inggris."}
                      </p>

                      {/* Facilities list snippet */}
                      {camp.facilities && camp.facilities.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {camp.facilities.slice(0, 3).map((f, i) => (
                            <span key={i} className="px-2.5 py-1 bg-surface-container rounded-md text-label-sm text-on-surface-variant">
                              {f}
                            </span>
                          ))}
                          {camp.facilities.length > 3 && (
                            <span className="px-2.5 py-1 bg-surface-container rounded-md text-label-sm text-outline">
                              +{camp.facilities.length - 3} lainnya
                            </span>
                          )}
                        </div>
                      )}

                      <div className="pt-4 border-t border-border-subtle mt-auto flex items-center justify-between">
                        <div>
                          <p className="text-label-sm text-outline">Mulai Dari</p>
                          <p className="text-headline-sm font-bold text-primary">
                            {camp.min_price > 0 ? formatRupiah(camp.min_price) : 'Rp —'}
                            <span className="text-label-sm font-normal text-outline">/periode</span>
                          </p>
                        </div>

                        <Link
                          href={`/camp/${camp.slug}`}
                          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-bold hover:bg-primary-container transition-colors shadow-sm"
                        >
                          Lihat Kamar
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimoni" className="max-w-6xl mx-auto px-4 py-20 space-y-12">
          <div className="text-center space-y-2">
            <span className="text-eyebrow text-primary">TESTIMONI</span>
            <h2 className="text-headline-md">Apa Kata Para Alumni Pejuang?</h2>
            <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">Masa tinggal yang berkesan membantu fokus belajar optimal hingga lulus dan menguasai bahasa Inggris.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-cream p-8 rounded-lg border border-border-subtle space-y-4">
              <p className="text-body-md italic text-on-surface-variant">
                "Camp-nya bersih, tenang banget buat belajar malam. Wifi juga cepat jadi gampang kalau mau nonton materi/Zoom kelas tambahan. Sangat recommended buat pejuang kursus di Pare."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">A</div>
                <div>
                  <h4 className="text-label-md font-bold">Ahmad Fauzi</h4>
                  <p className="text-label-sm text-outline">Alumni Camp Putra 1</p>
                </div>
              </div>
            </div>

            <div className="bg-surface-cream p-8 rounded-lg border border-border-subtle space-y-4">
              <p className="text-body-md italic text-on-surface-variant">
                "Sangat nyaman, keamanan 24 jam jadi tidak khawatir kalau jalan pulang dari tempat kursus malam hari. Opsi perpanjangan priority window-nya membantu sekali pas saya mau tambah durasi belajar."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">S</div>
                <div>
                  <h4 className="text-label-md font-bold">Siti Aminah</h4>
                  <p className="text-label-sm text-outline">Alumni Camp Putri 1</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-inverse-surface text-inverse-on-surface py-12 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-3xl font-bold">apartment</span>
              <span className="font-headline-sm font-bold tracking-tight text-white">Camp Pejuang</span>
            </div>
            <p className="text-label-md text-inverse-on-surface/75">
              Hunian dan camp terpadu bagi pejuang bahasa Inggris di Kampung Inggris Pare, Kediri, Jawa Timur.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-label-md font-bold uppercase tracking-wider text-white">Navigasi</h4>
            <div className="flex flex-col gap-2">
              <a href="#daftar-camp" className="text-label-sm hover:text-primary-container transition-colors text-inverse-on-surface/75">Daftar Pilihan Camp</a>
              <a href="#fasilitas" className="text-label-sm hover:text-primary-container transition-colors text-inverse-on-surface/75">Fasilitas Unggulan</a>
              <Link href="/cek-pesanan" className="text-label-sm hover:text-primary-container transition-colors text-inverse-on-surface/75">Lacak Booking Anda</Link>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-label-md font-bold uppercase tracking-wider text-white">Kontak Admin</h4>
            <p className="text-label-sm text-inverse-on-surface/75 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">location_on</span>
              Pare, Kediri, Jawa Timur
            </p>
            <p className="text-label-sm text-inverse-on-surface/75 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">call</span>
              +62 812-3456-7890 (WhatsApp Only)
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 mt-8 pt-8 border-t border-white/10 text-center text-label-sm text-inverse-on-surface/50">
          © {new Date().getFullYear()} Camp Pejuang Booking App. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
