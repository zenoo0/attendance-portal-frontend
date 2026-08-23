import { createClient } from '@supabase/supabase-js';

// Keys ab .env file se aayengi (portal_frontend/.env)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('WARNING: Supabase URL ya Anon Key missing hai. portal_frontend/.env check karein.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
