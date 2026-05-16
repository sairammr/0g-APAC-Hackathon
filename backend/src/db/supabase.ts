import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _client: SupabaseClient<Database> | null = null;
export function supabase(): SupabaseClient<Database> {
  if (!_client) {
    if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
    _client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _client;
}
