import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from './config';

/** Client acting as the signed-in user (reads the session from cookies). */
export async function serverClient(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) store.set(c.name, c.value, c.options);
        } catch {
          /* called from a Server Component: cookies are read-only there */
        }
      },
    },
  });
}

/** Privileged client for writes the user must not be able to forge (verified runs). Server only. */
export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseEnabled() || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
