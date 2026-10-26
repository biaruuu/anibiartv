"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowDownUp,
  Captions,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  ListVideo,
  Mic,
  Play,
  Plus,
  RotateCcw,
  X,
  Zap,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { SiteFooter, SiteHeader } from "@/components/site-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { VideoPlayer, type VideoTrack } from "@/components/ui/video-player"
import {
  animeTitle,
  getAnimeDetail,
  getFranchise,
  infoHref,
  type Detail,
  type FranchiseGraph,
} from "@/lib/anilist"
import type { EpisodesPayload, WatchEpisode, WatchPayload } from "@/lib/anivexa"
import { loadHistory, loadList, localList, saveProgress, toggleList } from "@/lib/library"
import { cn } from "@/lib/utils"

type Audio = "sub" | "dub"

/* ------------------------------ small helpers ------------------------------ */

const PREFS_KEY = "anibiar:watch-prefs"

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode: settings just won't persist */
  }
}

function useMedia(query: string) {
  const [match, setMatch] = React.useState(false)
  React.useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    on()
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [query])
  return match
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

const cleanText = (html: string | null | undefined) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const SEASON_NAME: Record<string, string> = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" }

/* ------------------------------ dropdown menu ------------------------------ */

function Menu({
  trigger,
  children,
  align = "left",
  className,
  label,
}: {
  trigger: (open: boolean) => React.ReactNode
  children: (close: () => void) => React.ReactNode
  align?: "left" | "right"
  className?: string
  label: string
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn("sm:relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/[0.03] px-3.5 text-sm text-[#eeeef0] transition-colors hover:bg-white/[0.07] sm:h-12"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute inset-x-0 top-full z-30 mt-2 max-h-[min(20rem,60svh)] overflow-y-auto overscroll-contain rounded-xl border border-white/20 bg-[#1b1a1e]/95 py-1.5 shadow-2xl backdrop-blur-xl",
            "sm:inset-x-auto sm:w-max sm:max-w-[22rem] sm:min-w-full",
            align === "right" ? "sm:right-0" : "sm:left-0"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

const MenuHeading = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 pt-2 pb-1 text-[0.7rem] font-semibold tracking-[0.12em] text-white/50 uppercase">{children}</p>
)

function Badge({ tone, children }: { tone: "soft" | "hard"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[0.65rem] leading-none font-medium",
        tone === "soft" ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : "border-orange-400/40 bg-orange-400/10 text-orange-300"
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------ seasons ------------------------------ */

type SeasonCard = {
  id: number
  label: string
  part: string | null
  year: number | null
  image: string
  current: boolean
}

/** Seasons come from AniList's PREQUEL/SEQUEL links, so they are real, not guessed. */
function buildSeasons(a: Detail, graph: FranchiseGraph | null): SeasonCard[] {
  const before = new Map<number, number[]>()
  const after = new Map<number, number[]>()
  const add = (m: Map<number, number[]>, k: number, v: number) => m.set(k, [...(m.get(k) ?? []), v])
  for (const l of graph?.links ?? []) {
    if (l.type === "SEQUEL") {
      add(before, l.to, l.from)
      add(after, l.from, l.to)
    } else {
      add(before, l.from, l.to)
      add(after, l.to, l.from)
    }
  }
  const reach = (start: number, adj: Map<number, number[]>) => {
    const seen = new Set<number>()
    const stack = [start]
    while (stack.length) {
      for (const n of adj.get(stack.pop()!) ?? []) {
        if (!seen.has(n)) {
          seen.add(n)
          stack.push(n)
        }
      }
    }
    return seen
  }
  const prequels = reach(a.id, before)
  const sequels = reach(a.id, after)
  const key = (d: { year: number | null; month?: number | null; day?: number | null }) =>
    (d.year ?? 9999) * 10000 + (d.month ?? 0) * 100 + (d.day ?? 0)

  const all = [
    { node: a as Pick<Detail, "id" | "title" | "coverImage" | "format" | "seasonYear">, date: key(a.startDate) },
    ...(graph?.entries ?? [])
      .filter((e) => prequels.has(e.node.id) || sequels.has(e.node.id))
      .map((e) => ({ node: e.node, date: key(e.node.startDate) })),
  ]
    .filter((e) => e.node.format === "TV" || e.node.format === "ONA" || e.node.format === "TV_SHORT")
    .sort((x, y) => x.date - y.date)

  let season = 0
  return all.map(({ node }) => {
    const title = `${node.title.english ?? ""} ${node.title.romaji ?? ""}`
    const part = Number(title.match(/\b(?:part|cour)\s*(\d+)/i)?.[1]) || null
    // "Part 2" of something continues the same season as the entry before it.
    if (!(part && part > 1 && season > 0)) season += 1
    return {
      id: node.id,
      label: `Season ${season}`,
      part: part ? `Part ${part}` : null,
      year: node.seasonYear ?? (node as { startDate?: { year: number | null } }).startDate?.year ?? null,
      image: node.coverImage.extraLarge ?? node.coverImage.large ?? "",
      current: node.id === a.id,
    }
  })
}

function Seasons({ items }: { items: SeasonCard[] }) {
  return (
    <section className="rounded-3xl bg-[#18171a] p-3.5 sm:p-5">
      <h2 className="mb-3.5 flex items-center gap-3 px-1 text-lg font-bold sm:text-xl">
        <ListVideo className="size-5 text-white/80" />
        Seasons
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {items.map((s, i) => {
          const last = i === items.length - 1 && items.length % 2 === 1
          return (
            <Link
              key={s.id}
              href={`/watch/${s.id}`}
              aria-current={s.current ? "page" : undefined}
              className={cn(
                "group relative grid h-20 place-items-center overflow-hidden rounded-xl border text-center sm:h-24",
                s.current ? "border-white/70" : "border-white/20 hover:border-white/50",
                last && "col-span-2 sm:col-span-1"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-black/45" />
              {s.current && (
                <span className="absolute top-1.5 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[0.65rem] font-semibold">
                  Current
                </span>
              )}
              <span className="relative px-2 leading-tight [text-shadow:0_1px_6px_rgb(0_0_0/0.8)]">
                <span className="block text-base font-extrabold sm:text-lg">{s.label}</span>
                {s.part && <span className="block text-xs text-white/80 sm:text-sm">{s.part}</span>}
                {s.year && <span className="block text-xs text-white/80 sm:text-sm">{s.year}</span>}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------ episode list ------------------------------ */

function EpisodePanel({
  title,
  episodes,
  current,
  audio,
  fallbackImage,
  hasDub,
  onSelect,
  onClose,
  className,
}: {
  title: string
  episodes: WatchEpisode[]
  current: number
  audio: Audio
  fallbackImage: string | null
  hasDub: Set<number>
  onSelect: (n: number) => void
  onClose?: () => void
  className?: string
}) {
  const [desc, setDesc] = React.useState(true)
  const [grid, setGrid] = React.useState(false)
  const [reverse, setReverse] = React.useState(false)
  const activeRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const sorted = React.useMemo(() => (reverse ? [...episodes].reverse() : episodes), [episodes, reverse])
  const index = Math.max(0, episodes.findIndex((e) => e.number === current)) + 1

  // Keep the playing episode in view inside the list (never scrolls the page).
  React.useEffect(() => {
    const list = listRef.current
    const el = activeRef.current
    if (!list || !el) return
    list.scrollTo({ top: el.offsetTop - list.offsetTop - 8, behavior: "smooth" })
  }, [current, reverse, grid])

  const iconBtn =
    "grid size-10 place-items-center rounded-xl border border-white/20 text-white/90 transition-colors hover:bg-white/10 sm:size-11"

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#18171a]", className)}>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close episode list" className="grid h-6 place-items-center">
          <span className="h-1 w-10 rounded-full bg-white/30" />
        </button>
      )}
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-bold sm:text-lg">{title}</h2>
        <span className="shrink-0 pr-1 text-sm text-white/70 tabular-nums">
          {index}/{episodes.length}
        </span>
        <button type="button" aria-label="Reverse order" onClick={() => setReverse((r) => !r)} className={iconBtn}>
          <ArrowDownUp className="size-[1.1rem]" />
        </button>
        <button
          type="button"
          aria-label={desc ? "Hide synopses" : "Show synopses"}
          aria-pressed={desc}
          onClick={() => setDesc((d) => !d)}
          className={iconBtn}
        >
          {desc ? <Eye className="size-[1.1rem]" /> : <EyeOff className="size-[1.1rem]" />}
        </button>
        <button
          type="button"
          aria-label={grid ? "List view" : "Grid view"}
          onClick={() => setGrid((g) => !g)}
          className={iconBtn}
        >
          {grid ? <List className="size-[1.1rem]" /> : <LayoutGrid className="size-[1.1rem]" />}
        </button>
      </header>

      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
        {grid ? (
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
            {sorted.map((e) => (
              <button
                key={e.number}
                ref={e.number === current ? activeRef : undefined}
                type="button"
                onClick={() => onSelect(e.number)}
                aria-current={e.number === current ? "true" : undefined}
                title={e.title}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold tabular-nums transition-colors",
                  e.number === current
                    ? "border-white/70 bg-white/15"
                    : "border-white/15 hover:border-white/40 hover:bg-white/5"
                )}
              >
                {e.number}
              </button>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((e) => {
              const active = e.number === current
              const date = formatDate(e.airDate)
              const image = e.image ?? fallbackImage
              return (
                <li key={e.number}>
                  <button
                    ref={active ? activeRef : undefined}
                    type="button"
                    onClick={() => onSelect(e.number)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3 rounded-2xl border p-1.5 text-left transition-colors",
                      active ? "border-white/60 bg-white/10" : "border-white/15 hover:border-white/35 hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="relative aspect-[1.55] w-32 shrink-0 overflow-hidden rounded-xl bg-white/5 sm:w-36">
                      {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" loading="lazy" className="size-full object-cover" />
                      )}
                      {active && (
                        <span className="absolute inset-0 grid place-items-center bg-black/40">
                          <Play className="size-8 fill-white text-white" />
                        </span>
                      )}
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[0.7rem] font-bold">
                        EP {e.number}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col py-0.5 pr-1.5">
                      <span className={cn("line-clamp-1 text-sm font-bold sm:text-[0.95rem]", active && "text-white")}>
                        {e.title}
                      </span>
                      {desc && e.description && (
                        <span className="mt-1 line-clamp-3 text-xs leading-snug text-[#b5b2bc]">{e.description}</span>
                      )}
                      <span className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-xs text-[#b5b2bc]">
                        <span className="flex items-center gap-2">
                          <Captions className="size-4" aria-label="Subbed" />
                          {hasDub.has(e.number) && <Mic className="size-4" aria-label="Dubbed" />}
                        </span>
                        {date && <span className="tabular-nums">{date}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {audio === "dub" && (
          <p className="px-2 pt-3 text-center text-xs text-[#b5b2bc]">Showing episodes that have an English dub.</p>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ page ------------------------------ */

type Prefs = { autoplay: boolean; autoNext: boolean; autoSkip: boolean }

export function WatchApp({ id }: { id: number }) {
  const params = useSearchParams()
  const { user, ready: authReady } = useAuth()
  const isDesktop = useMedia("(min-width: 1024px)")

  const [anime, setAnime] = React.useState<Detail | null>(null)
  const [graph, setGraph] = React.useState<FranchiseGraph | null>(null)
  const [eps, setEps] = React.useState<EpisodesPayload | null>(null)
  const [epsError, setEpsError] = React.useState<string | null>(null)
  const [epsTry, setEpsTry] = React.useState(0)

  const [audio, setAudio] = React.useState<Audio>(params.get("audio") === "dub" ? "dub" : "sub")
  const [ep, setEp] = React.useState<number>(Number(params.get("ep")) || 1)
  const [watch, setWatch] = React.useState<WatchPayload | null>(null)
  const [watchError, setWatchError] = React.useState<string | null>(null)
  const [watchTry, setWatchTry] = React.useState(0)
  // The server the viewer picked, by name, so it stays selected from episode to episode.
  const [streamName, setStreamName] = React.useState<string | null>(null)

  const [prefs, setPrefs] = React.useState<Prefs>({ autoplay: true, autoNext: true, autoSkip: true })
  const [episodesOpen, setEpisodesOpen] = React.useState(false)
  const [synopsis, setSynopsis] = React.useState<"anime" | "episode">("anime")
  const [expanded, setExpanded] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setPrefs(readJson<Prefs>(PREFS_KEY, { autoplay: true, autoNext: true, autoSkip: true }))
    setSaved(localList().some((l) => l.animeId === id))
  }, [id])
  React.useEffect(() => {
    if (!authReady) return
    let alive = true
    loadList(user?.id).then((l) => alive && setSaved(l.some((x) => x.animeId === id)))
    return () => {
      alive = false
    }
  }, [id, user?.id, authReady])

  const updatePrefs = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch }
      writeJson(PREFS_KEY, next)
      return next
    })

  const toggleSaved = async () => {
    const now = await toggleList(
      { animeId: id, title: anime ? animeTitle(anime) : (eps?.title ?? `Anime ${id}`), image: anime?.coverImage.large ?? anime?.coverImage.extraLarge ?? null },
      user?.id
    )
    setSaved(now)
  }

  /* anime details + seasons (AniList) */
  React.useEffect(() => {
    const c = new AbortController()
    getAnimeDetail(id, c.signal)
      .then((a) => setAnime(a))
      .catch(() => {})
    getFranchise(id, c.signal)
      .then(setGraph)
      .catch(() => {})
    return () => c.abort()
  }, [id])

  /* episode list (ani.pm through the Anivexa API) */
  React.useEffect(() => {
    const c = new AbortController()
    setEps(null)
    setEpsError(null)
    fetch(`/api/anime/${id}/episodes`, { signal: c.signal })
      .then(async (r) => {
        const data = await r.json().catch(() => null)
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`)
        return data as EpisodesPayload
      })
      .then(setEps)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setEpsError(e.message)
      })
    return () => c.abort()
  }, [id, epsTry])

  const list = React.useMemo(() => (eps ? (audio === "dub" && eps.dub.length ? eps.dub : eps.sub) : []), [eps, audio])
  const dubSet = React.useMemo(() => new Set(eps?.dub.map((e) => e.number) ?? []), [eps])
  const subSet = React.useMemo(() => new Set(eps?.sub.map((e) => e.number) ?? []), [eps])

  // Fall back to a sensible audio and episode when the requested ones don't exist.
  React.useEffect(() => {
    if (!eps) return
    if (audio === "dub" && !eps.dub.length) setAudio("sub")
    if (audio === "sub" && !eps.sub.length && eps.dub.length) setAudio("dub")
  }, [eps, audio])
  React.useEffect(() => {
    if (list.length && !list.some((e) => e.number === ep)) setEp(list[0].number)
  }, [list, ep])

  const currentEp = list.find((e) => e.number === ep) ?? null
  const position = list.findIndex((e) => e.number === ep)
  const prev = position > 0 ? list[position - 1] : null
  const next = position >= 0 && position < list.length - 1 ? list[position + 1] : null

  // Keep the address bar in step so a refresh or a shared link opens the same episode.
  React.useEffect(() => {
    if (!list.length) return
    window.history.replaceState(null, "", `/watch/${id}?ep=${ep}${audio === "dub" ? "&audio=dub" : ""}`)
  }, [id, ep, audio, list.length])

  /* stream sources for the chosen episode */
  React.useEffect(() => {
    if (!currentEp) return
    const c = new AbortController()
    setWatchError(null)
    fetch(`/api/anime/${id}/watch?audio=${audio}&ep=${currentEp.number}&p=${currentEp.providers.join(",")}`, { signal: c.signal })
      .then(async (r) => {
        const data = await r.json().catch(() => null)
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`)
        return data as WatchPayload
      })
      .then((w) => {
        setWatch(w)
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setWatchError(e.message)
      })
    return () => c.abort()
  }, [id, audio, currentEp?.number, watchTry]) // eslint-disable-line react-hooks/exhaustive-deps

  const stream = watch?.streams.find((s) => s.name === streamName) ?? watch?.streams[0] ?? null

  // Intro / outro times: the server's own when it has them, otherwise the backup list (AniSkip).
  const [backup, setBackup] = React.useState<{ intro: { start: number; end: number } | null; outro: { start: number; end: number } | null; length: number | null } | null>(null)
  const malId = anime?.idMal ?? null
  const epNumber = currentEp?.number ?? null
  React.useEffect(() => {
    setBackup(null)
    if (!malId || !epNumber) return
    const c = new AbortController()
    fetch(`/api/skip?mal=${malId}&ep=${epNumber}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setBackup)
      .catch(() => {})
    return () => c.abort()
  }, [malId, epNumber])
  const own = Boolean(stream?.intro || stream?.outro)
  const skip = own
    ? { intro: stream?.intro ?? null, outro: stream?.outro ?? null, length: null }
    : { intro: backup?.intro ?? null, outro: backup?.outro ?? null, length: backup?.length ?? null }

  const ready = !!watch && watch.episode === currentEp?.number && watch.audio === audio

  // Continue Watching: where this viewer stopped in this episode (read once per episode).
  const [resumeAt, setResumeAt] = React.useState<number | null>(null)
  React.useEffect(() => {
    setResumeAt(null)
    if (!authReady || !epNumber) return
    let alive = true
    loadHistory(user?.id).then((h) => {
      const mine = h.find((x) => x.animeId === id && x.episode === epNumber)
      if (alive && mine && mine.position > 5) setResumeAt(mine.position)
    })
    return () => {
      alive = false
    }
  }, [id, epNumber, user?.id, authReady])

  const remember = (position: number, duration: number, episode = epNumber, forAudio = audio) => {
    if (!episode) return
    void saveProgress(
      {
        animeId: id,
        episode,
        audio: forAudio,
        position,
        duration,
        title: anime ? animeTitle(anime) : (eps?.title ?? `Anime ${id}`),
        image: anime?.bannerImage ?? currentEp?.image ?? anime?.coverImage.extraLarge ?? null,
        totalEpisodes: list.length ? list[list.length - 1].number : (anime?.episodes ?? null),
      },
      user?.id
    )
  }

  const tracks = React.useMemo<VideoTrack[]>(() => {
    if (!stream || stream.kind === "hard") return []
    const rank = (t: { label: string; srclang: string; default: boolean }) =>
      /^en/i.test(t.srclang) || /english/i.test(t.label) ? 0 : t.default ? 1 : 2
    return [...stream.subtitles]
      .sort((a, b) => rank(a) - rank(b))
      .map((t) => ({ id: t.src, srclang: t.srclang, label: t.label, src: t.src }))
  }, [stream])

  /* page text */
  const name = anime ? animeTitle(anime) : (eps?.title ?? "Loading…")
  const art = currentEp?.image ?? anime?.bannerImage ?? anime?.coverImage.extraLarge ?? null
  const poster = currentEp?.image ?? anime?.bannerImage ?? undefined
  const seasons = React.useMemo(() => (anime ? buildSeasons(anime, graph) : []), [anime, graph])
  const when = anime
    ? [anime.season ? SEASON_NAME[anime.season] : null, anime.seasonYear ?? anime.startDate.year].filter(Boolean).join(" ")
    : ""
  const description = cleanText(anime?.description)
  const shown = synopsis === "episode" && currentEp?.description ? currentEp.description : description

  React.useEffect(() => {
    document.title = currentEp ? `${name} · Episode ${currentEp.number} · AniBiar TV` : `${name} · AniBiar TV`
  }, [name, currentEp])

  const select = (n: number) => {
    setEp(n)
    setSynopsis("anime")
    setEpisodesOpen(false)
    if (!isDesktop) window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const panelProps = {
    title: name,
    episodes: list,
    current: ep,
    audio,
    fallbackImage: anime?.bannerImage ?? anime?.coverImage.large ?? null,
    hasDub: dubSet,
    onSelect: select,
  }

  /* ------------------------------ render ------------------------------ */
  return (
    <div className="min-h-svh overflow-x-clip bg-[#121113] text-[#eeeef0]">
      <SiteHeader />

      {/* Blurred artwork behind the top of the page, like Miruro */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden">
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="size-full scale-125 object-cover opacity-50 blur-2xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#121113]/20 via-[#121113]/70 to-[#121113]" />
      </div>

      <main className="relative mx-auto w-full max-w-[96rem] px-0 pt-14 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-6">
          <div className="min-w-0">
            {/* Player */}
            <div className="relative">
              {stream ? (
                <VideoPlayer
                  src={stream.src}
                  type={stream.format}
                  onFail={() => {
                    // Try the next server automatically when this one can't play.
                    const all = watch?.streams ?? []
                    const at = all.findIndex((x) => x.id === stream.id)
                    if (at >= 0 && at < all.length - 1) setStreamName(all[at + 1].name)
                  }}
                  poster={poster}
                  title={currentEp ? `${name} · Episode ${currentEp.number}` : name}
                  tracks={tracks}
                  autoPlay={prefs.autoplay}
                  autoplayOption={{ value: prefs.autoplay, onChange: (v) => updatePrefs({ autoplay: v }) }}
                  autoNextOption={{ value: prefs.autoNext, onChange: (v) => updatePrefs({ autoNext: v }) }}
                  autoSkipOption={{ value: prefs.autoSkip, onChange: (v) => updatePrefs({ autoSkip: v }) }}
                  intro={skip.intro}
                  outro={skip.outro}
                  skipLength={skip.length}
                  startAt={resumeAt}
                  onTime={(t, d) => remember(t, d)}
                  className="rounded-none border-x-0 sm:rounded-2xl sm:border-x"
                  onEnded={() => {
                    // Watched to the end: Continue Watching should point at the next episode.
                    if (next) remember(0, 0, next.number)
                    else remember(1, 1)
                    if (prefs.autoNext && next) select(next.number)
                  }}
                />
              ) : (
                <div className="aspect-video w-full bg-black sm:rounded-2xl sm:border sm:border-white/10" />
              )}
              {(!stream || !ready) && (
                <div className="absolute inset-0 z-20 grid place-items-center overflow-hidden bg-black/85 sm:rounded-2xl">
                  {poster && !stream && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-30 blur-sm" />
                  )}
                  <div className="relative flex max-w-sm flex-col items-center gap-3 px-6 text-center">
                    {epsError || watchError ? (
                      <>
                        <CircleAlert className="size-8 text-white/80" />
                        <p className="text-sm font-semibold">Couldn&apos;t load this episode</p>
                        <p className="text-xs text-white/70">{watchError ?? epsError}</p>
                        <button
                          type="button"
                          onClick={() => (epsError ? setEpsTry((n) => n + 1) : setWatchTry((n) => n + 1))}
                          className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/85"
                        >
                          <RotateCcw className="size-3.5" />
                          Try again
                        </button>
                      </>
                    ) : (
                      <>
                        <Spinner className="size-7" />
                        <p className="text-xs text-white/70">{eps ? "Finding the best stream…" : "Loading episodes…"}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile episode drawer, right under the player like Miruro */}
            {!isDesktop && episodesOpen && eps && (
              <div ref={panelRef} className="mt-3 px-3 sm:px-0">
                <EpisodePanel {...panelProps} className="max-h-[60svh]" onClose={() => setEpisodesOpen(false)} />
              </div>
            )}

            <div className="space-y-4 px-3.5 pt-4 sm:space-y-5 sm:px-0 sm:pt-5">
              {/* Episode heading */}
              <div className="space-y-1.5">
                <div className="text-sm text-[#b5b2bc]">
                  {currentEp ? (
                    <>
                      Episode {currentEp.number}
                      {formatDate(currentEp.airDate) && <> · {formatDate(currentEp.airDate)}</>}
                    </>
                  ) : (
                    <Skeleton className="h-4 w-40" />
                  )}
                </div>
                {currentEp ? (
                  <h1 className="text-xl leading-tight font-extrabold text-balance sm:text-3xl">{currentEp.title}</h1>
                ) : (
                  <Skeleton className="h-7 w-3/4" />
                )}
              </div>

              {/* Audio, server, options */}
              <div className="relative grid grid-cols-2 gap-2.5">
                <Menu
                  label="Audio"
                  trigger={(open) => (
                    <>
                      <span className="flex items-center gap-2.5">
                        {audio === "sub" ? <Captions className="size-5" /> : <Mic className="size-5" />}
                        <span className="font-medium">{audio === "sub" ? "Sub" : "Dub"}</span>
                      </span>
                      <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                    </>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuHeading>Audio</MenuHeading>
                      {(["sub", "dub"] as const).map((a) => {
                        const available = a === "sub" ? !!eps?.sub.length : !!eps?.dub.length
                        return (
                          <button
                            key={a}
                            type="button"
                            role="menuitemradio"
                            aria-checked={audio === a}
                            disabled={!available}
                            onClick={() => {
                              setAudio(a)
                              close()
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            {a === "sub" ? <Captions className="size-5" /> : <Mic className="size-5" />}
                            <span className="flex-1 pr-8 text-base">{a === "sub" ? "Sub" : "Dub"}</span>
                            {!available && <span className="text-xs text-white/60">Unavailable</span>}
                            {audio === a && available && <Check className="size-5" />}
                          </button>
                        )
                      })}
                    </>
                  )}
                </Menu>

                <Menu
                  label="Server"
                  trigger={(open) => (
                    <>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Zap className="size-5 shrink-0" />
                        <span className="truncate font-medium">{stream?.name ?? "Server"}</span>
                      </span>
                      <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
                    </>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuHeading>Provider</MenuHeading>
                      {watch?.streams.length ? (
                        watch.streams.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={stream?.id === s.id}
                            onClick={() => {
                              setStreamName(s.name)
                              close()
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/10"
                          >
                            <Zap className="size-5" />
                            <span className="min-w-0 flex-1 truncate text-base">{s.name}</span>
                            {audio === "sub" && <Badge tone={s.kind}>{s.kind === "soft" ? "s-sub" : "h-sub"}</Badge>}
                            <span className="grid w-5 place-items-center">{stream?.id === s.id && <Check className="size-5" />}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-4 py-2.5 text-sm text-white/60">{watchError ? "No server answered" : "Loading…"}</p>
                      )}
                    </>
                  )}
                </Menu>
              </div>

              {/* Previous / Episodes / Next */}
              <div className="grid h-11 grid-cols-[1fr_auto_1fr] overflow-hidden rounded-xl border border-white/20 sm:h-12">
                <button
                  type="button"
                  disabled={!prev}
                  onClick={() => prev && select(prev.number)}
                  className="flex items-center gap-2 px-3.5 text-sm text-[#b5b2bc] hover:bg-white/5 enabled:hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                  {prev ? `Ep ${prev.number}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isDesktop) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                    else setEpisodesOpen((o) => !o)
                  }}
                  className="flex items-center gap-2 border-x border-white/20 px-5 text-sm font-semibold hover:bg-white/5"
                >
                  <ListVideo className="size-4 lg:hidden" />
                  Episodes
                </button>
                <button
                  type="button"
                  disabled={!next}
                  onClick={() => next && select(next.number)}
                  className="flex items-center justify-end gap-2 px-3.5 text-sm text-[#b5b2bc] hover:bg-white/5 enabled:hover:text-white disabled:opacity-40"
                >
                  {next ? `Ep ${next.number}` : ""}
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Anime card */}
              <section className="rounded-3xl bg-[#18171a] p-3.5 sm:p-5">
                <div className="flex gap-3.5 sm:gap-5">
                  <Link
                    href={infoHref({ id })}
                    className="relative aspect-[2/3] w-[4.8rem] shrink-0 overflow-hidden rounded-xl bg-white/5 sm:w-28"
                  >
                    {anime && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={anime.coverImage.extraLarge ?? anime.coverImage.large ?? undefined} alt="" className="size-full object-cover" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                    <Link href={infoHref({ id })} className="line-clamp-2 text-lg leading-snug font-bold hover:underline sm:text-2xl">
                      {name}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#b5b2bc]">
                      {when && <span>{when}</span>}
                      {eps && (
                        <>
                          {when && <span aria-hidden>·</span>}
                          <span className="inline-flex items-center gap-1.5">
                            <Captions className="size-4" />
                            {eps.sub.length}
                          </span>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Mic className="size-4" />
                            {eps.dub.length}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleSaved}
                    aria-label={saved ? "Remove from my list" : "Add to my list"}
                    aria-pressed={saved}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/25 bg-white/[0.06] transition-colors hover:bg-white/15 sm:size-12"
                  >
                    {saved ? <Check className="size-5" /> : <Plus className="size-5" />}
                  </button>
                </div>

                {shown ? (
                  <p
                    className={cn(
                      "mt-3.5 leading-relaxed whitespace-pre-line text-[#b5b2bc] sm:text-base",
                      expanded ? "" : "line-clamp-2"
                    )}
                  >
                    {shown}
                  </p>
                ) : (
                  <Skeleton className="mt-3.5 h-10 w-full" />
                )}
                <div className="mt-3 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    disabled={!currentEp?.description}
                    onClick={() => setSynopsis((s) => (s === "anime" ? "episode" : "anime"))}
                    className="text-[#b5b2bc] enabled:hover:text-white disabled:opacity-40"
                  >
                    {synopsis === "anime" ? "Episode synopsis" : "Anime synopsis"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded((x) => !x)}
                    className="inline-flex items-center gap-1.5 font-medium"
                  >
                    {expanded ? "Show less" : "Show more"}
                    <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                  </button>
                </div>
              </section>

              {seasons.length > 1 && <Seasons items={seasons} />}
            </div>
          </div>

          {/* Desktop episode list */}
          {isDesktop && (
            <aside ref={panelRef} className="sticky top-20 min-w-0">
              {eps ? (
                <EpisodePanel {...panelProps} className="max-h-[calc(100svh-6.5rem)]" />
              ) : epsError ? (
                <div className="rounded-3xl border border-white/10 bg-[#18171a] p-6 text-center">
                  <CircleAlert className="mx-auto mb-2 size-6 text-white/70" />
                  <p className="text-sm font-semibold">Episodes unavailable</p>
                  <p className="mt-1 text-xs text-[#b5b2bc]">{epsError}</p>
                  <button
                    type="button"
                    onClick={() => setEpsTry((n) => n + 1)}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
                  >
                    <RotateCcw className="size-3.5" />
                    Try again
                  </button>
                </div>
              ) : (
                <div className="space-y-2 rounded-3xl border border-white/10 bg-[#18171a] p-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                  ))}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Not enough room on a phone for the drawer to show errors, so show them inline */}
        {!isDesktop && epsError && (
          <p className="mx-3.5 mt-4 flex items-center gap-2 rounded-xl border border-white/15 p-3 text-xs text-[#b5b2bc]">
            <X className="size-4 shrink-0" />
            {epsError}
          </p>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
