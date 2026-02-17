import { createServerClient } from '@supabase/ssr'

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Cookie handling se fait dans le middleware / route handlers (selon ton besoin)
  return createServerClient(url, anon, { cookies: { getAll: () => [], setAll: () => {} } })
}
