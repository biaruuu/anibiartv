/**
 * Server only. Talks to a running Anivexa API (https://github.com/walterwhite-69/Anivexa-API)
 * and uses only its `anipm` provider.
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
}

export type EpisodesPayload = {
  source: "anipm"
  title: string | null
  sub: WatchEpisode[]
  dub: WatchEpisode[]
}

export type StreamSubtitle = { label: string; srclang: string; src: string; default: boolean }
export type StreamSource = {
  id: string
  /** "soft" = separate subtitle tracks, "hard" = subtitles burned into the video. */
  kind: "soft" | "hard"
  src: string
  subtitles: StreamSubtitle[]
  audioLang: string | null
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

async function call<T>(path: string, revalidate: number): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${base()}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(55_000),
      next: { revalidate },
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

function episode(raw: Record<string, unknown>): WatchEpisode | null {
  const number = Number(raw.number)
  if (!Number.isFinite(number)) return null
  return {
    number,
    title: str(raw.title) ?? `Episode ${number}`,
    description: str(raw.description),
    image: str(raw.image),
    airDate: str(raw.airDate),
    duration: typeof raw.duration === "number" ? raw.duration : null,
    filler: raw.filler === true,
  }
}

export async function getEpisodes(anilistId: number): Promise<EpisodesPayload> {
  const data = await call<{
    anipm?: {
      error?: string
      meta?: { title?: string }
      episodes?: { sub?: Record<string, unknown>[]; dub?: Record<string, unknown>[] }
    }
  }>(`/episodes/anipm/${anilistId}?map=false`, 300)
  const p = data.anipm
  if (!p || p.error) {
    throw new AnivexaError(p?.error ?? "Ani.pm has no episodes for this anime.", 404)
  }
  const list = (items?: Record<string, unknown>[]) =>
    (items ?? [])
      .map(episode)
      .filter((e): e is WatchEpisode => !!e)
      .sort((a, b) => a.number - b.number)
  return {
    source: "anipm",
    title: str(p.meta?.title),
    sub: list(p.episodes?.sub),
    dub: list(p.episodes?.dub),
  }
}

type RawStream = {
  url?: string
  referer?: string
  subtitleType?: string
  audioLang?: string | null
  subtitles?: { url?: string; label?: string; srclang?: string; default?: boolean; headers?: { Referer?: string } }[]
}
type RawRange = { start?: number; end?: number } | null | undefined
const range = (r: RawRange) =>
  r && typeof r.start === "number" && typeof r.end === "number" && r.end > r.start
    ? { start: r.start, end: r.end }
    : null

export async function getWatch(anilistId: number, audio: Audio, ep: number): Promise<WatchPayload> {
  const data = await call<{ streams?: RawStream[]; intro?: RawRange; outro?: RawRange }>(
    `/watch/anipm/${anilistId}/${audio}/anipm-${ep}`,
    30
  )
  const streams: StreamSource[] = (data.streams ?? [])
    .filter((s) => s.url && /^https?:\/\//i.test(s.url))
    .map((s, i) => {
      const kind = s.subtitleType === "hardsub" ? "hard" : "soft"
      return {
        id: `${kind}-${i}`,
        kind,
        src: proxied(s.url!, s.referer ?? ""),
        audioLang: s.audioLang ?? null,
        subtitles: (s.subtitles ?? [])
          .filter((t) => t.url && /^https?:\/\//i.test(t.url))
          .map((t) => ({
            label: t.label || "Subtitle",
            srclang: t.srclang || "und",
            default: !!t.default,
            src: proxied(t.url!, t.headers?.Referer ?? ""),
          })),
      }
    })
  if (!streams.length) throw new AnivexaError("No stream was returned for this episode.", 404)
  return { audio, episode: ep, streams, intro: range(data.intro), outro: range(data.outro) }
}
