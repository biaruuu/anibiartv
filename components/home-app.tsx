"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Info,
  Play,
  Plus,
  Star,
  Captions,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  animeTitle,
  getLatestEpisodes,
  getTopAiring,
  getUpcoming,
  infoHref,
  getTrending,
  timeAgo,
  watchHref,
  type Anime,
  type LatestEpisode,
} from "@/lib/anilist"
import { getTitleLogo, logosEnabled } from "@/lib/logos"
import { ContinueWatching } from "@/components/continue-watching"
import { SiteFooter, SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"

const MAX_PAGES = 5

// Thin frosted glass, flat colours only.
const GLASS = "border border-white/15 bg-white/[0.08]"

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

/* ---------------------------------- hero ---------------------------------- */

// The artwork fills the hero only and fades into the page background at the
// bottom, so the episode list below sits on the plain dark page.
function Hero({
  items,
  index,
  setIndex,
  onRetry,
}: {
  items: Anime[] | null
  index: number
  setIndex: (i: number) => void
  onRetry: () => void
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
  if (!a) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 pt-28 pb-8 text-center text-sm text-white/60">
        <p>Couldn&apos;t load featured anime.</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }

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
          <h1 className="max-w-3xl text-2xl leading-tight font-extrabold tracking-tight text-balance text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.6)] sm:text-4xl lg:text-5xl">
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
            <Link href={infoHref(a)}>
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

function EpisodeCard({ item, dub }: { item: LatestEpisode; dub?: boolean }) {
  const a = item.media
  const meta = a.format === "TV_SHORT" ? "TV" : (a.format ?? "TV").replace("_", " ")
  return (
    <Link href={dub ? `/watch/${a.id}?ep=${item.episode}&audio=dub` : infoHref(a)} className="group block min-w-0">
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
          <Captions className="size-3 sm:size-3.5" />
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

/** Dub is checked against the streaming servers, one title at a time. Remembered for the visit. */
const dubCache = new Map<string, boolean>()

function useDubCheck(items: LatestEpisode[] | null, on: boolean) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  const [pending, setPending] = React.useState(0)
  React.useEffect(() => {
    if (!on || !items) return
    const todo = items.filter((it) => !dubCache.has(`${it.media.id}:${it.episode}`))
    if (!todo.length) return
    let alive = true
    let next = 0
    let active = 0
    setPending(todo.length)
    const run = async () => {
      while (alive && next < todo.length) {
        const it = todo[next++]
        active++
        try {
          const r = await fetch(`/api/anime/${it.media.id}/episodes`)
          const data = r.ok ? ((await r.json()) as { dub?: { number: number }[] }) : null
          dubCache.set(`${it.media.id}:${it.episode}`, !!data?.dub?.some((e) => e.number === it.episode))
        } catch {
          dubCache.set(`${it.media.id}:${it.episode}`, false)
        }
        active--
        if (alive) {
          setPending(todo.length - Math.min(next, todo.length) + active)
          tick()
        }
      }
    }
    void Promise.all([run(), run(), run()]).then(() => alive && setPending(0))
    return () => {
      alive = false
    }
  }, [items, on])
  return { has: (it: LatestEpisode) => dubCache.get(`${it.media.id}:${it.episode}`) === true, pending: on ? pending : 0 }
}

function LatestEpisodes() {
  const [page, setPage] = React.useState(1)
  const [lastPage, setLastPage] = React.useState(MAX_PAGES)
  const [items, setItems] = React.useState<LatestEpisode[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"sub" | "dub">("sub")
  const [retry, setRetry] = React.useState(0)
  const top = React.useRef<HTMLDivElement>(null)
  const dub = useDubCheck(items, mode === "dub")
  const shown = items && mode === "dub" ? items.filter(dub.has) : items

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

      {mode === "dub" && items && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
          {dub.pending > 0 ? (
            <>
              <Spinner className="size-4" /> Checking which of these episodes have an English dub…
            </>
          ) : shown && shown.length > 0 ? (
            "Showing only episodes that have an English dub on the servers."
          ) : (
            "None of the latest episodes on this page have a dub yet. Try another page or switch back to Sub."
          )}
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
          {shown
            ? shown.map((it) => <EpisodeCard key={it.id} item={it} dub={mode === "dub"} />)
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

/* ------------------------- top airing / upcoming lists ------------------------- */

const PANEL_STEP = 5

function RankedPanel({
  title,
  dot,
  load,
}: {
  title: string
  dot: string
  load: (signal: AbortSignal) => Promise<Anime[]>
}) {
  const [items, setItems] = React.useState<Anime[] | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const [shown, setShown] = React.useState(PANEL_STEP)

  React.useEffect(() => {
    const ctrl = new AbortController()
    setFailed(false)
    load(ctrl.signal)
      .then(setItems)
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setFailed(true)
      })
    return () => ctrl.abort()
    // `load` is a stable module-level function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry])

  const visible = items?.slice(0, shown) ?? []

  return (
    <section className="min-w-0 rounded-2xl border border-white/20 p-3 sm:p-4">
      <h2 className="mb-3 flex items-center gap-2 px-1 pt-1 text-base font-semibold tracking-wide text-white uppercase sm:text-lg">
        <ChevronRight className="size-5" />
        {title}
      </h2>

      {failed ? (
        <div className="flex items-center justify-between gap-3 p-3 text-sm text-white/60">
          <span>Couldn&apos;t load this list.</span>
          <Button variant="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {!items &&
            Array.from({ length: PANEL_STEP }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-24 rounded-xl bg-white/5 sm:h-28" />
              </li>
            ))}
          {visible.map((a) => {
            const eps = a.nextAiringEpisode ? a.nextAiringEpisode.episode - 1 : a.episodes
            const pill =
              "inline-flex items-center gap-1 rounded bg-white/[0.07] px-1.5 py-1 sm:px-2 sm:py-1.5"
            return (
              <li key={a.id}>
                <Link
                  href={infoHref(a)}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-white/[0.05] pr-3 transition-colors hover:bg-white/[0.09]"
                >
                  {/* Faint artwork on the right half, like the reference. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.bannerImage ?? a.coverImage.extraLarge ?? ""}
                    alt=""
                    loading="lazy"
                    className="pointer-events-none absolute inset-y-0 right-0 h-full w-3/4 object-cover opacity-20 grayscale [mask-image:linear-gradient(to_left,black,transparent)]"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.coverImage.large ?? a.coverImage.extraLarge ?? ""}
                    alt=""
                    loading="lazy"
                    className="relative h-24 w-16 shrink-0 rounded-lg bg-white/10 object-cover sm:h-28 sm:w-[4.75rem]"
                  />
                  <div className="relative min-w-0 flex-1 py-2">
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)} />
                      <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-white sm:text-base">
                        {animeTitle(a)}
                      </h3>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 pl-4 text-[0.65rem] leading-none text-white/70 sm:gap-1.5 sm:text-xs">
                      {a.format && <span className={pill}>{a.format.replace("_", " ")}</span>}
                      {a.seasonYear && (
                        <span className={pill}>
                          <CalendarDays className="size-3 sm:size-3.5" />
                          {a.seasonYear}
                        </span>
                      )}
                      {eps ? (
                        <span className={pill}>
                          <Captions className="size-3 sm:size-3.5" />
                          {eps}
                        </span>
                      ) : null}
                      {a.averageScore ? (
                        <span className={pill}>
                          <Star className="size-3 sm:size-3.5" />
                          {a.averageScore}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {items && items.length > PANEL_STEP && (
        <button
          type="button"
          aria-label={shown >= items.length ? "Show less" : "Show more"}
          onClick={() => setShown((n) => (n >= items.length ? PANEL_STEP : items.length))}
          className="mt-2 grid h-10 w-full place-items-center rounded-xl bg-white/[0.05] text-white/80 transition-colors hover:bg-white/10"
        >
          <ChevronDown className={cn("size-5 transition-transform", shown >= items.length && "rotate-180")} />
        </button>
      )}
    </section>
  )
}

function RankedLists() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-10 sm:px-8 lg:grid-cols-2 lg:gap-6">
      <RankedPanel title="Top Airing" dot="bg-green-500" load={getTopAiring} />
      <RankedPanel title="Upcoming" dot="bg-orange-400" load={getUpcoming} />
    </div>
  )
}

/* ----------------------------------- page ----------------------------------- */

export function HomeApp() {
  const [trending, setTrending] = React.useState<Anime[] | null>(null)
  const [heroIndex, setHeroIndex] = React.useState(0)
  const [heroRetry, setHeroRetry] = React.useState(0)

  React.useEffect(() => {
    if (!trending || trending.length < 2) return
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % trending.length), 8000)
    return () => clearInterval(t)
  }, [trending, heroIndex])

  React.useEffect(() => {
    const ctrl = new AbortController()
    getTrending(ctrl.signal)
      .then(setTrending)
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setTrending([])
      })
    return () => ctrl.abort()
  }, [heroRetry])

  return (
    <div className="relative min-h-svh overflow-x-clip bg-[#121113] text-[#eeeef0]">
      <SiteHeader />

      <main>
        <Hero
          items={trending}
          index={heroIndex}
          setIndex={setHeroIndex}
          onRetry={() => {
            setTrending(null)
            setHeroRetry((n) => n + 1)
          }}
        />
        <ContinueWatching />
        <LatestEpisodes />
        <RankedLists />
      </main>

      <SiteFooter />
    </div>
  )
}
