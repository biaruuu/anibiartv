import { randomBytes } from "node:crypto"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { authorizeUrl, configured, isProvider } from "@/lib/oauth"

/** Sends the visitor to Google / Discord with our own address as the return address. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const url = new URL(req.url)
  if (!isProvider(provider)) return NextResponse.redirect(new URL("/login", url.origin))

  const next = url.searchParams.get("next") ?? "/"
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/"

  // Not set up with its own keys yet: fall back to the Supabase-hosted sign-in.
  if (!configured(provider)) {
    return NextResponse.redirect(new URL(`/login?via=supabase&provider=${provider}&next=${encodeURIComponent(safe)}`, url.origin))
  }

  const state = randomBytes(24).toString("base64url")
  const store = await cookies()
  store.set("oauth_state", `${state}|${safe}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 })
  return NextResponse.redirect(authorizeUrl(provider, url.origin, state))
}
