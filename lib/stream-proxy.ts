import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Server only. Stream URLs from the provider need a Referer header that a browser
 * cannot send, so the site fetches them itself. URLs are signed so this can never
 * be used as an open proxy for arbitrary websites.
 */
const SECRET =
  process.env.STREAM_PROXY_SECRET ??
  process.env.ANIVEXA_API_URL ??
  "anibiar-stream-proxy"

function sign(url: string, referer: string) {
  return createHmac("sha256", SECRET).update(`${url}\n${referer}`).digest("hex").slice(0, 32)
}

export function proxied(url: string, referer = "") {
  const q = new URLSearchParams({ u: url, s: sign(url, referer) })
  if (referer) q.set("r", referer)
  return `/api/proxy?${q.toString()}`
}

export function verify(url: string, referer: string, signature: string) {
  const expected = Buffer.from(sign(url, referer))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** Refuses localhost and private network addresses (SSRF guard). */
export function isPublicHttpUrl(value: string) {
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return false
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false
  const h = u.hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false
  if (/^\[/.test(h) || h.includes(":")) return false
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
  }
  return true
}
