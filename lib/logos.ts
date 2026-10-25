// Title logos (the stylised artwork you see on Miruro) are not part of AniList.
// They come from TMDB through our own cached route (/api/tmdb, stored in Redis for a week).
// Add a free TMDB key as TMDB_KEY (or NEXT_PUBLIC_TMDB_KEY) in Vercel and redeploy.
// Without a key the hero falls back to the plain text title.

const cache = new Map<string, string | null>()
let disabled = false

type TmdbSearch = { results: { id: number }[] }
type TmdbImages = { logos: { file_path: string; iso_639_1: string | null; vote_average: number; width: number }[] }

export const logosEnabled = true

async function tmdb<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T | null> {
  if (disabled) return null
  const res = await fetch(`/api/tmdb?${new URLSearchParams({ path, ...params })}`, { signal })
  if (res.status === 503) {
    disabled = true // no key on the server: stop asking
    return null
  }
  return res.ok ? ((await res.json()) as T) : null
}

export async function getTitleLogo(
  name: string,
  isMovie: boolean,
  signal?: AbortSignal
): Promise<string | null> {
  const cacheKey = `${isMovie ? "m" : "t"}:${name}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null

  const kinds = isMovie ? (["movie", "tv"] as const) : (["tv", "movie"] as const)
  try {
    for (const kind of kinds) {
      const id = (await tmdb<TmdbSearch>(`search/${kind}`, { query: name }, signal))?.results[0]?.id
      if (!id) continue
      const logos = (await tmdb<TmdbImages>(`${kind}/${id}/images`, { include_image_language: "en,ja,null" }, signal))?.logos
      if (!logos) continue
      const best =
        logos
          .filter((l) => l.iso_639_1 === "en")
          .sort((a, b) => b.vote_average - a.vote_average || b.width - a.width)[0] ?? logos[0]
      if (best) {
        const url = `https://image.tmdb.org/t/p/w500${best.file_path}`
        cache.set(cacheKey, url)
        return url
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return null
  }
  if (!disabled) cache.set(cacheKey, null)
  return null
}

export type Artwork = { kind: "Backgrounds" | "Banners" | "Posters" | "Logos"; url: string }

/** Artwork for the info page gallery (TMDB). Empty when there is no key or no match. */
export async function getArtwork(name: string, isMovie: boolean, signal?: AbortSignal): Promise<Artwork[]> {
  const kinds = isMovie ? (["movie", "tv"] as const) : (["tv", "movie"] as const)
  try {
    for (const kind of kinds) {
      const id = (await tmdb<TmdbSearch>(`search/${kind}`, { query: name }, signal))?.results[0]?.id
      if (!id) continue
      const j = await tmdb<{ backdrops: { file_path: string }[]; posters: { file_path: string }[]; logos: { file_path: string }[] }>(
        `${kind}/${id}/images`,
        {},
        signal
      )
      if (!j) continue
      const out: Artwork[] = [
        ...j.backdrops.map((i) => ({ kind: "Backgrounds" as const, url: `https://image.tmdb.org/t/p/w780${i.file_path}` })),
        ...j.posters.map((i) => ({ kind: "Posters" as const, url: `https://image.tmdb.org/t/p/w500${i.file_path}` })),
        ...j.logos.map((i) => ({ kind: "Logos" as const, url: `https://image.tmdb.org/t/p/w500${i.file_path}` })),
      ]
      if (out.length) return out
    }
  } catch {
    /* ignore: gallery is optional */
  }
  return []
}
