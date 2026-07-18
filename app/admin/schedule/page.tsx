'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Court, BookingWithDetails, SportPrice } from '@/lib/supabase/types';
import { HOURS } from '@/lib/data/constants';
import {
  formatRupiah,
  formatDateLong,
  getEndTime,
  getTodayStr,
  sportDisplayName,
  generateBookingCode,
  validateWhatsApp
} from '@/lib/utils/helpers';

export default function AdminScheduleCalendarPage() {
  const [selectedSport, setSelectedSport] = useState<'badminton' | 'futsal' | 'tenis-meja'>('badminton');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // DB States
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [priceConfig, setPriceConfig] = useState<SportPrice | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ courtId: string; hour: string } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formWA, setFormWA] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'paid' | 'pending' | 'maintenance'>('paid');
  const [formErrors, setFormErrors] = useState<{ name?: string; whatsapp?: string }>({});

  useEffect(() => {
    setSelectedDate(getTodayStr());
  }, []);

  // Fetch courts, prices and bookings for selected date & sport
  const fetchData = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      // 1. Fetch price config
      const { data: priceData } = await supabase
        .from('sport_prices')
        .select('*')
        .eq('sport_type', selectedSport)
        .maybeSingle();
      if (priceData) setPriceConfig(priceData);

      // 2. Fetch active courts for selected sport
      const { data: dataVenue } = await supabase
        .from('venues')
        .select('*')
        .eq('sport_type', selectedSport)
        .eq('is_active', true)
        .maybeSingle();
      const venueData = dataVenue as any;

      let activeCourts: Court[] = [];
      if (venueData) {
        const { data: courtsData } = await supabase
          .from('courts')
          .select('*')
          .eq('venue_id', venueData.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (courtsData) {
          activeCourts = courtsData;
          setCourts(courtsData);
        }
      }

      // 3. Fetch bookings for this sport, date & active courts
      if (activeCourts.length > 0) {
        const courtIds = activeCourts.map(c => c.id);
        const { data: dataList } = await supabase
          .from('bookings')
          .select('*, courts(*)')
          .eq('booking_date', selectedDate)
          .in('court_id', courtIds)
          .not('status', 'in', '("cancelled","expired")');
        const bookingsList = dataList as any[] | null;
        if (bookingsList && bookingsList.length > 0) {
          // Fetch slots for bookings
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

          setBookings(fullBookings as any);
        } else {
          setBookings([]);
        }
      } else {
        setCourts([]);
        setBookings([]);
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSport, selectedDate]);

  // Helper: Find booking occupying specific cell
  const getBookingForCell = (courtId: string, hour: string) => {
    return bookings.find(b => 
      b.court_id === courtId && 
      b.booking_slots?.some(s => s.hour_slot === hour)
    );
  };

  // Dialog & Form Handlers
  const handleOpenCell = (courtId: string, hour: string, booking?: BookingWithDetails) => {
    if (booking) {
      setSelectedBooking(booking);
      setSelectedCell(null);
    } else {
      setSelectedBooking(null);
      setSelectedCell({ courtId, hour });
      setFormName('');
      setFormWA('');
      setFormNotes('');
      setFormStatus('paid');
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCell(null);
    setSelectedBooking(null);
  };

  const validateForm = (): boolean => {
    const errors: { name?: string; whatsapp?: string } = {};
    if (formStatus !== 'maintenance') {
      if (!formName.trim()) {
        errors.name = 'Nama pemesan wajib diisi';
      }
      if (!formWA.trim()) {
        errors.whatsapp = 'Nomor WhatsApp wajib diisi';
      } else if (!validateWhatsApp(formWA)) {
        errors.whatsapp = 'Format nomor WhatsApp tidak valid';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell || !priceConfig) return;
    if (!validateForm()) return;

    try {
      const code = generateBookingCode(selectedSport, selectedDate);
      const isMaintenance = formStatus === 'maintenance';
      
      const hourNum = parseInt(selectedCell.hour.split(':')[0]);
      const isPeak = hourNum >= priceConfig.peak_hour_start;
      const slotPrice = isMaintenance ? 0 : (priceConfig.base_price + (isPeak ? priceConfig.peak_hour_extra : 0));

      const { data: bookingData, error: bookingErr } = await (supabase as any)
        .from('bookings')
        .insert({
          booking_code: code,
          court_id: selectedCell.courtId,
          sport_type: selectedSport,
          booking_date: selectedDate,
          customer_name: isMaintenance ? 'SYSTEM MAINTENANCE' : formName,
          whatsapp_number: isMaintenance ? 'SYSTEM' : formWA,
          notes: formNotes || null,
          payment_method: 'onsite',
          status: isMaintenance ? 'maintenance' : (formStatus === 'paid' ? 'confirmed' : 'pending'),
          total_price: slotPrice,
          confirmed_at: formStatus === 'paid' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (bookingErr || !bookingData) {
        console.error('Error creating manual booking:', bookingErr);
        alert('Gagal membuat jadwal baru. Kemungkinan bentrok.');
        return;
      }

      const { error: slotErr } = await (supabase as any)
        .from('booking_slots')
        .insert({
          booking_id: bookingData.id,
          court_id: selectedCell.courtId,
          booking_date: selectedDate,
          hour_slot: selectedCell.hour
        });

      if (slotErr) {
        console.error('Error creating slot:', slotErr);
        await (supabase as any).from('bookings').delete().eq('id', bookingData.id);
        alert('Slot ini sudah dibooking orang lain.');
        return;
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedBooking) return;
    try {
      const { error } = await (supabase as any)
        .from('bookings')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', selectedBooking.id);

      if (error) {
        alert('Gagal memperbarui pembayaran.');
        return;
      }

      // WhatsApp redirect for approval
      const waNum = selectedBooking.whatsapp_number.replace(/[^0-9]/g, '');
      const trackingUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/booking/track/${selectedBooking.booking_code}?wa=${waNum}` 
        : '';
      const waMsg = `Halo ${selectedBooking.customer_name}, bukti pembayaran sewa lapangan olahraga Anda untuk booking *${selectedBooking.booking_code}* telah **DISETUJUI** (Lunas). Selamat berolahraga! 🚀\n\nLacak pemesanan Anda: ${trackingUrl}`;
      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`, '_blank');

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    if (!confirm('Apakah Anda yakin ingin membatalkan/menghapus booking ini?')) return;

    try {
      const { error } = await (supabase as any)
        .from('bookings')
        .delete()
        .eq('id', selectedBooking.id);

      if (error) {
        alert('Gagal menghapus booking.');
        return;
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Metrics for bottom info bar
  const totalCapacity = courts.length * HOURS.length;
  const occupiedCount = bookings.reduce((sum, b) => sum + (b.booking_slots?.length || 0), 0);
  const occupancyPercentage = totalCapacity > 0 ? Math.round((occupiedCount / totalCapacity) * 100) : 0;
  const expectedRevenue = bookings.reduce((sum, b) => sum + (b.status === 'confirmed' || b.status === 'pending' ? b.total_price : 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. FILTER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-outline-variant/60 shadow-sm">
        <div>
          <h1 className="font-headline-lg text-xl text-on-surface font-bold">Kalender Jadwal</h1>
          <p className="font-body-sm text-xs text-on-surface-variant">Manajemen sel jadwal lapangan secara instan.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Sport Selector */}
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value as any)}
            className="px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white font-semibold outline-none focus:border-[#0052ff] cursor-pointer"
          >
            <option value="badminton">🏸 Badminton</option>
            <option value="futsal">⚽ Futsal</option>
            <option value="tenis-meja">🏓 Tenis Meja</option>
          </select>

          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white font-semibold outline-none focus:border-[#0052ff] cursor-pointer"
          />
        </div>
      </div>

      {/* Legend & Stats Overview */}
      <div className="flex flex-wrap justify-between items-center gap-4 text-xs select-none">
        {/* Color Legend */}
        <div className="flex flex-wrap gap-4 items-center bg-white px-4 py-2.5 rounded-lg border border-outline-variant/40">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border border-[#0052ff]/30 bg-white"></span>
            <span className="text-on-surface-variant font-medium">Tersedia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#0052ff]"></span>
            <span className="text-on-surface-variant font-medium">Lunas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#fff4e6] border border-[#ff9200]/25"></span>
            <span className="text-on-surface-variant font-medium">Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300/30"></span>
            <span className="text-on-surface-variant font-medium">Maintenance</span>
          </div>
        </div>

        {/* Stats indicators */}
        <div className="flex gap-4">
          <span className="font-semibold text-on-surface-variant bg-[#f3f2ff] px-3 py-1.5 rounded-lg border border-outline-variant/30">
            Okupansi: <span className="text-[#0052ff]">{occupancyPercentage}%</span>
          </span>
          <span className="font-semibold text-on-surface-variant bg-[#eefaf2] px-3 py-1.5 rounded-lg border border-outline-variant/30">
            Estimasi Pendapatan: <span className="text-[#00c853]">{formatRupiah(expectedRevenue)}</span>
          </span>
        </div>
      </div>

      {/* 2. CALENDAR SCHEDULE GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 font-body-md text-on-surface-variant animate-pulse">Menghubungkan Jadwal...</p>
        </div>
      ) : courts.length === 0 ? (
        <div className="bg-white border border-outline-variant/60 rounded-xl p-12 text-center text-on-surface-variant/60">
          <span className="material-symbols-outlined text-5xl mb-3">stadium</span>
          <p className="font-semibold text-sm">Tidak ada lapangan aktif ditemukan untuk olahraga ini.</p>
        </div>
      ) : (
        <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-outline-variant text-[10px] text-on-surface-variant/80 font-label-caps tracking-wider select-none">
                  <th className="py-4 px-4 w-20 border-r border-outline-variant/40 text-center">WAKTU</th>
                  {courts.map(court => (
                    <th key={court.id} className="py-4 px-6 text-center font-bold">
                      {court.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {HOURS.map(hour => (
                  <tr key={hour} className="h-14 hover:bg-slate-50/20">
                    {/* Time cell */}
                    <td className="py-2 px-3 border-r border-outline-variant/40 text-center font-label-caps text-[11px] font-bold text-on-surface-variant bg-slate-50/60 select-none">
                      {hour}
                    </td>

                    {/* Courts cells */}
                    {courts.map(court => {
                      const booking = getBookingForCell(court.id, hour);
                      
                      if (booking) {
                        const isFirstSlot = booking.booking_slots?.map(s => s.hour_slot).sort()[0] === hour;
                        const isPaid = booking.status === 'confirmed';
                        const isPending = booking.status === 'pending';
                        const isMaintenance = booking.status === 'maintenance';

                        return (
                          <td 
                            key={court.id}
                            className={`p-1 text-xs border-r border-outline-variant/10 align-middle ${
                              isFirstSlot ? 'relative' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenCell(court.id, hour, booking)}
                              className={`w-full h-11 px-3 py-1.5 rounded-lg border text-left flex flex-col justify-center transition-all duration-200 select-none cursor-pointer ${
                                isPaid
                                  ? 'bg-[#0052ff] border-[#0052ff] text-white shadow-sm hover:opacity-90'
                                  : isPending
                                  ? 'bg-[#fff4e6] border-[#ff9200]/30 text-[#ff9200] hover:bg-[#ffe8cc]'
                                  : isMaintenance
                                  ? 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                {isMaintenance && (
                                  <span className="material-symbols-outlined text-sm font-semibold">build</span>
                                )}
                                <span className="font-bold truncate max-w-full">
                                  {isMaintenance ? 'MAINTENANCE' : booking.customer_name}
                                </span>
                              </div>
                              {isFirstSlot && booking.booking_slots && booking.booking_slots.length > 1 && (
                                <span className="text-[9px] opacity-75 font-label-caps font-semibold mt-0.5">
                                  {booking.booking_slots[0].hour_slot} - {getEndTime(booking.booking_slots.sort().reverse()[0].hour_slot)}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      }

                      // Empty available slot
                      return (
                        <td 
                          key={court.id}
                          className="p-1 border-r border-outline-variant/10 align-middle"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenCell(court.id, hour)}
                            className="w-full h-11 rounded-lg border border-dashed border-[#0052ff]/20 hover:border-[#0052ff] hover:bg-[#f3f2ff]/60 transition-all duration-200 cursor-pointer flex items-center justify-center text-[#0052ff] opacity-0 hover:opacity-100"
                            title="Pesan Slot"
                          >
                            <span className="material-symbols-outlined text-lg">add</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. MODAL FOR BOOKING / DETAIL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-outline-variant px-6 py-4 flex justify-between items-center select-none">
              <h3 className="font-headline-md text-base font-bold text-on-surface">
                {selectedBooking ? 'Detail Pemesanan' : 'Tambah Jadwal Manual'}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg hover:bg-slate-200/60 text-on-surface-variant"
                title="Tutup"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* DETAIL EXISTING BOOKING */}
            {selectedBooking ? (
              <div className="p-6 space-y-5">
                {/* Reference Box */}
                <div className="bg-slate-50 border border-outline-variant/40 rounded-xl p-3.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-on-surface-variant font-label-caps block">KODE BOOKING</span>
                    <span className="font-label-caps font-bold text-[#003ec7] tracking-wider block mt-0.5 select-all">
                      {selectedBooking.booking_code}
                    </span>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase select-none ${
                    selectedBooking.status === 'confirmed' ? 'bg-[#eefaf2] text-[#00c853]' :
                    selectedBooking.status === 'pending' ? 'bg-[#fff4e6] text-[#ff9200]' :
                    selectedBooking.status === 'maintenance' ? 'bg-slate-100 text-slate-500' :
                    'bg-[#ffdad6] text-[#ba1a1a]'
                  }`}>
                    {selectedBooking.status === 'confirmed' ? 'Lunas' :
                     selectedBooking.status === 'pending' ? 'Pending' :
                     selectedBooking.status === 'maintenance' ? 'Maintenance' :
                     selectedBooking.status}
                  </span>
                </div>

                {/* Details list */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant select-none">Pemesan</span>
                    <span className="font-bold text-on-surface">{selectedBooking.customer_name}</span>
                  </div>
                  {selectedBooking.status !== 'maintenance' && (
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant select-none">WhatsApp</span>
                      <a 
                        href={`https://wa.me/${selectedBooking.whatsapp_number}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="font-semibold text-[#0052ff] hover:underline"
                      >
                        {selectedBooking.whatsapp_number}
                      </a>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant select-none">Lapangan</span>
                    <span className="font-semibold text-on-surface">{selectedBooking.courts?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant select-none">Jam Booking</span>
                    <span className="font-label-caps font-bold text-[#003ec7]">
                      {selectedBooking.booking_slots?.map(s => s.hour_slot).sort().join(', ')}
                    </span>
                  </div>
                  {selectedBooking.notes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-xs text-on-surface-variant select-none block">Catatan</span>
                      <p className="text-xs text-on-surface italic mt-0.5 bg-slate-50 p-2 rounded-lg border border-outline-variant/20 leading-relaxed">
                        "{selectedBooking.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-outline-variant/40 flex flex-col gap-2">
                  {selectedBooking.status === 'pending' && (
                    <button
                      type="button"
                      onClick={handleMarkAsPaid}
                      className="w-full py-3 bg-[#00C853] hover:bg-[#00a844] text-white font-semibold text-sm rounded-xl transition-standard shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      Tandai Sebagai Lunas (Lunas)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDeleteBooking}
                    className="w-full py-2.5 bg-white border border-[#ff3b30]/30 hover:border-[#ff3b30] hover:bg-[#ffdad6]/20 text-[#ff3b30] font-semibold text-xs rounded-lg transition-standard"
                  >
                    Hapus / Batalkan Pemesanan
                  </button>
                </div>
              </div>
            ) : (
              /* CREATE NEW BOOKING MANUAL FORM */
              <form onSubmit={handleCreateBooking} className="p-6 space-y-4">
                {/* Form Cell details */}
                <div className="bg-slate-50 border border-outline-variant/40 rounded-xl p-3 text-xs select-none">
                  <div className="grid grid-cols-2 gap-2 text-on-surface-variant">
                    <div>
                      <span>WAKTU SLOT</span>
                      <span className="font-label-caps font-bold text-[#003ec7] block mt-0.5">
                        {selectedCell?.hour}
                      </span>
                    </div>
                    <div>
                      <span>TANGGAL</span>
                      <span className="font-semibold text-on-surface block mt-0.5">
                        {selectedDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Schedule Type Selection */}
                <div className="flex gap-4 border-b border-outline-variant pb-3 justify-center select-none">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="formtype"
                      checked={formStatus !== 'maintenance'}
                      onChange={() => setFormStatus('paid')}
                      className="accent-[#0052ff] w-4 h-4"
                    />
                    Booking Pelanggan
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-500">
                    <input
                      type="radio"
                      name="formtype"
                      checked={formStatus === 'maintenance'}
                      onChange={() => setFormStatus('maintenance')}
                      className="accent-slate-500 w-4 h-4"
                    />
                    Blokir Pemeliharaan (Maintenance)
                  </label>
                </div>

                {formStatus !== 'maintenance' ? (
                  <>
                    {/* Customer Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-headline-md font-bold text-on-surface select-none">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Budi Santoso"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none bg-white transition-standard ${
                          formErrors.name ? 'border-[#ff3b30]' : 'border-outline-variant focus:border-[#0052ff]'
                        }`}
                      />
                      {formErrors.name && (
                        <span className="text-xs text-[#ff3b30] mt-0.5">{formErrors.name}</span>
                      )}
                    </div>

                    {/* WhatsApp */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-headline-md font-bold text-on-surface select-none">
                        Nomor WhatsApp
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 081234567890"
                        value={formWA}
                        onChange={(e) => setFormWA(e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none bg-white transition-standard ${
                          formErrors.whatsapp ? 'border-[#ff3b30]' : 'border-outline-variant focus:border-[#0052ff]'
                        }`}
                      />
                      {formErrors.whatsapp && (
                        <span className="text-xs text-[#ff3b30] mt-0.5">{formErrors.whatsapp}</span>
                      )}
                    </div>

                    {/* Booking Status Select */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-headline-md font-bold text-on-surface select-none">
                        Status Pembayaran
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-white font-semibold outline-none focus:border-[#0052ff]"
                      >
                        <option value="paid">Lunas (Paid / Confirmed)</option>
                        <option value="pending">Belum Lunas (Unpaid / Pending)</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed select-none">
                    📌 Menandai blokir ini sebagai maintenance akan memblokir slot waktu <strong>{selectedCell?.hour}</strong> pada lapangan ini sehingga tidak dapat dipesan oleh pelanggan umum.
                  </div>
                )}

                {/* Notes */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-headline-md font-bold text-on-surface select-none">
                    Catatan Internal (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Maintenance rutin lampu atau perbaikan net"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm outline-none bg-white transition-standard resize-none focus:border-[#0052ff]"
                  />
                </div>

                {/* Actions */}
                <button
                  type="submit"
                  className={`w-full py-3 text-white font-headline-md text-sm font-bold uppercase tracking-wider rounded-xl transition-standard shadow-sm flex items-center justify-center gap-1.5 ${
                    formStatus === 'maintenance' ? 'bg-slate-600 hover:bg-slate-700' : 'bg-[#0052ff] hover:bg-[#003ec7]'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">check</span>
                  Terapkan Jadwal
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
