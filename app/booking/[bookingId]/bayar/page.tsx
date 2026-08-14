'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatRupiah, formatTimeRemaining, getStatusLabel, compressImage } from '@/lib/utils/helpers';
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
  hold_expires_at: string;
  room_id: string;
}

interface SystemSettings {
  qris_image_url: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  is_qris_active?: boolean;
  is_bank_active?: boolean;
  admin_whatsapp: string;
}

export default function PaymentInstructionsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params?.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

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
        const b = data.booking as Booking;
        setBooking(b);

        if (b.status !== 'hold' && b.status !== 'pending_verification') {
          router.replace(`/booking/${bookingId}/sukses`);
          return;
        }

        // Fetch system settings
        const { data: sData } = await supabase
          .from('system_settings')
          .select('*')
          .single();

        if (sData) {
          setSettings(sData as unknown as SystemSettings);
        }

      } catch (err) {
        console.error('Error fetching payment data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [bookingId, router]);

  // Live countdown timer
  useEffect(() => {
    if (!booking || booking.status !== 'hold') return;

    const timer = setInterval(() => {
      const remaining = formatTimeRemaining(booking.hold_expires_at);
      if (remaining === 'Kedaluwarsa') {
        clearInterval(timer);
        setTimeLeft('Kedaluwarsa');
        setBooking((prev) => prev ? { ...prev, status: 'expired' } : null);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    // Initial run
    setTimeLeft(formatTimeRemaining(booking.hold_expires_at));

    return () => clearInterval(timer);
  }, [booking]);

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!booking) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'File Terlalu Besar',
        text: 'Ukuran file maksimal adalah 5MB',
        confirmButtonColor: '#b52330',
      });
      return;
    }

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      Swal.fire({
        icon: 'error',
        title: 'Format Tidak Didukung',
        text: 'Format bukti transfer harus JPG, PNG, atau PDF',
        confirmButtonColor: '#b52330',
      });
      return;
    }

    setFile(selectedFile);
    setErrorMsg('');

    // Generate preview URL if it is an image
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreviewUrl(''); // Clear preview for PDF
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Silakan pilih file bukti transfer terlebih dahulu');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const compressedFile = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressedFile);

      const res = await fetch(`/api/bookings/${bookingId}/upload-proof`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.error || 'Gagal mengupload bukti transfer');
        setSubmitting(false);
        return;
      }

      Swal.fire({
        icon: 'success',
        title: 'Bukti Terkirim',
        text: 'Bukti transfer berhasil diupload. Admin akan segera memverifikasi pesanan Anda.',
        confirmButtonColor: '#b52330',
      }).then(() => {
        router.push(`/booking/${bookingId}/sukses`);
      });

    } catch (err) {
      console.error('Upload proof failed:', err);
      setErrorMsg('Gagal terhubung ke server');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-warm selection:bg-primary/10 selection:text-primary">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full bg-surface-cream/80 backdrop-blur-md border-b border-border-subtle shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl font-bold">home</span>
            <span className="text-label-md font-semibold text-on-surface hover:text-primary transition-colors">Beranda</span>
          </Link>
          <span className="font-headline-sm text-sm font-bold text-primary">Instruksi Pembayaran</span>
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Countdown / Expired Warning */}
        {booking.status === 'hold' ? (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-1 shadow-sm">
            <p className="text-label-sm text-amber-800 font-semibold uppercase tracking-wider">Selesaikan Pembayaran Sebelum Hold Kedaluwarsa</p>
            <p className="text-headline-sm font-bold text-amber-900">{timeLeft}</p>
          </div>
        ) : booking.status === 'expired' ? (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center space-y-1 shadow-sm">
            <p className="text-label-sm text-red-800 font-semibold uppercase tracking-wider">Hold Booking Kedaluwarsa</p>
            <p className="text-body-md text-red-900">Kamar Anda telah dilepas kembali ke publik. Silakan lakukan pemesanan ulang.</p>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center space-y-1 shadow-sm">
            <p className="text-label-sm text-blue-800 font-semibold uppercase tracking-wider">Status Pemesanan Anda</p>
            <p className="text-headline-sm font-bold text-blue-900">{getStatusLabel(booking.status)}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Instructions Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
              <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Langkah Pembayaran</h3>

              {booking.payment_channel === 'qris' ? (
                <div className="space-y-6 flex flex-col items-center">
                  <div className="text-center space-y-1">
                    <p className="text-label-md text-on-surface-variant font-semibold">Pindai Kode QRIS di bawah ini</p>
                    <p className="text-label-sm text-outline">Gunakan aplikasi m-banking atau e-wallet (Gopay, OVO, Dana, dll).</p>
                  </div>
                  
                  <div className="w-56 h-72 border border-border-subtle rounded-lg bg-white p-3 flex flex-col items-center justify-between shadow-sm">
                    {settings?.qris_image_url ? (
                      <img src={settings.qris_image_url} alt="QRIS Code" className="w-full h-auto object-contain flex-grow" />
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-outline gap-2 bg-background-warm w-full rounded border border-dashed border-border-subtle">
                        <span className="material-symbols-outlined text-4xl">qr_code_2</span>
                        <span className="text-xs">QRIS Statis Mock</span>
                      </div>
                    )}
                    <p className="text-label-sm font-bold text-primary mt-2">CAMP PEJUANG PARE</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-label-md text-on-surface-variant font-semibold">Transfer Bank Manual ke Rekening:</p>
                    <p className="text-label-sm text-outline">Silakan transfer nominal pas sesuai tagihan di samping.</p>
                  </div>

                  <div className="p-5 bg-background-warm rounded-lg border border-border-subtle space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <span className="text-on-surface-variant font-medium">Bank</span>
                      <span className="col-span-2 font-bold">{settings?.bank_name || 'BCA'}</span>

                      <span className="text-on-surface-variant font-medium">No. Rekening</span>
                      <span className="col-span-2 font-bold text-primary text-base select-all">{settings?.bank_account_number || '123-4567-890'}</span>

                      <span className="text-on-surface-variant font-medium">Atas Nama</span>
                      <span className="col-span-2 font-bold">{settings?.bank_account_holder || 'Camp Pejuang Admin'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* General terms */}
              <div className="text-xs text-outline space-y-1 list-decimal pl-4">
                <li>Pastikan nominal transfer sama persis dengan **Nominal Pembayaran**.</li>
                <li>Simpan struk / bukti transfer asli untuk diupload di formulir samping.</li>
                <li>Proses verifikasi admin memerlukan waktu maksimal **1x24 jam** pada jam kerja.</li>
              </div>
            </div>
          </div>

          {/* Upload Form Column */}
          <div className="lg:col-span-5 bg-surface-cream p-6 rounded-xl border border-border-subtle shadow-sm space-y-6">
            <h3 className="text-headline-sm font-bold border-b border-border-subtle pb-3">Konfirmasi Pembayaran</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-on-surface-variant">Kode Booking</span>
                <span className="font-bold text-on-surface select-all">{booking.booking_code}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-on-surface-variant">Atas Nama</span>
                <span className="font-medium">{booking.customer_name}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-on-surface-variant">Jenis Bayar</span>
                <span className="font-semibold text-primary capitalize">{booking.payment_type === 'dp' ? 'DP (Uang Muka)' : 'Penuh (Lunas)'}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2 text-primary font-bold">
                <span>Nominal Pembayaran</span>
                <span className="text-base">{formatRupiah(booking.claimed_amount)}</span>
              </div>
            </div>

            {booking.status === 'expired' ? (
              <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm font-semibold text-center">
                Waktu Pembayaran Habis
              </div>
            ) : (
              <form onSubmit={handleUpload} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-error/10 text-error rounded-md text-xs font-semibold border border-error/20">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-label-md text-on-surface-variant font-semibold">Upload Bukti Transfer</label>
                  
                  {/* File Selector Box */}
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-lg p-5 bg-background-warm hover:bg-surface-container-low transition-colors cursor-pointer relative group">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                    
                    {file ? (
                      <div className="text-center space-y-2">
                        <span className="material-symbols-outlined text-success-green text-3xl">task</span>
                        <p className="text-sm font-bold text-on-surface truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-outline">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <span className="material-symbols-outlined text-outline text-3xl group-hover:text-primary transition-colors">cloud_upload</span>
                        <p className="text-sm font-bold text-on-surface">Pilih file bukti</p>
                        <p className="text-xs text-outline">Format JPG, PNG, PDF (Maks 5MB)</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Live Image Preview */}
                {previewUrl && (
                  <div className="aspect-[3/4] w-full rounded-lg overflow-hidden border border-border-subtle relative shadow-sm">
                    <img src={previewUrl} alt="Preview Bukti" className="w-full h-full object-cover" />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !file}
                  className="w-full py-3 bg-primary text-white rounded-md text-sm font-bold shadow-md hover:shadow-lg transition-standard disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Mengupload...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">upload_file</span>
                      Kirim Bukti Pembayaran
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-inverse-surface text-inverse-on-surface py-8 border-t border-border-subtle mt-20">
        <div className="max-w-4xl mx-auto px-4 text-center text-label-sm text-inverse-on-surface/50">
          © {new Date().getFullYear()} Camp Pejuang Booking App. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
