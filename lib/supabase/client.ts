import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof window !== 'undefined' && (!url || url.includes('placeholder'))) {
  console.error(
    'CRITICAL ERROR: Supabase URL/Anon Key is not configured for client-side queries! ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your hosting dashboard (e.g., Vercel Environment Variables).'
  );
}

export const supabase = createClient<Database>(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
  {
    realtime: {
      transport: null as any,
    },
  }
);
