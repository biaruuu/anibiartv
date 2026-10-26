/**
 * Server only. "Continue with Google / Discord" straight to our own site (redirect_uri on our domain),
 * instead of through the Supabase address. After the provider says who the person is, we open a normal
 * Supabase session for that email, so everything else (RLS, history, My List) works the same.
 */
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config"

export type Provider = "google" | "discord"
export const isProvider = (v: string): v is Provider => v === "google" || v === "discord"

type Cfg = { authorize: string; token: string; scope: string; id?: string; secret?: string; extra?: Record<string, string> }

const cfg: Record<Provider, Cfg> = {
  discord: {
    authorize: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    scope: "identify email",
    id: process.env.DISCORD_CLIENT_ID || "1564150843148599436",
    secret: process.env.DISCORD_CLIENT_SECRET,
  },
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    id: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    extra: { prompt: "select_account" },
  },
}

const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY

/** True when this provider has everything it needs to run directly on our domain. */
export const configured = (p: Provider) => Boolean(cfg[p].id && cfg[p].secret && serviceKey())

export const callbackUrl = (origin: string, p: Provider) => `${origin}/auth/callback/${p}`

export function authorizeUrl(p: Provider, origin: string, state: string) {
  const c = cfg[p]
  const u = new URL(c.authorize)
  u.searchParams.set("client_id", c.id!)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("redirect_uri", callbackUrl(origin, p))
  u.searchParams.set("scope", c.scope)
  u.searchParams.set("state", state)
  for (const [k, v] of Object.entries(c.extra ?? {})) u.searchParams.set(k, v)
  return u.toString()
}

export type Profile = { email: string; name: string | null; avatar: string | null }

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as T | null
  if (!res.ok || !data) throw new Error(`HTTP ${res.status}`)
  return data
}

export async function fetchProfile(p: Provider, code: string, origin: string): Promise<Profile> {
  const c = cfg[p]
  const tokenRes = await fetch(c.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: c.id!,
      client_secret: c.secret!,
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(origin, p),
    }),
    cache: "no-store",
  })
  const { access_token } = await json<{ access_token: string }>(tokenRes)
  const auth = { Authorization: `Bearer ${access_token}` }

  if (p === "discord") {
    const u = await json<{ id: string; username: string; global_name?: string | null; avatar?: string | null; email?: string | null; verified?: boolean }>(
      await fetch("https://discord.com/api/users/@me", { headers: auth, cache: "no-store" })
    )
    if (!u.email || u.verified === false) throw new Error("Your Discord email is missing or not verified.")
    return {
      email: u.email,
      name: u.global_name || u.username,
      avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256` : null,
    }
  }
  const g = await json<{ email?: string; email_verified?: boolean; name?: string; picture?: string }>(
    await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: auth, cache: "no-store" })
  )
  if (!g.email || g.email_verified === false) throw new Error("Your Google email is missing or not verified.")
  return { email: g.email, name: g.name ?? null, avatar: g.picture ?? null }
}

type CookieStore = {
  getAll: () => { name: string; value: string }[]
  set: (name: string, value: string, options?: Record<string, unknown>) => void
}

/** Finds or creates the account for this email and signs the browser in (session cookies). */
export async function openSession(profile: Profile, provider: Provider, store: CookieStore) {
  const admin = createClient(SUPABASE_URL, serviceKey()!, { auth: { persistSession: false, autoRefreshToken: false } })
  const meta = { full_name: profile.name, avatar_url: profile.avatar, provider_used: provider }
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: { data: meta },
  })
  if (error || !data?.properties?.hashed_token) throw new Error(error?.message ?? "Could not create the sign-in.")
  // Keep name / picture fresh for accounts that already existed.
  const existing = data.user
  if (existing) {
    const m = (existing.user_metadata ?? {}) as Record<string, unknown>
    await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...m, full_name: m.full_name ?? profile.name, avatar_url: m.avatar_url ?? profile.avatar },
    })
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options)
      },
    },
  })
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token })
  if (verifyError) throw new Error(verifyError.message)
}
