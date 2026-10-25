import { NextResponse } from "next/server"

import { AnivexaError, getWatch } from "@/lib/anivexa"

export const maxDuration = 60

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id)
  const url = new URL(req.url)
  const audio = url.searchParams.get("audio") === "dub" ? "dub" : "sub"
  const ep = Number(url.searchParams.get("ep"))
  const wanted = url.searchParams.get("p")?.split(",").map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z]+$/.test(x))
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(ep) || ep < 0) {
    return NextResponse.json({ error: "Invalid anime or episode." }, { status: 400 })
  }
  try {
    return NextResponse.json(await getWatch(id, audio, ep, wanted), {
      // Signed stream links expire quickly, so never cache them for long.
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (e) {
    const err = e instanceof AnivexaError ? e : new AnivexaError("Could not load this episode.")
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
}
