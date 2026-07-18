// ============================================================
// Shared utility functions
// ============================================================

import type { SportPrice } from '@/lib/supabase/types';

/** Format number to Indonesian Rupiah (e.g. Rp 50.000) */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format date string to long Indonesian format (e.g. "Jumat, 18 Juli 2026") */
export function formatDateLong(dateStr: string): string {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr + 'T00:00:00');
  return dateObj.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Format countdown seconds to MM:SS */
export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Given a slot like "19:00", return "20:00" (the end time) */
export function getEndTime(slot: string): string {
  if (!slot) return '';
  const [h, m] = slot.split(':');
  const nextHour = (parseInt(h) + 1).toString().padStart(2, '0');
  return `${nextHour}:${m}`;
}

/** Generate a human-readable booking reference code */
export function generateBookingCode(sportKey: string, dateStr: string): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const sportPrefix = sportKey.substring(0, 3).toUpperCase();
  const dateCompact = dateStr.replace(/-/g, '');
  return `AG-${sportPrefix}-${dateCompact}-${rand}`;
}

/** Calculate total price for selected slots using SportPrice config */
export function calculateTotalPrice(
  slots: string[],
  priceConfig: SportPrice
): number {
  return slots.reduce((total, slot) => {
    const hourNum = parseInt(slot.split(':')[0]);
    const isPeak = hourNum >= priceConfig.peak_hour_start;
    return total + priceConfig.base_price + (isPeak ? priceConfig.peak_hour_extra : 0);
  }, 0);
}

/** Calculate price for a single slot */
export function getSlotPrice(slot: string, priceConfig: SportPrice): number {
  const hourNum = parseInt(slot.split(':')[0]);
  const isPeak = hourNum >= priceConfig.peak_hour_start;
  return priceConfig.base_price + (isPeak ? priceConfig.peak_hour_extra : 0);
}

/** Get today's date as YYYY-MM-DD */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Generate 14 days starting from today */
export function generateDateList(days: number = 14): { dateStr: string; labelDay: string; labelDate: string }[] {
  const daysName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = new Date();
  const list = [];
  
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    list.push({
      dateStr: d.toISOString().split('T')[0],
      labelDay: daysName[d.getDay()],
      labelDate: d.getDate().toString(),
    });
  }
  return list;
}

/** Validate Indonesian WhatsApp number */
export function validateWhatsApp(number: string): boolean {
  const waPattern = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
  return waPattern.test(number.replace(/\s+/g, ''));
}

/** Sport key to display name */
export function sportDisplayName(sport: string): string {
  const names: Record<string, string> = {
    badminton: 'Badminton',
    futsal: 'Futsal',
    'tenis-meja': 'Tenis Meja',
  };
  return names[sport] || sport;
}
