'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { BookingWithDetails, Court, SportPrice } from '@/lib/supabase/types';
import { HOURS } from '@/lib/data/constants';
import {
  formatRupiah,
  formatDateLong,
  getEndTime,
  generateBookingCode,
  validateWhatsApp,
  sportDisplayName,
  getTodayStr
} from '@/lib/utils/helpers';

export default function AdminTransactionsPage() {
  // DB States
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [prices, setPrices] = useState<SportPrice[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSport, setFilterSport] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState('');

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);

  // Edit Form states
  const [editName, setEditName] = useState('');
  const [editWA, setEditWA] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<any>('pending');
  const [editErrors, setEditErrors] = useState<{ name?: string; whatsapp?: string }>({});

  // Create Form states
  const [createSport, setCreateSport] = useState<'badminton' | 'futsal' | 'tenis-meja'>('badminton');
  const [createCourtId, setCreateCourtId] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createSlots, setCreateSlots] = useState<string[]>([]);
  const [createName, setCreateName] = useState('');
  const [createWA, setCreateWA] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createStatus, setCreateStatus] = useState<any>('paid');
  const [createErrors, setCreateErrors] = useState<any>({});
  const [createOccupiedSlots, setCreateOccupiedSlots] = useState<string[]>([]);

  // Load baseline configuration
  const loadConfig = async () => {
    try {
      const { data: pricesData } = await supabase.from('sport_prices').select('*');
      if (pricesData) setPrices(pricesData);

      const { data: courtsData } = await supabase.from('courts').select('*').eq('is_active', true);
      if (courtsData) setCourts(courtsData);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data: dataList, error } = await supabase
        .from('bookings')
        .select('*, courts(*)')
        .order('created_at', { ascending: false });
      const bookingsData = dataList as any[] | null;

      if (bookingsData && !error) {
        // Fetch slots
        const bookingIds = bookingsData.map(b => b.id);
        const { data: dataSlots } = await supabase
          .from('booking_slots')
          .select('*')
          .in('booking_id', bookingIds);
        const slotsList = dataSlots as any[] | null;

        const fullBookings = bookingsData.map(b => ({
          ...b,
          booking_slots: slotsList?.filter(s => s.booking_id === b.id) || [],
        }));

        setBookings(fullBookings as any);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    fetchBookings();
  }, []);

  // Fetch occupied slots for CREATE manual booking when court/date changes
  useEffect(() => {
    if (!createCourtId || !createDate) {
      setCreateOccupiedSlots([]);
      return;
    }

    const fetchOccupied = async () => {
      try {
        const { data: dataSlots } = await supabase
          .from('booking_slots')
          .select('hour_slot, bookings(status)')
          .eq('court_id', createCourtId)
          .eq('booking_date', createDate);
        const slotsData = dataSlots as any[] | null;

        if (slotsData) {
          const activeSlots = slotsData
            .filter((item: any) => {
              const status = item.bookings?.status;
              return status && !['cancelled', 'expired'].includes(status);
            })
            .map((item: any) => item.hour_slot);
          setCreateOccupiedSlots(activeSlots);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchOccupied();
    setCreateSlots([]);
  }, [createCourtId, createDate]);

  // Set default court when createSport changes
  useEffect(() => {
    // Let's filter properly
    const filtered = courts.filter(c => {
      if (createSport === 'badminton') return c.id.includes('badminton') || c.name.toLowerCase().includes('court') || c.name.toLowerCase().includes('badminton');
      if (createSport === 'futsal') return c.id.includes('futsal') || c.name.toLowerCase().includes('futsal') || c.name.toLowerCase().includes('synthetic');
      return c.id.includes('meja') || c.name.toLowerCase().includes('meja') || c.name.toLowerCase().includes('tennis');
    });

    if (filtered.length > 0) {
      setCreateCourtId(filtered[0].id);
    } else if (courts.length > 0) {
      setCreateCourtId(courts[0].id);
    }
  }, [createSport, courts]);

  // Edit Modal triggers
  const handleOpenEdit = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setEditName(booking.customer_name);
    setEditWA(booking.whatsapp_number);
    setEditNotes(booking.notes || '');
    setEditStatus(booking.status);
    setEditErrors({});
    setIsModalOpen(true);
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    // Validate
    const errors: any = {};
    if (!editName.trim()) errors.name = 'Nama wajib diisi';
    if (!editWA.trim()) errors.whatsapp = 'Nomor WA wajib diisi';
    else if (!validateWhatsApp(editWA)) errors.whatsapp = 'Format nomor WA tidak valid';

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('bookings')
        .update({
          customer_name: editName,
          whatsapp_number: editWA,
          notes: editNotes || null,
          status: editStatus,
          confirmed_at: editStatus === 'confirmed' && selectedBooking.status !== 'confirmed' ? new Date().toISOString() : selectedBooking.confirmed_at,
        })
        .eq('id', selectedBooking.id);

      if (error) {
        alert('Gagal memperbarui pemesanan.');
        return;
      }

      setIsModalOpen(false);
      fetchBookings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan/menghapus booking ini?')) return;
    try {
      const { error } = await (supabase as any).from('bookings').delete().eq('id', id);
      if (error) {
        alert('Gagal menghapus booking.');
        return;
      }
      fetchBookings();
      if (selectedBooking?.id === id) {
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Modal triggers
  const handleOpenCreate = () => {
    setCreateSport('badminton');
    setCreateDate(getTodayStr());
    setCreateSlots([]);
    setCreateName('');
    setCreateWA('');
    setCreateNotes('');
    setCreateStatus('paid');
    setCreateErrors({});
    setIsCreateModalOpen(true);
  };

  const toggleCreateSlot = (slot: string) => {
    if (createOccupiedSlots.includes(slot)) return;
    if (createSlots.includes(slot)) {
      setCreateSlots(prev => prev.filter(s => s !== slot));
    } else {
      setCreateSlots(prev => [...prev, slot].sort());
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: any = {};
    if (!createCourtId) errors.court = 'Pilih lapangan';
    if (!createDate) errors.date = 'Pilih tanggal';
    if (createSlots.length === 0) errors.slots = 'Pilih setidaknya 1 jam';
    
    if (createStatus !== 'maintenance') {
      if (!createName.trim()) errors.name = 'Nama wajib diisi';
      if (!createWA.trim()) errors.whatsapp = 'Nomor WA wajib diisi';
      else if (!validateWhatsApp(createWA)) errors.whatsapp = 'Format WA tidak valid';
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    const priceConfig = prices.find(p => p.sport_type === createSport);
    if (!priceConfig) return;

    // Calculate dynamic total
    const calculatedTotal = createStatus === 'maintenance' ? 0 : createSlots.reduce((total, slot) => {
      const hourNum = parseInt(slot.split(':')[0]);
      const isPeak = hourNum >= priceConfig.peak_hour_start;
      return total + priceConfig.base_price + (isPeak ? priceConfig.peak_hour_extra : 0);
    }, 0);

    try {
      const code = generateBookingCode(createSport, createDate);
      const isMaintenance = createStatus === 'maintenance';

      // 1. Insert booking
      const { data: bookingData, error: bookingErr } = await (supabase as any)
        .from('bookings')
        .insert({
          booking_code: code,
          court_id: createCourtId,
          sport_type: createSport,
          booking_date: createDate,
          customer_name: isMaintenance ? 'SYSTEM MAINTENANCE' : createName,
          whatsapp_number: isMaintenance ? 'SYSTEM' : createWA,
          notes: createNotes || null,
          payment_method: 'onsite',
          status: isMaintenance ? 'maintenance' : (createStatus === 'paid' ? 'confirmed' : 'pending'),
          total_price: calculatedTotal,
          confirmed_at: createStatus === 'paid' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (bookingErr || !bookingData) {
        alert('Gagal membuat booking baru.');
        return;
      }

      // 2. Insert slots
      const slotsToInsert = createSlots.map(s => ({
        booking_id: bookingData.id,
        court_id: createCourtId,
        booking_date: createDate,
        hour_slot: s,
      }));

      const { error: slotErr } = await (supabase as any).from('booking_slots').insert(slotsToInsert);
      if (slotErr) {
        await (supabase as any).from('bookings').delete().eq('id', bookingData.id);
        alert('Terjadi bentrok jadwal saat pemesanan.');
        return;
      }

      setIsCreateModalOpen(false);
      fetchBookings();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter logic
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.booking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.whatsapp_number.includes(searchTerm);
    const matchesSport = filterSport === 'all' || b.sport_type === filterSport;
    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
    const matchesDate = !filterDate || b.booking_date === filterDate;

    return matchesSearch && matchesSport && matchesStatus && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline-lg text-xl text-on-surface font-bold">Daftar Transaksi</h1>
          <p className="font-body-sm text-xs text-on-surface-variant">Lihat, cari, tambah, dan edit seluruh data pemesanan.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-5 py-2.5 bg-[#0052ff] hover:bg-[#003ec7] text-white font-semibold text-sm rounded-lg transition-standard flex items-center gap-2 select-none shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Tambah Booking
        </button>
      </div>

      {/* FILTER & SEARCH PANEL */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant/60 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-lg select-none">
            search
          </span>
          <input
            type="text"
            placeholder="Cari kode, nama, nomor WA..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-outline-variant rounded-lg text-xs outline-none focus:border-[#0052ff] bg-slate-50 focus:bg-white"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          {/* Sport */}
          <select
            value={filterSport}
            onChange={(e) => setFilterSport(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-xs bg-white font-semibold outline-none focus:border-[#0052ff] cursor-pointer"
          >
            <option value="all">Semua Cabang</option>
            <option value="badminton">Badminton</option>
            <option value="futsal">Futsal</option>
            <option value="tenis-meja">Tenis Meja</option>
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-xs bg-white font-semibold outline-none focus:border-[#0052ff] cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="confirmed">Lunas (Paid)</option>
            <option value="pending">Pending</option>
            <option value="hold">Hold</option>
            <option value="maintenance">Maintenance</option>
            <option value="cancelled">Dibatalkan</option>
            <option value="expired">Expired</option>
          </select>

          {/* Date filter */}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs bg-white font-semibold outline-none focus:border-[#0052ff] cursor-pointer"
          />
        </div>
      </div>

      {/* DATA TABLE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 font-body-md text-on-surface-variant animate-pulse">Menghubungkan Transaksi...</p>
        </div>
      ) : (
        <div className="bg-white border border-outline-variant/60 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-outline-variant text-[10px] text-on-surface-variant/80 font-label-caps tracking-wider select-none">
                  <th className="py-3.5 px-6">KODE</th>
                  <th className="py-3.5 px-4">PELANGGAN</th>
                  <th className="py-3.5 px-4">WHATSAPP</th>
                  <th className="py-3.5 px-4">OLAHRAGA</th>
                  <th className="py-3.5 px-4">LAPANGAN</th>
                  <th className="py-3.5 px-4">TANGGAL &amp; SLOT</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">TOTAL</th>
                  <th className="py-3.5 px-6 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-on-surface-variant/60">
                      <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                      <p className="text-sm">Tidak ada transaksi ditemukan.</p>
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => {
                    const sortedSlots = b.booking_slots?.map(s => s.hour_slot).sort() || [];
                    const timeRange = sortedSlots.length > 0
                      ? `${sortedSlots[0]} - ${getEndTime(sortedSlots[sortedSlots.length - 1])}`
                      : 'N/A';

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-6 font-label-caps font-bold text-[#003ec7] select-all">
                          {b.booking_code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-on-surface">
                          {b.customer_name}
                        </td>
                        <td className="py-3.5 px-4">
                          {b.whatsapp_number === 'SYSTEM' ? (
                            <span className="text-slate-400 select-none">-</span>
                          ) : (
                            <a
                              href={`https://wa.me/${b.whatsapp_number.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#0052ff] hover:underline"
                            >
                              <span className="material-symbols-outlined text-base">chat</span>
                              {b.whatsapp_number}
                            </a>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-on-surface capitalize">
                          {sportDisplayName(b.sport_type)}
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant">
                          {b.courts?.name || '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col text-xs">
                            <span className="font-semibold text-on-surface">{b.booking_date}</span>
                            <span className="text-on-surface-variant font-label-caps font-bold text-[10px] mt-0.5">
                              {timeRange}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase select-none ${
                              b.status === 'confirmed' ? 'bg-[#eefaf2] text-[#00c853]' :
                              b.status === 'pending' ? 'bg-[#fff4e6] text-[#ff9200]' :
                              b.status === 'hold' ? 'bg-sky-50 text-sky-600' :
                              b.status === 'maintenance' ? 'bg-slate-100 text-slate-500' :
                              'bg-[#ffdad6] text-[#ba1a1a]'
                            }`}>
                              {b.status === 'confirmed' ? 'Lunas' :
                               b.status === 'pending' ? 'Pending' :
                               b.status === 'hold' ? 'Hold' :
                               b.status === 'maintenance' ? 'Maintenance' :
                               b.status}
                            </span>
                            {b.payment_proof_url && (
                              <span className="ml-1.5 text-[#0052ff] flex items-center" title="Ada bukti transfer (Upload)">
                                <span className="material-symbols-outlined text-[15px]">image</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-on-surface">
                          <div className="flex flex-col items-end">
                            <span>{formatRupiah(b.total_price)}</span>
                            {b.unique_code > 0 && (
                              <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                                Unik: {b.unique_code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(b)}
                              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-on-surface-variant cursor-pointer flex items-center justify-center"
                              title="Edit"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBooking(b.id)}
                              className="p-1.5 rounded bg-[#ffdad6] hover:bg-[#ffcdc9] text-[#ba1a1a] cursor-pointer flex items-center justify-center"
                              title="Hapus"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. EDIT MODAL */}
      {isModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-50 border-b border-outline-variant px-6 py-4 flex justify-between items-center select-none">
              <h3 className="font-headline-md text-base font-bold text-on-surface">Edit Detail Pemesanan</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-200 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <form onSubmit={handleUpdateBooking} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
               
               {/* Verification quick actions */}
               {selectedBooking.status === 'pending' && selectedBooking.payment_proof_url && (
                 <div className="bg-[#f0f4ff] border border-[#0052ff]/10 p-3.5 rounded-xl space-y-2">
                   <span className="text-xs font-bold text-[#0052ff] flex items-center gap-1 select-none">
                     <span className="material-symbols-outlined text-sm">verified_user</span>
                     Verifikasi Pembayaran Manual
                   </span>
                   <div className="grid grid-cols-2 gap-2">
                     <button
                       type="button"
                       onClick={async () => {
                         if (confirm('Setujui pembayaran ini?')) {
                           try {
                             const { error } = await (supabase as any)
                               .from('bookings')
                               .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
                               .eq('id', selectedBooking.id);
                             if (error) throw error;

                             // WhatsApp redirect for approval
                             const waNum = selectedBooking.whatsapp_number.replace(/[^0-9]/g, '');
                             const trackingUrl = typeof window !== 'undefined' 
                               ? `${window.location.origin}/booking/track/${selectedBooking.booking_code}?wa=${waNum}` 
                               : '';
                             const waMsg = `Halo ${selectedBooking.customer_name}, bukti pembayaran sewa lapangan olahraga Anda untuk booking *${selectedBooking.booking_code}* telah **DISETUJUI** (Lunas). Selamat berolahraga! 🚀\n\nLacak pemesanan Anda: ${trackingUrl}`;
                             window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`, '_blank');

                             setIsModalOpen(false);
                             fetchBookings();
                           } catch (err) {
                             console.error(err);
                             alert('Gagal menyetujui.');
                           }
                         }
                       }}
                       className="py-2 px-3 bg-[#00c853] hover:bg-[#00a844] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                     >
                       <span className="material-symbols-outlined text-sm">check_circle</span>
                       Setujui
                     </button>
                     <button
                       type="button"
                       onClick={async () => {
                         const reason = prompt('Masukkan alasan penolakan (mis. Bukti transfer tidak valid/salah nominal):');
                         if (reason !== null) {
                           try {
                             // 1. Delete associated slots first to free up schedule
                             const { error: delSlotsErr } = await (supabase as any)
                               .from('booking_slots')
                               .delete()
                               .eq('booking_id', selectedBooking.id);
                             if (delSlotsErr) throw delSlotsErr;

                             // 2. Set status to cancelled
                             const { error } = await (supabase as any)
                               .from('bookings')
                               .update({ 
                                 status: 'cancelled', 
                                 notes: `DITOLAK ADMIN: ${reason}. ` + (selectedBooking.notes || '')
                               })
                               .eq('id', selectedBooking.id);
                             if (error) throw error;

                             // WhatsApp redirect for rejection
                             const waNum = selectedBooking.whatsapp_number.replace(/[^0-9]/g, '');
                             const trackingUrl = typeof window !== 'undefined' 
                               ? `${window.location.origin}/booking/track/${selectedBooking.booking_code}?wa=${waNum}` 
                               : '';
                             const waMsg = `Halo ${selectedBooking.customer_name}, bukti pembayaran sewa lapangan olahraga Anda untuk booking *${selectedBooking.booking_code}* telah **DITOLAK** oleh Admin dengan alasan: "${reason}".\n\nSilakan unggah ulang bukti transfer baru di: ${trackingUrl}`;
                             window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`, '_blank');

                             setIsModalOpen(false);
                             fetchBookings();
                           } catch (err) {
                             console.error(err);
                             alert('Gagal menolak.');
                           }
                         }
                       }}
                       className="py-2 px-3 bg-[#ff3b30] hover:bg-[#d6241a] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                     >
                       <span className="material-symbols-outlined text-sm">cancel</span>
                       Tolak
                     </button>
                   </div>
                 </div>
               )}

               {/* Receipt Preview */}
               {selectedBooking.payment_proof_url && (
                 <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-outline-variant rounded-xl">
                   <span className="text-xs font-bold text-on-surface select-none flex items-center gap-1">
                     <span className="material-symbols-outlined text-sm text-[#0052ff]">receipt_long</span>
                     Bukti Transfer
                   </span>
                   <a 
                     href={selectedBooking.payment_proof_url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="relative group block rounded-lg overflow-hidden border border-outline-variant bg-black max-h-48"
                   >
                     <img 
                       src={selectedBooking.payment_proof_url} 
                       alt="Bukti Transfer" 
                       className="w-full h-auto object-contain max-h-48 mx-auto group-hover:scale-105 transition-transform duration-300"
                     />
                     <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                       <span className="material-symbols-outlined text-sm">open_in_new</span>
                       Buka Gambar Penuh
                     </div>
                   </a>
                 </div>
               )}

              {/* Customer Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Nama Lengkap</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                />
                {editErrors.name && <span className="text-xs text-[#ff3b30]">{editErrors.name}</span>}
              </div>

              {/* WhatsApp */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Nomor WhatsApp</label>
                <input
                  type="text"
                  value={editWA}
                  onChange={(e) => setEditWA(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                />
                {editErrors.whatsapp && <span className="text-xs text-[#ff3b30]">{editErrors.whatsapp}</span>}
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                >
                  <option value="confirmed">Lunas (Paid)</option>
                  <option value="pending">Pending</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Catatan Internal</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0052ff] hover:bg-[#003ec7] text-white font-headline-md text-sm font-bold uppercase rounded-xl transition-standard shadow-sm"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            <div className="bg-slate-50 border-b border-outline-variant px-6 py-4 flex justify-between items-center select-none shrink-0">
              <h3 className="font-headline-md text-base font-bold text-on-surface">Tambah Booking Baru</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-200 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
              
              {/* Choose Sport & Court & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-headline-md font-bold text-on-surface">Cabang Olahraga</label>
                  <select
                    value={createSport}
                    onChange={(e) => setCreateSport(e.target.value as any)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs bg-white"
                  >
                    <option value="badminton">Badminton</option>
                    <option value="futsal">Futsal</option>
                    <option value="tenis-meja">Tenis Meja</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-headline-md font-bold text-on-surface">Lapangan</label>
                  <select
                    value={createCourtId}
                    onChange={(e) => setCreateCourtId(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs bg-white"
                  >
                    {courts.filter(c => {
                      if (createSport === 'badminton') return c.id.includes('badminton') || c.name.toLowerCase().includes('court') || c.name.toLowerCase().includes('badminton');
                      if (createSport === 'futsal') return c.id.includes('futsal') || c.name.toLowerCase().includes('futsal') || c.name.toLowerCase().includes('synthetic');
                      return c.id.includes('meja') || c.name.toLowerCase().includes('meja') || c.name.toLowerCase().includes('tennis');
                    }).map(court => (
                      <option key={court.id} value={court.id}>{court.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-headline-md font-bold text-on-surface">Tanggal</label>
                  <input
                    type="date"
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-outline-variant rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              {/* Slots Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface block select-none">Pilih Waktu/Jam</label>
                <div className="grid grid-cols-4 gap-2">
                  {HOURS.map(hour => {
                    const isOccupied = createOccupiedSlots.includes(hour);
                    const isSelected = createSlots.includes(hour);
                    
                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={isOccupied}
                        onClick={() => toggleCreateSlot(hour)}
                        className={`py-1.5 border text-center text-xs font-semibold font-label-caps rounded-lg ${
                          isOccupied
                            ? 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#0052ff] border-[#0052ff] text-white font-bold'
                            : 'bg-white border-[#0052ff]/20 text-[#0052ff] hover:bg-[#f3f2ff]'
                        }`}
                      >
                        {hour}
                      </button>
                    );
                  })}
                </div>
                {createErrors.slots && <span className="text-xs text-[#ff3b30]">{createErrors.slots}</span>}
              </div>

              {/* Status Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface">Status Jadwal</label>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                >
                  <option value="paid">Lunas (Paid)</option>
                  <option value="pending">Pending (Unpaid)</option>
                  <option value="maintenance">Maintenance (Block)</option>
                </select>
              </div>

              {createStatus !== 'maintenance' ? (
                <>
                  {/* Customer Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-headline-md font-bold text-on-surface">Nama Lengkap Pemesan</label>
                    <input
                      type="text"
                      placeholder="Masukkan nama pemesan"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                    />
                    {createErrors.name && <span className="text-xs text-[#ff3b30]">{createErrors.name}</span>}
                  </div>

                  {/* WhatsApp */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-headline-md font-bold text-on-surface">Nomor WhatsApp</label>
                    <input
                      type="text"
                      placeholder="Contoh: 081234567890"
                      value={createWA}
                      onChange={(e) => setCreateWA(e.target.value)}
                      className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                    />
                    {createErrors.whatsapp && <span className="text-xs text-[#ff3b30]">{createErrors.whatsapp}</span>}
                  </div>
                </>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 leading-relaxed">
                  Menandai sebagai maintenance akan memblokir slot-slot terpilih untuk keperluan internal atau perbaikan teknis.
                </div>
              )}

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Masukkan catatan"
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <button
                type="submit"
                className="w-full py-3 bg-[#0052ff] hover:bg-[#003ec7] text-white font-headline-md text-sm font-bold uppercase rounded-xl transition-standard shadow-sm"
              >
                Buat Booking
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
