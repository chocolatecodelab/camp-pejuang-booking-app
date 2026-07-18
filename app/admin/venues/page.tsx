'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Court, Venue } from '@/lib/supabase/types';
import { sportDisplayName } from '@/lib/utils/helpers';

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);

  // Form states (Create / Edit)
  const [formVenueId, setFormVenueId] = useState('');
  const [formName, setFormName] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<any>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: venuesData } = await supabase.from('venues').select('*');
      if (venuesData) setVenues(venuesData);

      const { data: courtsData } = await supabase
        .from('courts')
        .select('*')
        .order('sort_order', { ascending: true });
      if (courtsData) setCourts(courtsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setSelectedCourt(null);
    setFormVenueId(venues[0]?.id || '');
    setFormName('');
    setFormBadge('');
    setFormDescription('');
    setFormImageUrl('');
    setFormIsActive(true);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (court: Court) => {
    setSelectedCourt(court);
    setFormVenueId(court.venue_id);
    setFormName(court.name);
    setFormBadge(court.badge || '');
    setFormDescription(court.description || '');
    setFormImageUrl(court.image_url || '');
    setFormIsActive(court.is_active);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Switch toggle active state directly from card
  const handleToggleActive = async (court: Court) => {
    try {
      const { error } = await (supabase as any)
        .from('courts')
        .update({ is_active: !court.is_active })
        .eq('id', court.id);

      if (error) {
        alert('Gagal mengubah status lapangan.');
        return;
      }
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const validateForm = (): boolean => {
    const errors: any = {};
    if (!formVenueId) errors.venueId = 'Pilih cabang olahraga';
    if (!formName.trim()) errors.name = 'Nama lapangan wajib diisi';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (selectedCourt) {
        // Edit Operation
        const { error } = await (supabase as any)
          .from('courts')
          .update({
            venue_id: formVenueId,
            name: formName,
            badge: formBadge || null,
            description: formDescription || null,
            image_url: formImageUrl || null,
            is_active: formIsActive,
          })
          .eq('id', selectedCourt.id);

        if (error) {
          alert('Gagal memperbarui lapangan.');
          return;
        }
      } else {
        // Create Operation
        const { error } = await (supabase as any)
          .from('courts')
          .insert({
            venue_id: formVenueId,
            name: formName,
            badge: formBadge || null,
            description: formDescription || null,
            image_url: formImageUrl || null,
            is_active: formIsActive,
            sort_order: courts.length + 1,
          });

        if (error) {
          alert('Gagal menambahkan lapangan.');
          return;
        }
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCourt = async () => {
    if (!selectedCourt) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus "${selectedCourt.name}"?`)) return;

    try {
      // Safeguard: Check if this court has active bookings in Supabase
      const { data: dataBookings, error: checkErr } = await (supabase as any)
        .from('bookings')
        .select('*')
        .eq('court_id', selectedCourt.id)
        .not('status', 'in', '("cancelled","expired")');
      const activeBookings = dataBookings as any[] | null;

      if (checkErr) {
        alert('Gagal memeriksa relasi booking lapangan.');
        return;
      }

      if (activeBookings && activeBookings.length > 0) {
        alert('❌ Lapangan tidak dapat dihapus karena memiliki jadwal booking aktif. Harap batalkan atau selesaikan booking terlebih dahulu.');
        return;
      }

      // Execute delete
      const { error: deleteErr } = await (supabase as any)
        .from('courts')
        .delete()
        .eq('id', selectedCourt.id);

      if (deleteErr) {
        alert('Gagal menghapus lapangan.');
        return;
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-body-md text-on-surface-variant animate-pulse">Memuat Pengaturan Lapangan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline-lg text-xl text-on-surface font-bold">Pengaturan Lapangan</h1>
          <p className="font-body-sm text-xs text-on-surface-variant">Manajemen lapangan fisik (court) per jenis olahraga, status operasional, dan spesifikasi.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-5 py-2.5 bg-[#0052ff] hover:bg-[#003ec7] text-white font-semibold text-sm rounded-lg transition-standard flex items-center gap-2 select-none shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Tambah Lapangan
        </button>
      </div>

      {/* SPORTS SECTION GROUPS */}
      {venues.map((venue) => {
        const venueCourts = courts.filter(c => c.venue_id === venue.id);
        const displayTitle = sportDisplayName(venue.sport_type);
        
        return (
          <div key={venue.id} className="space-y-4">
            <h2 className="border-l-4 border-[#0052ff] pl-3 font-headline-md text-base font-bold text-on-surface select-none">
              Kategori: {displayTitle} ({venueCourts.length} Lapangan)
            </h2>
            
            {venueCourts.length === 0 ? (
              <div className="bg-white border border-outline-variant/60 rounded-xl p-8 text-center text-xs text-on-surface-variant select-none">
                Belum ada lapangan yang didaftarkan di kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {venueCourts.map((court) => (
                  <div 
                    key={court.id} 
                    className="bg-white border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    {/* Header Image */}
                    <div className="relative h-40 overflow-hidden select-none">
                      <img
                        src={court.image_url || 'https://images.unsplash.com/photo-1545809074-59472b3f5ecc?w=500'}
                        alt={court.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                      
                      <span className="absolute top-3 right-3 bg-[#c1f100] text-[#191b25] font-label-caps text-[9px] px-2 py-0.5 rounded font-extrabold tracking-wider">
                        {court.badge || 'PRO SPEC'}
                      </span>

                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <h4 className="font-headline-md text-sm font-bold truncate">{court.name}</h4>
                      </div>
                    </div>

                    {/* Specifications */}
                    <div className="p-5 space-y-4 flex-grow">
                      <p className="text-xs text-on-surface-variant leading-relaxed select-none min-h-[40px]">
                        {court.description || 'Fasilitas premium dengan standar nasional.'}
                      </p>

                      <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-xs select-none">
                        <span className="font-semibold text-on-surface-variant">Status Lapangan</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold ${court.is_active ? 'text-[#00c853]' : 'text-slate-400'}`}>
                            {court.is_active ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                          
                          {/* Toggle switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(court)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                              court.is_active ? 'bg-[#00c853]' : 'bg-slate-300'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${
                              court.is_active ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer edit button */}
                    <div className="px-5 py-3.5 bg-slate-50 border-t border-outline-variant/30">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(court)}
                        className="w-full py-1.5 bg-white hover:bg-slate-100 border border-outline-variant text-on-surface-variant font-semibold text-xs rounded-lg transition-standard flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                        Edit Spesifikasi
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* CREATE & EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-scale-up">
            
            <div className="bg-slate-50 border-b border-outline-variant px-6 py-4 flex justify-between items-center select-none">
              <h3 className="font-headline-md text-base font-bold text-on-surface">
                {selectedCourt ? 'Edit Lapangan' : 'Tambah Lapangan Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-200 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveCourt} className="p-6 space-y-4">
              
              {/* Select Sport Venue */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Cabang Olahraga</label>
                <select
                  value={formVenueId}
                  onChange={(e) => setFormVenueId(e.target.value)}
                  disabled={!!selectedCourt}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white cursor-pointer"
                >
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{sportDisplayName(v.sport_type)}</option>
                  ))}
                </select>
                {formErrors.venueId && <span className="text-xs text-[#ff3b30]">{formErrors.venueId}</span>}
              </div>

              {/* Court Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Nama Lapangan / Court</label>
                <input
                  type="text"
                  placeholder="Contoh: Lapangan 4"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                />
                {formErrors.name && <span className="text-xs text-[#ff3b30]">{formErrors.name}</span>}
              </div>

              {/* Badge label */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Badge Kualitas (Badge)</label>
                <input
                  type="text"
                  placeholder="Contoh: EXCELLENT GRIP"
                  value={formBadge}
                  onChange={(e) => setFormBadge(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                />
              </div>

              {/* Image URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">URL Foto Lapangan</label>
                <input
                  type="text"
                  placeholder="Opsional, masukkan URL foto"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline-md font-bold text-on-surface select-none">Deskripsi Spesifikasi</label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan spesifikasi detail lapangan"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white resize-none"
                />
              </div>

              {/* Active Toggle inside Form */}
              <div className="flex items-center justify-between py-2 select-none">
                <span className="text-xs font-headline-md font-bold text-on-surface">Tampilkan &amp; Aktifkan</span>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                    formIsActive ? 'bg-[#00c853]' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${
                    formIsActive ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#0052ff] hover:bg-[#003ec7] text-white font-headline-md text-sm font-bold uppercase rounded-xl transition-standard shadow-sm"
                >
                  Simpan Lapangan
                </button>
                {selectedCourt && (
                  <button
                    type="button"
                    onClick={handleDeleteCourt}
                    className="w-full py-2 bg-[#ffdad6] hover:bg-[#ffcdc9] text-[#ba1a1a] font-semibold text-xs rounded-lg transition-standard"
                  >
                    Hapus Lapangan
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
