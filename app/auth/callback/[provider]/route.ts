import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { configured, fetchProfile, isProvider, openSession } from "@/lib/oauth"

export const maxDuration = 20

const fail = (origin: string, message: string) =>
  NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, origin))

/** Google / Discord send the visitor back here with a one-time code. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const url = new URL(req.url)
  if (!isProvider(provider) || !configured(provider)) return fail(url.origin, "Sign in is not available right now.")

  if (url.searchParams.get("error")) return fail(url.origin, "Sign in was cancelled.")

  const store = await cookies()
  const saved = store.get("oauth_state")?.value ?? ""
  store.delete("oauth_state")
  const [state, next = "/"] = saved.split("|")
  const code = url.searchParams.get("code")
  if (!code || !state || state !== url.searchParams.get("state")) {
    return fail(url.origin, "That sign-in link expired. Please try again.")
  }

  try {
    const profile = await fetchProfile(provider, code, url.origin)
    await openSession(profile, provider, store)
  } catch (e) {
    console.error(`[auth:${provider}]`, e instanceof Error ? e.message : e)
    return fail(url.origin, e instanceof Error && /verified|missing/i.test(e.message) ? e.message : "Sign in failed. Please try again.")
  }
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/"
  return NextResponse.redirect(new URL(target, url.origin))
}
