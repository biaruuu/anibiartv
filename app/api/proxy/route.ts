import { isPublicHttpUrl, proxied, verify } from "@/lib/stream-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]
const SEGMENT = /\.(ts|m4s|mp4|m4a|aac|mp3|key|webm|vtt|srt|ass)(\?|$)/i

function cors(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    ...extra,
  }
}

/** Rewrites every URL inside an HLS playlist so it goes through this proxy too. */
function rewritePlaylist(text: string, base: string, referer: string) {
  const abs = (u: string) => {
    try {
      return new URL(u, base).toString()
    } catch {
      return null
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim()
      if (!t) return line
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (whole, u: string) => {
          const full = abs(u)
          return full && isPublicHttpUrl(full) ? `URI="${proxied(full, referer)}"` : whole
        })
      }
      const full = abs(t)
      return full && isPublicHttpUrl(full) ? proxied(full, referer) : line
    })
    .join("\n")
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors({ "Access-Control-Allow-Headers": "Range" }) })
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const target = q.get("u") ?? ""
  const referer = q.get("r") ?? ""
  const sig = q.get("s") ?? ""

  if (!target || !sig || !verify(target, referer, sig) || !isPublicHttpUrl(target)) {
    return new Response("Forbidden", { status: 403 })
  }

  const headers: Record<string, string> = { "User-Agent": UA, Accept: "*/*" }
  if (referer) {
    headers.Referer = referer
    try {
      headers.Origin = new URL(referer).origin
    } catch {}
  }
  const range = req.headers.get("range")
  if (range) headers.Range = range

  let upstream: Response
  try {
    upstream = await fetch(target, { headers, redirect: "follow", signal: AbortSignal.timeout(50_000) })
  } catch {
    return new Response("Upstream unreachable", { status: 502, headers: cors() })
  }
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream HTTP ${upstream.status}`, { status: upstream.status, headers: cors() })
  }

  const type = (upstream.headers.get("content-type") ?? "").toLowerCase()
  const looksLikePlaylist = /mpegurl/.test(type) || /\.m3u8(\?|$)/i.test(target)
  const ambiguous = !looksLikePlaylist && !SEGMENT.test(target) && (type === "" || /octet-stream|text\/plain/.test(type))

  if (looksLikePlaylist || ambiguous) {
    const buf = Buffer.from(await upstream.arrayBuffer())
    const text = buf.subarray(0, 8).toString("utf8").trimStart().startsWith("#EXTM3U") ? buf.toString("utf8") : null
    if (text) {
      return new Response(rewritePlaylist(text, upstream.url || target, referer), {
        headers: cors({
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "private, no-store",
        }),
      })
    }
    return new Response(new Uint8Array(buf), {
      status: upstream.status,
      headers: cors({ "Content-Type": type || "application/octet-stream" }),
    })
  }

  const out = new Headers(cors())
  for (const h of PASS) {
    const v = upstream.headers.get(h)
    if (v) out.set(h, v)
  }
  if (/\.vtt(\?|$)/i.test(target) && !out.get("content-type")?.includes("text")) {
    out.set("content-type", "text/vtt; charset=utf-8")
  }
  out.set("Cache-Control", "private, max-age=300")
  return new Response(upstream.body, { status: upstream.status, headers: out })
}
