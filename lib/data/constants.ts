// ============================================================
// Shared constants — static data that doesn't live in DB
// ============================================================

/** All bookable hour slots (07:00 – 23:00) */
export const HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00',
] as const;

/** Day-name abbreviations */
export const DAYS_NAME = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/** Static sport metadata (icons & labels that don't change) */
export const SPORTS_CONFIG: Record<string, { label: string; icon: string; labelShort: string }> = {
  badminton: { label: 'Badminton', icon: 'sports_tennis', labelShort: 'BAD' },
  futsal: { label: 'Futsal', icon: 'sports_soccer', labelShort: 'FUT' },
  'tenis-meja': { label: 'Tenis Meja', icon: 'table', labelShort: 'TM' },
};

/** Admin sidebar menu items */
export const ADMIN_MENU = [
  { key: 'dashboard',     label: 'Dashboard',       icon: 'dashboard',       href: '/admin/dashboard' },
  { key: 'schedule',      label: 'Jadwal',          icon: 'calendar_month',  href: '/admin/schedule' },
  { key: 'transactions',  label: 'Transaksi',       icon: 'receipt_long',    href: '/admin/transactions' },
  { key: 'pricing',       label: 'Harga',           icon: 'sell',            href: '/admin/pricing' },
  { key: 'venues',        label: 'Lapangan',        icon: 'stadium',         href: '/admin/venues' },
  { key: 'settings',      label: 'Pengaturan',      icon: 'settings',        href: '/admin/settings' },
] as const;

/** Admin WhatsApp Number for customer chat support confirmations */
export const ADMIN_WHATSAPP = '6281234567890'; // Ubah ke nomor WhatsApp Admin Holiday Sport Anda (gunakan kode negara, mis. 628xxx)
