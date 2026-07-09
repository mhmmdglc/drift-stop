import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` henüz `.env`'de yoksa (bkz. .env.example),
 * client kurulmaz — bağımlı her şey (senkron, auth) sessizce devre dışı kalır.
 * Free/offline deneyim buna bağımlı değildir.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
