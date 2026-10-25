export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Online features (accounts, verified runs, leaderboard) only exist when Supabase is configured. */
export function supabaseEnabled(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}
