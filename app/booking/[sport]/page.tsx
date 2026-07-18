'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { Court, SportPrice } from '@/lib/supabase/types';
import { HOURS, SPORTS_CONFIG, ADMIN_WHATSAPP } from '@/lib/data/constants';
import {
  formatRupiah,
  formatDateLong,
  formatTimer,
  getEndTime,
  generateBookingCode,
  generateDateList,
  validateWhatsApp,
  sportDisplayName
} from '@/lib/utils/helpers';

interface FormErrors {
  name?: string;
  whatsapp?: string;
}

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  
  const rawSportParam = (params?.sport as string) || 'badminton';
  const sportParam = rawSportParam === 'table-tennis' ? 'tenis-meja' : rawSportParam;

  // DB States
  const [courts, setCourts] = useState<Court[]>([]);
  const [priceConfig, setPriceConfig] = useState<SportPrice | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Date selections (14 days)
  const [dates, setDates] = useState<{ dateStr: string; labelDay: string; labelDate: string }[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  // Checkout form states
  const [step, setStep] = useState<'select-slots' | 'checkout-form' | 'payment-qris' | 'success'>('select-slots');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'onsite'>('qris');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // QRIS Countdown timer state (10 minutes)
  const [qrisTimer, setQrisTimer] = useState(600);
  const [bookingRef, setBookingRef] = useState('');

  // Manual payment workflow states
  const [uniqueCode, setUniqueCode] = useState<number>(0);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadedProofUrl, setUploadedProofUrl] = useState('');

  // Dynamically loaded Admin Settings
  const [adminWhatsappNum, setAdminWhatsappNum] = useState('6281234567890');
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('system_settings')
          .select('*')
          .eq('id', 1)
          .single();
        if (data && !error) {
          const settingsData = data as any;
          setAdminWhatsappNum(settingsData.admin_whatsapp);
          setQrisImageUrl(settingsData.qris_image_url);
        }
      } catch (err) {
        console.error('Error fetching system settings:', err);
      }
    };
    fetchSystemSettings();
  }, []);

  // 1. Initial configuration load (dates & config)
  useEffect(() => {
    const list = generateDateList(14);
    setDates(list);
    if (list.length > 0) {
      setSelectedDate(list[0].dateStr);
    }
  }, []);

  // 2. Fetch courts & prices from Supabase
  useEffect(() => {
    const loadSportDetails = async () => {
      console.log('DEBUG: loadSportDetails started for sportParam:', sportParam);
      setLoading(true);
      try {
        // Fetch pricing
        const { data: priceData, error: priceErr } = await supabase
          .from('sport_prices')
          .select('*')
          .eq('sport_type', sportParam)
          .maybeSingle();

        console.log('DEBUG: priceData:', priceData, 'error:', priceErr);

        if (priceData) {
          setPriceConfig(priceData);
        }

        // Fetch venue
        const { data: dataVenue, error: venueErr } = await supabase
          .from('venues')
          .select('*')
          .eq('sport_type', sportParam)
          .eq('is_active', true)
          .maybeSingle();
        const venueData = dataVenue as any;

        console.log('DEBUG: venueData:', venueData, 'error:', venueErr);

        if (venueData) {
          const { data: dataCourts, error: courtsErr } = await supabase
            .from('courts')
            .select('*')
            .eq('venue_id', venueData.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
          const courtData = dataCourts as any[] | null;

          console.log('DEBUG: courtData:', courtData, 'error:', courtsErr);

          if (courtData) {
            setCourts(courtData);
            if (courtData.length > 0) {
              setSelectedCourtId(courtData[0].id);
            }
          }
        } else {
          console.log('DEBUG: No active venue found for sportParam:', sportParam);
        }
      } catch (err) {
        console.error('Error loading sport details:', err);
      } finally {
        setLoading(false);
        console.log('DEBUG: loadSportDetails finished. loading state set to false');
      }
    };

    loadSportDetails();
  }, [sportParam]);

  // 3. Fetch occupied slots for selected court & date
  useEffect(() => {
    if (!selectedCourtId || !selectedDate) return;

    const fetchBookedSlots = async () => {
      try {
        const { data, error } = await supabase
          .from('booking_slots')
          .select('hour_slot, bookings(status)')
          .eq('court_id', selectedCourtId)
          .eq('booking_date', selectedDate);

        if (data && !error) {
          // Filter out expired or cancelled slots
          const activeSlots = data
            .filter((item: any) => {
              const status = item.bookings?.status;
              return status && !['cancelled', 'expired'].includes(status);
            })
            .map((item: any) => item.hour_slot);

          setBookedSlots(activeSlots);
        }
      } catch (err) {
        console.error('Error fetching booked slots:', err);
      }
    };

    fetchBookedSlots();
  }, [selectedCourtId, selectedDate]);

  // QRIS Countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'payment-qris' && qrisTimer > 0) {
      interval = setInterval(() => {
        setQrisTimer(prev => prev - 1);
      }, 1000);
    } else if (qrisTimer === 0 && step === 'payment-qris') {
      const expireBooking = async () => {
        await (supabase as any)
          .from('bookings')
          .update({ status: 'expired' })
          .eq('booking_code', bookingRef);
        alert('Sesi pembayaran QRIS telah kedaluwarsa. Silakan lakukan pemesanan ulang.');
        setStep('select-slots');
        setSelectedSlots([]);
        setQrisTimer(600);
      };
      expireBooking();
    }
    return () => clearInterval(interval);
  }, [step, qrisTimer, bookingRef]);

  // Generate unique code when proceeding to checkout-form
  useEffect(() => {
    if (step === 'checkout-form' && uniqueCode === 0) {
      setUniqueCode(Math.floor(100 + Math.random() * 900));
    }
  }, [step, uniqueCode]);

  // Total price calculation using database pricing rules
  const baseTotalPrice = priceConfig
    ? selectedSlots.reduce((total, slot) => {
        const hourNum = parseInt(slot.split(':')[0]);
        const isPeak = hourNum >= priceConfig.peak_hour_start;
        return total + priceConfig.base_price + (isPeak ? priceConfig.peak_hour_extra : 0);
      }, 0)
    : 0;

  const totalPrice = baseTotalPrice + (paymentMethod === 'qris' && step !== 'select-slots' ? uniqueCode : 0);

  const handleCourtChange = (courtId: string) => {
    setSelectedCourtId(courtId);
    setSelectedSlots([]);
  };

  const handleDateChange = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlots([]);
  };

  const toggleSlotSelection = (hour: string) => {
    if (bookedSlots.includes(hour)) return;
    if (selectedSlots.includes(hour)) {
      setSelectedSlots(prev => prev.filter(s => s !== hour));
    } else {
      setSelectedSlots(prev => [...prev, hour].sort());
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!name.trim()) {
      errors.name = 'Nama lengkap wajib diisi';
    } else if (name.trim().length < 3) {
      errors.name = 'Nama minimal 3 karakter';
    }

    if (!whatsapp.trim()) {
      errors.whatsapp = 'Nomor WhatsApp wajib diisi';
    } else if (!validateWhatsApp(whatsapp)) {
      errors.whatsapp = 'Format nomor WhatsApp tidak valid (mis. 081234567890)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const code = generateBookingCode(sportParam, selectedDate);
    setBookingRef(code);

    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const { data: bookingData, error: bookingErr } = await (supabase as any)
        .from('bookings')
        .insert({
          booking_code: code,
          court_id: selectedCourtId,
          sport_type: sportParam as any,
          booking_date: selectedDate,
          customer_name: name,
          whatsapp_number: whatsapp,
          notes: notes || null,
          payment_method: paymentMethod,
          status: paymentMethod === 'qris' ? 'hold' : 'pending',
          total_price: totalPrice,
          expires_at: paymentMethod === 'qris' ? expiresAt.toISOString() : null,
          unique_code: paymentMethod === 'qris' ? uniqueCode : 0,
          payment_proof_url: null,
        })
        .select()
        .single();

      if (bookingErr || !bookingData) {
        console.error('Error creating booking:', bookingErr);
        alert('Gagal membuat pesanan. Silakan coba lagi.');
        return;
      }

      const slotsToInsert = selectedSlots.map(slot => ({
        booking_id: bookingData.id,
        court_id: selectedCourtId,
        booking_date: selectedDate,
        hour_slot: slot,
      }));

      const { error: slotsErr } = await (supabase as any)
        .from('booking_slots')
        .insert(slotsToInsert);

      if (slotsErr) {
        console.error('Error creating slots (race condition violation):', slotsErr);
        // Rollback booking transaction manually
        await (supabase as any).from('bookings').delete().eq('id', bookingData.id);
        alert('Slot jadwal baru saja dibooking orang lain. Silakan pilih jadwal lainnya.');
        setSelectedSlots([]);
        setStep('select-slots');
        return;
      }

      if (paymentMethod === 'qris') {
        setStep('payment-qris');
        setQrisTimer(600);
      } else {
        setStep('success');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Terjadi kesalahan server saat checkout.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPaymentProofFile(e.target.files[0]);
    }
  };

  const handleUploadProof = async () => {
    if (!paymentProofFile) {
      alert('Silakan pilih file bukti transfer terlebih dahulu.');
      return;
    }
    setUploadingProof(true);
    try {
      const fileExt = paymentProofFile.name.split('.').pop();
      const fileName = `proof_${bookingRef}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to Supabase Storage Bucket
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, paymentProofFile);

      if (error) {
        console.error('Storage upload error:', error);
        alert('Gagal mengunggah bukti pembayaran. Pastikan tabel & storage bucket sudah dimigrasi.');
        setUploadingProof(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      setUploadedProofUrl(publicUrl);

      // Update booking in Supabase: status to pending, save proof URL, clear expires_at
      const { error: updateErr } = await (supabase as any)
        .from('bookings')
        .update({
          status: 'pending',
          payment_proof_url: publicUrl,
          expires_at: null,
        })
        .eq('booking_code', bookingRef);

      if (updateErr) {
        console.error('Update booking error:', updateErr);
        alert('Gagal menyimpan konfirmasi pembayaran.');
        setUploadingProof(false);
        return;
      }

      setStep('success');
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengunggah bukti.');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleCancelPayment = async () => {
    try {
      await (supabase as any)
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('booking_code', bookingRef);
      setStep('checkout-form');
    } catch (err) {
      console.error('Error cancelling payment:', err);
    }
  };

  const renderHeader = (title: string, onBack: () => void) => {
    return (
      <header className="sticky top-0 bg-white border-b border-outline-variant z-40 w-full">
        <div className="flex items-center justify-between px-container-margin h-16 max-w-7xl mx-auto w-full">
          <button 
            type="button"
            onClick={onBack}
            className="flex items-center justify-center p-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
            title="Kembali"
          >
            <span className="material-symbols-outlined text-on-surface font-semibold text-2xl" data-icon="arrow_back">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold capitalize select-none text-center">
            {title}
          </h1>
          <div className="flex items-center gap-2">
            <button type="button" className="p-2 rounded-lg hover:bg-surface-container transition-colors" title="Bagikan">
              <span className="material-symbols-outlined text-on-surface" data-icon="share">share</span>
            </button>
            <button type="button" className="p-2 rounded-lg hover:bg-surface-container transition-colors" title="Info">
              <span className="material-symbols-outlined text-on-surface" data-icon="info">info</span>
            </button>
          </div>
        </div>
      </header>
    );
  };

  const renderCheckoutHeader = (onBack: () => void) => {
    return (
      <header className="sticky top-0 bg-white border-b border-outline-variant z-40 w-full shadow-sm">
        <div className="flex items-center justify-between px-container-margin h-16 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={onBack}
              className="flex items-center justify-center p-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              title="Kembali"
            >
              <span className="material-symbols-outlined text-[#0052ff] font-semibold text-2xl" data-icon="arrow_back">arrow_back</span>
            </button>
            <span className="text-xs italic text-on-surface-variant/70 hidden sm:inline select-none">
              Jika kembali, jadwal yang di-hold akan dilepas
            </span>
          </div>
          
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold select-none text-center">
            Detail Booking
          </h1>
          
          <div className="flex items-center">
            <button type="button" className="p-2 rounded-lg hover:bg-surface-container transition-colors" title="Profil">
              <span className="material-symbols-outlined text-[#0052ff] text-2xl" data-icon="account_circle">account_circle</span>
            </button>
          </div>
        </div>
        <div className="bg-[#f3f2ff] py-1.5 px-container-margin text-center border-b border-outline-variant/30 sm:hidden">
          <span className="text-[10px] italic text-[#ba1a1a] font-medium">
            Jika kembali, jadwal yang di-hold akan dilepas
          </span>
        </div>
      </header>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fbf8ff]">
        <div className="w-12 h-12 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-body-md text-on-surface-variant animate-pulse">Memuat Jadwal Lapangan...</p>
      </div>
    );
  }

  const selectedCourt = courts.find(c => c.id === selectedCourtId);

  return (
    <div className="flex flex-col min-h-screen bg-[#fbf8ff]">
      {/* 1. SLOT SELECTION STEP */}
      {step === 'select-slots' && (
        <>
          {renderHeader(sportDisplayName(sportParam), () => router.push('/'))}
          
          <main className="flex-grow max-w-3xl mx-auto w-full px-container-margin py-6 pb-32 space-y-6">
            
            {/* LANGKAH 1: PILIH LAPANGAN */}
            <div className="space-y-3">
              <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-wider text-xs select-none">
                LANGKAH 1: PILIH LAPANGAN
              </h2>
              <div className="flex flex-wrap gap-3">
                {courts.map((court, idx) => {
                  const isSelected = selectedCourtId === court.id;
                  return (
                    <button
                      key={court.id}
                      type="button"
                      onClick={() => handleCourtChange(court.id)}
                      className={`px-6 py-3 rounded-lg border text-sm font-semibold transition-standard cursor-pointer ${
                        isSelected
                          ? 'bg-[#0052ff] border-[#0052ff] text-white shadow-sm'
                          : 'bg-white border-outline-variant hover:border-[#0052ff] text-on-surface hover:bg-[#f3f2ff]'
                      }`}
                    >
                      {court.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LANGKAH 2: PILIH TANGGAL */}
            <div className="space-y-3">
              <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-wider text-xs select-none">
                LANGKAH 2: PILIH TANGGAL
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-outline-variant">
                {dates.map((item) => {
                  const isSelected = selectedDate === item.dateStr;
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => handleDateChange(item.dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[70px] h-[90px] rounded-xl border transition-standard cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-[#0052ff] border-[#0052ff] text-white shadow-sm'
                          : 'bg-white border-outline-variant hover:border-[#0052ff] text-on-surface hover:bg-[#f3f2ff]'
                      }`}
                    >
                      <span className="font-label-caps text-[10px] tracking-wider font-semibold opacity-70">
                        {item.labelDay}
                      </span>
                      <span className="font-headline-md text-2xl font-bold mt-1">
                        {item.labelDate}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LANGKAH 3: PILIH JAM */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-wider text-xs select-none">
                  LANGKAH 3: PILIH JAM
                </h2>
                
                {/* Legend */}
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded border border-[#0052ff] bg-white"></span>
                    <span className="font-body-sm text-xs text-on-surface-variant select-none">Tersedia</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-[#0052ff]"></span>
                    <span className="font-body-sm text-xs text-on-surface-variant select-none">Pilihan</span>
                  </div>
                </div>
              </div>

              {/* Grid of Hours */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {HOURS.map((hour) => {
                  const isBooked = bookedSlots.includes(hour);
                  const isSelected = selectedSlots.includes(hour);
                  
                  if (isBooked) {
                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled
                        className="h-12 rounded-lg bg-[#f1f3f5] border border-outline-variant/30 text-on-surface-variant/40 font-label-caps line-through flex items-center justify-center cursor-not-allowed select-none text-sm"
                      >
                        {hour}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => toggleSlotSelection(hour)}
                      className={`h-12 rounded-lg border text-sm font-label-caps font-semibold flex items-center justify-center transition-standard cursor-pointer ${
                        isSelected
                          ? 'bg-[#0052ff] border-[#0052ff] text-white font-bold shadow-sm'
                          : 'bg-white border-[#0052ff]/30 hover:border-[#0052ff] text-[#0052ff] hover:bg-[#f3f2ff]'
                      }`}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Showcase Court Card */}
            {selectedCourt && (
              <div className="border border-outline-variant/50 rounded-2xl overflow-hidden bg-white shadow-sm mt-4">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={selectedCourt.image_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCAg9OnmdBLJR9hP-XsotH_xM55fHLox9I2AJS30sX7Vt3_uMejkOfxar9mBFG7wX5Aqfe1I6HFhnvQtJSP5mHffUGaL2lzaq3DNuzbY52wJGbyZzIXQh_cvawpP-vVmcgZG2HSLZGnowxGcZeMj_8HrhhfS8XW9yfDZMtQ3mnWFzocpn8D8m0aGu-iH9TO5EYvJ-if819G8LvR27AbglzqaQSIUP-fr00Rl18p_ctw06xuRtEqqlH2GA'}
                    alt={selectedCourt.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="font-label-caps text-[10px] text-[#c1f100] tracking-wider font-bold block mb-1">
                      {selectedCourt.badge || 'PRO ARENA QUALITY'}
                    </span>
                    <h3 className="font-headline-md text-lg font-bold">
                      {selectedCourt.name}
                    </h3>
                    <p className="font-body-sm text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
                      {selectedCourt.description || 'Fasilitas terbaik dengan standar kompetisi.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </main>

          {/* Sticky Bottom Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-outline-variant shadow-[0_-4px_16px_rgba(0,0,0,0.05)] z-40 w-full px-container-margin">
            <div className="max-w-3xl mx-auto h-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-surface-container rounded-xl text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-[#0052ff]" data-icon="shopping_cart">shopping_cart</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-sm text-xs text-on-surface-variant select-none">
                    {selectedSlots.length} Slot Terpilih
                  </span>
                  <span className="font-price-display text-price-display text-[#003ec7] font-bold">
                    {formatRupiah(totalPrice)}
                  </span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => selectedSlots.length > 0 && setStep('checkout-form')}
                disabled={selectedSlots.length === 0}
                className={`px-8 py-3.5 font-headline-md text-sm font-extrabold uppercase tracking-wider rounded-lg transition-standard flex items-center gap-2 select-none ${
                  selectedSlots.length > 0
                    ? 'bg-[#c1f100] hover:bg-[#abd600] text-[#191b25] active:scale-[0.98] cursor-pointer shadow-sm'
                    : 'bg-[#f1f3f5] text-on-surface-variant/40 border border-outline-variant/30 cursor-not-allowed'
                }`}
              >
                Lanjut Booking
              </button>
            </div>
          </div>
        </>
      )}

      {/* 2. CHECKOUT FORM STEP */}
      {step === 'checkout-form' && (
        <>
          {renderCheckoutHeader(() => setStep('select-slots'))}
          
          <main className="flex-grow max-w-3xl mx-auto w-full px-container-margin py-8 space-y-8 pb-20">
            
            {/* Ringkasan Booking Card */}
            <div className="bg-white border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#0052ff] px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-headline-md text-sm font-bold tracking-wide uppercase select-none">
                  Ringkasan Booking
                </h3>
                <span className="font-label-caps text-xs bg-white text-[#0052ff] px-3 py-1 rounded font-bold tracking-wider select-none">
                  {sportDisplayName(sportParam).toUpperCase()}
                </span>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-3.5">
                  <div className="flex items-center gap-3 text-on-surface">
                    <span className="material-symbols-outlined text-[#0052ff] text-xl" data-icon="stadium">stadium</span>
                    <span className="font-semibold text-sm">{selectedCourt?.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-on-surface">
                    <span className="material-symbols-outlined text-[#0052ff] text-xl" data-icon="calendar_today">calendar_today</span>
                    <span className="font-semibold text-sm">{formatDateLong(selectedDate)}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-on-surface">
                    <span className="material-symbols-outlined text-[#0052ff] text-xl" data-icon="schedule">schedule</span>
                    <span className="font-semibold text-sm">
                      {selectedSlots[0]} - {getEndTime(selectedSlots[selectedSlots.length - 1])} ({selectedSlots.length} Slot)
                    </span>
                  </div>
                </div>
                
                <div className="hidden md:block md:col-span-1 h-16 border-r border-slate-200 justify-self-center"></div>
                
                <div className="md:col-span-4 flex flex-col md:items-end justify-center">
                  <span className="text-xs text-on-surface-variant/80 font-medium select-none mb-1">
                    Total Pembayaran
                  </span>
                  <span className="font-headline-lg text-xl text-[#003ec7] font-black tracking-tight">
                    {formatRupiah(totalPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleProceedCheckout} className="space-y-8">
              
              {/* Data Pemesan Section */}
              <div className="space-y-4">
                <h2 className="border-l-4 border-[#0052ff] pl-3 font-headline-md text-lg font-bold text-on-surface select-none">
                  Data Pemesan
                </h2>
                
                <div className="bg-white border border-outline-variant/60 rounded-2xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fullname" className="font-headline-md text-xs text-on-surface font-bold">
                      Nama Lengkap <span className="text-[#ff3b30]">*</span>
                    </label>
                    <input
                      type="text"
                      id="fullname"
                      placeholder="Masukkan nama lengkap"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border text-sm transition-standard outline-none bg-white ${
                        formErrors.name 
                          ? 'border-[#ff3b30] focus:border-[#ff3b30]' 
                          : 'border-outline-variant focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]'
                      }`}
                    />
                    {formErrors.name && (
                      <span className="font-body-sm text-xs text-[#ff3b30] mt-0.5">{formErrors.name}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="whatsapp" className="font-headline-md text-xs text-on-surface font-bold">
                      Nomor WhatsApp <span className="text-[#ff3b30]">*</span>
                    </label>
                    <input
                      type="text"
                      id="whatsapp"
                      placeholder="Contoh: 081234567890"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border text-sm transition-standard outline-none bg-white ${
                        formErrors.whatsapp 
                          ? 'border-[#ff3b30] focus:border-[#ff3b30]' 
                          : 'border-outline-variant focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]'
                      }`}
                    />
                    {formErrors.whatsapp && (
                      <span className="font-body-sm text-xs text-[#ff3b30] mt-0.5">{formErrors.whatsapp}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="notes" className="font-headline-md text-xs text-on-surface font-bold">
                      Catatan Tambahan (Opsional)
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      placeholder="Contoh: Bawa bola sendiri"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-outline-variant focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] text-sm transition-standard outline-none resize-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Metode Pembayaran Section */}
              <div className="space-y-4">
                <h2 className="border-l-4 border-[#0052ff] pl-3 font-headline-md text-lg font-bold text-on-surface select-none">
                  Metode Pembayaran
                </h2>
                
                <div className="grid grid-cols-1 gap-4">
                  {/* QRIS payment */}
                  <label 
                    onClick={() => setPaymentMethod('qris')}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-standard ${
                      paymentMethod === 'qris'
                        ? 'bg-[#f3f2ff] border-[#0052ff] shadow-sm'
                        : 'bg-white border-outline-variant hover:border-[#0052ff]/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input 
                        type="radio" 
                        name="payment" 
                        checked={paymentMethod === 'qris'}
                        onChange={() => {}}
                        className="mt-1.5 accent-[#0052ff] w-4 h-4 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="font-headline-md text-sm font-bold text-on-surface flex flex-wrap items-center gap-2">
                          QRIS (Otomatis)
                          <span className="text-[9px] font-black bg-[#c1f100] text-[#191b25] px-2 py-0.5 rounded uppercase tracking-wider">
                            REKOMENDASI
                          </span>
                        </span>
                        <span className="font-body-sm text-xs text-[#00C853] font-medium mt-1 leading-relaxed">
                          Konfirmasi otomatis setelah pembayaran berhasil.
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-2xl text-[#0052ff] opacity-80" data-icon="qr_code_2">qr_code_2</span>
                  </label>

                  {/* On-Site payment */}
                  <label 
                    onClick={() => setPaymentMethod('onsite')}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-standard ${
                      paymentMethod === 'onsite'
                        ? 'bg-[#f3f2ff] border-[#0052ff] shadow-sm'
                        : 'bg-white border-outline-variant hover:border-[#0052ff]/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input 
                        type="radio" 
                        name="payment" 
                        checked={paymentMethod === 'onsite'}
                        onChange={() => {}}
                        className="mt-1.5 accent-[#0052ff] w-4 h-4 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="font-headline-md text-sm font-bold text-on-surface">
                          Bayar di Tempat (Kasir)
                        </span>
                        <span className="font-body-sm text-xs text-[#ff3b30] font-medium mt-1 leading-relaxed flex items-center gap-1">
                          ⚠ Harap datang 15 menit sebelum jadwal untuk pelunasan.
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-2xl text-on-surface-variant/80" data-icon="payments">payments</span>
                  </label>
                </div>
              </div>

              {/* Action Button & Disclaimer */}
              <div className="pt-4 space-y-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-[#0052ff] hover:bg-[#003ec7] text-white font-headline-lg text-base font-bold uppercase tracking-wider rounded-xl transition-standard shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  Konfirmasi Pesanan
                  <span className="font-semibold text-lg ml-0.5 select-none font-label-caps">&gt;</span>
                </button>
                
                <p className="text-center font-body-sm text-xs text-on-surface-variant/70 leading-relaxed select-none">
                  Dengan melanjutkan, Anda menyetujui{' '}
                  <a href="#" className="text-[#0052ff] hover:underline font-semibold">
                    Syarat &amp; Ketentuan
                  </a>{' '}
                  Holiday Sport.
                </p>
              </div>

            </form>
          </main>

          <footer className="bg-[#191b25] text-[#8e91a1] w-full mt-auto">
            <div className="max-w-7xl mx-auto px-container-margin py-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left space-y-1">
                <span className="font-headline-sm font-bold text-white tracking-wider block">HOLIDAY SPORT</span>
                <span className="text-[11px] block text-slate-400 select-none">
                  © 2024 Holiday Sport. All rights reserved.
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-white transition-colors">Contact Us</a>
                <a href="#" className="hover:text-white transition-colors">Venue Partners</a>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* 3. QRIS PAYMENT SIMULATION */}
      {step === 'payment-qris' && (
        <>
          {renderHeader('Pembayaran QRIS', handleCancelPayment)}
          
          <main className="flex-grow max-w-md mx-auto w-full px-container-margin py-8 space-y-6 flex flex-col items-center">
            
            <div className="bg-white border border-outline-variant/60 rounded-2xl p-6 shadow-sm w-full text-center space-y-6">
              
              <div className="space-y-1">
                <span className="font-body-sm text-xs text-on-surface-variant select-none">Sisa Waktu Pembayaran</span>
                <div className="font-label-caps text-3xl font-bold text-[#ba1a1a] tracking-wider select-none animate-pulse">
                  {formatTimer(qrisTimer)}
                </div>
              </div>

              {/* Vector Premium Mock QRIS Code or Uploaded QRIS */}
              <div className="p-4 bg-white border-2 border-slate-100 rounded-xl inline-block mx-auto relative shadow-sm">
                <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2 mb-3 px-1">
                  <span className="font-black text-slate-800 text-base italic tracking-tighter">QRIS</span>
                  <span className="font-label-caps text-[8px] font-bold bg-[#0052ff] text-white px-1.5 py-0.5 rounded">GPN</span>
                </div>
                
                {qrisImageUrl ? (
                  <a href={qrisImageUrl} target="_blank" rel="noreferrer" className="block max-w-[220px] mx-auto">
                    <img src={qrisImageUrl} alt="QRIS Code Pembayaran" className="w-56 h-56 object-contain mx-auto" />
                  </a>
                ) : (
                  <svg className="w-56 h-56 mx-auto text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                    <rect x="0" y="0" width="30" height="30" />
                    <rect x="5" y="5" width="20" height="20" fill="white" />
                    <rect x="10" y="10" width="10" height="10" />

                    <rect x="70" y="0" width="30" height="30" />
                    <rect x="75" y="5" width="20" height="20" fill="white" />
                    <rect x="80" y="10" width="10" height="10" />

                    <rect x="0" y="70" width="30" height="30" />
                    <rect x="5" y="75" width="20" height="20" fill="white" />
                    <rect x="10" y="80" width="10" height="10" />

                    <rect x="70" y="70" width="10" height="10" />
                    
                    <rect x="35" y="0" width="10" height="5" />
                    <rect x="40" y="10" width="5" height="15" />
                    <rect x="55" y="5" width="10" height="5" />
                    <rect x="60" y="15" width="5" height="20" />
                    
                    <rect x="0" y="35" width="5" height="10" />
                    <rect x="10" y="45" width="20" height="5" />
                    <rect x="15" y="55" width="10" height="10" />
                    
                    <rect x="35" y="35" width="30" height="30" />
                    <rect x="40" y="40" width="20" height="20" fill="white" />
                    <rect x="47" y="47" width="6" height="6" />

                    <rect x="75" y="35" width="15" height="5" />
                    <rect x="85" y="45" width="10" height="15" />
                    <rect x="70" y="55" width="10" height="10" />

                    <rect x="35" y="70" width="15" height="10" />
                    <rect x="40" y="85" width="10" height="15" />
                    <rect x="55" y="80" width="25" height="5" />
                    <rect x="60" y="90" width="10" height="10" />
                    <rect x="85" y="85" width="15" height="15" />
                  </svg>
                )}

                <div className="text-[10px] text-on-surface-variant mt-2 font-semibold select-none">
                  NMID: ID1020037729498
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-headline-md text-base font-bold text-on-surface">Holiday Sport Premium Booking</h3>
                <div className="bg-[#f0f4ff] border border-[#0052ff]/20 rounded-xl p-3 inline-block">
                  <span className="text-[10px] text-on-surface-variant font-medium block">NOMINAL TRANSFER (TERMASUK KODE UNIK)</span>
                  <span className="font-price-display text-lg text-[#003ec7] font-black block mt-0.5 select-all">
                    {formatRupiah(totalPrice)}
                  </span>
                  <span className="text-[10px] text-[#ff3b30] font-bold block mt-1">
                    * 3 digit terakhir ({uniqueCode}) adalah kode unik verifikasi Anda.
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant/80 px-2 leading-relaxed mt-2">
                  Pindai kode QR di atas menggunakan aplikasi pembayaran Anda (GoPay, OVO, Dana, LinkAja, ShopeePay, atau M-Banking). Transfer nominal pas sampai digit terakhir.
                </p>
              </div>

              {/* Upload Proof and Actions */}
              <div className="pt-4 border-t border-outline-variant/40 space-y-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="proof-upload" className="text-xs font-bold text-on-surface">
                    Unggah Bukti Transfer <span className="text-[#ff3b30]">*</span>
                  </label>
                  <input
                    type="file"
                    id="proof-upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#f3f2ff] file:text-[#0052ff] hover:file:bg-[#e4e2ff] cursor-pointer border border-outline-variant rounded-lg p-1.5"
                  />
                  {paymentProofFile && (
                    <span className="text-[11px] text-[#00c853] font-medium flex items-center gap-1 mt-0.5">
                      ✓ {paymentProofFile.name} ({(paymentProofFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleUploadProof}
                  disabled={uploadingProof || !paymentProofFile}
                  className={`w-full py-3 text-white font-headline-md text-sm font-bold uppercase tracking-wider rounded-xl transition-standard shadow-sm flex items-center justify-center gap-2 ${
                    uploadingProof || !paymentProofFile
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-outline-variant/20'
                      : 'bg-[#0052ff] hover:bg-[#003ec7] cursor-pointer'
                  }`}
                >
                  {uploadingProof ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Mengunggah Bukti...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">cloud_upload</span>
                      Kirim &amp; Konfirmasi
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleCancelPayment}
                  disabled={uploadingProof}
                  className="w-full py-2 bg-white border border-outline-variant text-on-surface hover:bg-surface-container font-semibold text-xs rounded-lg transition-standard cursor-pointer text-center"
                >
                  Batal &amp; Ubah Metode Bayar
                </button>
              </div>

            </div>
          </main>
        </>
      )}

      {/* 4. SUCCESS SCREEN */}
      {step === 'success' && (
        <main className="flex-grow max-w-md mx-auto w-full px-container-margin py-12 flex flex-col justify-center">
          
          <div className="bg-white border border-outline-variant/60 rounded-3xl p-8 shadow-md text-center space-y-6">
            
            <div className="w-20 h-20 bg-[#EDF2FF] rounded-full flex items-center justify-center mx-auto text-[#0052ff] border-4 border-white shadow-inner select-none transition-transform hover:scale-110 duration-300">
              <span className="material-symbols-outlined text-5xl font-black" data-icon="check">check</span>
            </div>

            <div className="space-y-2 select-none">
              <h1 className="font-headline-lg text-2xl font-black text-[#191b25]">
                {paymentMethod === 'qris' ? 'Bukti Terkirim!' : 'Booking Berhasil!'}
              </h1>
              <p className="font-body-sm text-sm text-on-surface-variant/80 max-w-xs mx-auto leading-relaxed">
                {paymentMethod === 'qris' 
                  ? 'Pemesanan Anda sedang diverifikasi oleh admin. Jadwal lapangan telah dikunci sementara.' 
                  : 'Jadwal lapangan Anda telah berhasil dikunci. Harap lakukan pembayaran di kasir.'}
              </p>
            </div>

            {/* Reference Number */}
            <div className="bg-surface-container-low border border-[#0052ff]/10 py-3 px-4 rounded-xl inline-block">
              <span className="font-label-caps text-[10px] text-on-surface-variant/70 tracking-wider block select-none">
                NOMOR BOOKING
              </span>
              <span className="font-label-caps text-sm font-extrabold text-[#003ec7] tracking-wider mt-0.5 block select-all">
                {bookingRef}
              </span>
            </div>

            {/* Receipt details */}
            <div className="border border-outline-variant/40 rounded-2xl p-4 text-left text-sm space-y-2.5 bg-slate-50">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Jenis Olahraga</span>
                <span className="font-bold text-on-surface capitalize">{sportDisplayName(sportParam)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Lokasi Lapangan</span>
                <span className="font-bold text-on-surface">{selectedCourt?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Tanggal</span>
                <span className="font-semibold text-on-surface">{formatDateLong(selectedDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Waktu</span>
                <span className="font-label-caps font-bold text-[#003ec7]">{selectedSlots.join(', ')} - {getEndTime(selectedSlots[selectedSlots.length - 1])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Metode Bayar</span>
                <span className="font-bold text-on-surface uppercase text-xs">
                  {paymentMethod === 'qris' ? 'QRIS (Menunggu Verifikasi)' : 'Bayar Di Tempat (Unpaid)'}
                </span>
              </div>
              <div className="border-t border-dashed border-outline-variant/50 pt-2.5 mt-2 flex justify-between font-bold">
                <span className="text-on-surface">Total Harga</span>
                <span className="text-[#003ec7] font-extrabold">{formatRupiah(totalPrice)}</span>
              </div>
            </div>

            {/* Customer Information */}
            <div className="text-left text-xs border border-outline-variant/30 rounded-xl p-4 space-y-2">
              <span className="font-label-caps text-[10px] text-on-surface-variant tracking-wider font-semibold block mb-1">
                INFORMASI PEMESAN
              </span>
              <div className="flex justify-between text-on-surface-variant">
                <span>Nama</span>
                <span className="font-semibold text-on-surface">{name}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>WhatsApp</span>
                <span className="font-semibold text-on-surface">{whatsapp}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <a
                href={`https://wa.me/${adminWhatsappNum}?text=${encodeURIComponent(
                  `Halo Admin Holiday Sport, saya telah melakukan pemesanan lapangan olahraga:\n\n` +
                  `- *Nomor Booking*: ${bookingRef}\n` +
                  `- *Pelacakan Status*: ${typeof window !== 'undefined' ? `${window.location.origin}/booking/track/${bookingRef}` : ''}\n` +
                  `- *Olahraga*: ${sportDisplayName(sportParam)}\n` +
                  `- *Lapangan*: ${selectedCourt?.name}\n` +
                  `- *Tanggal*: ${selectedDate}\n` +
                  `- *Waktu*: ${selectedSlots.join(', ')} - ${getEndTime(selectedSlots[selectedSlots.length - 1])}\n` +
                  `- *Total Nominal*: ${formatRupiah(totalPrice)}\n` +
                  `- *Metode Bayar*: ${paymentMethod === 'qris' ? 'QRIS (Menunggu Verifikasi)' : 'Bayar di Tempat'}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 bg-[#c1f100] hover:bg-[#abd600] text-[#191b25] font-headline-md text-sm font-bold uppercase tracking-wider rounded-xl transition-standard shadow-sm flex items-center justify-center gap-2 cursor-pointer select-none text-center"
              >
                <span className="material-symbols-outlined text-lg" data-icon="send">send</span>
                Kirim Bukti Ke WhatsApp
              </a>

              <Link
                href="/"
                className="w-full py-3 bg-white hover:bg-surface-container border border-outline-variant text-on-surface font-headline-md text-sm font-bold uppercase tracking-wider rounded-xl transition-standard block text-center select-none"
              >
                Kembali ke Beranda
              </Link>
            </div>

          </div>
        </main>
      )}
    </div>
  );
}
