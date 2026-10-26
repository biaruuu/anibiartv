import { NextResponse } from "next/server"

export const maxDuration = 15

// Only the image hosts the site already shows. Lets the browser draw them onto a canvas (profile story image).
const HOSTS = [/(^|\.)anilist\.co$/, /(^|\.)anili\.st$/, /^zrlzsrakfzfayegvvisg\.supabase\.co$/, /^lh3\.googleusercontent\.com$/, /^cdn\.discordapp\.com$/, /^media\.discordapp\.net$/, /^image\.tmdb\.org$/]
const MAX_BYTES = 12 * 1024 * 1024

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u")
  let target: URL
  try {
    target = new URL(raw ?? "")
  } catch {
    return NextResponse.json({ error: "Bad address." }, { status: 400 })
  }
  if (target.protocol !== "https:" || !HOSTS.some((h) => h.test(target.hostname))) {
    return NextResponse.json({ error: "That image host is not allowed." }, { status: 403 })
  }
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(10_000), redirect: "error" })
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !type.startsWith("image/")) return NextResponse.json({ error: "Not an image." }, { status: 502 })
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "Image too large." }, { status: 413 })
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return NextResponse.json({ error: "Could not load the image." }, { status: 502 })
  }
}
