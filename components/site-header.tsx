"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { animeTitle, infoHref, searchAnime, type Anime } from "@/lib/anilist"
import { cn } from "@/lib/utils"

function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="AniBiar TV home" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="AniBiar TV" className={cn("h-8 w-auto sm:h-10", className)} />
    </Link>
  )
}

/* ------------------------------ search overlay ------------------------------ */

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = React.useState("")
  const [results, setResults] = React.useState<Anime[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setError(null)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      searchAnime(term, ctrl.signal)
        .then((r) => {
          setResults(r)
          setError(null)
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setError((e as Error).message)
        })
        .finally(() => setLoading(false))
    }, 350)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Search anime"
        className="mx-auto mt-14 w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#17181b]/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 p-3">
          <Search className="ml-1 size-5 shrink-0 text-white/60" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search anime"
            className="h-9 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {loading && <Spinner className="shrink-0" />}
          <Button variant="ghost" size="icon" aria-label="Close search" onClick={onClose}>
            <X />
          </Button>
        </div>
        <ul className="max-h-[60svh] overflow-y-auto p-2">
          {error && <li className="p-3 text-sm text-red-400">{error}</li>}
          {!error && q.trim().length >= 2 && !loading && results.length === 0 && (
            <li className="p-3 text-sm text-white/60">No results for “{q.trim()}”.</li>
          )}
          {!error && q.trim().length < 2 && (
            <li className="p-3 text-sm text-white/60">Type at least 2 letters.</li>
          )}
          {results.map((a) => (
            <li key={a.id}>
              <Link
                href={infoHref(a)}
                className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.coverImage.large ?? ""}
                  alt=""
                  className="h-16 w-11 shrink-0 rounded-lg bg-white/10 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{animeTitle(a)}</p>
                  <p className="text-xs text-white/60">
                    {[a.format?.replace("_", " "), a.seasonYear, a.episodes && `${a.episodes} eps`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}


export function SiteHeader() {
  const [searching, setSearching] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b transition-colors duration-200",
          scrolled || menuOpen
            ? "border-white/15 bg-[#111214]/90"
            : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-8">
          <Logo />
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearching(true)}
              className="grid size-10 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            >
              <Search className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="grid size-10 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-3 text-sm sm:px-8">
            <Link href="/" className="rounded-lg px-3 py-2.5 text-white hover:bg-white/10">
              Home
            </Link>
            <Link href="/watch" className="rounded-lg px-3 py-2.5 text-white hover:bg-white/10">
              Video player
            </Link>
          </nav>
        )}
      </header>
      {searching && <SearchOverlay onClose={() => setSearching(false)} />}
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-medium text-white/80">AniBiar TV</p>
        <p>Anime data from AniList. Streaming servers coming soon.</p>
      </div>
    </footer>
  )
}
