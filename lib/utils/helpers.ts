// ============================================================
// Shared utility functions — Camp Pejuang Booking App
// ============================================================

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

/** Format date to short format (e.g. "18 Jul 2026") */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr + 'T00:00:00');
  return dateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format date range (e.g. "1 Agustus – 31 Agustus 2026") */
export function formatDateRange(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return '';
  const inDate = new Date(checkIn + 'T00:00:00');
  const outDate = new Date(checkOut + 'T00:00:00');

  const inMonth = inDate.toLocaleDateString('id-ID', { month: 'long' });
  const outMonth = outDate.toLocaleDateString('id-ID', { month: 'long' });
  const year = outDate.getFullYear();

  if (inMonth === outMonth) {
    return `${inDate.getDate()} – ${outDate.getDate()} ${inMonth} ${year}`;
  }
  return `${inDate.getDate()} ${inMonth} – ${outDate.getDate()} ${outMonth} ${year}`;
}

/** Calculate checkout date from check-in + duration days */
export function calculateCheckoutDate(checkIn: string, durationDays: number): string {
  const date = new Date(checkIn + 'T00:00:00');
  date.setDate(date.getDate() + durationDays);
  return date.toISOString().split('T')[0];
}

/** Generate camp booking code: CP-MMDD-XXXX */
export function generateCampBookingCode(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  // Use alphanumeric chars excluding ambiguous ones (0/O, 1/I, L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CP-${mm}${dd}-${rand}`;
}

/** Format countdown remaining from an ISO timestamp to readable string */
export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date().getTime();
  const expires = new Date(expiresAt).getTime();
  const diff = expires - now;

  if (diff <= 0) return 'Kedaluwarsa';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}

/** Format countdown seconds to HH:MM:SS */
export function formatTimer(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Validate Indonesian WhatsApp number */
export function validateWhatsApp(number: string): boolean {
  const waPattern = /^(\\+62|62|0)8[1-9][0-9]{6,11}$/;
  return waPattern.test(number.replace(/\s+/g, ''));
}

/** Normalize WhatsApp number to 62xxx format */
export function normalizeWhatsApp(number: string): string {
  let cleaned = number.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+62')) cleaned = cleaned.slice(1);
  else if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  return cleaned;
}

/** Get today's date as YYYY-MM-DD */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Get status display label in Indonesian */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    hold: 'Menunggu Pembayaran',
    pending_verification: 'Menunggu Verifikasi',
    confirmed: 'Terkonfirmasi',
    completed: 'Selesai (Check-Out)',
    rejected: 'Ditolak',
    expired: 'Kedaluwarsa',
    cancelled: 'Dibatalkan',
  };
  return labels[status] || status;
}

/** Get status badge color class */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    hold: 'bg-amber-100 text-amber-800',
    pending_verification: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    completed: 'bg-teal-100 text-teal-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-gray-100 text-gray-600',
  };
  return colors[status] || 'bg-gray-100 text-gray-600';
}

/** Camp type display label */
export function getCampTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    putra: 'Putra',
    putri: 'Putri',
    campuran: 'Campuran',
  };
  return labels[type] || type;
}

/** Camp type badge color */
export function getCampTypeColor(type: string): string {
  const colors: Record<string, string> = {
    putra: 'bg-blue-50 text-blue-700',
    putri: 'bg-pink-50 text-pink-700',
    campuran: 'bg-purple-50 text-purple-700',
  };
  return colors[type] || 'bg-gray-100 text-gray-600';
}

/**
 * Extract YouTube Video ID from various YouTube URL formats
 * and return the embed URL (https://www.youtube.com/embed/VIDEO_ID).
 * Supports watch?v=, short links (youtu.be/), embed URLs, shorts, etc.
 */
export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);

  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
}
