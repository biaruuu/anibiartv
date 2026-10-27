import { NextResponse } from "next/server"

import { cached } from "@/lib/redis"
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config"

type Row = { id: string; label: string; apng: string; sheet: string; frames: number; cols: number; frame_size: number; fps: number | string; scale: number | string }

/** The avatar decoration list from Supabase, kept in Upstash Redis for 5 minutes. */
export async function GET() {
  try {
    const decorations = await cached(
      "decorations:v1",
      300,
      async () => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/avatar_decorations?select=*&active=eq.true&order=sort.asc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`Supabase ${res.status}`)
        const rows = (await res.json()) as Row[]
        return rows.map((r) => ({ id: r.id, label: r.label, apng: r.apng, sheet: r.sheet, frames: r.frames, cols: r.cols, frame_size: r.frame_size, fps: Number(r.fps), scale: Number(r.scale) }))
      },
      { stale: 3600 }
    )
    return NextResponse.json({ decorations }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } })
  } catch {
    return NextResponse.json({ error: "Could not load decorations" }, { status: 502 })
  }
}
