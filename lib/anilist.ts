// Minimal AniList GraphQL client (https://anilist.gitbook.io/anilist-apiv2-docs).
// The API allows browser requests, needs no key, and is rate limited per IP.

const ENDPOINT = "https://graphql.anilist.co"

export type Anime = {
  id: number
  title: { romaji: string | null; english: string | null }
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

export const animeTitle = (a: Anime) => a.title.english ?? a.title.romaji ?? "Untitled"

async function query<T>(q: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: q, variables }),
    signal,
  })
  if (!res.ok) {
    throw new Error(res.status === 429 ? "AniList is busy. Try again in a minute." : `AniList error ${res.status}`)
  }
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
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
          status averageScore
        }
      }
    }`,
    { search, page, perPage },
    signal
  )
  return { items: data.Page.media, hasNext: data.Page.pageInfo.hasNextPage }
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
