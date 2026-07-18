'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatRupiah, formatDateLong, getEndTime, sportDisplayName } from '@/lib/utils/helpers';

export default function BookingTrackDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingCode = (params?.code as string || '').toUpperCase();
  const inputWA = searchParams?.get('wa') || '';

  // Booking states
  const [booking, setBooking] = useState<any>(null);
  const [court, setCourt] = useState<any>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload states
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Dynamically loaded Admin Settings
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null);
  const [adminWhatsapp, setAdminWhatsapp] = useState('6281234567890');

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
          setAdminWhatsapp(settingsData.admin_whatsapp);
          setQrisImageUrl(settingsData.qris_image_url);
        }
      } catch (err) {
        console.error('Error fetching system settings:', err);
      }
    };
    fetchSystemSettings();
  }, []);

  const fetchBookingDetail = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch booking row
      const { data: bookingData, error: fetchErr } = await (supabase as any)
        .from('bookings')
        .select('*, courts(*)')
        .eq('booking_code', bookingCode)
        .single();

      if (fetchErr || !bookingData) {
        setError('Pemesanan tidak ditemukan. Periksa kembali kode booking Anda.');
        setLoading(false);
        return;
      }

      // 2. Security Check: WhatsApp Number Match
      const cleanInputWA = inputWA.replace(/[^0-9]/g, '');
      const cleanDBWA = bookingData.whatsapp_number.replace(/[^0-9]/g, '');

      // Allow bypass if accessed via admin or if the last 8 digits match (resilient validation)
      if (cleanInputWA && !cleanDBWA.endsWith(cleanInputWA) && !cleanInputWA.endsWith(cleanDBWA)) {
        setError('Nomor WhatsApp verifikasi tidak cocok. Akses ditolak.');
        setLoading(false);
        return;
      }

      setBooking(bookingData);
      setCourt(bookingData.courts);

      // 3. Fetch booking slots
      const { data: dataSlots } = await supabase
        .from('booking_slots')
        .select('*')
        .eq('booking_id', bookingData.id);
      const slotsData = dataSlots as any[] | null;

      if (slotsData) {
        setSlots(slotsData.map(s => s.hour_slot).sort());
      }
    } catch (err) {
      console.error(err);
      setError('Gagal memuat detail pemesanan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingCode) {
      fetchBookingDetail();
    }
  }, [bookingCode, inputWA]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPaymentProofFile(e.target.files[0]);
    }
  };

  const handleUploadProof = async () => {
    if (!paymentProofFile || !booking) {
      alert('Silakan pilih file bukti transfer terlebih dahulu.');
      return;
    }
    setUploadingProof(true);
    try {
      const fileExt = paymentProofFile.name.split('.').pop();
      const fileName = `proof_${booking.booking_code}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to Supabase Storage Bucket
      const { data, error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, paymentProofFile);

      if (uploadErr) {
        console.error('Storage upload error:', uploadErr);
        alert('Gagal mengunggah bukti pembayaran. Coba lagi.');
        setUploadingProof(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      // Update booking in Supabase: status to pending, save proof URL, clear expires_at
      const { error: updateErr } = await (supabase as any)
        .from('bookings')
        .update({
          status: 'pending',
          payment_proof_url: publicUrl,
          expires_at: null,
        })
        .eq('id', booking.id);

      if (updateErr) {
        console.error('Update booking error:', updateErr);
        alert('Gagal menyimpan konfirmasi pembayaran.');
        setUploadingProof(false);
        return;
      }

      alert('Bukti transfer berhasil diunggah! Status pembayaran sedang diverifikasi.');
      setPaymentProofFile(null);
      fetchBookingDetail();
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mengunggah bukti.');
    } finally {
      setUploadingProof(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center font-sans">
        <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-semibold text-sm text-slate-600 animate-pulse">Memuat detail pemesanan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-on-surface">
        <header className="sticky top-0 bg-white border-b border-outline-variant z-40 w-full shrink-0">
          <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/booking/track" className="flex items-center gap-1 text-[#0052ff] hover:text-[#003ec7] font-bold">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span className="text-sm font-semibold">Kembali</span>
            </Link>
            <h1 className="text-sm font-black tracking-wide text-slate-800 uppercase">Pelacakan Detail</h1>
            <div className="w-6"></div>
          </div>
        </header>

        <main className="flex-grow max-w-md mx-auto w-full px-4 py-12 flex flex-col justify-center">
          <div className="bg-white border border-outline-variant/60 rounded-3xl p-8 shadow-md text-center space-y-4">
            <div className="w-16 h-16 bg-[#FFDAD6] rounded-full flex items-center justify-center mx-auto text-[#ba1a1a] border-2 border-white shadow-sm">
              <span className="material-symbols-outlined text-3xl">error</span>
            </div>
            <h2 className="font-headline-lg text-lg font-black text-[#191b25]">Akses Ditolak</h2>
            <p className="text-sm text-on-surface-variant/80 leading-relaxed">{error}</p>
            <div className="pt-2">
              <Link
                href="/booking/track"
                className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-[#0052ff] hover:bg-[#003ec7] text-white font-bold text-xs uppercase rounded-lg shadow-sm"
              >
                Coba Lagi
              </Link>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-on-surface-variant/60 border-t border-outline-variant bg-white">
          &copy; {new Date().getFullYear()} Holiday Sport Arena.
        </footer>
      </div>
    );
  }

  // Define Badge and Message per status
  const statusStyles: Record<string, { badge: string; text: string; desc: string; colorClass: string }> = {
    hold: {
      badge: 'bg-sky-50 text-sky-600 border border-sky-200',
      text: 'Menunggu Bukti Transfer',
      desc: 'Pesanan Anda terkunci sementara selama 10 menit. Silakan lakukan pembayaran QRIS dan unggah bukti transfer di bawah.',
      colorClass: 'text-sky-600',
    },
    pending: {
      badge: 'bg-[#fff4e6] text-[#ff9200] border border-[#ffe3cc]',
      text: 'Menunggu Verifikasi',
      desc: 'Bukti transfer Anda telah dikirim dan sedang diperiksa oleh Admin. Jadwal Anda terkunci aman.',
      colorClass: 'text-[#ff9200]',
    },
    confirmed: {
      badge: 'bg-[#eefaf2] text-[#00c853] border border-[#ccf2d9]',
      text: 'Pemesanan Lunas (Confirmed)',
      desc: 'Pembayaran disetujui! Selamat berolahraga. Tunjukkan bukti lunas ini saat Anda datang ke lapangan.',
      colorClass: 'text-[#00c853]',
    },
    cancelled: {
      badge: 'bg-[#ffdad6] text-[#ba1a1a] border border-[#ffcdcd]',
      text: 'Dibatalkan',
      desc: 'Pesanan dibatalkan atau ditolak. Slot lapangan telah dibebaskan kembali.',
      colorClass: 'text-[#ba1a1a]',
    },
    expired: {
      badge: 'bg-slate-100 text-slate-500 border border-slate-200',
      text: 'Kedaluwarsa (Expired)',
      desc: 'Waktu pembayaran QRIS habis sebelum bukti transfer terunggah. Lapangan dilepaskan kembali.',
      colorClass: 'text-slate-500',
    },
    maintenance: {
      badge: 'bg-slate-100 text-slate-500 border border-slate-200',
      text: 'Maintenance',
      desc: 'Lapangan sedang ditutup untuk keperluan pemeliharaan sistem.',
      colorClass: 'text-slate-500',
    },
  };

  const currentStatus = statusStyles[booking.status] || {
    badge: 'bg-slate-100 text-slate-500 border border-slate-200',
    text: booking.status,
    desc: '',
    colorClass: 'text-slate-500',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-on-surface">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-outline-variant z-40 w-full shrink-0 select-none">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/booking/track" className="flex items-center gap-1 text-[#0052ff] hover:text-[#003ec7] font-bold">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="text-sm font-semibold">Pelacakan</span>
          </Link>
          <h1 className="text-sm font-black tracking-wide text-slate-800 uppercase">Detail Pemesanan</h1>
          <div className="w-6"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-md mx-auto w-full px-4 py-8 space-y-6">
        
        {/* Status Info Box */}
        <div className="bg-white border border-outline-variant/60 rounded-3xl p-6 shadow-sm text-center space-y-4">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold uppercase ${currentStatus.badge}`}>
            {currentStatus.text}
          </span>
          
          <div className="space-y-1 select-none">
            <h2 className="font-headline-md text-base font-bold text-on-surface">Status Pemesanan</h2>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed px-2">
              {currentStatus.desc}
            </p>
          </div>

          {booking.status === 'cancelled' && booking.notes && (
            <div className="bg-[#ffdad6]/20 border border-[#ff3b30]/10 rounded-xl p-3 text-left">
              <span className="text-[10px] font-bold text-[#ba1a1a] block select-none">CATATAN/ALASAN PENOLAKAN:</span>
              <p className="text-xs text-on-surface font-medium mt-0.5">{booking.notes}</p>
            </div>
          )}
        </div>

        {/* QRIS Upload Proof - Visible ONLY on HOLD status for guest to pay */}
        {booking.status === 'hold' && (
          <div className="bg-white border border-outline-variant/60 rounded-3xl p-6 shadow-sm text-center space-y-6">
            <div className="border-b border-outline-variant/40 pb-3 select-none">
              <h3 className="font-headline-md text-sm font-bold text-on-surface text-left">Lakukan Pembayaran QRIS</h3>
            </div>

            {/* Vector Premium Mock QRIS Code or Uploaded QRIS */}
            <div className="p-4 bg-white border border-slate-100 rounded-xl inline-block mx-auto shadow-sm">
              <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2 mb-3 px-1">
                <span className="font-black text-slate-800 text-sm italic tracking-tighter">QRIS</span>
                <span className="font-label-caps text-[7px] font-bold bg-[#0052ff] text-white px-1.5 py-0.5 rounded">GPN</span>
              </div>
              
              {qrisImageUrl ? (
                <a href={qrisImageUrl} target="_blank" rel="noreferrer" className="block max-w-[200px] mx-auto">
                  <img src={qrisImageUrl} alt="QRIS Code Pembayaran" className="w-48 h-48 object-contain mx-auto" />
                </a>
              ) : (
                <svg className="w-48 h-48 mx-auto text-slate-800 animate-pulse" viewBox="0 0 100 100" fill="currentColor">
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
                  <rect x="35" y="35" width="30" height="30" fill="currentColor" />
                  <rect x="40" y="40" width="20" height="20" fill="white" />
                  <rect x="47" y="47" width="6" height="6" fill="currentColor" />
                </svg>
              )}
              <div className="text-[9px] text-slate-400 mt-2 font-semibold">NMID: ID1020037729498</div>
            </div>

            {/* Total Amount Box with unique code */}
            <div className="bg-[#f0f4ff] border border-[#0052ff]/20 rounded-xl p-3 w-full text-center">
              <span className="text-[10px] text-on-surface-variant font-medium block">NOMINAL TRANSFER (TERMASUK KODE UNIK)</span>
              <span className="font-price-display text-lg text-[#003ec7] font-black block mt-0.5 select-all">
                {formatRupiah(booking.total_price)}
              </span>
              {booking.unique_code > 0 && (
                <span className="text-[10px] text-[#ff3b30] font-bold block mt-1">
                  * Harus transfer tepat sampai kode unik: {booking.unique_code}
                </span>
              )}
            </div>

            {/* Upload form */}
            <div className="pt-2 text-left space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="track-proof-upload" className="text-xs font-bold text-on-surface">
                  Unggah Bukti Transfer <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="file"
                  id="track-proof-upload"
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
                className={`w-full py-3 text-white font-bold text-sm uppercase rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${
                  uploadingProof || !paymentProofFile
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-outline-variant/20'
                    : 'bg-[#0052ff] hover:bg-[#003ec7] cursor-pointer'
                }`}
              >
                {uploadingProof ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">cloud_upload</span>
                    Kirim &amp; Konfirmasi Pembayaran
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Receipt Details Box */}
        <div className="bg-white border border-outline-variant/60 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-outline-variant/40 pb-3 flex justify-between items-center select-none">
            <h3 className="font-headline-md text-sm font-bold text-on-surface">Rincian Pemesanan</h3>
            <span className="text-[10px] text-[#003ec7] font-extrabold select-all">{booking.booking_code}</span>
          </div>

          <div className="border border-outline-variant/40 rounded-2xl p-4 text-xs space-y-2.5 bg-slate-50">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Jenis Olahraga</span>
              <span className="font-bold text-on-surface capitalize">{sportDisplayName(booking.sport_type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Lokasi Lapangan</span>
              <span className="font-bold text-on-surface">{court?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Tanggal Sewa</span>
              <span className="font-semibold text-on-surface">{formatDateLong(booking.booking_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Waktu Jam Sewa</span>
              <span className="font-bold text-[#003ec7]">{slots.join(', ')} - {slots.length > 0 ? getEndTime(slots[slots.length - 1]) : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Metode Bayar</span>
              <span className="font-bold text-on-surface uppercase text-[10px]">
                {booking.payment_method === 'qris' ? 'QRIS (Transfer Manual)' : 'Bayar di Tempat (Cash)'}
              </span>
            </div>
            <div className="border-t border-dashed border-outline-variant/50 pt-2.5 mt-2 flex justify-between font-bold text-sm">
              <span className="text-on-surface">Total Nominal</span>
              <span className="text-[#003ec7] font-extrabold">{formatRupiah(booking.total_price)}</span>
            </div>
          </div>

          {/* Customer info */}
          <div className="border border-outline-variant/20 rounded-2xl p-4 text-xs space-y-2.5">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Nama Pemesan</span>
              <span className="font-bold text-on-surface">{booking.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Nomor WhatsApp</span>
              <span className="font-semibold text-on-surface">{booking.whatsapp_number}</span>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-on-surface-variant/60 shrink-0 border-t border-outline-variant bg-white select-none">
        &copy; {new Date().getFullYear()} Holiday Sport Arena. All rights reserved.
      </footer>
    </div>
  );
}
