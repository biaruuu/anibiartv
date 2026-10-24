// Title logos (the stylised artwork you see on Miruro) are not part of AniList.
// They come from TMDB: add a free API key as NEXT_PUBLIC_TMDB_KEY in Vercel
// (Project Settings -> Environment Variables) and redeploy. Without a key the
// hero falls back to the plain text title.

const KEY = process.env.NEXT_PUBLIC_TMDB_KEY
const cache = new Map<string, string | null>()

type TmdbSearch = { results: { id: number }[] }
type TmdbImages = { logos: { file_path: string; iso_639_1: string | null; vote_average: number; width: number }[] }

export const logosEnabled = Boolean(KEY)

export async function getTitleLogo(
  name: string,
  isMovie: boolean,
  signal?: AbortSignal
): Promise<string | null> {
  if (!KEY) return null
  const cacheKey = `${isMovie ? "m" : "t"}:${name}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null

  const kinds = isMovie ? (["movie", "tv"] as const) : (["tv", "movie"] as const)
  try {
    for (const kind of kinds) {
      const search = await fetch(
        `https://api.themoviedb.org/3/search/${kind}?api_key=${KEY}&query=${encodeURIComponent(name)}`,
        { signal }
      )
      if (!search.ok) continue
      const id = ((await search.json()) as TmdbSearch).results[0]?.id
      if (!id) continue
      const images = await fetch(
        `https://api.themoviedb.org/3/${kind}/${id}/images?api_key=${KEY}&include_image_language=en,ja,null`,
        { signal }
      )
      if (!images.ok) continue
      const logos = ((await images.json()) as TmdbImages).logos
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
  cache.set(cacheKey, null)
  return null
}
