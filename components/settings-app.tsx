"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight, X } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Spinner } from "@/components/ui/spinner"
import { getSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Field = "username" | "name" | "email"

const COPY: Record<Field, { title: string; hint: string; type: string; max: number }> = {
  username: { title: "Username", hint: "3 to 20 characters: lowercase letters, numbers, dots and underscores.", type: "text", max: 20 },
  name: { title: "Display Name", hint: "This is the name people see on your profile.", type: "text", max: 32 },
  email: { title: "Email", hint: "We will send a confirmation link to the new address.", type: "email", max: 120 },
}

function EditSheet({ field, initial, onClose }: { field: Field; initial: string; onClose: () => void }) {
  const { user, refreshProfile } = useAuth()
  const [value, setValue] = React.useState(initial)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const c = COPY[field]

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onClose])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const v = value.trim()
    setError(null)
    setBusy(true)
    const supabase = getSupabase()
    try {
      if (field === "username") {
        const handle = v.toLowerCase()
        if (!/^[a-z0-9_.]{3,20}$/.test(handle)) throw new Error("Use 3 to 20 letters, numbers, dots or underscores.")
        const { error } = await supabase.from("profiles").upsert({ id: user.id, handle }, { onConflict: "id" })
        if (error) throw new Error(error.code === "23505" ? "That username is already taken." : error.message)
        await refreshProfile()
        onClose()
      } else if (field === "name") {
        if (!v) throw new Error("Enter a display name.")
        const { error } = await supabase.from("profiles").upsert({ id: user.id, username: v }, { onConflict: "id" })
        if (error) throw new Error(error.message)
        await refreshProfile()
        onClose()
      } else {
        if (!/^\S+@\S+\.\S+$/.test(v)) throw new Error("Enter a valid email address.")
        if (v.toLowerCase() === (user.email ?? "").toLowerCase()) throw new Error("That is already your email.")
        const { error } = await supabase.auth.updateUser({ email: v }, { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` })
        if (error) throw new Error(error.message)
        setDone("Check your inbox. Open the confirmation link to finish changing your email.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.")
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 sm:place-items-center sm:p-6" onClick={() => !busy && onClose()}>
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl glass-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:pb-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{c.title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10 glass-btn">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-white/55">{c.hint}</p>

        <input
          autoFocus
          type={c.type}
          value={value}
          maxLength={c.max}
          disabled={busy || !!done}
          onChange={(e) => setValue(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-4 h-12 w-full rounded-xl border border-white/20 bg-transparent px-4 text-base text-white outline-none placeholder:text-white/40 focus:border-white/60 sm:text-sm"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="mt-3 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white/80">
            {done}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10 glass-btn">
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-full glass-white px-6 text-sm font-semibold text-black disabled:opacity-60"
            >
              {busy && <Spinner className="size-4" />}
              Save
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export function SettingsApp() {
  const router = useRouter()
  const { user, ready, name, handle } = useAuth()
  const [editing, setEditing] = React.useState<Field | null>(null)

  const back = () => (window.history.length > 1 ? router.back() : router.push("/"))

  const rows: { field: Field; label: string; value: string }[] = [
    { field: "username", label: "Username", value: handle ?? "" },
    { field: "name", label: "Display Name", value: name ?? "" },
    { field: "email", label: "Email", value: user?.email ?? "" },
  ]

  return (
    <div className="min-h-svh bg-[#000000] text-[#f2f3f5]">
      <header className="sticky top-0 z-10 border-b border-white/15 bg-[#000000]">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <button type="button" aria-label="Back" onClick={back} className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10 glass-btn">
            <ArrowLeft className="size-6" />
          </button>
          <h1 className="text-lg font-semibold text-white sm:text-xl">Settings</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {ready && !user ? (
          <div className="rounded-2xl border border-white/20 p-6 text-center">
            <p className="text-white/80">Log in to manage your account.</p>
            <Link href="/login?next=/settings" className="mt-4 inline-flex h-11 items-center rounded-full glass-white px-6 text-sm font-semibold text-black">
              Log in / Sign up
            </Link>
          </div>
        ) : (
          <section>
            <h2 className="mb-3 text-base text-white/60">Account Information</h2>
            <ul className="overflow-hidden rounded-2xl border border-white/20">
              {rows.map((r, i) => (
                <li key={r.field} className={cn(i > 0 && "border-t border-white/15")}>
                  <button
                    type="button"
                    disabled={!user}
                    onClick={() => setEditing(r.field)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.05] sm:px-5"
                  >
                    <span className="shrink-0 text-base text-white">{r.label}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-sm text-white/55">{r.value}</span>
                    <ChevronRight className="size-5 shrink-0 text-white/50" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {editing && user && (
        <EditSheet
          key={editing}
          field={editing}
          initial={rows.find((r) => r.field === editing)?.value ?? ""}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
