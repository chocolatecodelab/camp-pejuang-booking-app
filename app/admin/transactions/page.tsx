'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatRupiah, formatDateRange, getStatusLabel, getStatusColor } from '@/lib/utils/helpers';
import { waConfirmPayment, waRejectPayment, waBookingCompleted, waSettleBalance } from '@/lib/whatsapp';
import Swal from 'sweetalert2';

interface Booking {
  id: string;
  booking_code: string;
  customer_name: string;
  whatsapp_number: string;
  check_in: string;
  check_out: string;
  payment_type: 'dp' | 'full';
  payment_channel: 'qris' | 'transfer_bank';
  claimed_amount: number;
  total_price: number;
  status: string;
  notes: string | null;
  created_at: string;
  rooms: {
    id: string;
    name: string;
    floor_label: string | null;
    camps: {
      id: string;
      name: string;
    }
  }
}

export default function AdminTransactionsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Selected detail modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // Room reassignment states
  const [isReassigning, setIsReassigning] = useState(false);
  const [campRooms, setCampRooms] = useState<{ id: string; name: string; floor_label: string | null }[]>([]);
  const [selectedNewRoomId, setSelectedNewRoomId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  
  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      let url = '/api/admin/bookings';
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.bookings) {
        setBookings(data.bookings);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const filteredBookings = bookings.filter((b) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.booking_code.toLowerCase().includes(term) ||
      b.customer_name.toLowerCase().includes(term) ||
      b.whatsapp_number.includes(term) ||
      b.rooms?.name.toLowerCase().includes(term) ||
      b.rooms?.camps?.name.toLowerCase().includes(term)
    );
  });

  const openDetail = async (booking: Booking) => {
    setSelectedBooking(booking);
    setProofUrl(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`);
      const data = await res.json();
      if (data.payment_proofs && data.payment_proofs.length > 0) {
        // Ambil bukti pembayaran terbaru
        const sortedProofs = [...data.payment_proofs].sort(
          (a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
        setProofUrl(sortedProofs[0].signed_url);
      }
    } catch (err) {
      console.error('Error loading detail/proof:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const startReassign = async () => {
    if (!selectedBooking) return;
    setIsReassigning(true);
    try {
      const res = await fetch(`/api/admin/camps/${selectedBooking.rooms.camps.id}/rooms`);
      const data = await res.json();
      if (data.rooms) {
        setCampRooms(data.rooms.filter((r: any) => r.is_active));
        setSelectedNewRoomId(selectedBooking.rooms.id);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  const handleReassignSave = async () => {
    if (!selectedBooking || !selectedNewRoomId || selectedNewRoomId === selectedBooking.rooms.id) {
      setIsReassigning(false);
      return;
    }
    setReassignLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: selectedNewRoomId })
      });
      const data = await res.json();
      if (!res.ok) {
        Swal.fire('Gagal Pindah Kamar', data.error || 'Terjadi kesalahan', 'error');
        return;
      }
      
      Swal.fire('Berhasil!', 'Kamar berhasil dipindahkan.', 'success');
      setIsReassigning(false);
      
      // Refresh the main bookings list
      fetchBookings();
      
      // Update local modal data
      const matchedRoom = campRooms.find(r => r.id === selectedNewRoomId);
      if (matchedRoom) {
        setSelectedBooking({
          ...selectedBooking,
          rooms: {
            ...selectedBooking.rooms,
            id: matchedRoom.id,
            name: matchedRoom.name,
            floor_label: matchedRoom.floor_label
          }
        });
      }
    } catch (err) {
      console.error('Error reassigning room:', err);
      Swal.fire('Error', 'Gagal memproses pemindahan kamar.', 'error');
    } finally {
      setReassignLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedBooking) return;

    const confirm = await Swal.fire({
      title: 'Approve Pembayaran?',
      text: 'Status booking akan diubah menjadi CONFIRMED dan kamar dikunci secara permanen.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28A745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Ya, Approve!',
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/approve`, {
        method: 'PATCH',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengapprove sewa');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Booking Approved',
        text: 'Pemesanan telah disetujui.',
        confirmButtonColor: '#b52330',
      });

      // Show option to contact user via WhatsApp
      const waLink = waConfirmPayment(selectedBooking.whatsapp_number, selectedBooking.booking_code, selectedBooking.customer_name);
      window.open(waLink, '_blank');

      setSelectedBooking(null);
      fetchBookings();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Terjadi kesalahan sistem',
        confirmButtonColor: '#b52330',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedBooking) return;

    const { value: reason } = await Swal.fire({
      title: 'Tolak Pembayaran?',
      text: 'Masukkan alasan penolakan bukti transfer:',
      input: 'text',
      inputPlaceholder: 'Contoh: Bukti transfer tidak terbaca / palsu',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b52330',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Ya, Tolak!',
      inputValidator: (value) => {
        if (!value) {
          return 'Alasan penolakan wajib diisi!';
        }
      }
    });

    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menolak sewa');
      }

      await Swal.fire({
        icon: 'warning',
        title: 'Booking Rejected',
        text: 'Bukti transfer telah ditolak.',
        confirmButtonColor: '#b52330',
      });

      // Show option to contact user via WhatsApp
      const waLink = waRejectPayment(selectedBooking.whatsapp_number, selectedBooking.booking_code, selectedBooking.customer_name, reason);
      window.open(waLink, '_blank');

      setSelectedBooking(null);
      fetchBookings();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Terjadi kesalahan sistem',
        confirmButtonColor: '#b52330',
      });
    }
  };

  const handleCheckout = async (targetBooking?: Booking) => {
    const b = targetBooking || selectedBooking;
    if (!b) return;

    const { value: notes, isConfirmed } = await Swal.fire({
      title: 'Selesai Sewa / Check-Out Awal?',
      html: `<div class="text-left text-sm space-y-2 mt-2">` +
            `<p>Apakah penyewa <strong>${b.customer_name}</strong> telah selesai menyewa dan mengosongkan <strong>${b.rooms?.name} (${b.rooms?.camps?.name})</strong>?</p>` +
            `<p class="text-xs text-teal-800 bg-teal-50 p-2.5 rounded border border-teal-200">ℹ️ Kamar akan langsung rilis dan status kamar menjadi <strong>Tersedia (Kosong)</strong> untuk pemesan baru.</p>` +
            `</div>`,
      input: 'text',
      inputPlaceholder: 'Catatan opsional (misal: keluar H-5 urusan keluarga)',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0d9488',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Ya, Selesaikan Sewa!',
      cancelButtonText: 'Batal',
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/bookings/${b.id}/checkout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses check-out sewa');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Sewa Berhasil Diselesaikan!',
        text: `Status sewa ${b.customer_name} diubah menjadi Selesai (Check-Out). Kamar ${b.rooms?.name} telah dirilis dan tersedia kembali.`,
        confirmButtonColor: '#0d9488',
      });

      // Open WhatsApp link to send completion notice
      const waLink = waBookingCompleted(b.whatsapp_number, b.booking_code, b.customer_name, notes || undefined);
      window.open(waLink, '_blank');

      if (selectedBooking?.id === b.id) {
        setSelectedBooking(null);
      }
      fetchBookings();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Terjadi kesalahan sistem',
        confirmButtonColor: '#b52330',
      });
    }
  };

  const handleSettleBalance = async (targetBooking?: Booking) => {
    const b = targetBooking || selectedBooking;
    if (!b) return;

    const remaining = b.total_price - b.claimed_amount;
    if (remaining <= 0) return;

    const result = await Swal.fire({
      title: 'Catat Pelunasan Sisa di Tempat?',
      html: `<div class="text-left text-sm space-y-2 mt-2">` +
            `<p>Konfirmasi bahwa sisa pembayaran sebesar <strong>${formatRupiah(remaining)}</strong> dari penyewa <strong>${b.customer_name}</strong> telah diterima di lokasi?</p>` +
            `<p class="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded border border-emerald-200">ℹ️ Nominal terbayar (claimed amount) akan diperbarui menjadi 100% LUNAS (<strong>${formatRupiah(b.total_price)}</strong>) dan tercatat di laporan keuangan.</p>` +
            `</div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Ya, Catat Pelunasan!',
      cancelButtonText: 'Batal',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/bookings/${b.id}/settle`, {
        method: 'PATCH',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mencatat pelunasan sisa');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Pelunasan Berhasil Dicatat!',
        text: `Status pembayaran sewa ${b.customer_name} kini 100% LUNAS (${formatRupiah(b.total_price)}).`,
        confirmButtonColor: '#059669',
      });

      // Open WhatsApp notification
      const waLink = waSettleBalance(b.whatsapp_number, b.booking_code, b.customer_name, remaining);
      window.open(waLink, '_blank');

      if (selectedBooking?.id === b.id) {
        setSelectedBooking(null);
      }
      fetchBookings();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Terjadi kesalahan sistem',
        confirmButtonColor: '#b52330',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-headline-md font-bold text-on-surface">Transaksi Pemesanan</h1>
        <p className="text-body-md text-on-surface-variant">Daftar kelola sewa kamar & verifikasi pembayaran manual admin.</p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#EAEAEA] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Cari nama, kode booking, camp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#EAEAEA] bg-neutral-50 rounded-lg text-sm transition-colors outline-none focus:bg-white focus:border-[#b52330]"
          />
        </form>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <label className="text-label-sm text-on-surface-variant font-semibold">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border border-[#EAEAEA] rounded-lg text-sm bg-white outline-none focus:border-[#b52330] font-medium"
          >
            <option value="all">Semua Status</option>
            <option value="hold">Hold (Menunggu Transfer)</option>
            <option value="pending_verification">Pending Verifikasi</option>
            <option value="confirmed">Confirmed (Lunas/Aktif)</option>
            <option value="completed">Completed (Selesai/Check-out)</option>
            <option value="rejected">Rejected (Ditolak)</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl border border-[#EAEAEA] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-[#EAEAEA] text-label-sm text-outline font-semibold">
                <th className="p-4">Kode Booking</th>
                <th className="p-4">Nama Pelanggan</th>
                <th className="p-4">Camp & Kamar</th>
                <th className="p-4">Periode Tinggal</th>
                <th className="p-4">Nominal</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-outline">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-outline font-medium">
                    Tidak ada transaksi ditemukan
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 font-bold text-primary select-all">{b.booking_code}</td>
                    <td className="p-4">
                      <p className="font-semibold text-on-surface">{b.customer_name}</p>
                      <a
                        href={`https://wa.me/${b.whatsapp_number}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-success-green hover:underline flex items-center gap-0.5 mt-0.5"
                      >
                        <span className="material-symbols-outlined text-[12px] font-bold">chat</span>
                        {b.whatsapp_number}
                      </a>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-on-surface">{b.rooms?.camps.name}</p>
                      <p className="text-xs text-outline font-medium">{b.rooms?.name}</p>
                    </td>
                    <td className="p-4 font-medium text-on-surface-variant">
                      {formatDateRange(b.check_in, b.check_out)}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-on-surface">{formatRupiah(b.claimed_amount)}</p>
                      <p className="text-[10px] text-outline uppercase font-semibold">{b.payment_type} pay</p>
                      {b.status === 'confirmed' && b.claimed_amount < b.total_price && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[9px] font-bold rounded">
                          Sisa {formatRupiah(b.total_price - b.claimed_amount)}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(b.status)}`}>
                        {getStatusLabel(b.status)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetail(b)}
                          className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-on-surface font-bold text-xs rounded transition-colors"
                        >
                          Detail & Verifikasi
                        </button>
                        {b.status === 'confirmed' && b.claimed_amount < b.total_price && (
                          <button
                            onClick={() => handleSettleBalance(b)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors inline-flex items-center gap-1 shadow-sm"
                            title="Catat penerimaan sisa pelunasan di lokasi"
                          >
                            <span className="material-symbols-outlined text-xs">price_check</span>
                            Pelunasan Sisa
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => handleCheckout(b)}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded transition-colors inline-flex items-center gap-1 shadow-sm"
                            title="Tandai penyewa telah selesai/keluar (kamar kosong)"
                          >
                            <span className="material-symbols-outlined text-xs">logout</span>
                            Selesai Sewa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-[#EAEAEA] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#EAEAEA] flex justify-between items-center bg-neutral-50 rounded-t-xl">
              <div className="space-y-0.5">
                <h3 className="text-headline-sm text-base font-bold">Detail Transaksi {selectedBooking.booking_code}</h3>
                <p className="text-xs text-outline">Dibuat pada: {new Date(selectedBooking.created_at).toLocaleString('id-ID')}</p>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded hover:bg-neutral-200 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-4 border-b border-dashed border-[#EAEAEA] pb-4">
                <div>
                  <p className="text-xs text-outline font-semibold uppercase tracking-wider">Penyewa</p>
                  <p className="font-bold text-on-surface">{selectedBooking.customer_name}</p>
                  <p className="text-xs text-on-surface-variant font-medium">{selectedBooking.whatsapp_number}</p>
                </div>
                 <div>
                  <p className="text-xs text-outline font-semibold uppercase tracking-wider">Camp & Kamar</p>
                  <p className="font-bold text-on-surface">{selectedBooking.rooms?.camps.name}</p>
                  
                  {isReassigning ? (
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={selectedNewRoomId}
                        onChange={(e) => setSelectedNewRoomId(e.target.value)}
                        disabled={reassignLoading}
                        className="p-1.5 rounded border border-outline-variant bg-white text-xs font-semibold focus:outline-none focus:border-primary text-slate-800"
                      >
                        {campRooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.floor_label || 'Lantai 1'})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleReassignSave}
                        disabled={reassignLoading}
                        className="px-2 py-1 bg-primary text-white font-bold text-[10px] rounded hover:bg-[#93000a] transition-colors"
                      >
                        {reassignLoading ? '...' : 'Simpan'}
                      </button>
                      <button
                        onClick={() => setIsReassigning(false)}
                        disabled={reassignLoading}
                        className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-on-surface font-bold text-[10px] rounded transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-on-surface-variant font-medium">{selectedBooking.rooms?.name}</p>
                      {(selectedBooking.status === 'hold' || selectedBooking.status === 'pending_verification') && (
                        <button
                          onClick={startReassign}
                          className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-xs">swap_horiz</span>
                          Pindahkan
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-dashed border-[#EAEAEA] pb-4">
                <div>
                  <p className="text-xs text-outline font-semibold uppercase tracking-wider">Periode Sewa</p>
                  <p className="font-semibold text-on-surface">{formatDateRange(selectedBooking.check_in, selectedBooking.check_out)}</p>
                </div>
                <div>
                  <p className="text-xs text-outline font-semibold uppercase tracking-wider">Rincian Pembayaran</p>
                  <p className="font-bold text-primary">{formatRupiah(selectedBooking.claimed_amount)} ({selectedBooking.payment_type.toUpperCase()})</p>
                  <p className="text-xs text-outline">Total Sewa: {formatRupiah(selectedBooking.total_price)}</p>
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="p-3 bg-neutral-50 rounded border border-[#EAEAEA] italic text-on-surface-variant">
                  <strong>Catatan:</strong> "{selectedBooking.notes}"
                </div>
              )}

              {/* Payment Proof View */}
              <div className="space-y-2 border-t border-[#EAEAEA] pt-4">
                <p className="text-label-sm text-on-surface font-semibold uppercase tracking-wider">Bukti Pembayaran</p>
                {detailLoading ? (
                  <div className="aspect-[4/3] w-full flex items-center justify-center bg-neutral-50 border border-dashed border-[#EAEAEA] rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : proofUrl ? (
                  <div className="aspect-[4/3] w-full rounded-lg overflow-hidden border border-[#EAEAEA] bg-neutral-50 shadow-inner relative flex items-center justify-center">
                    {proofUrl.toLowerCase().includes('.pdf') ? (
                      <div className="flex flex-col items-center justify-center text-outline gap-2 p-6">
                        <span className="material-symbols-outlined text-5xl">picture_as_pdf</span>
                        <p className="font-semibold text-xs">Bukti dalam format PDF</p>
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-1.5 bg-primary text-white rounded text-xs font-bold shadow hover:bg-primary-container transition-colors"
                        >
                          Unduh / Buka PDF
                        </a>
                      </div>
                    ) : (
                      <img src={proofUrl} alt="Bukti Transfer" className="w-full h-full object-contain" />
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-outline bg-neutral-50 border border-dashed border-[#EAEAEA] rounded-lg">
                    Belum ada bukti pembayaran diupload oleh pelanggan.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer (Actions) */}
            <div className="p-4 bg-neutral-50 border-t border-[#EAEAEA] flex justify-between items-center rounded-b-xl">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 border border-outline-variant hover:bg-neutral-200 text-on-surface font-bold text-xs rounded transition-colors"
              >
                Tutup
              </button>

              {selectedBooking.status === 'confirmed' && (
                <div className="flex items-center gap-2">
                  {selectedBooking.claimed_amount < selectedBooking.total_price && (
                    <button
                      onClick={() => handleSettleBalance()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">price_check</span>
                      Catat Pelunasan Sisa ({formatRupiah(selectedBooking.total_price - selectedBooking.claimed_amount)})
                    </button>
                  )}
                  <button
                    onClick={() => handleCheckout()}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Selesai Sewa / Check-Out
                  </button>
                </div>
              )}

              {selectedBooking.status === 'pending_verification' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReject}
                    className="px-4 py-2 bg-error hover:bg-red-700 text-white font-bold text-xs rounded transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    Tolak Bukti
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 bg-success-green hover:bg-green-600 text-white font-bold text-xs rounded transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Setujui & Kunci Kamar
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
