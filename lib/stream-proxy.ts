import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto"

/**
 * Server only. Stream URLs from the provider need a Referer header that a browser cannot
 * send, so the site fetches them itself. The address and referer are sealed into one opaque
 * token (AES-256-GCM), so the browser never sees the real host names, and nobody can make
 * this route fetch an address that this server did not issue.
 */
const SECRET =
  process.env.STREAM_PROXY_SECRET ??
  process.env.ANIVEXA_API_URL ??
  "anibiar-stream-proxy"

const KEY = createHash("sha256").update(`seal:${SECRET}`).digest()

const b64 = (buf: Buffer) => buf.toString("base64url")

export function proxied(url: string, referer = "") {
  const plain = Buffer.from(JSON.stringify([url, referer]))
  // Same input, same token: the browser can reuse what it already downloaded.
  const iv = createHmac("sha256", KEY).update(plain).digest().subarray(0, 12)
  const cipher = createCipheriv("aes-256-gcm", KEY, iv)
  const sealed = Buffer.concat([cipher.update(plain), cipher.final()])
  return `/api/proxy?t=${b64(Buffer.concat([iv, cipher.getAuthTag(), sealed]))}`
}

/** Returns the address and referer inside a token, or null if it is not one of ours. */
export function open(token: string): { url: string; referer: string } | null {
  try {
    const raw = Buffer.from(token, "base64url")
    if (raw.length < 29) return null
    const decipher = createDecipheriv("aes-256-gcm", KEY, raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")
    const [url, referer] = JSON.parse(plain) as [unknown, unknown]
    return typeof url === "string" ? { url, referer: typeof referer === "string" ? referer : "" } : null
  } catch {
    return null
  }
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
