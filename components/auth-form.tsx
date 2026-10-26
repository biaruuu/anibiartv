"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Bookmark, Eye, EyeOff, History, Lock, Mail, MonitorSmartphone } from "lucide-react"

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

const PERKS = [
  { icon: History, title: "Continue Watching", text: "Pick up every episode right where you stopped." },
  { icon: Bookmark, title: "My List", text: "Save anime to watch later, on any device." },
  { icon: MonitorSmartphone, title: "Everywhere", text: "Phone, tablet or computer: it all follows you." },
]

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

  // Always send people back to the site they signed in on (not a fixed address).
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

  const field =
    "h-12 w-full rounded-xl border border-white/12 bg-white/[0.05] pl-11 pr-4 text-[0.95rem] text-white outline-none transition-colors placeholder:text-white/35 focus:border-lime-300/60 focus:bg-white/[0.08] focus:ring-4 focus:ring-lime-300/10"
  const social =
    "flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.05] text-sm font-semibold text-white transition-all hover:border-white/25 hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-60"

  return (
    <div className="relative min-h-svh overflow-x-clip bg-[#121113] text-[#eeeef0]">
      <SiteHeader />

      {/* soft colour glows behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-lime-400/15 blur-[110px]" />
        <div className="absolute top-1/3 -right-24 size-[30rem] rounded-full bg-violet-500/20 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 size-[26rem] rounded-full bg-rose-500/10 blur-[120px]" />
      </div>

      <main className="relative mx-auto grid min-h-svh w-full max-w-6xl items-center gap-10 px-4 pt-24 pb-12 sm:px-8 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16">
        {/* left: why sign in (desktop only) */}
        <section className="hidden lg:block">
          <p className="mb-3 inline-flex rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 text-xs font-semibold tracking-wide text-lime-200 uppercase">
            Free account
          </p>
          <h1 className="text-5xl leading-[1.08] font-bold tracking-tight text-white">
            Your anime,
            <br />
            <span className="bg-gradient-to-r from-lime-300 to-emerald-300 bg-clip-text text-transparent">wherever you watch.</span>
          </h1>
          <ul className="mt-9 space-y-5">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06] text-lime-300">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="block text-sm text-white/55">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* right: the form */}
        <section className="mx-auto w-full max-w-md lg:max-w-none">
          <div className="rounded-3xl border border-white/12 bg-white/[0.045] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {mode === "login" ? "Log in to continue watching." : "Join to save your progress and your list."}
            </p>

            <div role="tablist" aria-label="Log in or sign up" className="relative mt-5 grid grid-cols-2 rounded-full border border-white/15 bg-black/20 p-1">
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow transition-transform duration-300",
                  mode === "login" ? "translate-x-0" : "translate-x-full"
                )}
              />
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
                    "relative z-10 rounded-full py-2 text-sm font-semibold transition-colors",
                    mode === m ? "text-black" : "text-white/70 hover:text-white"
                  )}
                >
                  {m === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-2.5 min-[420px]:grid-cols-2">
              <button type="button" className={social} disabled={!!busy} onClick={() => oauth("google")}>
                {busy === "google" ? <Spinner className="size-5" /> : <Google />} Google
              </button>
              <button type="button" className={social} disabled={!!busy} onClick={() => oauth("discord")}>
                {busy === "discord" ? <Spinner className="size-5" /> : <Discord />} Discord
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-[0.7rem] font-medium tracking-wider text-white/35 uppercase">
              <span className="h-px flex-1 bg-white/12" /> or use email <span className="h-px flex-1 bg-white/12" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              <label className="relative block">
                <span className="sr-only">Email</span>
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-[1.15rem] -translate-y-1/2 text-white/40" />
                <input type="email" required autoComplete="email" inputMode="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </label>
              <label className="relative block">
                <span className="sr-only">Password</span>
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-[1.15rem] -translate-y-1/2 text-white/40" />
                <input
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "login" ? "Password" : "Password (6+ characters)"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(field, "pr-12")}
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-white/45 hover:text-white"
                >
                  {show ? <EyeOff className="size-[1.15rem]" /> : <Eye className="size-[1.15rem]" />}
                </button>
              </label>

              {error && (
                <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-2.5 text-[0.8rem] text-red-200">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-xl border border-lime-300/20 bg-lime-300/10 px-3.5 py-2.5 text-[0.8rem] text-lime-100">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={!!busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lime-300 to-emerald-300 text-[0.95rem] font-bold text-black shadow-lg shadow-lime-400/10 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              >
                {busy === "email" && <Spinner className="size-4" />}
                {mode === "login" ? "Log in" : "Create account"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-white/55">
              {mode === "login" ? "New here? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login")
                  setError(null)
                  setNotice(null)
                }}
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
