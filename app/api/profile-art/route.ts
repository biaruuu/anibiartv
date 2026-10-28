import { NextResponse } from "next/server"

import { cached } from "@/lib/redis"
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config"

type Row = {
  id: string
  kind: "intro" | "frame"
  label: string
  apng: string
  idle: string | null
  sheet: string | null
  frames: number
  cols: number
  frame_w: number
  frame_h: number
  fps: number | string
  intro_ms: number
}

/** Profile intros and frames from Supabase, kept in Upstash Redis for 5 minutes. */
export async function GET() {
  try {
    const art = await cached(
      "profile-art:v2",
      300,
      async () => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/profile_art?select=*&active=eq.true&order=sort.asc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`Supabase ${res.status}`)
        const rows = (await res.json()) as Row[]
        return rows.map((r) => ({ ...r, sheet: r.sheet ?? "", fps: Number(r.fps) }))
      },
      { stale: 3600 }
    )
    return NextResponse.json({ art }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } })
  } catch {
    return NextResponse.json({ error: "Could not load profile art" }, { status: 502 })
  }
}
