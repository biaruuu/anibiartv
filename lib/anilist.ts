// Minimal AniList GraphQL client (https://anilist.gitbook.io/anilist-apiv2-docs).
// The API allows browser requests, needs no key, and is rate limited per IP.

const ENDPOINT = "https://graphql.anilist.co"

export type Anime = {
  id: number
  title: { romaji: string | null; english: string | null; native?: string | null }
  coverImage: { extraLarge: string | null; large: string | null; color: string | null }
  bannerImage?: string | null
  description?: string | null
  format: string | null
  episodes: number | null
  seasonYear: number | null
  genres?: string[]
  averageScore?: number | null
  status?: string | null
  nextAiringEpisode?: { episode: number } | null
}

export type LatestEpisode = { id: number; airingAt: number; episode: number; media: Anime }

/** Episodes you can watch now: aired so far for a running show, otherwise the total. */
export const airedEpisodes = (a: Anime) =>
  a.status === "RELEASING" && a.nextAiringEpisode ? Math.max(0, a.nextAiringEpisode.episode - 1) : (a.episodes ?? 0)

export const animeTitle = (a: Anime) => a.title.english ?? a.title.romaji ?? "Untitled"

/* ------------------------------ request layer ------------------------------ */
// AniList allows about 90 requests a minute per IP and answers with 429 (which the
// browser often reports as the unhelpful "Failed to fetch"). So every request goes
// through: a cache (memory + sessionStorage), de-duplication of identical in-flight
// requests, a small concurrency limit, and retries with backoff.

const MEMORY_TTL = 5 * 60 * 1000
const STORE_TTL = 20 * 60 * 1000
const MAX_ACTIVE = 3
const MAX_RETRIES = 3

const memory = new Map<string, { at: number; data: unknown }>()
const inflight = new Map<string, Promise<unknown>>()
let active = 0
const waiting: (() => void)[] = []

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function acquire() {
  if (active >= MAX_ACTIVE) await new Promise<void>((r) => waiting.push(r))
  active++
}
function release() {
  active--
  waiting.shift()?.()
}

function hash(str: string) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + str.length.toString(36)
}

function readStore(key: string): { at: number; data: unknown } | null {
  try {
    const raw = sessionStorage.getItem(`anibiar:q:${key}`)
    return raw ? (JSON.parse(raw) as { at: number; data: unknown }) : null
  } catch {
    return null
  }
}
function writeStore(key: string, entry: { at: number; data: unknown }) {
  try {
    const raw = JSON.stringify(entry)
    if (raw.length < 400_000) sessionStorage.setItem(`anibiar:q:${key}`, raw)
  } catch {
    /* storage full or blocked: the memory cache still works */
  }
}

async function request(body: string): Promise<unknown> {
  let lastError: Error = new Error("Couldn't reach AniList.")
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await acquire()
    let res: Response | null = null
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
      })
    } catch {
      // Network error, or a 429 whose response had no CORS headers.
      lastError = new Error("Couldn't reach AniList. Check your connection and try again.")
    } finally {
      release()
    }

    if (res) {
      if (res.ok) {
        const json = await res.json()
        if (json.errors?.length) throw new Error(json.errors[0].message)
        return json.data
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(
          res.status === 429 ? "AniList is busy right now. Try again in a moment." : `AniList is having problems (${res.status}).`
        )
        const retryAfter = Number(res.headers.get("Retry-After"))
        if (attempt < MAX_RETRIES) {
          await sleep(retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 1500 * (attempt + 1))
          continue
        }
        throw lastError
      }
      throw new Error(`AniList error ${res.status}`)
    }
    if (attempt < MAX_RETRIES) await sleep(1000 * 2 ** attempt)
  }
  throw lastError
}

function withAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"))
    if (signal.aborted) return abort()
    signal.addEventListener("abort", abort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener("abort", abort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener("abort", abort)
        reject(e)
      }
    )
  })
}

async function query<T>(q: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const body = JSON.stringify({ query: q, variables })
  const key = hash(body)
  const now = Date.now()

  const mem = memory.get(key)
  if (mem && now - mem.at < MEMORY_TTL) return mem.data as T
  const stored = typeof window !== "undefined" ? readStore(key) : null
  if (stored && now - stored.at < STORE_TTL) {
    memory.set(key, stored)
    return stored.data as T
  }

  let pending = inflight.get(key)
  if (!pending) {
    pending = request(body)
      .then((data) => {
        const entry = { at: Date.now(), data }
        memory.set(key, entry)
        if (typeof window !== "undefined") writeStore(key, entry)
        return data
      })
      .catch((e: Error) => {
        // Better to show slightly old data than an error.
        const old = memory.get(key) ?? stored
        if (old) return old.data
        throw e
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }
  return withAbort(pending as Promise<T>, signal)
}

const MEDIA_FIELDS = `
  id
  title { romaji english }
  coverImage { extraLarge large color }
  format episodes seasonYear isAdult
`

export async function getLatestEpisodes(page: number, signal?: AbortSignal) {
  const data = await query<{
    Page: {
      pageInfo: { lastPage: number }
      airingSchedules: { id: number; airingAt: number; episode: number; media: Anime & { isAdult: boolean } }[]
    }
  }>(
    `query ($page: Int) {
      Page(page: $page, perPage: 12) {
        pageInfo { lastPage }
        airingSchedules(notYetAired: false, sort: TIME_DESC) {
          id airingAt episode
          media { ${MEDIA_FIELDS} }
        }
      }
    }`,
    { page },
    signal
  )
  const seen = new Set<number>()
  const items = data.Page.airingSchedules.filter((s) => {
    if (s.media.isAdult || seen.has(s.media.id)) return false
    seen.add(s.media.id)
    return true
  })
  return { items: items as LatestEpisode[], lastPage: data.Page.pageInfo.lastPage }
}

export async function getTrending(signal?: AbortSignal) {
  const data = await query<{ Page: { media: Anime[] } }>(
    `query {
      Page(page: 1, perPage: 8) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false, status_in: [RELEASING, FINISHED]) {
          ${MEDIA_FIELDS}
          bannerImage description(asHtml: false) genres
          status averageScore nextAiringEpisode { episode }
        }
      }
    }`,
    {},
    signal
  )
  return data.Page.media.filter((m) => m.bannerImage || m.coverImage.extraLarge)
}

async function getRanked(status: "RELEASING" | "NOT_YET_RELEASED", signal?: AbortSignal) {
  const data = await query<{ Page: { media: Anime[] } }>(
    `query ($status: MediaStatus) {
      Page(page: 1, perPage: 10) {
        media(type: ANIME, status: $status, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_FIELDS}
          bannerImage averageScore nextAiringEpisode { episode }
        }
      }
    }`,
    { status },
    signal
  )
  return data.Page.media
}

export const getTopAiring = (signal?: AbortSignal) => getRanked("RELEASING", signal)
export const getUpcoming = (signal?: AbortSignal) => getRanked("NOT_YET_RELEASED", signal)

export async function searchAnimePage(search: string, page: number, perPage: number, signal?: AbortSignal) {
  const data = await query<{ Page: { pageInfo: { hasNextPage: boolean }; media: Anime[] } }>(
    `query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(type: ANIME, search: $search, isAdult: false, sort: SEARCH_MATCH) {
          ${MEDIA_FIELDS}
          status averageScore nextAiringEpisode { episode }
        }
      }
    }`,
    { search, page, perPage },
    signal
  )
  return { items: data.Page.media, hasNext: data.Page.pageInfo.hasNextPage }
}

/* --------------------------------- smart search --------------------------------- */

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×✕]/g, "x")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

type SearchHit = Anime & { synonyms: string[] | null; popularity: number | null }

function score(hit: SearchHit, term: string, tokens: string[]) {
  const titles = [hit.title.english, hit.title.romaji, hit.title.native, ...(hit.synonyms ?? [])]
    .filter((t): t is string => Boolean(t))
    .map(normalize)
  let best = 0
  for (const t of titles) {
    let s = 0
    if (t === term) s = 100
    else if (t.startsWith(term)) s = 80
    else if (t.split(" ").some((w) => w.startsWith(tokens[0] ?? term)) && tokens.every((k) => t.includes(k))) s = 65
    else if (t.includes(term)) s = 55
    else if (tokens.length > 1 && tokens.every((k) => t.includes(k))) s = 45
    else if (tokens.some((k) => t.includes(k))) s = 15
    best = Math.max(best, s)
  }
  return best + Math.min(10, Math.log10((hit.popularity ?? 0) + 1) * 2)
}

/**
 * Search tuned for "type a few letters, find the show": asks AniList (which also searches
 * synonyms) for a wide page, then ranks exact and prefix title matches first and
 * lets popularity break ties, so the popular show you meant beats an obscure OVA.
 */
export async function searchSmart(raw: string, limit: number, signal?: AbortSignal): Promise<Anime[]> {
  const term = normalize(raw)
  if (!term) return []
  const tokens = term.split(" ").filter(Boolean)
  const run = async (q: string) => {
    const data = await query<{ Page: { media: SearchHit[] } }>(
      `query ($search: String) {
        Page(page: 1, perPage: 12) {
          media(type: ANIME, search: $search, isAdult: false, sort: SEARCH_MATCH) {
            ${MEDIA_FIELDS}
            title { romaji english native }
            synonyms popularity status averageScore nextAiringEpisode { episode }
          }
        }
      }`,
      { search: q },
      signal
    )
    return data.Page.media
  }
  let hits = await run(raw.trim())
  // Nothing found: the last word is often a typo or a partial word, so try without it.
  if (hits.length === 0 && tokens.length > 1) hits = await run(tokens.slice(0, -1).join(" "))
  return hits
    .map((h, i) => ({ h, s: score(h, term, tokens) - i * 0.01 }))
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.h)
}

export function timeAgo(unix: number) {
  const s = Math.max(0, Date.now() / 1000 - unix)
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const watchHref = (a: Anime, episode?: number) =>
  `/watch?title=${encodeURIComponent(animeTitle(a))}${episode ? `&ep=${episode}` : ""}`

/* ------------------------------ info page data ------------------------------ */

export type Mini = Pick<Anime, "id" | "title" | "coverImage" | "format" | "episodes" | "seasonYear">

export type Detail = Anime & {
  idMal: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  status: string | null
  duration: number | null
  season: string | null
  startDate: { year: number | null; month: number | null; day: number | null }
  endDate: { year: number | null; month: number | null; day: number | null }
  meanScore: number | null
  popularity: number | null
  siteUrl: string
  studios: { edges: { isMain: boolean; node: { name: string } }[] }
  externalLinks: { site: string; url: string; icon: string | null; color: string | null; type: string }[]
  trailer: { id: string; site: string; thumbnail: string | null } | null
  relations: {
    edges: { relationType: string; node: Mini & { type: string; startDate: { year: number | null } } }[]
  }
  recommendations: { nodes: { mediaRecommendation: (Mini & { isAdult: boolean }) | null }[] }
}

export async function getAnimeDetail(id: number, signal?: AbortSignal) {
  const mini = `id title { romaji english } coverImage { extraLarge large color } format episodes seasonYear`
  const data = await query<{ Media: Detail | null }>(
    `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${mini}
        idMal bannerImage description(asHtml: false) genres status duration season siteUrl
        title { romaji english native }
        startDate { year month day } endDate { year month day }
        averageScore meanScore popularity
        studios { edges { isMain node { name } } }
        externalLinks { site url icon color type }
        trailer { id site thumbnail }
        relations { edges { relationType(version: 2) node { ${mini} type startDate { year } } } }
        recommendations(sort: RATING_DESC, perPage: 12) {
          nodes { mediaRecommendation { ${mini} isAdult } }
        }
      }
    }`,
    { id },
    signal
  )
  return data.Media
}

export const infoHref = (a: { id: number }) => `/anime/${a.id}`

const FORMATS: Record<string, string> = {
  TV: "TV Series",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
  MANGA: "Manga",
  NOVEL: "Novel",
  ONE_SHOT: "One Shot",
}
export const formatName = (f: string | null) => (f ? (FORMATS[f] ?? f.replace("_", " ")) : "")

/* ------------------- characters (own query, one voice language) ------------------- */

export type CharacterEdge = {
  role: string
  node: { id: number; name: { full: string }; image: { large: string | null } }
  voiceActors: { id: number; name: { full: string }; image: { large: string | null }; languageV2: string | null }[]
}

export const VOICE_LANGUAGES = [
  "Japanese",
  "English",
  "Korean",
  "Italian",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Hebrew",
  "Hungarian",
] as const

export async function getCharacters(id: number, language: string, page: number, signal?: AbortSignal) {
  const data = await query<{
    Media: { characters: { pageInfo: { hasNextPage: boolean }; edges: CharacterEdge[] } } | null
  }>(
    `query ($id: Int, $page: Int, $lang: StaffLanguage) {
      Media(id: $id, type: ANIME) {
        characters(sort: [ROLE, RELEVANCE], page: $page, perPage: 25) {
          pageInfo { hasNextPage }
          edges {
            role
            node { id name { full } image { large } }
            voiceActors(language: $lang) { id name { full } image { large } languageV2 }
          }
        }
      }
    }`,
    { id, page, lang: language.toUpperCase() },
    signal
  )
  const c = data.Media?.characters
  return { hasNext: c?.pageInfo.hasNextPage ?? false, edges: c?.edges ?? [] }
}

/* --------------- whole franchise: walk prequels/sequels and side stories --------------- */

export type DateParts = { year: number | null; month: number | null; day: number | null }
export type FranchiseEntry = {
  node: Mini & { type: string; startDate: DateParts }
  /** Relation type of the edge that first reached this entry (as AniList reports it). */
  rel: string
  /** The entry whose relations listed this one. */
  parent: number
}
export type FranchiseGraph = {
  entries: FranchiseEntry[]
  /** Every PREQUEL / SEQUEL link seen, as AniList reports it: `to` is the `type` of `from`. */
  links: { from: number; to: number; type: string }[]
}

const CHAIN = new Set(["PREQUEL", "SEQUEL", "PARENT"])
const EXTRA = new Set(["SIDE_STORY", "SPIN_OFF", "SUMMARY"])

/** Walks AniList's relation graph so every season, movie, OVA and special of a franchise is found. */
export async function getFranchise(id: number, signal?: AbortSignal): Promise<FranchiseGraph> {
  const mini = `id title { romaji english } coverImage { extraLarge large color } format episodes seasonYear`
  const known = new Map<number, FranchiseEntry>()
  const links: FranchiseGraph["links"] = []
  const visited = new Set<number>([id])
  let frontier = [id]
  for (let depth = 0; depth < 8 && frontier.length > 0 && known.size < 60; depth++) {
    const data = await query<{
      Page: {
        media: { id: number; relations: { edges: { relationType: string; node: FranchiseEntry["node"] }[] } }[]
      }
    }>(
      `query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id
            relations { edges { relationType(version: 2) node { ${mini} type startDate { year month day } } } }
          }
        }
      }`,
      { ids: frontier },
      signal
    )
    const next: number[] = []
    for (const m of data.Page.media) {
      for (const e of m.relations.edges) {
        if (e.node.type !== "ANIME") continue
        if (e.relationType === "PREQUEL" || e.relationType === "SEQUEL") {
          links.push({ from: m.id, to: e.node.id, type: e.relationType })
        }
        if (visited.has(e.node.id)) continue
        if (!CHAIN.has(e.relationType) && !EXTRA.has(e.relationType)) continue
        visited.add(e.node.id)
        known.set(e.node.id, { node: e.node, rel: e.relationType, parent: m.id })
        if (CHAIN.has(e.relationType)) next.push(e.node.id)
      }
    }
    frontier = next
  }
  return { entries: [...known.values()], links }
}
