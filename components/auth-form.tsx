"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { SiteHeader } from "@/components/site-header"
import { Spinner } from "@/components/ui/spinner"
import { getSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function Google() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.500-.2-2.200H12v4.200h5.900a5 5 0 0 1-2.200 3.300v2.700h3.500c2.100-1.900 3.300-4.700 3.300-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.500-2.700c-1 .7-2.200 1.100-3.800 1.100-2.900 0-5.400-2-6.300-4.600H2.100v2.800A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.700 13.900a6.600 6.600 0 0 1 0-4.200V6.900H2.100a11 11 0 0 0 0 9.900l3.600-2.900z" />
      <path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.600l3.100-3.100A11 11 0 0 0 2.100 6.900l3.600 2.800C6.600 7.400 9.100 5.400 12 5.400z" />
    </svg>
  )
}
function Discord() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="#5865F2" aria-hidden>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18 18 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.900 1.400C.6 9 0 13.500.3 18a20 20 0 0 0 6 3l1.300-2.100c-.7-.3-1.400-.6-2-1l.5-.4a14.200 14.200 0 0 0 12.200 0l.5.4c-.6.4-1.300.7-2 1l1.300 2.100a20 20 0 0 0 6-3c.4-5.200-.7-9.700-3.800-13.600zM8.300 15.300c-1.200 0-2.100-1.100-2.100-2.400s.9-2.400 2.100-2.400 2.100 1.100 2.100 2.400-.9 2.400-2.100 2.400zm7.400 0c-1.200 0-2.100-1.100-2.100-2.400s.9-2.400 2.100-2.400 2.100 1.100 2.100 2.400-.9 2.400-2.100 2.400z" />
    </svg>
  )
}

export function AuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, ready } = useAuth()
  const next = (() => {
    const n = params.get("next") ?? "/"
    return n.startsWith("/") && !n.startsWith("//") ? n : "/"
  })()

  const [mode, setMode] = React.useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [show, setShow] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(params.get("error"))
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (ready && user) router.replace(next)
  }, [ready, user, next, router])

  const viaSupabase = params.get("via") === "supabase" ? params.get("provider") : null
  const startedRef = React.useRef(false)
  React.useEffect(() => {
    if (startedRef.current || (viaSupabase !== "google" && viaSupabase !== "discord")) return
    startedRef.current = true
    void oauth(viaSupabase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaSupabase])

  // Always send people back to the site they signed in on (not a fixed address).
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

  // Google / Discord go straight from our own site (the server route); if it isn't set up with its own keys
  // it sends us back here with ?via=supabase and we use the Supabase-hosted sign-in instead.
  const direct = (provider: "google" | "discord") => {
    setBusy(provider)
    setError(null)
    window.location.href = `/auth/start/${provider}?next=${encodeURIComponent(next)}`
  }

  const oauth = async (provider: "google" | "discord") => {
    setBusy(provider)
    setError(null)
    const { error } = await getSupabase().auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } })
    if (error) {
      setError(error.message)
      setBusy(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (password.length < 6) return setError("Use a password with at least 6 characters.")
    setBusy("email")
    const supabase = getSupabase()
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.replace(next)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } })
      if (error) setError(error.message)
      else if (data.session) router.replace(next)
      else if (data.user && data.user.identities?.length === 0) setError("That email already has an account. Try logging in.")
      else setNotice("Almost there! We sent a confirmation link to your email. Open it to finish signing up.")
    }
    setBusy(null)
  }

  const switchMode = (m: "login" | "signup") => {
    setMode(m)
    setError(null)
    setNotice(null)
  }

  const field =
    "h-12 w-full rounded-xl border border-white/20 bg-transparent px-4 text-base text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/60 sm:text-sm"
  const social =
    "flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/20 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60"

  return (
    <div className="min-h-svh bg-[#121113] text-[#eeeef0]">
      <SiteHeader />

      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 pt-20 pb-10 sm:pt-24">
        <div className="rounded-2xl border border-white/20 p-5 sm:p-7">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {mode === "login" ? "Log in to continue watching." : "Save your progress and your list on every device."}
          </p>

          <div role="tablist" aria-label="Log in or sign up" className="mt-5 flex rounded-full border border-white/20 p-0.5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors",
                  mode === m ? "bg-white text-black" : "text-white/70 hover:text-white"
                )}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-2.5">
            <button type="button" className={social} disabled={!!busy} onClick={() => direct("google")}>
              {busy === "google" ? <Spinner className="size-5" /> : <Google />} Continue with Google
            </button>
            <button type="button" className={social} disabled={!!busy} onClick={() => direct("discord")}>
              {busy === "discord" ? <Spinner className="size-5" /> : <Discord />} Continue with Discord
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-white/40">
            <span className="h-px flex-1 bg-white/15" /> or <span className="h-px flex-1 bg-white/15" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                aria-label="Password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(field, "pr-12")}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-white/50 hover:text-white"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white/80">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={!!busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
            >
              {busy === "email" && <Spinner className="size-4" />}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/60">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="font-semibold text-white underline-offset-4 hover:underline"
            >
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
        </div>

        <p className="mt-4 px-2 text-center text-xs leading-relaxed text-white/45">
          By continuing you agree to our{" "}
          <Link href="/terms" className="text-white/80 underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-white/80 underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
