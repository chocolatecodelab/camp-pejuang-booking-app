'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { SystemSettings } from '@/lib/supabase/types';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await (supabase as any)
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (fetchErr || !data) {
        console.error('Error fetching system settings:', fetchErr);
        setError('Gagal memuat pengaturan sistem. Pastikan tabel system_settings sudah dimigrasikan.');
        return;
      }

      const settingsData = data as any;
      setSettings(settingsData);
      setWhatsapp(settingsData.admin_whatsapp);
      setQrisUrl(settingsData.qris_image_url);
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanWA = whatsapp.trim().replace(/[^0-9]/g, '');
    if (!cleanWA) {
      setError('Nomor WhatsApp Admin tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      let finalQrisUrl = qrisUrl;

      // 1. Upload QRIS Image if a new file is selected
      if (selectedFile) {
        setUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `qris_config_${Date.now()}.${fileExt}`;
        const filePath = `settings/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadErr) {
          console.error('Error uploading QRIS config:', uploadErr);
          setError('Gagal mengunggah gambar QRIS baru. Pastikan Storage Bucket sudah disiapkan.');
          setUploading(false);
          setSaving(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(filePath);

        finalQrisUrl = publicUrl;
        setQrisUrl(publicUrl);
        setSelectedFile(null);
        setUploading(false);
      }

      // 2. Update DB settings row
      const { error: updateErr } = await (supabase as any)
        .from('system_settings')
        .update({
          admin_whatsapp: cleanWA,
          qris_image_url: finalQrisUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (updateErr) {
        console.error('Error updating system settings:', updateErr);
        setError('Gagal memperbarui pengaturan di database.');
        setSaving(false);
        return;
      }

      setSuccess('Pengaturan sistem berhasil disimpan!');
      fetchSettings();
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan saat menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-semibold text-sm text-slate-500 animate-pulse">Memuat pengaturan sistem...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title section */}
      <div className="border-b border-outline-variant/60 pb-5 select-none">
        <h2 className="font-headline-lg text-2xl font-black text-on-surface">Pengaturan Sistem</h2>
        <p className="font-body-md text-sm text-on-surface-variant/80 mt-1">
          Konfigurasi nomor kontak admin dan gambar kode QRIS pembayaran yang digunakan oleh pengunjung.
        </p>
      </div>

      {error && (
        <div className="max-w-xl text-sm text-[#ff3b30] bg-[#fff5f5] p-4 rounded-xl border border-[#ffcdcd] flex items-center gap-2 select-none">
          <span className="material-symbols-outlined shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="max-w-xl text-sm text-[#00c853] bg-[#f0fff4] p-4 rounded-xl border border-[#ccf2d9] flex items-center gap-2 select-none">
          <span className="material-symbols-outlined shrink-0">check_circle</span>
          <span>{success}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="max-w-xl bg-white border border-outline-variant/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant select-none bg-slate-50">
          <h3 className="font-headline-md text-base font-bold text-on-surface">Konfigurasi Pembayaran &amp; Kontak</h3>
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
          {/* Admin WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-whatsapp" className="text-xs font-bold text-on-surface select-none">
              Nomor WhatsApp Admin Support <span className="text-[#ff3b30]">*</span>
            </label>
            <input
              type="text"
              id="admin-whatsapp"
              placeholder="Contoh: 6281234567890 (Gunakan kode negara tanpa tanda +)"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-white focus:border-[#0052ff] outline-none"
              disabled={saving}
            />
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              Nomor ini digunakan untuk tombol kirim bukti ke WhatsApp pasca booking serta notifikasi tindak lanjut. Gunakan awalan kode negara (mis. 628...).
            </p>
          </div>

          {/* QRIS Image display and upload */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-bold text-on-surface select-none">
              Gambar QRIS Pembayaran
            </label>

            {/* Preview Box */}
            <div className="border border-outline-variant rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50 text-center relative overflow-hidden min-h-48">
              {qrisUrl ? (
                <div className="space-y-2">
                  <a href={qrisUrl} target="_blank" rel="noreferrer" className="block max-w-[200px] border border-outline-variant bg-white p-2 rounded-lg shadow-sm mx-auto hover:scale-105 transition-transform duration-300">
                    <img src={qrisUrl} alt="QRIS Configured" className="w-full h-auto object-contain" />
                  </a>
                  <span className="text-[10px] text-[#0052ff] font-bold block select-none">
                    * Menggunakan QRIS Kustom Admin
                  </span>
                </div>
              ) : (
                <div className="space-y-3 p-4 select-none">
                  <span className="material-symbols-outlined text-4xl text-slate-400">qr_code_2</span>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-700 block">QRIS Belum Diunggah</span>
                    <span className="text-[10px] text-slate-500 block leading-relaxed max-w-xs">
                      Saat ini sistem menggunakan gambar fallback QRIS dummy/mock. Unggah gambar QRIS asli Anda di bawah ini.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* File input */}
            <div className="flex flex-col gap-1.5 mt-2">
              <label htmlFor="qris-upload" className="text-[11px] font-bold text-slate-700 select-none">
                Pilih Gambar QRIS Baru (Format JPG/PNG)
              </label>
              <input
                type="file"
                id="qris-upload"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#f3f2ff] file:text-[#0052ff] hover:file:bg-[#e4e2ff] cursor-pointer border border-outline-variant rounded-lg p-1.5"
                disabled={saving}
              />
              {selectedFile && (
                <span className="text-[11px] text-[#00c853] font-medium flex items-center gap-1">
                  ✓ File terpilih: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#0052ff] hover:bg-[#003ec7] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {uploading ? 'Mengunggah Gambar QRIS...' : 'Menyimpan Pengaturan...'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">save</span>
                Simpan Perubahan
              </>
            )}
          </button>
        </form>
      </div>

    </div>
  );
}
