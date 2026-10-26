"use client"

import * as React from "react"
import type { User } from "@supabase/supabase-js"

import { getSupabase } from "@/lib/supabase/client"

type AuthState = {
  user: User | null
  /** False until the first answer from Supabase, so the UI doesn't flash "Log in". */
  ready: boolean
  name: string | null
  avatar: string | null
  signOut: () => Promise<void>
}

const Ctx = React.createContext<AuthState>({ user: null, ready: false, name: null, avatar: null, signOut: async () => {} })

export const useAuth = () => React.useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
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

  const value = React.useMemo<AuthState>(() => {
    const m = (user?.user_metadata ?? {}) as Record<string, unknown>
    const pick = (...keys: string[]) => keys.map((k) => m[k]).find((v): v is string => typeof v === "string" && !!v) ?? null
    return {
      user,
      ready,
      name: pick("full_name", "name", "user_name") ?? user?.email?.split("@")[0] ?? null,
      avatar: pick("avatar_url", "picture"),
      signOut: async () => {
        await getSupabase().auth.signOut()
        setUser(null)
      },
    }
  }, [user, ready])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
