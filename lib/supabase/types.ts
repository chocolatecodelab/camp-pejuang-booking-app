// ============================================================
// Database TypeScript types matching Supabase schema
// ============================================================

export type SportType = 'badminton' | 'futsal' | 'tenis-meja';
export type BookingStatus = 'hold' | 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'maintenance';
export type PaymentMethod = 'qris' | 'onsite';

// ---------- Row types (what comes from Supabase) ----------

export interface Venue {
  id: string;
  sport_type: SportType;
  name: string;
  icon: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Court {
  id: string;
  venue_id: string;
  name: string;
  badge: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface SportPrice {
  id: string;
  sport_type: SportType;
  base_price: number;
  peak_hour_extra: number;
  peak_hour_start: number;
  updated_at: string;
}

export interface Booking {
  id: string;
  booking_code: string;
  court_id: string;
  sport_type: SportType;
  booking_date: string;
  customer_name: string;
  whatsapp_number: string;
  notes: string | null;
  payment_method: PaymentMethod;
  status: BookingStatus;
  total_price: number;
  created_at: string;
  expires_at: string | null;
  confirmed_at: string | null;
  unique_code: number;
  payment_proof_url: string | null;
}

export interface SystemSettings {
  id: number;
  admin_whatsapp: string;
  qris_image_url: string | null;
  updated_at: string;
}

export interface BookingSlot {
  id: string;
  booking_id: string;
  court_id: string;
  booking_date: string;
  hour_slot: string;
}

// ---------- Insert types (what we send to Supabase) ----------

export type VenueInsert = Omit<Venue, 'id' | 'created_at'>;
export type CourtInsert = Omit<Court, 'id' | 'created_at'>;
export type SportPriceInsert = Omit<SportPrice, 'id' | 'updated_at'>;
export type BookingInsert = Omit<Booking, 'id' | 'created_at'>;
export type BookingSlotInsert = Omit<BookingSlot, 'id'>;

// ---------- Update types ----------

export type VenueUpdate = Partial<Omit<Venue, 'id' | 'created_at'>>;
export type CourtUpdate = Partial<Omit<Court, 'id' | 'created_at'>>;
export type SportPriceUpdate = Partial<Omit<SportPrice, 'id'>>;
export type BookingUpdate = Partial<Omit<Booking, 'id' | 'created_at'>>;

// ---------- Join types (with relations) ----------

export interface CourtWithVenue extends Court {
  venues?: Venue;
}

export interface BookingWithDetails extends Booking {
  courts?: Court;
  booking_slots?: BookingSlot[];
}

// ---------- Supabase Database type (for typed client) ----------

export interface Database {
  public: {
    Tables: {
      venues: {
        Row: Venue;
        Insert: VenueInsert;
        Update: VenueUpdate;
      };
      courts: {
        Row: Court;
        Insert: CourtInsert;
        Update: CourtUpdate;
      };
      sport_prices: {
        Row: SportPrice;
        Insert: SportPriceInsert;
        Update: SportPriceUpdate;
      };
      bookings: {
        Row: Booking;
        Insert: BookingInsert;
        Update: BookingUpdate;
      };
      booking_slots: {
        Row: BookingSlot;
        Insert: BookingSlotInsert;
        Update: Partial<Omit<BookingSlot, 'id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
