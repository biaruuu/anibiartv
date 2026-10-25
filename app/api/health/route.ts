import { NextResponse } from "next/server"

import { redisHealth } from "@/lib/redis"

export const dynamic = "force-dynamic"

/** Open /api/health to check the setup. It never shows keys or addresses. */
export async function GET() {
  return NextResponse.json(
    {
      redis: await redisHealth(),
      streaming: { apiUrlSet: Boolean(process.env.ANIVEXA_API_URL?.trim()) },
      tmdb: { keySet: Boolean(process.env.TMDB_KEY ?? process.env.NEXT_PUBLIC_TMDB_KEY) },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
