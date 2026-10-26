import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config"

/** Google / Discord / email-confirmation links land here with a one-time code. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/"
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/"

  if (code) {
    const store = await cookies()
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) store.set(name, value, options)
        },
      },
    })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(target, url.origin))
  }
  const reason = url.searchParams.get("error_description") ?? "Sign in failed. Please try again."
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin))
}
