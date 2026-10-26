"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Spinner } from "@/components/ui/spinner"
import { getSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function Google() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  )
}
function Discord() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="#5865F2" aria-hidden>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18 18 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 0 13.5.3 18a20 20 0 0 0 6 3l1.3-2.1c-.7-.3-1.400-.6-2-1l.5-.4a14.200 14.200 0 0 0 12.200 0l.5.4c-.6.4-1.300.700-2 1l1.300 2.100a20 20 0 0 0 6-3c.4-5.200-.7-9.700-3.800-13.600zM8.300 15.300c-1.200 0-2.100-1.100-2.100-2.400s.9-2.400 2.100-2.400 2.100 1.100 2.100 2.400-.9 2.400-2.100 2.400zm7.400 0c-1.200 0-2.100-1.100-2.100-2.400s.9-2.400 2.100-2.400 2.100 1.100 2.100 2.400-.9 2.400-2.100 2.400z" />
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

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

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

  const input =
    "h-11 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
  const social =
    "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.06] text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60"

  return (
    <div className="relative grid min-h-svh place-items-center bg-[#121113] px-4 py-10 text-[#eeeef0]">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="size-4" /> Back home
        </Link>
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="AniBiar TV" className="mb-5 h-10 w-auto" />
          <div role="tablist" className="mb-5 flex rounded-full border border-white/20 p-0.5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setError(null)
                  setNotice(null)
                }}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors",
                  mode === m ? "bg-white text-black" : "text-white/70 hover:text-white"
                )}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            <button type="button" className={social} disabled={!!busy} onClick={() => oauth("google")}>
              {busy === "google" ? <Spinner className="size-5" /> : <Google />} Continue with Google
            </button>
            <button type="button" className={social} disabled={!!busy} onClick={() => oauth("discord")}>
              {busy === "discord" ? <Spinner className="size-5" /> : <Discord />} Continue with Discord
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-white/40">
            <span className="h-px flex-1 bg-white/15" /> or with email <span className="h-px flex-1 bg-white/15" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(input, "pr-11")}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-white/50 hover:text-white"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-lime-300/15 px-3 py-2 text-xs text-lime-200">{notice}</p>}
            <button
              type="submit"
              disabled={!!busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
            >
              {busy === "email" && <Spinner className="size-4" />}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-white/40">Your Continue Watching and My List are saved to your account.</p>
      </div>
    </div>
  )
}
