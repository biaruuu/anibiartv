import { NextResponse } from "next/server"

import { cached, digest } from "@/lib/redis"

export const maxDuration = 20

const KEY = process.env.TMDB_KEY ?? process.env.NEXT_PUBLIC_TMDB_KEY
const ALLOWED = [/^search\/(tv|movie)$/, /^(tv|movie)\/\d+\/images$/]
const PARAMS = ["query", "include_image_language"]

/** Cached door to TMDB. Title logos and artwork rarely change, so they live in Redis for a week. */
export async function GET(req: Request) {
  if (!KEY) return NextResponse.json({ error: "TMDB key is not set." }, { status: 503 })
  const q = new URL(req.url).searchParams
  const path = q.get("path") ?? ""
  if (!ALLOWED.some((r) => r.test(path))) return NextResponse.json({ error: "Not allowed." }, { status: 400 })

  const params = new URLSearchParams()
  for (const name of PARAMS) {
    const v = q.get(name)
    if (v) params.set(name, v.slice(0, 200))
  }
  try {
    const data = await cached(
      `tmdb:v1:${digest(`${path}?${params}`)}`,
      7 * 24 * 3600,
      async () => {
        const res = await fetch(`https://api.themoviedb.org/3/${path}?${params}&api_key=${KEY}`, {
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`)
        return res.json()
      },
      { stale: 30 * 24 * 3600 }
    )
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } })
  } catch {
    return NextResponse.json({ error: "TMDB did not answer." }, { status: 502 })
  }
}
