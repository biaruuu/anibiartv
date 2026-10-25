import { NextResponse } from "next/server"

import { AnivexaError, configuredProviders, getEpisodes } from "@/lib/anivexa"
import { cached } from "@/lib/redis"

export const maxDuration = 60

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anime id." }, { status: 400 })
  }
  try {
    // Shared by every visitor for 10 minutes; an older copy is used if the servers are down.
    const data = await cached(`ep:v2:${id}:${configuredProviders().join(",")}`, 600, () => getEpisodes(id), { stale: 6 * 3600 })
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    })
  } catch (e) {
    const err = e instanceof AnivexaError ? e : new AnivexaError("Could not load episodes.")
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
}
