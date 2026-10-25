/**
 * Server only. Talks to a running Anivexa API (https://github.com/walterwhite-69/Anivexa-API).
 *
 * Several providers are used at once; their episode lists are merged by episode number and
 * every provider that has the episode becomes a server in the Server menu. Only streams a
 * browser can play directly (HLS and MP4) are kept; embed pages and iframes are skipped.
 */
import { proxied } from "@/lib/stream-proxy"

export type Audio = "sub" | "dub"

export type WatchEpisode = {
  number: number
  title: string
  description: string | null
  image: string | null
  airDate: string | null
  duration: number | null
  filler: boolean
  /** Opaque ids of the servers that have this episode (in priority order). */
  providers: string[]
}

export type EpisodesPayload = {
  title: string | null
  sub: WatchEpisode[]
  dub: WatchEpisode[]
  /** Opaque ids of the servers that answered with episodes. */
  sources: string[]
}

export type StreamSubtitle = { label: string; srclang: string; src: string; default: boolean }
export type StreamSource = {
  id: string
  /** Our own name for the server. Real provider and site names never leave the server. */
  name: string
  /** "soft" = separate subtitle tracks, "hard" = subtitles burned into the video. */
  kind: "soft" | "hard"
  format: "hls" | "file"
  src: string
  subtitles: StreamSubtitle[]
  /** Seconds, from this server's own copy of the episode (null when it has none). */
  intro: { start: number; end: number } | null
  outro: { start: number; end: number } | null
}
export type WatchPayload = {
  audio: Audio
  episode: number
  streams: StreamSource[]
  intro: { start: number; end: number } | null
  outro: { start: number; end: number } | null
}

export class AnivexaError extends Error {
  constructor(
    message: string,
    public status = 502
  ) {
    super(message)
  }
}

/** Providers that were checked to return playable HLS/MP4 links. Order = priority. */
const KNOWN = ["anikoto", "aniwaves", "animegg", "anipm", "anizone", "animeonsen", "senshi", "animedunya"]
const DEFAULT_PROVIDERS = ["anikoto", "aniwaves", "animegg"]

// Real provider names stay on the server. The browser only ever sees these ids and the invented names below.
const alias = (provider: string) => `s${KNOWN.indexOf(provider) + 1}`
const fromAlias = (value: string) => KNOWN[Number(value.replace(/^s/, "")) - 1] ?? null

const NAMES = ["Nova", "Orion", "Lyra", "Atlas", "Comet", "Zephyr", "Pulse", "Ember", "Echo", "Halo", "Vega", "Aero"]
const hash = (text: string) => [...text].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381)
/** Stable invented name for a provider server; unique within one list. */
function nameFor(provider: string, server: string, taken: Set<string>) {
  let i = hash(`${provider}:${server.toLowerCase()}`) % NAMES.length
  for (let n = 0; n < NAMES.length; n++, i = (i + 1) % NAMES.length) {
    if (!taken.has(NAMES[i])) {
      taken.add(NAMES[i])
      return NAMES[i]
    }
  }
  const fallback = `Server ${taken.size + 1}`
  taken.add(fallback)
  return fallback
}

export function configuredProviders() {
  const raw = process.env.ANIVEXA_PROVIDERS?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  const list = (raw?.length ? raw : DEFAULT_PROVIDERS).filter((p) => KNOWN.includes(p))
  return list.length ? list : DEFAULT_PROVIDERS
}

function base() {
  const raw = process.env.ANIVEXA_API_URL?.trim()
  if (!raw) {
    throw new AnivexaError(
      "Streaming is not set up yet. Add ANIVEXA_API_URL (the address of your Anivexa API) to the environment variables.",
      503
    )
  }
  return raw.replace(/\/+$/, "")
}

async function call<T>(path: string, timeoutMs: number): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${base()}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    })
  } catch (e) {
    if (e instanceof AnivexaError) throw e
    throw new AnivexaError("The streaming server did not answer. Try again in a moment.")
  }
  const text = await res.text()
  let data: unknown = null
  try {
    data = JSON.parse(text)
  } catch {}
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new AnivexaError(msg ? String(msg) : `Streaming server error (HTTP ${res.status}).`, res.status === 404 ? 404 : 502)
  }
  return data as T
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

type RawEpisode = Record<string, unknown>
type RawProvider = {
  error?: string
  meta?: { title?: string }
  episodes?: { sub?: RawEpisode[]; dub?: RawEpisode[] }
}

/** Merges each provider's list; the first provider to give a field wins. */
function merge(order: string[], data: Record<string, RawProvider | undefined>, audio: Audio): WatchEpisode[] {
  const byNumber = new Map<number, WatchEpisode>()
  for (const provider of order) {
    for (const raw of data[provider]?.episodes?.[audio] ?? []) {
      const number = Number(raw.number)
      if (!Number.isInteger(number) || number < 0) continue
      const have = byNumber.get(number)
      if (!have) {
        byNumber.set(number, {
          number,
          title: str(raw.title) ?? `Episode ${number}`,
          description: str(raw.description),
          image: str(raw.image),
          airDate: str(raw.airDate),
          duration: typeof raw.duration === "number" ? raw.duration : null,
          filler: raw.filler === true,
          providers: [alias(provider)],
        })
      } else {
        have.providers.push(alias(provider))
        if (/^Episode \d+$/.test(have.title) && str(raw.title)) have.title = str(raw.title)!
        have.description ??= str(raw.description)
        have.image ??= str(raw.image)
        have.airDate ??= str(raw.airDate)
        have.duration ??= typeof raw.duration === "number" ? raw.duration : null
      }
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

export async function getEpisodes(anilistId: number): Promise<EpisodesPayload> {
  const order = configuredProviders()
  const data = await call<Record<string, RawProvider | undefined>>(
    `/episodes/${order.join("/")}/${anilistId}?map=false`,
    58_000
  )
  const sub = merge(order, data, "sub")
  const dub = merge(order, data, "dub")
  if (!sub.length && !dub.length) {
    for (const p of order) console.error(`[episodes:${p}] ${str(data[p]?.error) ?? "no episodes"}`)
    throw new AnivexaError("No server has this anime yet. Try again later.", 404)
  }
  const sources = order
    .filter((p) => (data[p]?.episodes?.sub?.length ?? 0) + (data[p]?.episodes?.dub?.length ?? 0) > 0)
    .map(alias)
  const title = order.map((p) => str(data[p]?.meta?.title)).find(Boolean) ?? null
  return { title, sub, dub, sources }
}

type RawSubtitle = { url?: string; src?: string; file?: string; label?: string; lang?: string; language?: string; srclang?: string; default?: boolean; headers?: { Referer?: string } }
type RawStream = {
  url?: string
  type?: string
  server?: string
  referer?: string
  subtitleType?: string
  priority?: number
  isActive?: boolean
  subtitles?: RawSubtitle[]
  headers?: { Referer?: string }
  intro?: { start?: number; end?: number } | null
  outro?: { start?: number; end?: number } | null
}
type RawWatch = {
  streams?: RawStream[]
  subtitles?: RawSubtitle[]
  headers?: { Referer?: string }
  intro?: RawStream["intro"]
  outro?: RawStream["outro"]
}

const range = (r: RawStream["intro"]) =>
  r && typeof r.start === "number" && typeof r.end === "number" && r.end > r.start ? { start: r.start, end: r.end } : null

const isThumbnails = (t: RawSubtitle) => /thumbnail|storyboard|sprite|preview/i.test(`${t.url ?? t.src ?? t.file ?? ""} ${t.label ?? ""}`)

function parseWatch(provider: string, audio: Audio, data: RawWatch, taken: Set<string>) {
  const streams: StreamSource[] = []
  const seen = new Set<string>()
  const ordered = [...(data.streams ?? [])].sort((a, b) => Number(!!b.isActive) - Number(!!a.isActive) || (b.priority ?? 0) - (a.priority ?? 0))
  for (const s of ordered) {
    const type = (s.type ?? "").toLowerCase()
    const format = type === "hls" || type === "m3u8" ? "hls" : type === "mp4" ? "file" : null
    if (!format || !s.url || !/^https?:\/\//i.test(s.url) || seen.has(s.url)) continue
    seen.add(s.url)
    const referer = s.referer ?? s.headers?.Referer ?? data.headers?.Referer ?? ""
    const rawSubs = (s.subtitles?.length ? s.subtitles : (data.subtitles ?? [])).filter((t) => !isThumbnails(t))
    const subtitles: StreamSubtitle[] = rawSubs
      .map((t) => {
        const url = t.url ?? t.src ?? t.file
        if (!url || !/^https?:\/\//i.test(url)) return null
        return {
          label: t.label ?? t.lang ?? t.language ?? "Subtitle",
          srclang: t.srclang ?? t.lang ?? t.language ?? "und",
          default: !!t.default,
          src: proxied(url, t.headers?.Referer ?? referer),
        }
      })
      .filter((t): t is StreamSubtitle => !!t)
    // When a provider doesn't say, a sub stream without caption tracks has its subtitles in the picture.
    const kind: "soft" | "hard" =
      s.subtitleType === "hardsub" ? "hard" : s.subtitleType === "softsub" || subtitles.length ? "soft" : audio === "sub" ? "hard" : "soft"
    streams.push({
      id: `${alias(provider)}-${streams.length}`,
      name: nameFor(provider, s.server?.trim() || provider, taken),
      kind,
      format,
      src: proxied(s.url, referer),
      subtitles,
      intro: range(s.intro ?? data.intro),
      outro: range(s.outro ?? data.outro),
    })
  }
  return { streams, intro: range(data.intro ?? ordered[0]?.intro), outro: range(data.outro ?? ordered[0]?.outro) }
}

export async function getWatch(anilistId: number, audio: Audio, ep: number, wanted?: string[]): Promise<WatchPayload> {
  const asked = wanted?.map(fromAlias).filter((p): p is string => !!p)
  const order = configuredProviders().filter((p) => !asked?.length || asked.includes(p))
  if (!order.length) throw new AnivexaError("No server has this episode.", 404)
  const taken = new Set<string>()

  const results = await Promise.allSettled(
    order.map(async (provider) => {
      const raw = await call<RawWatch>(`/watch/${provider}/${anilistId}/${audio}/${provider}-${ep}`, 40_000)
      return { provider, parsed: parseWatch(provider, audio, raw, taken) }
    })
  )

  const streams: StreamSource[] = []
  let intro: WatchPayload["intro"] = null
  let outro: WatchPayload["outro"] = null
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      streams.push(...r.value.parsed.streams)
      intro ??= r.value.parsed.intro
      outro ??= r.value.parsed.outro
    } else {
      console.error(`[watch:${order[i]}] ${r.reason instanceof Error ? r.reason.message : "failed"}`)
    }
  })
  if (!streams.length) {
    throw new AnivexaError("No playable stream was found for this episode. Try another episode or try again later.", 404)
  }
  return { audio, episode: ep, streams, intro, outro }
}
