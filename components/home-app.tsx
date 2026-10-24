"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  Menu,
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
import { getTitleLogo, logosEnabled } from "@/lib/logos"
import { cn } from "@/lib/utils"

const MAX_PAGES = 5

// Thin frosted glass, flat colours only.
const GLASS = "border border-white/15 bg-white/[0.08]"

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

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

// The artwork fills the hero only and fades into the page background at the
// bottom, so the episode list below sits on the plain dark page.
function Hero({
  items,
  index,
  setIndex,
}: {
  items: Anime[] | null
  index: number
  setIndex: (i: number) => void
}) {
  const [logos, setLogos] = React.useState<Record<number, string | null>>({})
  const a = items?.[index]

  React.useEffect(() => {
    if (!a || !logosEnabled || a.id in logos) return
    const ctrl = new AbortController()
    getTitleLogo(a.title.english ?? a.title.romaji ?? "", a.format === "MOVIE", ctrl.signal).then(
      (url) => setLogos((l) => ({ ...l, [a.id]: url }))
    )
    return () => ctrl.abort()
  }, [a, logos])

  if (!items) return <div className="h-[78svh] min-h-[28rem] md:h-[70svh]" />
  if (!a) return <div className="h-24" />

  const desc = stripHtml(a.description ?? "")
  const logo = logos[a.id]
  const chips = [
    a.episodes ? `${a.episodes} Episodes` : null,
    a.seasonYear ? String(a.seasonYear) : null,
    ...(a.genres ?? []).slice(0, 2),
  ].filter(Boolean) as string[]

  return (
    <section className="relative flex h-[78svh] min-h-[28rem] w-full items-end md:h-[70svh]">
      <div
        className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_72%,transparent)]"
        aria-hidden="true"
      >
        {items.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              i === index ? "opacity-100" : "opacity-0"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.coverImage.extraLarge ?? ""} alt="" className="size-full object-cover md:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.bannerImage ?? m.coverImage.extraLarge ?? ""}
              alt=""
              className="hidden size-full object-cover object-top md:block"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-black/40" />
      </div>
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pb-10 sm:gap-4 sm:px-8 md:pb-14">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logo}
            src={logo}
            alt={animeTitle(a)}
            className="max-h-24 w-auto max-w-[85%] object-contain object-left drop-shadow-[0_2px_10px_rgb(0_0_0/0.6)] sm:max-h-32 sm:max-w-md"
          />
        ) : (
          <h1 className="max-w-3xl text-2xl leading-tight font-bold tracking-tight text-balance text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.6)] sm:text-4xl lg:text-5xl">
            {animeTitle(a)}
          </h1>
        )}
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c} className={cn("rounded-full px-3 py-1 text-xs text-white/90 sm:px-4 sm:py-1.5 sm:text-sm", GLASS)}>
              {c}
            </span>
          ))}
        </div>
        {desc && (
          <p className="line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">{desc}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-10 rounded-lg bg-white px-5 text-sm font-semibold text-black hover:bg-white/90 sm:h-11 sm:text-base"
          >
            <Link href={watchHref(a, 1)}>
              <Play className="fill-current" />
              Watch Now
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="h-10 rounded-lg bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20 sm:h-11 sm:text-base"
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
            className="size-10 rounded-lg bg-white/10 text-white hover:bg-white/20 sm:size-11"
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
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
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
            "absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          )}
        >
          <Plus className="size-4" />
        </span>
        <span className="absolute inset-0 grid place-items-center text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="size-10 fill-current drop-shadow-lg" />
        </span>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pt-8 pb-2 text-[0.7rem] font-semibold whitespace-nowrap text-white min-[400px]:text-xs sm:px-3 sm:text-sm">
          <span>EP {item.episode}</span>
          <span>{timeAgo(item.airingAt)}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[0.65rem] leading-none text-white/70 sm:gap-1.5 sm:text-xs">
        <span className="inline-flex items-center gap-1 rounded bg-white/[0.07] px-1.5 py-1 sm:px-2 sm:py-1.5 group-hover:bg-lime-300/10">
          <Subtitles className="size-3 sm:size-3.5" />
          {item.episode}
        </span>
        <span className="rounded bg-white/[0.07] px-1.5 py-1 sm:px-2 sm:py-1.5 group-hover:bg-lime-300/10">{meta}</span>
        {a.seasonYear && (
          <span className="rounded bg-white/[0.07] px-1.5 py-1 sm:px-2 sm:py-1.5 group-hover:bg-lime-300/10">
            {a.seasonYear}
          </span>
        )}
      </div>
      <h3 className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium text-white transition-colors group-hover:text-lime-300 sm:text-sm lg:text-base">
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
    <section ref={top} className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-2 sm:mb-6">
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-white sm:text-2xl">
          Latest Episodes
        </h2>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div
            role="tablist"
            aria-label="Audio"
            className="flex rounded-full border border-white/20 p-0.5"
          >
            {(["sub", "dub"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-colors sm:px-5 sm:py-1.5 sm:text-sm",
                  mode === m ? "bg-white text-black" : "text-white/70 hover:text-white"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-full border border-white/20 p-0.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
              className="grid size-6 place-items-center rounded-full text-white/80 sm:size-7 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-8 text-center text-xs font-medium sm:min-w-10 sm:text-sm text-white tabular-nums">
              {page}/{lastPage}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= lastPage}
              onClick={() => go(page + 1)}
              className="grid size-6 place-items-center rounded-full text-white/80 sm:size-7 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
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
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items
            ? items.map((it) => <EpisodeCard key={it.id} item={it} />)
            : Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[2/3] rounded-xl bg-white/5" />
                  <Skeleton className="h-4 w-3/4 bg-white/5" />
                  <Skeleton className="h-3 w-full bg-white/5" />
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
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [heroIndex, setHeroIndex] = React.useState(0)

  React.useEffect(() => {
    if (!trending || trending.length < 2) return
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % trending.length), 8000)
    return () => clearInterval(t)
  }, [trending, heroIndex])

  React.useEffect(() => {
    const ctrl = new AbortController()
    getTrending(ctrl.signal)
      .then(setTrending)
      .catch(() => setTrending([]))
    return () => ctrl.abort()
  }, [])

  React.useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="relative min-h-svh overflow-x-clip bg-[#111214] font-poppins text-white">
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

      <main>
        <Hero items={trending} index={heroIndex} setIndex={setHeroIndex} />
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
