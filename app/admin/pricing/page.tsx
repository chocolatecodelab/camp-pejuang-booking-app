'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { SportPrice } from '@/lib/supabase/types';
import { HOURS } from '@/lib/data/constants';
import { formatRupiah, sportDisplayName } from '@/lib/utils/helpers';

export default function AdminPricingPage() {
  const [prices, setPrices] = useState<SportPrice[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<SportPrice | null>(null);

  // Form states
  const [formBasePrice, setFormBasePrice] = useState<number>(0);
  const [formPeakExtra, setFormPeakExtra] = useState<number>(0);
  const [formPeakStart, setFormPeakStart] = useState<number>(18);
  const [formErrors, setFormErrors] = useState<{ basePrice?: string; peakExtra?: string }>({});

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sport_prices')
        .select('*')
        .order('sport_type', { ascending: true });
      if (data && !error) {
        setPrices(data);
      }
    } catch (err) {
      console.error('Error fetching prices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const handleOpenEdit = (price: SportPrice) => {
    setSelectedPrice(price);
    setFormBasePrice(price.base_price);
    setFormPeakExtra(price.peak_hour_extra);
    setFormPeakStart(price.peak_hour_start);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: any = {};
    if (formBasePrice < 0) errors.basePrice = 'Tarif dasar tidak boleh negatif';
    if (formPeakExtra < 0) errors.peakExtra = 'Biaya tambahan tidak boleh negatif';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrice) return;
    if (!validateForm()) return;

    try {
      const { error } = await (supabase as any)
        .from('sport_prices')
        .update({
          base_price: formBasePrice,
          peak_hour_extra: formPeakExtra,
          peak_hour_start: formPeakStart,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPrice.id);

      if (error) {
        alert('Gagal memperbarui harga.');
        return;
      }

      setIsModalOpen(false);
      fetchPrices();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-body-md text-on-surface-variant animate-pulse">Memuat Pengaturan Harga...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="font-headline-lg text-xl text-on-surface font-bold">Pengaturan Harga Lapangan</h1>
        <p className="font-body-sm text-xs text-on-surface-variant">Atur tarif dasar sewa per jam dan aturan dinamis biaya tambahan jam sibuk (peak hours).</p>
      </div>

      {/* PRICING CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {prices.map((price) => {
          const sportKey = price.sport_type;
          const displayTitle = sportDisplayName(sportKey);
          
          return (
            <div 
              key={price.id}
              className="bg-white border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="bg-[#fbf8ff] border-b border-outline-variant/30 px-6 py-4 flex justify-between items-center select-none">
                <span className="font-headline-md text-base font-bold text-on-surface capitalize">{displayTitle}</span>
                <span className="text-[10px] font-black bg-[#dde1ff] text-[#003ec7] px-2 py-0.5 rounded tracking-wide font-label-caps">
                  {sportKey === 'tenis-meja' ? 'TABLE TENNIS' : sportKey.toUpperCase()}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4 flex-grow text-sm select-none">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Tarif Dasar</span>
                  <span className="font-bold text-on-surface text-base">{formatRupiah(price.base_price)}<span className="text-xs font-normal text-on-surface-variant/80">/jam</span></span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Peak Hour Extra</span>
                  <span className="font-bold text-[#ba1a1a] text-base">+{formatRupiah(price.peak_hour_extra)}<span className="text-xs font-normal text-on-surface-variant/80">/jam</span></span>
                </div>

                <div className="flex justify-between items-center border-t border-dashed border-outline-variant/50 pt-3">
                  <span className="text-on-surface-variant">Jam Sibuk Dimulai</span>
                  <span className="font-semibold text-on-surface font-label-caps">{price.peak_hour_start.toString().padStart(2, '0')}:00</span>
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="px-6 py-4 bg-slate-50/70 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(price)}
                  className="w-full py-2 bg-white hover:bg-[#f3f2ff] border border-[#0052ff]/30 text-[#0052ff] hover:border-[#0052ff] font-semibold text-xs rounded-lg transition-standard cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">sell</span>
                  Ubah Harga &amp; Simulasi
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT & SIMULATION MODAL */}
      {isModalOpen && selectedPrice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-outline-variant px-6 py-4 flex justify-between items-center shrink-0 select-none">
              <h3 className="font-headline-md text-base font-bold text-on-surface">
                Ubah Harga: {sportDisplayName(selectedPrice.sport_type)}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-on-surface-variant"
                title="Tutup"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Form Inputs (Left) */}
              <form onSubmit={handleSavePrice} className="md:col-span-5 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-headline-md font-bold text-on-surface select-none">Tarif Dasar per Jam</label>
                  <input
                    type="number"
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                  />
                  {formErrors.basePrice && <span className="text-xs text-[#ff3b30]">{formErrors.basePrice}</span>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-headline-md font-bold text-on-surface select-none">Biaya Jam Sibuk (Peak Hour Extra)</label>
                  <input
                    type="number"
                    value={formPeakExtra}
                    onChange={(e) => setFormPeakExtra(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                  />
                  {formErrors.peakExtra && <span className="text-xs text-[#ff3b30]">{formErrors.peakExtra}</span>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-headline-md font-bold text-on-surface select-none">Jam Mulai Sibuk (Peak Time)</label>
                  <select
                    value={formPeakStart}
                    onChange={(e) => setFormPeakStart(parseInt(e.target.value) || 18)}
                    className="w-full px-4 py-2 border border-outline-variant rounded-lg text-sm bg-white cursor-pointer font-semibold"
                  >
                    {HOURS.map(hour => {
                      const val = parseInt(hour.split(':')[0]);
                      return (
                        <option key={hour} value={val}>Mulai Pukul {hour}</option>
                      );
                    })}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#0052ff] hover:bg-[#003ec7] text-white font-headline-md text-xs font-bold uppercase rounded-lg transition-standard cursor-pointer shadow-sm"
                  >
                    Simpan &amp; Terapkan
                  </button>
                </div>
              </form>

              {/* Vertical Divider */}
              <div className="hidden md:block w-px bg-slate-200 h-full self-stretch justify-self-center"></div>

              {/* Hourly simulation preview list (Right) */}
              <div className="md:col-span-6 flex flex-col h-full overflow-hidden">
                <span className="text-xs font-headline-md font-bold text-on-surface select-none mb-3 block">Simulasi Tarif per Jam</span>
                <div className="flex-grow border border-outline-variant/60 rounded-xl overflow-hidden bg-slate-50 flex flex-col max-h-[300px]">
                  <div className="overflow-y-auto divide-y divide-slate-200">
                    {HOURS.map(hour => {
                      const hVal = parseInt(hour.split(':')[0]);
                      const isPeak = hVal >= formPeakStart;
                      const computedPrice = formBasePrice + (isPeak ? formPeakExtra : 0);
                      
                      return (
                        <div key={hour} className="flex justify-between items-center py-2.5 px-4 text-xs">
                          <span className="font-label-caps font-semibold text-on-surface-variant flex items-center gap-2">
                            {hour}
                            {isPeak && (
                              <span className="text-[8px] font-extrabold bg-[#ffdad6] text-[#ba1a1a] px-1.5 py-0.5 rounded uppercase tracking-wider scale-95 select-none">
                                PEAK
                              </span>
                            )}
                          </span>
                          <span className="font-bold text-on-surface">{formatRupiah(computedPrice)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
