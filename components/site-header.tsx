"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Captions, History, Menu, Search, Star, TrendingUp, X } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { airedEpisodes, animeTitle, getTrending, infoHref, searchSmart, type Anime } from "@/lib/anilist"
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

const STATUS_LABEL: Record<string, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
}

function Dot() {
  return <span className="text-white/40">·</span>
}

const RECENT_KEY = "anibiar:recent-searches"

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : []
  } catch {
    return []
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)))
  } catch {
    /* private mode: recent searches just won't persist */
  }
}

/** Bold the part of a title that matches what was typed. */
function Highlight({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="font-bold text-white">{text.slice(i, i + term.length)}</span>
      {text.slice(i + term.length)}
    </>
  )
}

function ResultRow({
  a,
  term,
  active,
  onPick,
}: {
  a: Anime
  term: string
  active: boolean
  onPick: () => void
}) {
  const aired = airedEpisodes(a)
  const parts: React.ReactNode[] = []
  if (a.format) parts.push(<span key="f">{a.format}</span>)
  if (a.seasonYear) parts.push(<span key="y">{a.seasonYear}</span>)
  if (a.episodes) parts.push(<span key="e">{a.episodes} ep</span>)
  if (aired > 0) {
    parts.push(
      <span key="c" className="inline-flex items-center gap-1 rounded bg-white/[0.08] px-1 py-0.5">
        <Captions className="size-3" />
        {aired}
      </span>
    )
  }
  if (a.averageScore) {
    parts.push(
      <span key="s" className="inline-flex items-center gap-1">
        <Star className="size-3 fill-current" />
        {(a.averageScore / 10).toFixed(1)}
      </span>
    )
  }
  if (a.status) parts.push(<span key="st">{STATUS_LABEL[a.status] ?? a.status}</span>)
  return (
    <li>
      <Link
        href={infoHref(a)}
        onClick={onPick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 transition-colors hover:bg-white/[0.08] sm:gap-4 sm:px-5 sm:py-2.5",
          active && "bg-white/[0.1]"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.coverImage.large ?? ""}
          alt=""
          className="h-14 w-10 shrink-0 rounded-md bg-white/10 object-cover sm:h-[4.5rem] sm:w-[3.25rem]"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white/95 sm:text-[0.95rem]">
            <Highlight text={animeTitle(a)} term={term} />
          </p>
          {/* Each item carries its own leading dot, so a wrap never strands a dot at a line end. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.68rem] leading-none text-white/60 sm:text-xs">
            {parts.map((part, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {i > 0 && <Dot />}
                {part}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </li>
  )
}

function ResultSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-5" aria-hidden="true">
      <Skeleton className="h-14 w-10 shrink-0 rounded-md bg-white/10 sm:h-20 sm:w-14" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3 bg-white/10" />
        <Skeleton className="h-3 w-full max-w-xs bg-white/10" />
      </div>
    </li>
  )
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = React.useState("")
  const [results, setResults] = React.useState<Anime[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [recent, setRecent] = React.useState<string[]>([])
  const [trending, setTrending] = React.useState<Anime[]>([])
  const [cursor, setCursor] = React.useState(-1)
  const term = q.trim()

  React.useEffect(() => {
    setRecent(readRecent())
    const ctrl = new AbortController()
    getTrending(ctrl.signal)
      .then((t) => setTrending(t.slice(0, 5)))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // Search as you type. Results already fetched for the same words come back instantly.
  React.useEffect(() => {
    setCursor(-1)
    if (term.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      searchSmart(term, 6, ctrl.signal)
        .then((r) => {
          setResults(r)
          setError(null)
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setError((e as Error).message)
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false)
        })
    }, 180)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [term])

  // The page behind stays scrollable (like Miruro). A tap outside the panel closes it;
  // scrolling does not, because it never fires a click.
  const panel = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    const onClick = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener("keydown", onKey)
    const t = setTimeout(() => document.addEventListener("click", onClick, true), 0)
    return () => {
      window.removeEventListener("keydown", onKey)
      clearTimeout(t)
      document.removeEventListener("click", onClick, true)
    }
  }, [onClose])

  const remember = (value: string) => {
    const v = value.trim()
    if (!v) return
    const next = [v, ...readRecent().filter((r) => r.toLowerCase() !== v.toLowerCase())]
    writeRecent(next)
  }

  const goSearch = (value: string) => {
    if (!value.trim()) return
    remember(value)
    onClose()
    router.push(`/search?q=${encodeURIComponent(value.trim())}`)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const hit = cursor >= 0 ? results[cursor] : null
    if (hit) {
      remember(term)
      onClose()
      router.push(infoHref(hit))
    } else {
      goSearch(term)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setCursor((c) => (c + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCursor((c) => (c <= 0 ? results.length - 1 : c - 1))
    }
  }

  const showResults = term.length >= 2

  return (
    <>
      {/* Dims the page but lets touches and wheel scrolling pass through to it. */}
      <div className="pointer-events-none fixed inset-0 z-[55] bg-black/40" aria-hidden="true" />
      <div
        ref={panel}
        className="fixed inset-x-0 top-0 z-[60] border-b border-white/15 bg-[#121113]/75 backdrop-blur-md"
      >
        <form onSubmit={submit} className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-3 sm:h-16 sm:px-4">
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full text-white/90 hover:bg-white/10"
          >
            <ArrowLeft className="size-6" />
          </button>
          <div className="flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-white/35 sm:h-11">
            <input
              autoFocus
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search anime..."
              aria-label="Search anime"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/50 sm:px-4 sm:text-base [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setQ("")}
                className="grid size-8 shrink-0 place-items-center text-white/80 hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
            <button
              type="submit"
              aria-label="Search"
              className="grid h-full w-10 shrink-0 place-items-center border-l border-white/35 text-white/80 hover:bg-white/10 hover:text-white sm:w-12"
            >
              {loading ? <Spinner /> : <Search className="size-4 sm:size-5" />}
            </button>
          </div>
        </form>

        <div className="mx-auto max-h-[calc(100svh-4rem)] w-full max-w-3xl overflow-y-auto pb-2">
          {showResults ? (
            <>
              {error && !results.length && <p className="px-5 py-4 text-sm text-red-300">{error}</p>}
              {loading && results.length === 0 && !error && (
                <ul>
                  {Array.from({ length: 5 }, (_, i) => (
                    <ResultSkeleton key={i} />
                  ))}
                </ul>
              )}
              {!error && !loading && results.length === 0 && (
                <p className="px-5 py-4 text-sm text-white/60">No results for &ldquo;{term}&rdquo;.</p>
              )}
              <ul>
                {results.map((a, i) => (
                  <ResultRow
                    key={a.id}
                    a={a}
                    term={term}
                    active={i === cursor}
                    onPick={() => {
                      remember(term)
                      onClose()
                    }}
                  />
                ))}
              </ul>
              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() => goSearch(term)}
                  className="mx-auto flex items-center gap-2 px-4 py-3 text-xs text-white/70 hover:text-white sm:text-sm"
                >
                  <Search className="size-4" />
                  See all results for &ldquo;{term}&rdquo;
                </button>
              )}
            </>
          ) : (
            <>
              {recent.length > 0 && (
                <div className="px-4 pt-3 sm:px-5">
                  <div className="mb-1 flex items-center justify-between text-xs text-white/50">
                    <span className="inline-flex items-center gap-1.5">
                      <History className="size-3.5" />
                      Recent searches
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        writeRecent([])
                        setRecent([])
                      }}
                      className="hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <ul>
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => setQ(r)}
                          className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-sm text-white/80 hover:bg-white/[0.08]"
                        >
                          <Search className="size-4 shrink-0 text-white/40" />
                          <span className="truncate">{r}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {trending.length === 0 && (
                <ul>
                  {Array.from({ length: 4 }, (_, i) => (
                    <ResultSkeleton key={i} />
                  ))}
                </ul>
              )}
              {trending.length > 0 && (
                <div className="pt-2">
                  <p className="inline-flex items-center gap-1.5 px-4 pb-1 text-xs text-white/50 sm:px-5">
                    <TrendingUp className="size-3.5" />
                    Trending now
                  </p>
                  <ul>
                    {trending.map((a) => (
                      <ResultRow key={a.id} a={a} term="" active={false} onPick={onClose} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
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
            ? "border-white/15 bg-[#121113]/60 backdrop-blur-lg backdrop-saturate-150"
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
