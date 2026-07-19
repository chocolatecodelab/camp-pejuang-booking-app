// ============================================================
// Shared constants — Camp Pejuang Booking App
// ============================================================

/** Admin sidebar menu items */
export const ADMIN_MENU = [
  { key: 'dashboard',    label: 'Dashboard',       icon: 'dashboard',       href: '/admin/dashboard' },
  { key: 'transaksi',    label: 'Transaksi',       icon: 'receipt_long',    href: '/admin/transactions' },
  { key: 'camp',         label: 'Camp & Kamar',    icon: 'apartment',       href: '/admin/camps' },
  { key: 'settings',     label: 'Pengaturan',      icon: 'settings',        href: '/admin/settings' },
] as const;

/** Hold expiry duration in hours */
export const HOLD_EXPIRY_HOURS = 24;

/** Default extension window days before checkout */
export const DEFAULT_EXTENSION_WINDOW_DAYS = 7;

/** Default extension response hours */
export const DEFAULT_EXTENSION_RESPONSE_HOURS = 72;

/** Facility icon mapping */
export const FACILITY_ICONS: Record<string, string> = {
  'Wi-Fi Cepat': 'wifi',
  'Dapur Umum': 'cooking',
  'Air Minum Gratis': 'water_drop',
  'Laundry': 'local_laundry_service',
  'Parkir Motor': 'two_wheeler',
  'Kamar Mandi Dalam': 'bathroom',
  'Keamanan 24 Jam': 'security',
  'Taman': 'park',
  'AC': 'ac_unit',
  'Lemari': 'dresser',
  'Kasur': 'bed',
  'Meja Belajar': 'desk',
};

/** Payment type labels */
export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  dp: 'DP (Uang Muka)',
  full: 'Bayar Penuh',
};

/** Payment channel labels */
export const PAYMENT_CHANNEL_LABELS: Record<string, string> = {
  qris: 'QRIS',
  transfer_bank: 'Transfer Bank',
};
