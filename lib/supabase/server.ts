import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    'CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not configured! ' +
    'This key is required for server-side API routes. ' +
    'Set SUPABASE_SERVICE_ROLE_KEY in your .env.local file.'
  );
}

/**
 * Supabase client with service_role key — SERVER ONLY.
 * This client bypasses RLS and should NEVER be imported from client components.
 * Use only in API routes (app/api/*) and server actions.
 */
export const supabaseAdmin = createClient<Database>(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
