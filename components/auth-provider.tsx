"use client"

import * as React from "react"
import type { User } from "@supabase/supabase-js"

import { bumpLibrary, fetchBundle } from "@/lib/library"
import { getSupabase } from "@/lib/supabase/client"

export type Profile = { username: string | null; avatar_url: string | null; banner_url: string | null; bio: string | null; handle: string | null; decoration?: string | null }

type AuthState = {
  user: User | null
  /** False until the first answer from Supabase, so the UI doesn't flash "Log in". */
  ready: boolean
  /** The viewer's own choices first (profile page), then what Google / Discord gave. */
  name: string | null
  avatar: string | null
  banner: string | null
  /** The @username (unique); falls back to the start of the email until one is saved. */
  handle: string | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = React.createContext<AuthState>({
  user: null,
  ready: false,
  name: null,
  avatar: null,
  banner: null,
  handle: null,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export const useAuth = () => React.useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    // If a sign-in link ever lands on another page with ?code=..., finish it on the callback route.
    const q = new URLSearchParams(window.location.search)
    const code = q.get("code")
    if (code && !window.location.pathname.startsWith("/auth/callback")) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    const supabase = getSupabase()
    let alive = true
    supabase.auth
      .getUser()
      .then(({ data }) => alive && setUser(data.user ?? null))
      .catch(() => {})
      .finally(() => alive && setReady(true))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setReady(true)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = user?.id ?? null
  const empty: Profile = { username: null, avatar_url: null, banner_url: null, bio: null, handle: null, decoration: null }
  /** The profile comes from Upstash Redis through /api/me/library (fast); Supabase is the fallback. */
  const loadProfile = React.useCallback(async () => {
    if (!userId) return setProfile(null)
    try {
      const bundle = await fetchBundle()
      if (bundle) return setProfile((bundle.profile as Profile | null) ?? empty)
      const { data } = await getSupabase().from("profiles").select("username, avatar_url, banner_url, bio, handle, decoration").eq("id", userId).maybeSingle()
      setProfile((data as Profile | null) ?? empty)
    } catch {
      /* offline: fall back to what the sign-in provider gave */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  /** Called after the profile was saved: refreshes the Redis copy first so every device sees the change. */
  const refreshProfile = React.useCallback(async () => {
    await bumpLibrary()
    await loadProfile()
  }, [loadProfile])

  React.useEffect(() => {
    setProfile(null)
    void loadProfile()
  }, [loadProfile])

  const value = React.useMemo<AuthState>(() => {
    const m = (user?.user_metadata ?? {}) as Record<string, unknown>
    const pick = (...keys: string[]) => keys.map((k) => m[k]).find((v): v is string => typeof v === "string" && !!v) ?? null
    return {
      user,
      ready,
      profile,
      refreshProfile,
      name: profile?.username || pick("full_name", "name", "user_name") || user?.email?.split("@")[0] || null,
      avatar: profile?.avatar_url || pick("avatar_url", "picture"),
      banner: profile?.banner_url ?? null,
      handle: profile?.handle ?? user?.email?.split("@")[0] ?? null,
      signOut: async () => {
        await getSupabase().auth.signOut()
        setUser(null)
        setProfile(null)
      },
    }
  }, [user, ready, profile, refreshProfile])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
