// ============================================================
// Input validation schemas — Zod
// ============================================================

import { z } from 'zod';

export const holdBookingSchema = z.object({
  room_id: z.string().uuid(),
  pricing_package_id: z.string().uuid(),
  check_in: z.string().date(),
  customer_name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  whatsapp_number: z.string().regex(/^62\d{8,13}$/, 'Format nomor harus 62xxxxxxxxxx'),
  notes: z.string().max(500).optional().nullable(),
  payment_type: z.enum(['dp', 'full']),
  payment_channel: z.enum(['qris', 'transfer_bank']),
  claimed_amount: z.number().positive('Nominal harus lebih dari 0'),
  parent_booking_id: z.string().uuid().optional().nullable(),
});

export const uploadProofSchema = z.object({
  file_size: z.number().max(5 * 1024 * 1024, 'Maksimal 5MB'),
  file_type: z.string().refine(
    (type) => ['image/jpeg', 'image/png', 'application/pdf'].includes(type),
    'Format file harus JPG, PNG, atau PDF'
  ),
});

export const trackBookingSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  code: z.string().regex(/^CP-\d{4}-[A-Z0-9]{4}$/, 'Format kode booking tidak valid'),
});

export const campSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung'),
  type: z.enum(['putra', 'putri', 'campuran']),
  address: z.string().min(5).max(300),
  description: z.string().max(2000).optional().nullable(),
  facilities: z.array(z.string()).optional().nullable(),
  cover_photo_url: z.string().optional().nullable(),
  youtube_video_url: z.string().optional().nullable(),
  gallery_photo_urls: z.array(z.string()).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  extension_window_days: z.number().int().min(1).max(30).default(7),
  extension_response_hours: z.number().int().min(1).max(168).default(72),
  is_active: z.boolean().optional().default(true),
});

export const roomSchema = z.object({
  camp_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  floor_label: z.string().max(50).optional().nullable(),
  room_photo_urls: z.array(z.string()).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const pricingPackageSchema = z.object({
  room_id: z.string().uuid(),
  label: z.string().min(1).max(50),
  duration_days: z.number().int().min(1).max(365),
  price: z.number().positive(),
  min_dp_amount: z.number().positive().optional().nullable(),
  sort_order: z.number().int().default(0),
});

export const approveBookingSchema = z.object({
  admin_email: z.string().optional(),
});

export const rejectBookingSchema = z.object({
  reason: z.string().min(5, 'Alasan minimal 5 karakter').max(500),
  admin_email: z.string().optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(5, 'Alasan minimal 5 karakter').max(500),
  admin_email: z.string().optional(),
});

export const checkoutBookingSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
  admin_email: z.string().optional(),
});

export const settingsSchema = z.object({
  admin_whatsapp: z.string().regex(/^62\d{8,13}$/).optional(),
  qris_image_url: z.string().url().optional().nullable(),
  bank_name: z.string().max(100).optional().nullable(),
  bank_account_number: z.string().max(30).optional().nullable(),
  bank_account_holder: z.string().max(100).optional().nullable(),
  is_qris_active: z.boolean().optional(),
  is_bank_active: z.boolean().optional(),
});

// Type exports for convenience
export type HoldBookingInput = z.infer<typeof holdBookingSchema>;
export type TrackBookingInput = z.infer<typeof trackBookingSchema>;
export type CampInput = z.infer<typeof campSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type PricingPackageInput = z.infer<typeof pricingPackageSchema>;
export type RejectBookingInput = z.infer<typeof rejectBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type CheckoutBookingInput = z.infer<typeof checkoutBookingSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
