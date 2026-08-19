'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatRupiah, getCampTypeLabel, getCampTypeColor, getTodayStr, calculateCheckoutDate, getYouTubeEmbedUrl } from '@/lib/utils/helpers';

interface PricingPackage {
  id: string;
  label: string;
  occupancy_label?: string | null;
  occupancy_tier?: number;
  slots_consumed?: number;
  duration_days: number;
  price: number;
  min_dp_amount: number | null;
}

interface Room {
  id: string;
  name: string;
  floor_label: string;
  capacity?: number;
  active_occupancy_limit?: number | null;
  active_occupancy_tier?: string | null;
  room_photo_urls: string[] | null;
  pricing_packages: PricingPackage[];
}

interface Camp {
  id: string;
  name: string;
  slug: string;
  type: 'putra' | 'putri' | 'campuran';
  address: string;
  description: string | null;
  facilities: string[] | null;
  cover_photo_url: string | null;
  youtube_video_url?: string | null;
  gallery_photo_urls: string[] | null;
  latitude: number | null;
  longitude: number | null;
}

interface BookingLock {
  room_id: string;
  stay_period: string; // e.g. [2026-07-01,2026-08-01)
}

function RoomCard({
  room,
  occupiedCount,
  checkInDate,
  durationLabel,
  pkg,
  floor
}: {
  room: Room;
  occupiedCount: number;
  checkInDate: string;
  durationLabel: string;
  pkg: any;
  floor: string;
}) {
  const [activePhoto, setActivePhoto] = useState(0);
  const capacity = room.capacity || 1;
  const isMultiOccupancy = capacity > 1;
  const remainingSlots = Math.max(0, capacity - occupiedCount);
  const booked = remainingSlots === 0;

  // Available packages
  const availablePkgs = room.pricing_packages && room.pricing_packages.length > 0
    ? room.pricing_packages
    : (pkg ? [pkg] : []);

  const [selectedPkg, setSelectedPkg] = useState<PricingPackage | null>(
    pkg || availablePkgs[0] || null
  );

  useEffect(() => {
    if (pkg) setSelectedPkg(pkg);
  }, [pkg]);

  const photos = room.room_photo_urls && room.room_photo_urls.length > 0
    ? room.room_photo_urls
    : ["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=600"];

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setActivePhoto((prev) => (prev + 1) % photos.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [photos.length]);

  const currentPkg = selectedPkg || pkg;

  return (
    <div className="bg-surface-cream rounded-xl border border-border-subtle shadow-sm overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
      <div className="aspect-[4/5] w-full bg-surface-container-high relative group select-none overflow-hidden">
        <img
          src={photos[activePhoto]}
          alt={`${room.name} ${activePhoto + 1}`}
          className="w-full h-full object-cover transition-all duration-300 hover:scale-105"
        />

        {/* Capacity badge */}
        <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-label-sm font-bold bg-black/70 text-white shadow-sm backdrop-blur-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">bed</span>
          {capacity > 1 ? `Kapasitas ${capacity} Bed` : 'Single Room'}
        </span>

        {/* Status badge: Exact Occupancy Count */}
        <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-label-sm font-bold shadow-sm ${
          booked
            ? 'bg-red-600 text-white shadow'
            : occupiedCount > 0
            ? 'bg-amber-500 text-white shadow'
            : 'bg-emerald-600 text-white shadow'
        }`}>
          {booked
            ? `🔴 Full Booked (${capacity}/${capacity})`
            : occupiedCount > 0
            ? `👥 Terisi ${occupiedCount}/${capacity} Bed (Sisa ${remainingSlots})`
            : `🟢 Kosong (0/${capacity} Terisi)`}
        </span>

        {/* Photo arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setActivePhoto((prev) => (prev === 0 ? photos.length - 1 : prev - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_left</span>
            </button>
            <button
              onClick={() => setActivePhoto((prev) => (prev === photos.length - 1 ? 0 : prev + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
            </button>
            <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-[10px] font-bold rounded">
              {activePhoto + 1}/{photos.length}
            </span>
          </>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow space-y-4 text-sm">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-headline-sm font-bold">{room.name}</h4>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">{floor}</span>
          </div>

          {room.active_occupancy_tier ? (
            <div className="text-xs text-amber-800 bg-amber-50/90 p-2.5 rounded-lg border border-amber-200 space-y-0.5">
              <div className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lock</span>
                Kamar Terisi ({occupiedCount}/${capacity} Penghuni): {room.active_occupancy_tier}
              </div>
              <p className="text-[11px] text-amber-700 leading-tight">
                Sisa {remainingSlots} bed kosong otomatis mengikuti tarif {room.active_occupancy_tier}.
              </p>
            </div>
          ) : isMultiOccupancy && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">tune</span>
              Kamar kosong (0/{capacity}) — Bebas pilih opsi Sharing atau Private.
            </p>
          )}
        </div>

        {/* Multi-occupancy Tier & Duration Selection */}
        {availablePkgs.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Pilih Paket Sewa & Keterisian Kamar:
            </p>
            <div className="flex flex-col gap-2">
              {availablePkgs.map((p) => {
                const isSelected = currentPkg?.id === p.id;
                
                // Determine Occupancy Title
                let titleText = p.occupancy_label && p.occupancy_label.trim() !== '' && p.occupancy_label !== p.label
                  ? p.occupancy_label
                  : p.occupancy_tier === 3
                  ? 'Sharing 3 Orang'
                  : p.occupancy_tier === 2
                  ? 'Sharing 2 Orang'
                  : p.occupancy_tier === 1
                  ? 'Private 1 Kamar'
                  : `Paket ${p.label}`;

                const durationLabelText = p.label && p.label !== p.occupancy_label ? p.label : `${p.duration_days} Hari`;
                const durationText = `Durasi: ${durationLabelText} (${p.duration_days} Hari)`;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPkg(p)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                        : 'border-border-subtle bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-primary bg-primary text-white' : 'border-neutral-300'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-on-surface">
                          {titleText}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {durationText} {p.min_dp_amount ? `• Bisa DP ${formatRupiah(p.min_dp_amount)}` : '• Bayar Lunas'}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-primary">{formatRupiah(p.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border-subtle mt-auto">
          {booked ? (
            <button
              disabled
              className="w-full py-2.5 bg-surface-container text-outline rounded-md text-sm font-bold cursor-not-allowed text-center"
            >
              Kamar Full Booked
            </button>
          ) : (
            <Link
              href={`/booking/${room.id}?check_in=${checkInDate}&package_id=${currentPkg?.id || ''}`}
              className="w-full block py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-container text-center transition-all shadow-sm hover:shadow-md"
            >
              Pilih & Pesan Bed Ini
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [camp, setCamp] = useState<Camp | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [locks, setLocks] = useState<BookingLock[]>([]);
  const [loading, setLoading] = useState(true);

  // Slider active state
  const [activeSlide, setActiveSlide] = useState(0);

  // Filter criteria for live room availability check
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [selectedDurationDays, setSelectedDurationDays] = useState<number>(30); // Default 1 month

  useEffect(() => {
    // Set default check-in to next Monday
    const today = new Date();
    const resultDate = new Date();
    resultDate.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    setCheckInDate(resultDate.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (!slug) return;
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/camps/${slug}`);
        if (!res.ok) {
          router.replace('/');
          return;
        }
        const data = await res.json();
        setCamp(data.camp);
        setRooms(data.rooms || []);
        setLocks(data.booking_locks || []);
      } catch (err) {
        console.error('Error fetching detail:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [slug, router]);

  const slidesCount = camp ? [camp.cover_photo_url, ...(camp.gallery_photo_urls || [])].filter(Boolean).length : 0;

  // Auto-slide top hero gallery every 4.5 seconds (Top-level hook)
  useEffect(() => {
    if (slidesCount <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slidesCount);
    }, 4500);
    return () => clearInterval(timer);
  }, [slidesCount]);

  // Helper to calculate occupied slots count in a room on the selected dates
  const getOccupiedCount = (roomId: string): number => {
    if (!checkInDate) return 0;
    const checkOutDate = calculateCheckoutDate(checkInDate, selectedDurationDays);

    const reqStart = new Date(checkInDate).getTime();
    const reqEnd = new Date(checkOutDate).getTime();

    const roomLocks = locks.filter((l) => l.room_id === roomId);
    let count = 0;
    for (const lock of roomLocks) {
      const matches = lock.stay_period.match(/[\[\(]([^,]+),([^\]\)]+)[\]\)]/);
      if (matches) {
        const lockStart = new Date(matches[1]).getTime();
        const lockEnd = new Date(matches[2]).getTime();
        if (reqStart < lockEnd && reqEnd > lockStart) {
          count++;
        }
      }
    }
    return count;
  };

  // Helper to check if a room is locked (booked) on the selected dates
  const isRoomBooked = (roomId: string): boolean => {
    const room = rooms.find((r) => r.id === roomId);
    const capacity = room?.capacity || 1;
    const occupied = getOccupiedCount(roomId);
    return occupied >= capacity;
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!camp) return null;

  // Group rooms by Floor
  const roomsByFloor: Record<string, Room[]> = {};
  rooms.forEach((r) => {
    const floor = r.floor_label || 'Lantai 1';
    if (!roomsByFloor[floor]) {
      roomsByFloor[floor] = [];
    }
    roomsByFloor[floor].push(r);
  });

  const slides = [camp.cover_photo_url, ...(camp.gallery_photo_urls || [])].filter(Boolean) as string[];

  return (
    <div className="flex flex-col min-h-screen bg-background-warm selection:bg-primary/10 selection:text-primary">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full bg-surface-cream/80 backdrop-blur-md border-b border-border-subtle shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl font-bold">arrow_back</span>
            <span className="text-label-md font-semibold text-on-surface hover:text-primary transition-colors">Kembali</span>
          </Link>
          <span className="font-headline-sm text-sm font-bold text-primary truncate max-w-[200px] sm:max-w-xs">{camp.name}</span>
        </div>
      </header>

      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 space-y-12">
        {/* Gallery Grid Section (seperti yang disarankan di gambar) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Exterior/Cover Images (Kiri - 2 Column) */}
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* Top Media (YouTube Video Player or Photo Fallback) */}
            {getYouTubeEmbedUrl(camp.youtube_video_url) ? (
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-lg border border-border-subtle bg-black group">
                <iframe
                  src={`${getYouTubeEmbedUrl(camp.youtube_video_url)}?autoplay=0&rel=0`}
                  title={`Video Tur ${camp.name}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                  className="w-full h-full border-0"
                />
                <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-label-sm font-bold shadow-md pointer-events-none z-10 ${getCampTypeColor(camp.type)}`}>
                  {getCampTypeLabel(camp.type).toUpperCase()}
                </span>
                <span className="absolute top-4 left-28 px-3 py-1 rounded-full text-label-sm font-bold bg-red-600 text-white shadow-md pointer-events-none z-10 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs font-bold">play_circle</span>
                  Video Tur Camp
                </span>
              </div>
            ) : (
              <div className="relative aspect-[1/1] w-full rounded-2xl overflow-hidden shadow-sm border border-border-subtle bg-slate-100">
                {camp.cover_photo_url ? (
                  <img
                    src={camp.cover_photo_url}
                    alt={camp.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 select-none">
                    <img
                      src="/logo-camp-pejuang.png"
                      alt="Logo Camp Pejuang"
                      className="h-24 sm:h-28 w-auto object-contain drop-shadow-sm opacity-90 transition-transform duration-300 hover:scale-105"
                    />
                    <span className="text-[11px] font-bold text-outline tracking-widest uppercase mt-3">Camp Pejuang</span>
                  </div>
                )}
                <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-label-sm font-bold shadow ${getCampTypeColor(camp.type)}`}>
                  {getCampTypeLabel(camp.type).toUpperCase()}
                </span>
                <span className="absolute top-4 left-24 px-3 py-1 rounded-full text-label-sm font-bold bg-green-100 text-green-800 shadow-sm">
                  Tersedia
                </span>
              </div>
            )}
          </div>

          {/* Carousel Slider & Kapasitas (Kanan - 1 Column) */}
          <div className="flex flex-col gap-6">
            {/* Carousel Slider */}
            <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden shadow-sm bg-surface-container-high border border-border-subtle group">
              {slides.length > 0 ? (
                <>
                  <img
                    src={slides[activeSlide]}
                    alt={`${camp.name} Slide ${activeSlide + 1}`}
                    className="w-full h-full object-cover transition-all duration-500"
                  />

                  {/* Slide Counter Indicator */}
                  <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-bold rounded-full select-none z-10">
                    {activeSlide + 1} / {slides.length}
                  </div>

                  {/* Prev / Next Arrows */}
                  {slides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white hover:bg-neutral-100 text-on-surface flex items-center justify-center shadow-md transition-all z-10"
                      >
                        <span className="material-symbols-outlined font-bold text-lg">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white hover:bg-neutral-100 text-on-surface flex items-center justify-center shadow-md transition-all z-10"
                      >
                        <span className="material-symbols-outlined font-bold text-lg">chevron_right</span>
                      </button>
                    </>
                  )}

                  {/* Little Dots Indicator */}
                  {slides.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full z-10">
                      {slides.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveSlide(idx)}
                          className={`h-2 rounded-full transition-all duration-300 ${idx === activeSlide ? 'w-4 bg-primary' : 'w-2 bg-white/60 hover:bg-white'
                            }`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-outline gap-2">
                  <span className="material-symbols-outlined text-5xl">photo</span>
                  <p className="text-sm font-semibold">Foto Camp Belum Tersedia</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Details & Live Filters */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Info */}
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-4">
              <h1 className="text-headline-md font-bold">{camp.name}</h1>
              <p className="text-body-md text-on-surface-variant flex items-start gap-1">
                <span className="material-symbols-outlined text-lg mt-0.5 text-primary">location_on</span>
                {camp.address}
              </p>
              <div className="pt-2 border-t border-border-subtle">
                <h3 className="text-headline-sm mb-2">Tentang Camp</h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed">
                  {camp.description || "Camp hunian berkualitas yang dirancang terintegrasi dengan kebutuhan siswa di Kampung Inggris Pare. Memberikan fasilitas nyaman yang kondusif agar kegiatan belajar Anda berjalan maksimal."}
                </p>
              </div>
            </div>

            {/* Facilities */}
            {camp.facilities && camp.facilities.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-headline-sm">Fasilitas Camp</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {camp.facilities.map((fac, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-surface-cream rounded-lg border border-border-subtle">
                      <span className="material-symbols-outlined text-primary text-xl">done_all</span>
                      <span className="text-label-md text-on-surface-variant">{fac}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Availability Checker Card */}
          <div className="lg:col-span-4 bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
            <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Cek Ketersediaan Kamar</h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-label-md text-on-surface-variant">Tanggal Check-In</label>
                <input
                  type="date"
                  value={checkInDate}
                  min={getTodayStr()}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-label-md text-on-surface-variant">Durasi Sewa</label>
                <select
                  value={selectedDurationDays}
                  onChange={(e) => setSelectedDurationDays(Number(e.target.value))}
                  className="w-full p-2.5 rounded-md border border-outline-variant bg-white focus:outline-none focus:border-primary text-sm font-medium"
                >
                  <option value={14}>2 Minggu (14 Hari)</option>
                  <option value={30}>1 Bulan (30 Hari)</option>
                  <option value={60}>2 Bulan (60 Hari)</option>
                  <option value={90}>3 Bulan (90 Hari)</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-background-warm rounded-lg text-label-sm text-on-surface-variant/80 leading-relaxed border border-border-subtle">
              Kamar akan di-hold selama <strong>24 jam</strong> setelah Anda melakukan pemesanan untuk proses verifikasi bukti transfer manual oleh admin.
            </div>
          </div>
        </section>

        {/* Rooms List Section */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-headline-md">Pilihan Kamar</h2>
            <p className="text-body-md text-on-surface-variant">Berikut adalah daftar kamar yang tersedia di camp ini sesuai lantai hunian.</p>
          </div>

          {Object.keys(roomsByFloor).sort().map((floor) => (
            <div key={floor} className="space-y-4 pt-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary rounded-full">
                <span className="material-symbols-outlined text-sm font-bold">layers</span>
                <span className="text-label-sm">{floor}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roomsByFloor[floor].map((room) => {
                  const occupiedCount = getOccupiedCount(room.id);
                  const durationLabel = selectedDurationDays === 14 ? '2 Minggu (14 Hari)' : selectedDurationDays === 30 ? '1 Bulan (30 Hari)' : selectedDurationDays === 60 ? '2 Bulan (60 Hari)' : '3 Bulan (90 Hari)';
                  const pkg = room.pricing_packages.find((p) => p.duration_days === selectedDurationDays || p.label.includes(String(selectedDurationDays))) || room.pricing_packages[0];

                  return (
                    <RoomCard
                      key={room.id}
                      room={room}
                      occupiedCount={occupiedCount}
                      checkInDate={checkInDate}
                      durationLabel={durationLabel}
                      pkg={pkg}
                      floor={floor}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Call to Action: Masih Ragu / Tanya Admin */}
        <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-surface-cream rounded-2xl border border-primary/20 p-8 sm:p-10 shadow-sm relative overflow-hidden my-8">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/15 text-primary rounded-full text-xs font-bold">
                <span className="material-symbols-outlined text-sm font-bold">help</span>
                Bantuan & Layanan Tanya Jawab
              </div>
              <h3 className="text-headline-md font-bold text-on-surface">Masih Ragu atau Punya Pertanyaan Seputar Camp?</h3>
              <p className="text-body-md text-on-surface-variant max-w-xl">
                Jangan ragu untuk konsultasi langsung dengan pengelola {camp.name}. Kami siap membantu memberikan informasi fasilitas, ketersediaan kamar, hingga lingkungan Kampung Inggris.
              </p>
            </div>

            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_OWNER_WHATSAPP || '6281234567890'}?text=${encodeURIComponent(
                `Halo Admin Camp Pejuang, saya ingin bertanya lebih lanjut mengenai ${camp.name}...`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0 hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-xl">chat</span>
              Tanya Admin via WhatsApp
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-inverse-surface text-inverse-on-surface py-8 border-t border-border-subtle mt-20">
        <div className="max-w-6xl mx-auto px-4 text-center text-label-sm text-inverse-on-surface/50">
          © {new Date().getFullYear()} Camp Pejuang Booking App. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
