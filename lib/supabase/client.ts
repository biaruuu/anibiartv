import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config"

let client: SupabaseClient | null = null

/** One shared browser client; the session lives in cookies so the callback route can set it. */
export function getSupabase() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
  return client
}
