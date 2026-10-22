// Whether Supabase Auth is configured (issue #127). Without these, a fresh
// checkout still runs on mock data, but nothing that needs sign-in can work,
// so pages show a notice instead of crashing in createServerSupabaseClient().
export function isSupabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());
}
