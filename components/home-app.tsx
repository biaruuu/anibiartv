"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  Play,
  Plus,
  Search,
  Subtitles,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  animeTitle,
  getLatestEpisodes,
  getTrending,
  searchAnime,
  timeAgo,
  watchHref,
  type Anime,
  type LatestEpisode,
} from "@/lib/anilist"
import { cn } from "@/lib/utils"

const MAX_PAGES = 5

// Thin frosted glass, flat colours only.
const GLASS =
  "border border-white/15 bg-white/10 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] backdrop-blur-lg backdrop-saturate-150"

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="AniBiar TV home" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="AniBiar TV" className={cn("h-9 w-auto sm:h-11", className)} />
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
                href={watchHref(a)}
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

/* ---------------------------------- hero ---------------------------------- */

function Hero({ items }: { items: Anime[] | null }) {
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    if (!items || items.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 8000)
    return () => clearInterval(t)
  }, [items])

  if (!items) {
    return <Skeleton className="h-[78svh] w-full rounded-none bg-white/5 md:h-[70svh]" />
  }
  if (items.length === 0) return <div className="h-24" />

  const a = items[index]
  const desc = stripHtml(a.description ?? "")
  const chips = [
    a.episodes ? `${a.episodes} Episodes` : null,
    a.seasonYear ? String(a.seasonYear) : null,
    ...(a.genres ?? []).slice(0, 2),
  ].filter(Boolean) as string[]

  return (
    <section className="relative h-[78svh] min-h-[28rem] w-full overflow-hidden bg-[#111214] md:h-[70svh]">
      {items.map((m, i) => (
        <div
          key={m.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === index ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={i !== index}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.coverImage.extraLarge ?? ""}
            alt=""
            className="size-full object-cover md:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.bannerImage ?? m.coverImage.extraLarge ?? ""}
            alt=""
            className="hidden size-full object-cover object-top md:block"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-black/45" />

      <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 pb-12 sm:px-8 md:pb-16">
        <h1 className="max-w-3xl text-3xl leading-tight font-bold tracking-tight text-balance text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.6)] sm:text-5xl">
          {animeTitle(a)}
        </h1>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c} className={cn("rounded-full px-4 py-1.5 text-sm text-white", GLASS)}>
              {c}
            </span>
          ))}
        </div>
        {desc && (
          <p className="line-clamp-3 max-w-2xl text-base text-white/75 sm:text-lg">{desc}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl bg-white px-6 text-base font-semibold text-black hover:bg-white/90"
          >
            <Link href={watchHref(a, 1)}>
              <Play className="fill-current" />
              Watch Now
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            className={cn("h-12 rounded-xl px-6 text-base font-semibold text-white hover:bg-white/20", GLASS)}
          >
            <Link href={watchHref(a)}>
              <Info />
              Details
            </Link>
          </Button>
          <Button
            type="button"
            size="icon"
            aria-label="Add to list"
            className={cn("size-12 rounded-xl text-white hover:bg-white/20", GLASS)}
          >
            <Plus />
          </Button>
        </div>
        {items.length > 1 && (
          <div className="flex gap-1.5" role="tablist" aria-label="Featured anime">
            {items.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${animeTitle(m)}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ latest episodes ----------------------------- */

function EpisodeCard({ item }: { item: LatestEpisode }) {
  const a = item.media
  const meta = a.format === "TV_SHORT" ? "TV" : (a.format ?? "TV").replace("_", " ")
  return (
    <Link href={watchHref(a, item.episode)} className="group block min-w-0">
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.coverImage.extraLarge ?? a.coverImage.large ?? ""}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" />
        <span
          className={cn(
            "absolute top-2 right-2 grid size-10 place-items-center rounded-full text-white opacity-0 transition-opacity group-hover:opacity-100",
            GLASS
          )}
        >
          <Plus className="size-5" />
        </span>
        <span className="absolute inset-0 grid place-items-center text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="size-12 fill-current drop-shadow-lg" />
        </span>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pt-10 pb-2.5 text-sm font-semibold text-white sm:text-base">
          <span>EP {item.episode}</span>
          <span>{timeAgo(item.airingAt)}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-sm text-white/70">
        <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.07] px-2.5 py-1.5 group-hover:bg-lime-300/10">
          <Subtitles className="size-4" />
          {item.episode}
        </span>
        <span className="rounded-md bg-white/[0.07] px-2.5 py-1.5 group-hover:bg-lime-300/10">{meta}</span>
        {a.seasonYear && (
          <span className="rounded-md bg-white/[0.07] px-2.5 py-1.5 group-hover:bg-lime-300/10">
            {a.seasonYear}
          </span>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-base leading-snug font-medium text-white transition-colors group-hover:text-lime-300 sm:text-lg">
        {animeTitle(a)}
      </h3>
    </Link>
  )
}

function LatestEpisodes() {
  const [page, setPage] = React.useState(1)
  const [lastPage, setLastPage] = React.useState(MAX_PAGES)
  const [items, setItems] = React.useState<LatestEpisode[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"sub" | "dub">("sub")
  const [retry, setRetry] = React.useState(0)
  const top = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const ctrl = new AbortController()
    setItems(null)
    setError(null)
    getLatestEpisodes(page, ctrl.signal)
      .then((r) => {
        setItems(r.items)
        setLastPage(Math.min(MAX_PAGES, r.lastPage))
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message)
      })
    return () => ctrl.abort()
  }, [page, retry])

  const go = (p: number) => {
    setPage(p)
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section ref={top} className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-8 sm:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Latest Episodes
        </h2>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div
            role="tablist"
            aria-label="Audio"
            className="flex rounded-full border border-white/20 p-1"
          >
            {(["sub", "dub"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-5 py-1.5 text-base font-semibold capitalize transition-colors sm:px-6",
                  mode === m ? "bg-[#c4b5fd] text-[#1b1530]" : "text-white/70 hover:text-white"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-full border border-white/20 p-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
              className="grid size-8 place-items-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="min-w-12 text-center text-sm font-medium text-white tabular-nums">
              {page}/{lastPage}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= lastPage}
              onClick={() => go(page + 1)}
              className="grid size-8 place-items-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {mode === "dub" && (
        <p className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Dub availability comes from your streaming servers, which are not connected yet. The
          list below shows every latest episode.
        </p>
      )}

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <CircleAlert className="size-8 text-red-400" />
          <p className="text-white/80">{error}</p>
          <Button variant="secondary" onClick={() => setRetry((r) => r + 1)}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items
            ? items.map((it) => <EpisodeCard key={it.id} item={it} />)
            : Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[2/3] rounded-2xl bg-white/5" />
                  <Skeleton className="h-8 w-3/4 bg-white/5" />
                  <Skeleton className="h-5 w-full bg-white/5" />
                </div>
              ))}
        </div>
      )}
    </section>
  )
}

/* ----------------------------------- page ----------------------------------- */

export function HomeApp() {
  const [trending, setTrending] = React.useState<Anime[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const ctrl = new AbortController()
    getTrending(ctrl.signal)
      .then(setTrending)
      .catch(() => setTrending([]))
    return () => ctrl.abort()
  }, [])

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-svh overflow-x-clip bg-[#111214] text-white">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
          scrolled ? "bg-[#111214]/80 backdrop-blur-lg" : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearching(true)}
              className={cn(
                "grid size-10 place-items-center rounded-full text-white transition-colors hover:bg-white/20",
                GLASS
              )}
            >
              <Search className="size-5" />
            </button>
            <Link
              href="/watch"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-white transition-colors hover:bg-white/20",
                GLASS
              )}
            >
              <Play className="size-4 fill-current" />
              Player
            </Link>
          </div>
        </div>
      </header>

      <main>
        <Hero items={trending} />
        <LatestEpisodes />
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-medium text-white/80">AniBiar TV</p>
          <p>Anime data from AniList. Streaming servers coming soon.</p>
        </div>
      </footer>

      {searching && <SearchOverlay onClose={() => setSearching(false)} />}
    </div>
  )
}
