"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  ImageIcon,
  Play,
  Plus,
  Star,
  Subtitles,
  Tv,
} from "lucide-react"

import { SiteFooter, SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  animeTitle,
  formatName,
  getAnimeDetail,
  infoHref,
  type Detail,
  type Mini,
} from "@/lib/anilist"
import { getArtwork, type Artwork } from "@/lib/logos"
import { cn } from "@/lib/utils"

const stripHtml = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const pad = (n: number) => String(n).padStart(2, "0")
const dateStr = (d: { year: number | null; month: number | null; day: number | null }) =>
  d.year ? `${d.year}-${pad(d.month ?? 1)}-${pad(d.day ?? 1)}` : null
const shortDate = (d: { year: number | null; month: number | null; day: number | null }) =>
  d.year ? `${MONTHS[(d.month ?? 1) - 1]} ${d.day ?? 1}, ${d.year}` : null

const STATUS: Record<string, { label: string; color: string }> = {
  FINISHED: { label: "Finished", color: "text-blue-400" },
  RELEASING: { label: "Releasing", color: "text-green-400" },
  NOT_YET_RELEASED: { label: "Not yet released", color: "text-orange-400" },
  CANCELLED: { label: "Cancelled", color: "text-red-400" },
  HIATUS: { label: "On hiatus", color: "text-yellow-400" },
}

const RELATION_LABEL: Record<string, string> = {
  PREQUEL: "Prequel",
  SEQUEL: "Sequel",
  PARENT: "Parent story",
  SIDE_STORY: "Side story",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Alternative",
  ADAPTATION: "Adaptation",
  SUMMARY: "Summary",
  CHARACTER: "Character",
  COMPILATION: "Compilation",
  CONTAINS: "Contains",
  SOURCE: "Source",
  OTHER: "Related",
}

const PILL = "inline-flex items-center gap-1 rounded bg-white/[0.07] px-2 py-1.5 text-xs text-white/70 sm:text-sm"

/* --------------------------------- pieces --------------------------------- */

function SectionTitle({
  title,
  sub,
  right,
}: {
  title: string
  sub?: string
  right?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-white/60">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  label: string
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-36 appearance-none rounded-lg border border-white/25 bg-transparent py-0 pr-9 pl-4 text-sm text-white/80 outline-none focus-visible:border-white/60 sm:min-w-44"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#17181b] text-white">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/70" />
    </label>
  )
}

function PosterCard({
  anime,
  badge,
  label,
  labelClass,
  current,
}: {
  anime: Mini
  badge?: string
  label?: string
  labelClass?: string
  current?: boolean
}) {
  const body = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={anime.coverImage.extraLarge ?? anime.coverImage.large ?? ""}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {badge && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
            {current && <Check className="size-3.5" />}
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {anime.episodes ? (
          <span className={PILL}>
            <Subtitles className="size-3.5" />
            {anime.episodes}
          </span>
        ) : null}
        {anime.format && <span className={PILL}>{formatName(anime.format).toUpperCase()}</span>}
        {anime.seasonYear && <span className={PILL}>{anime.seasonYear}</span>}
      </div>
      {label && <p className={cn("mt-2 text-sm font-semibold", labelClass)}>{label}</p>}
      <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-medium text-white sm:text-base">
        {animeTitle(anime as never)}
      </h3>
    </>
  )
  // Manga and novels are not on this site; only anime link to an info page.
  return current || (anime as Mini & { type?: string }).type === "MANGA" ||
    (anime as Mini & { type?: string }).type === "NOVEL" ? (
    <div className="min-w-0">{body}</div>
  ) : (
    <Link href={infoHref(anime)} className="group block min-w-0">
      {body}
    </Link>
  )
}

const GRID = "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"

/* ---------------------------------- page ---------------------------------- */

export function InfoApp({ id }: { id: number }) {
  const [a, setA] = React.useState<Detail | null | undefined>(undefined)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const ctrl = new AbortController()
    setA(undefined)
    setError(null)
    getAnimeDetail(id, ctrl.signal)
      .then((d) => {
        setA(d)
        if (d) document.title = `${animeTitle(d)} | AniBiar TV`
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message)
      })
    return () => ctrl.abort()
  }, [id])

  return (
    <div className="min-h-svh overflow-x-clip bg-[#111214] font-poppins text-white">
      <SiteHeader />
      {error || a === null ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 pt-40 pb-24 text-center">
          <CircleAlert className="size-8 text-red-400" />
          <p className="text-white/80">{error ?? "This anime could not be found."}</p>
          <Button asChild variant="secondary">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      ) : a === undefined ? (
        <div className="mx-auto max-w-7xl space-y-6 px-4 pt-24 sm:px-8">
          <div className="flex gap-4">
            <Skeleton className="h-40 w-[6.5rem] shrink-0 rounded-xl bg-white/5 sm:h-64 sm:w-44" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-3/4 bg-white/5" />
              <Skeleton className="h-5 w-1/2 bg-white/5" />
            </div>
          </div>
          <Skeleton className="h-10 w-full bg-white/5" />
          <Skeleton className="h-28 w-full bg-white/5" />
        </div>
      ) : (
        <Content a={a} />
      )}
      <SiteFooter />
    </div>
  )
}

function Content({ a }: { a: Detail }) {
  const title = animeTitle(a)
  const desc = stripHtml(a.description ?? "")
  const [more, setMore] = React.useState(false)
  const status = STATUS[a.status ?? ""]
  const season = a.season
    ? `${a.season[0]}${a.season.slice(1).toLowerCase()} ${a.seasonYear ?? ""}`.trim()
    : a.seasonYear
      ? String(a.seasonYear)
      : null
  const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : null
  const aired = [dateStr(a.startDate), a.status === "FINISHED" || a.endDate.year ? dateStr(a.endDate) : null]
    .filter(Boolean)
    .join(" - ")
  const studios = a.studios.edges
    .slice()
    .sort((x, y) => Number(y.isMain) - Number(x.isMain))
    .map((e) => e.node.name)
  const [allStudios, setAllStudios] = React.useState(false)
  const shownStudios = allStudios ? studios : studios.slice(0, 2)

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.bannerImage ?? a.coverImage.extraLarge ?? ""}
            alt=""
            className="size-full scale-110 object-cover blur-xl brightness-[0.45]"
          />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-4 pt-24 pb-10 sm:px-8 sm:pt-28">
          <div className="flex gap-4 sm:gap-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.coverImage.extraLarge ?? a.coverImage.large ?? ""}
              alt={title}
              className="h-40 w-[6.5rem] shrink-0 rounded-xl border border-white/20 bg-white/10 object-cover shadow-lg sm:h-72 sm:w-48"
            />
            <div className="min-w-0 flex-1 self-center sm:self-end">
              <h1 className="text-2xl leading-tight font-bold text-balance text-white sm:text-4xl">{title}</h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/75">
                {season && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-4" />
                    {season}
                  </span>
                )}
                {score && (
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="size-4" />
                    {score}
                  </span>
                )}
                {a.format && (
                  <span className="inline-flex items-center gap-1.5">
                    <Tv className="size-4" />
                    {formatName(a.format)}
                  </span>
                )}
                {a.duration && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {a.duration} min
                  </span>
                )}
              </div>
              <div className="mt-5 hidden max-w-md gap-3 sm:flex">
                <ActionButtons a={a} title={title} />
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-3 sm:hidden">
            <ActionButtons a={a} title={title} />
          </div>

          {desc && (
            <div className="mt-5 max-w-3xl">
              <p className={cn("text-sm leading-relaxed text-white/70 sm:text-base", !more && "line-clamp-4")}>
                {desc}
              </p>
              {desc.length > 200 && (
                <button
                  type="button"
                  onClick={() => setMore((m) => !m)}
                  className="mt-1.5 text-sm font-semibold text-white"
                >
                  {more ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-14 sm:px-8">
        {/* About */}
        <section className="max-w-3xl">
          <h2 className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl">About this anime</h2>
          <dl className="divide-y divide-transparent text-sm sm:text-base">
            <Row k="Status">
              <span className={cn("font-semibold", status?.color)}>{status?.label ?? "Unknown"}</span>
            </Row>
            {a.episodes ? <Row k="Episodes">{a.episodes}</Row> : null}
            {score && <Row k="AniList score">{score}</Row>}
            {a.meanScore ? <Row k="Mean score">{(a.meanScore / 10).toFixed(2)}</Row> : null}
            {aired && <Row k="Aired">{aired}</Row>}
            {a.popularity ? <Row k="Popularity">#{a.popularity.toLocaleString()}</Row> : null}
            {a.title.native && <Row k="Native">{a.title.native}</Row>}
          </dl>

          {a.genres && a.genres.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-white/60 sm:text-base">Genres</p>
              <div className="flex flex-wrap gap-2">
                {a.genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {studios.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-white/60 sm:text-base">Studios</p>
              <div className="flex flex-wrap gap-2">
                {shownStudios.map((s, i) => (
                  <span
                    key={s}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium",
                      i === 0 ? "bg-white/10" : "border border-white/25 text-white/80"
                    )}
                  >
                    {s}
                  </span>
                ))}
                {!allStudios && studios.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setAllStudios(true)}
                    className="rounded-full border border-white/25 px-4 py-1.5 text-sm text-white/80"
                  >
                    +{studios.length - 2} more
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={a.siteUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="AniList"
              className="grid size-11 place-items-center rounded-lg border border-white/25 text-sm font-bold hover:bg-white/10"
            >
              AL
            </a>
            {a.idMal && (
              <a
                href={`https://myanimelist.net/anime/${a.idMal}`}
                target="_blank"
                rel="noreferrer"
                aria-label="MyAnimeList"
                className="grid size-11 place-items-center rounded-lg border border-white/25 text-xs font-bold text-blue-300 hover:bg-white/10"
              >
                MAL
              </a>
            )}
            {a.externalLinks
              .filter((l) => l.icon)
              .slice(0, 12)
              .map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={l.site}
                  title={l.site}
                  className="grid size-11 place-items-center rounded-lg border border-white/25 hover:bg-white/10"
                  style={l.color ? { color: l.color } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.icon ?? ""} alt="" className="size-5 rounded-sm object-contain" />
                </a>
              ))}
          </div>
        </section>

        <Trailer a={a} title={title} />
        <Franchise a={a} />
        <Characters a={a} />
        <Gallery a={a} title={title} />
        <More a={a} />
      </div>
    </main>
  )
}

function ActionButtons({ a, title }: { a: Detail; title: string }) {
  return (
    <>
      <Button
        asChild
        className="h-11 flex-[1.4] rounded-lg bg-white text-sm font-semibold text-black hover:bg-white/90 sm:text-base"
      >
        <Link href={`/watch?title=${encodeURIComponent(title)}&ep=1`} aria-label={`Watch ${a.id}`}>
          <Play className="fill-current" />
          Watch Now
        </Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1 rounded-lg border-white/25 bg-white/[0.06] text-sm font-semibold text-white hover:bg-white/10 hover:text-white sm:text-base"
      >
        <Plus />
        Add to List
      </Button>
    </>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="shrink-0 text-white/60">{k}</dt>
      <dd className="min-w-0 text-right font-medium text-white">{children}</dd>
    </div>
  )
}

/* --------------------------------- trailer --------------------------------- */

function Trailer({ a, title }: { a: Detail; title: string }) {
  const [playing, setPlaying] = React.useState(false)
  const t = a.trailer
  if (!t || (t.site !== "youtube" && t.site !== "dailymotion")) return null
  const src =
    t.site === "youtube"
      ? `https://www.youtube.com/embed/${t.id}?autoplay=1&rel=0`
      : `https://www.dailymotion.com/embed/video/${t.id}?autoplay=1`
  const thumb = t.thumbnail ?? a.bannerImage ?? a.coverImage.extraLarge ?? ""
  return (
    <section className="max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl">Trailer</h2>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {playing ? (
          <iframe
            src={src}
            title={`${title} trailer`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Play trailer"
            className="group absolute inset-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="size-full object-cover brightness-75" />
            <span className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 transition-transform group-hover:scale-105 sm:size-20">
              <Play className="size-7 fill-white text-white sm:size-9" />
            </span>
          </button>
        )}
      </div>
    </section>
  )
}

/* --------------------------- franchise and related -------------------------- */

const FRANCHISE = new Set(["PREQUEL", "SEQUEL", "PARENT"])

function Franchise({ a }: { a: Detail }) {
  const [order, setOrder] = React.useState("Release order")

  const { show, related } = React.useMemo(() => {
    const seen = new Set<number>()
    const edges = a.relations.edges.filter((e) => {
      if (seen.has(e.node.id)) return false
      seen.add(e.node.id)
      return true
    })
    type Entry = { node: Mini & { type?: string; startDate?: { year: number | null } }; rel: string; current: boolean }
    const show: Entry[] = [
      { node: a, rel: "CURRENT", current: true },
      ...edges.filter((e) => e.node.type === "ANIME" && FRANCHISE.has(e.relationType)).map((e) => ({ node: e.node, rel: e.relationType, current: false })),
    ]
    const year = (e: Entry) => e.node.seasonYear ?? e.node.startDate?.year ?? 9999
    show.sort((x, y) => year(x) - year(y))
    const related = edges.filter((e) => !(e.node.type === "ANIME" && FRANCHISE.has(e.relationType)))
    return { show, related }
  }, [a])

  const shown = order === "Newest first" ? [...show].reverse() : show

  return (
    <>
      {show.length > 1 && (
        <section>
          <SectionTitle
            title="Show"
            sub={`${show.length} entries`}
            right={<Select label="Sort" value={order} onChange={setOrder} options={["Release order", "Newest first"]} />}
          />
          <div className={GRID}>
            {shown.map((e) => {
              const n = show.indexOf(e) + 1
              return (
                <PosterCard
                  key={e.node.id}
                  anime={e.node as Mini}
                  current={e.current}
                  badge={e.current ? "Current" : RELATION_LABEL[e.rel]}
                  label={`Season ${n}`}
                  labelClass={e.current ? "text-yellow-300" : "text-orange-400"}
                />
              )
            })}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <SectionTitle
            title="Related"
            sub="Side stories and franchise connections"
            right={<span className="shrink-0 text-sm text-white/60">{related.length} entries</span>}
          />
          <div className={GRID}>
            {related.map((e) => (
              <PosterCard
                key={e.node.id}
                anime={e.node as Mini}
                badge={RELATION_LABEL[e.relationType] ?? "Related"}
                label={RELATION_LABEL[e.relationType] ?? "Related"}
                labelClass={e.relationType === "ALTERNATIVE" ? "text-orange-300" : "text-amber-200"}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/* -------------------------------- characters -------------------------------- */

function Characters({ a }: { a: Detail }) {
  const edges = a.characters.edges
  const languages = React.useMemo(() => {
    const set = new Set<string>()
    edges.forEach((e) => e.voiceActors.forEach((v) => v.languageV2 && set.add(v.languageV2)))
    const list = [...set]
    list.sort((x, y) => (x === "Japanese" ? -1 : y === "Japanese" ? 1 : x.localeCompare(y)))
    return list.length ? list : ["Japanese"]
  }, [edges])
  const [lang, setLang] = React.useState(languages[0])
  const [all, setAll] = React.useState(false)
  if (edges.length === 0) return null
  const shown = all ? edges : edges.slice(0, 6)

  return (
    <section>
      <SectionTitle
        title="Characters"
        right={
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm text-white/60">{a.characters.pageInfo.total}</span>
            <Select label="Voice actor language" value={lang} onChange={setLang} options={languages} />
          </div>
        }
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((e) => {
          const va = e.voiceActors.find((v) => v.languageV2 === lang)
          return (
            <li
              key={e.node.id}
              className="flex h-[4.5rem] items-stretch overflow-hidden rounded-xl border border-white/20 bg-[#141517] sm:h-24"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.node.image.large ?? ""} alt="" loading="lazy" className="w-12 shrink-0 object-cover sm:w-16" />
              <div className="flex min-w-0 flex-1 flex-col justify-center px-3 sm:px-4">
                <p className="truncate text-sm font-semibold sm:text-base">{e.node.name.full}</p>
                <p className="text-xs text-white/60 capitalize sm:text-sm">{e.role.toLowerCase()}</p>
              </div>
              {va && (
                <>
                  <div className="flex min-w-0 max-w-[45%] flex-col items-end justify-center px-2 text-right sm:px-3">
                    <p className="max-w-full truncate text-xs font-medium sm:text-sm">{va.name.full}</p>
                    <p className="text-[0.7rem] text-white/60 sm:text-xs">{va.languageV2}</p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={va.image.large ?? ""} alt="" loading="lazy" className="w-12 shrink-0 object-cover sm:w-16" />
                </>
              )}
            </li>
          )
        })}
      </ul>
      {edges.length > 6 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-4 w-full py-2 text-center text-white/60 hover:text-white"
        >
          {all ? "Show less" : `Show all ${a.characters.pageInfo.total}`}
        </button>
      )}
    </section>
  )
}

/* ---------------------------------- gallery ---------------------------------- */

function Gallery({ a, title }: { a: Detail; title: string }) {
  const [extra, setExtra] = React.useState<Artwork[]>([])
  const [filter, setFilter] = React.useState("All")
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const ctrl = new AbortController()
    getArtwork(a.title.english ?? a.title.romaji ?? title, a.format === "MOVIE", ctrl.signal).then(setExtra)
    return () => ctrl.abort()
  }, [a, title])

  const base: Artwork[] = [
    ...(a.bannerImage ? [{ kind: "Backdrops" as const, url: a.bannerImage }] : []),
    ...(a.coverImage.extraLarge ? [{ kind: "Posters" as const, url: a.coverImage.extraLarge }] : []),
  ]
  const images = [...base, ...extra]
  if (images.length === 0) return null
  const kinds = ["All", ...Array.from(new Set(images.map((i) => i.kind)))]
  const list = (filter === "All" ? images : images.filter((i) => i.kind === filter)).slice(0, 80)

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/10">
            <ImageIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Artwork &amp; Posters</h2>
            <p className="text-sm text-white/60">{list.length} images</p>
          </div>
        </div>
        <Select label="Artwork type" value={filter} onChange={setFilter} options={kinds} />
      </div>

      {open ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {list.map((i) => (
            <div key={i.url} className="overflow-hidden rounded-xl border border-white/15 bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt="" loading="lazy" className="size-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        list[0] && (
          <div className="relative max-h-[26rem] overflow-hidden rounded-xl border border-white/15 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:max-h-[34rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={list[0].url} alt="" className="w-full object-cover" />
          </div>
        )
      )}
      {list.length > 1 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mx-auto mt-3 flex items-center gap-2 py-2 text-white/60 hover:text-white"
        >
          {open ? "Show less" : `View all ${list.length} images`}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </section>
  )
}

/* -------------------------------- more like this ------------------------------- */

function More({ a }: { a: Detail }) {
  const items = a.recommendations.nodes
    .map((n) => n.mediaRecommendation)
    .filter((m): m is NonNullable<typeof m> => Boolean(m) && !m!.isAdult)
  if (items.length === 0) return null
  return (
    <section>
      <SectionTitle title="More like this" />
      <div className={GRID}>
        {items.map((m) => (
          <PosterCard key={m.id} anime={m} />
        ))}
      </div>
    </section>
  )
}
