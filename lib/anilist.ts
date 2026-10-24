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

export async function searchAnime(search: string, signal?: AbortSignal) {
  const data = await query<{ Page: { media: Anime[] } }>(
    `query ($search: String) {
      Page(page: 1, perPage: 8) {
        media(type: ANIME, search: $search, isAdult: false, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }
    }`,
    { search },
    signal
  )
  return data.Page.media
}

export function timeAgo(unix: number) {
  const s = Math.max(0, Date.now() / 1000 - unix)
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const watchHref = (a: Anime, episode?: number) =>
  `/watch?title=${encodeURIComponent(animeTitle(a))}${episode ? `&ep=${episode}` : ""}`
