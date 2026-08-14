// ============================================================
// Database TypeScript types matching Supabase schema
// Camp Pejuang Booking App
// ============================================================

// ---------- Enum types ----------

export type CampType = 'putra' | 'putri' | 'campuran';
export type BookingStatus = 'hold' | 'pending_verification' | 'confirmed' | 'completed' | 'rejected' | 'expired' | 'cancelled';
export type PaymentType = 'dp' | 'full';
export type PaymentChannel = 'qris' | 'transfer_bank';

// ---------- Row types (what comes from Supabase) ----------

export type Camp = {
  id: string;
  name: string;
  slug: string;
  type: CampType;
  address: string;
  description: string | null;
  facilities: string[] | null;
  cover_photo_url: string | null;
  youtube_video_url: string | null;
  gallery_photo_urls: string[] | null;
  latitude: number | null;
  longitude: number | null;
  extension_window_days: number;
  extension_response_hours: number;
  is_active: boolean;
  created_at: string;
};

export type Room = {
  id: string;
  camp_id: string;
  name: string;
  floor_label: string | null;
  room_photo_urls: string[] | null;
  is_active: boolean;
  created_at: string;
};

export type PricingPackage = {
  id: string;
  room_id: string;
  label: string;
  duration_days: number;
  price: number;
  min_dp_amount: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Booking = {
  id: string;
  booking_code: string;
  room_id: string;
  pricing_package_id: string | null;
  parent_booking_id: string | null;
  customer_name: string;
  whatsapp_number: string;
  notes: string | null;
  check_in: string;
  check_out: string;
  stay_period: string | null; // daterange, returned as string
  payment_type: PaymentType;
  payment_channel: PaymentChannel;
  claimed_amount: number;
  total_price: number;
  status: BookingStatus;
  hold_expires_at: string | null;
  extension_offer_expires_at: string | null;
  rejected_reason: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingLock = {
  id: string;
  booking_id: string;
  room_id: string;
  stay_period: string; // daterange
};

export type PaymentProof = {
  id: string;
  booking_id: string;
  file_path: string;
  file_type: string;
  uploaded_at: string;
};

export type BookingStatusHistory = {
  id: string;
  booking_id: string;
  old_status: BookingStatus | null;
  new_status: BookingStatus;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
};

export type AdminProfile = {
  id: string;
  full_name: string | null;
  role: string;
};

export type SystemSettings = {
  id: number;
  admin_whatsapp: string;
  qris_image_url: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  is_qris_active: boolean;
  is_bank_active: boolean;
  updated_at: string;
};

// ---------- Insert types ----------

export type CampInsert = Omit<Camp, 'id' | 'created_at' | 'is_active' | 'extension_window_days' | 'extension_response_hours' | 'description' | 'facilities' | 'cover_photo_url' | 'youtube_video_url' | 'gallery_photo_urls' | 'latitude' | 'longitude'> & {
  id?: string;
  is_active?: boolean;
  extension_window_days?: number;
  extension_response_hours?: number;
  description?: string | null;
  facilities?: string[] | null;
  cover_photo_url?: string | null;
  youtube_video_url?: string | null;
  gallery_photo_urls?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
};

export type RoomInsert = Omit<Room, 'id' | 'created_at' | 'is_active' | 'floor_label' | 'room_photo_urls'> & {
  id?: string;
  is_active?: boolean;
  floor_label?: string | null;
  room_photo_urls?: string[] | null;
  created_at?: string;
};

export type PricingPackageInsert = Omit<PricingPackage, 'id' | 'created_at' | 'is_active' | 'sort_order' | 'min_dp_amount'> & {
  id?: string;
  is_active?: boolean;
  sort_order?: number;
  min_dp_amount?: number | null;
  created_at?: string;
};

export type BookingInsert = Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'stay_period' | 'status' | 'hold_expires_at' | 'extension_offer_expires_at' | 'rejected_reason' | 'cancelled_reason' | 'notes' | 'parent_booking_id'> & {
  id?: string;
  status?: BookingStatus;
  notes?: string | null;
  parent_booking_id?: string | null;
  hold_expires_at?: string | null;
  extension_offer_expires_at?: string | null;
  rejected_reason?: string | null;
  cancelled_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BookingLockInsert = Omit<BookingLock, 'id'> & {
  id?: string;
};

export type PaymentProofInsert = Omit<PaymentProof, 'id' | 'uploaded_at'> & {
  id?: string;
  uploaded_at?: string;
};

export type BookingStatusHistoryInsert = Omit<BookingStatusHistory, 'id' | 'changed_at' | 'old_status' | 'changed_by' | 'reason'> & {
  id?: string;
  old_status?: BookingStatus | null;
  changed_by?: string | null;
  reason?: string | null;
  changed_at?: string;
};

export type AdminProfileInsert = Omit<AdminProfile, 'role' | 'full_name'> & {
  full_name?: string | null;
  role?: string;
};

export type SystemSettingsInsert = Omit<SystemSettings, 'updated_at' | 'admin_whatsapp' | 'qris_image_url' | 'bank_name' | 'bank_account_number' | 'bank_account_holder' | 'is_qris_active' | 'is_bank_active'> & {
  admin_whatsapp?: string;
  qris_image_url?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  is_qris_active?: boolean;
  is_bank_active?: boolean;
  updated_at?: string;
};

// ---------- Update types ----------

export type CampUpdate = Partial<CampInsert>;
export type RoomUpdate = Partial<RoomInsert>;
export type PricingPackageUpdate = Partial<PricingPackageInsert>;
export type BookingUpdate = Partial<BookingInsert>;
export type BookingLockUpdate = Partial<BookingLockInsert>;
export type PaymentProofUpdate = Partial<PaymentProofInsert>;
export type BookingStatusHistoryUpdate = Partial<BookingStatusHistoryInsert>;
export type AdminProfileUpdate = Partial<AdminProfileInsert>;
export type SystemSettingsUpdate = Partial<SystemSettingsInsert>;

// ---------- Join types (with relations) ----------

export type RoomWithCamp = Room & {
  camps?: Camp;
};

export type RoomWithPricing = Room & {
  pricing_packages?: PricingPackage[];
};

export type BookingWithDetails = Booking & {
  rooms?: Room & { camps?: Camp };
  pricing_packages?: PricingPackage;
  payment_proofs?: PaymentProof[];
  booking_status_history?: BookingStatusHistory[];
};

// ---------- Supabase Database type (for typed client) ----------

export interface Database {
  public: {
    Tables: {
      camps: {
        Row: Camp;
        Insert: CampInsert;
        Update: CampUpdate;
        Relationships: [];
      };
      rooms: {
        Row: Room;
        Insert: RoomInsert;
        Update: RoomUpdate;
        Relationships: [
          {
            foreignKeyName: "rooms_camp_id_fkey";
            columns: ["camp_id"];
            isOneToOne: false;
            referencedRelation: "camps";
            referencedColumns: ["id"];
          }
        ];
      };
      pricing_packages: {
        Row: PricingPackage;
        Insert: PricingPackageInsert;
        Update: PricingPackageUpdate;
        Relationships: [
          {
            foreignKeyName: "pricing_packages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          }
        ];
      };
      bookings: {
        Row: Booking;
        Insert: BookingInsert;
        Update: BookingUpdate;
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_pricing_package_id_fkey";
            columns: ["pricing_package_id"];
            isOneToOne: false;
            referencedRelation: "pricing_packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey";
            columns: ["parent_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          }
        ];
      };
      booking_locks: {
        Row: BookingLock;
        Insert: BookingLockInsert;
        Update: BookingLockUpdate;
        Relationships: [
          {
            foreignKeyName: "booking_locks_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_locks_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          }
        ];
      };
      payment_proofs: {
        Row: PaymentProof;
        Insert: PaymentProofInsert;
        Update: PaymentProofUpdate;
        Relationships: [
          {
            foreignKeyName: "payment_proofs_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          }
        ];
      };
      booking_status_history: {
        Row: BookingStatusHistory;
        Insert: BookingStatusHistoryInsert;
        Update: BookingStatusHistoryUpdate;
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          }
        ];
      };
      admin_profiles: {
        Row: AdminProfile;
        Insert: AdminProfileInsert;
        Update: AdminProfileUpdate;
        Relationships: [
          {
            foreignKeyName: "admin_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      system_settings: {
        Row: SystemSettings;
        Insert: SystemSettingsInsert;
        Update: SystemSettingsUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_booking_hold: {
        Args: {
          p_room_id: string;
          p_pricing_package_id: string;
          p_check_in: string;
          p_customer_name: string;
          p_whatsapp: string;
          p_notes: string | null;
          p_payment_type: PaymentType;
          p_payment_channel: PaymentChannel;
          p_claimed_amount: number;
          p_parent_booking_id: string | null | undefined;
        };
        Returns: {
          id: string;
          booking_code: string;
          check_in: string;
          check_out: string;
          total_price: number;
          hold_expires_at: string;
          status: BookingStatus;
        };
      };
    };
    Enums: {
      camp_type: CampType;
      booking_status: BookingStatus;
      payment_type: PaymentType;
      payment_channel: PaymentChannel;
    };
  };
}
