// ============================================================
// WhatsApp link generator with templated messages
// ============================================================

import { formatRupiah, formatDateRange } from '@/lib/utils/helpers';

const OWNER_WA = process.env.NEXT_PUBLIC_OWNER_WHATSAPP || '6281234567890';

interface BookingInfo {
  booking_code: string;
  customer_name: string;
  whatsapp_number: string;
  camp_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  total_price: number;
}

/** Generate wa.me link with pre-filled message */
function waLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Booking confirmed — admin sends to customer */
export function waBookingConfirmed(booking: BookingInfo): string {
  const message =
    `✅ *Booking Terkonfirmasi!*\n\n` +
    `Halo ${booking.customer_name},\n` +
    `Booking Anda sudah dikonfirmasi!\n\n` +
    `📋 Kode: *${booking.booking_code}*\n` +
    `🏠 Camp: ${booking.camp_name}\n` +
    `🚪 Kamar: ${booking.room_name}\n` +
    `📅 Periode: ${formatDateRange(booking.check_in, booking.check_out)}\n` +
    `💰 Total: ${formatRupiah(booking.total_price)}\n\n` +
    `Silakan datang sesuai tanggal check-in. Terima kasih! 🙏`;

  return waLink(booking.whatsapp_number, message);
}

/** Booking rejected — admin sends to customer */
export function waBookingRejected(booking: BookingInfo, reason: string): string {
  const message =
    `❌ *Booking Ditolak*\n\n` +
    `Halo ${booking.customer_name},\n` +
    `Maaf, booking Anda tidak dapat dikonfirmasi.\n\n` +
    `📋 Kode: *${booking.booking_code}*\n` +
    `📝 Alasan: ${reason}\n\n` +
    `Silakan hubungi admin untuk informasi lebih lanjut atau lakukan booking ulang.`;

  return waLink(booking.whatsapp_number, message);
}

/** Extension reminder — system/admin sends to current tenant */
export function waExtensionReminder(booking: BookingInfo): string {
  const message =
    `🔔 *Reminder Perpanjangan Sewa*\n\n` +
    `Halo ${booking.customer_name},\n` +
    `Masa sewa Anda akan berakhir pada ${formatDateRange(booking.check_in, booking.check_out)}.\n\n` +
    `🏠 Camp: ${booking.camp_name}\n` +
    `🚪 Kamar: ${booking.room_name}\n\n` +
    `Apakah Anda ingin memperpanjang sewa? ` +
    `Silakan klik "Perpanjang" di halaman Cek Pesanan dengan kode *${booking.booking_code}* sebelum batas waktu berakhir.\n\n` +
    `Jika tidak diperpanjang, kamar akan dibuka untuk calon penghuni baru.`;

  return waLink(booking.whatsapp_number, message);
}

/** Booking cancelled — admin sends to customer */
export function waBookingCancelled(booking: BookingInfo, reason: string): string {
  const message =
    `⚠️ *Booking Dibatalkan*\n\n` +
    `Halo ${booking.customer_name},\n` +
    `Booking Anda telah dibatalkan oleh admin.\n\n` +
    `📋 Kode: *${booking.booking_code}*\n` +
    `📝 Alasan: ${reason}\n\n` +
    `Silakan hubungi admin jika ada pertanyaan.`;

  return waLink(booking.whatsapp_number, message);
}

/** Customer contacts admin — pre-filled template */
export function waContactAdmin(bookingCode: string, customerName: string, adminWhatsapp?: string): string {
  const message =
    `Halo Admin Camp Pejuang,\n\n` +
    `Saya ${customerName} ingin bertanya tentang booking saya.\n` +
    `Kode Booking: *${bookingCode}*\n\n` +
    `(Tuliskan pertanyaan Anda di sini)`;

  return waLink(adminWhatsapp || OWNER_WA, message);
}

/** Admin confirms payment to customer */
export function waConfirmPayment(phone: string, bookingCode: string, customerName: string): string {
  const message =
    `✅ *Pembayaran Sewa Diterima!*\n\n` +
    `Halo ${customerName},\n` +
    `Pembayaran/DP untuk booking Anda telah terverifikasi oleh admin.\n\n` +
    `📋 Kode Booking: *${bookingCode}*\n` +
    `Status sewa Anda sekarang aktif (CONFIRMED).\n\n` +
    `Terima kasih! Sampai jumpa di Camp Pejuang! 🙏`;

  return waLink(phone, message);
}

/** Admin rejects payment to customer */
export function waRejectPayment(phone: string, bookingCode: string, customerName: string, reason: string): string {
  const message =
    `❌ *Bukti Transfer Ditolak*\n\n` +
    `Halo ${customerName},\n` +
    `Maaf, bukti pembayaran yang Anda upload ditolak oleh admin.\n\n` +
    `📋 Kode Booking: *${bookingCode}*\n` +
    `📝 Alasan: ${reason}\n\n` +
    `Silakan upload ulang bukti pembayaran yang valid melalui halaman Cek Pesanan.`;

  return waLink(phone, message);
}

/** Admin completes/checks-out tenant sewa */
export function waBookingCompleted(phone: string, bookingCode: string, customerName: string, notes?: string): string {
  let message =
    `🏠 *Sewa Kamar Selesai (Check-Out)*\n\n` +
    `Halo ${customerName},\n` +
    `Masa sewa Anda untuk booking *${bookingCode}* di Camp Pejuang telah dinyatakan selesai / check-out.\n\n`;

  if (notes) {
    message += `📝 Catatan: ${notes}\n\n`;
  }

  message += `Terima kasih telah mempercayai Camp Pejuang sebagai hunian belajar Anda! Semoga sukses selalu! 🙏✨`;

  return waLink(phone, message);
}

/** Admin records remaining balance settlement */
export function waSettleBalance(phone: string, bookingCode: string, customerName: string, settledAmount: number): string {
  const message =
    `💰 *Pelunasan Pembayaran Sewa Diterima!*\n\n` +
    `Halo ${customerName},\n` +
    `Sisa pelunasan sebesar *${formatRupiah(settledAmount)}* untuk booking *${bookingCode}* di Camp Pejuang telah diterima di lokasi oleh admin.\n\n` +
    `Status pembayaran sewa Anda kini *LUNAS (100%)*! ✨\n\n` +
    `Terima kasih! Selamat menempuh masa sewa di Camp Pejuang! 🙏`;

  return waLink(phone, message);
}
