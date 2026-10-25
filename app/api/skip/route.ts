import { NextResponse } from "next/server"

import { cached } from "@/lib/redis"

export const maxDuration = 20

type Range = { start: number; end: number }
type Answer = { intro: Range | null; outro: Range | null; length: number | null }

/**
 * Backup source of intro / outro times (AniSkip, community made, keyed by MyAnimeList id and
 * episode), used when a video server gives none. Cached in Redis for a day.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const mal = Number(q.get("mal"))
  const ep = Number(q.get("ep"))
  if (!Number.isInteger(mal) || mal <= 0 || !Number.isInteger(ep) || ep <= 0) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  try {
    const data = await cached<Answer>(
      `skip:v1:${mal}:${ep}`,
      24 * 3600,
      async () => {
        const res = await fetch(
          `https://api.aniskip.com/v2/skip-times/${mal}/${ep}?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&episodeLength=0`,
          { signal: AbortSignal.timeout(8000), cache: "no-store" }
        )
        // 404 just means nobody has added times for this episode.
        if (res.status === 404) return { intro: null, outro: null, length: null }
        if (!res.ok) throw new Error(`AniSkip HTTP ${res.status}`)
        const json = (await res.json()) as {
          found?: boolean
          results?: { skipType: string; interval: { startTime: number; endTime: number }; episodeLength?: number }[]
        }
        const pick = (types: string[]) => {
          const hit = json.results?.find((r) => types.includes(r.skipType))
          return hit ? { start: hit.interval.startTime, end: hit.interval.endTime, length: hit.episodeLength ?? null } : null
        }
        const op = pick(["op", "mixed-op"])
        const ed = pick(["ed", "mixed-ed"])
        return {
          intro: op ? { start: op.start, end: op.end } : null,
          outro: ed ? { start: ed.start, end: ed.end } : null,
          length: op?.length ?? ed?.length ?? null,
        }
      },
      { stale: 7 * 24 * 3600 }
    )
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" } })
  } catch {
    return NextResponse.json({ intro: null, outro: null, length: null }, { headers: { "Cache-Control": "no-store" } })
  }
}
