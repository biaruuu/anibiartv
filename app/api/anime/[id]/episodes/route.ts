import { NextResponse } from "next/server"

import { AnivexaError, getEpisodes } from "@/lib/anivexa"

export const maxDuration = 60

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anime id." }, { status: 400 })
  }
  try {
    return NextResponse.json(await getEpisodes(id), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (e) {
    const err = e instanceof AnivexaError ? e : new AnivexaError("Could not load episodes.")
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
}
