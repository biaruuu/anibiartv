/**
 * Server only. A tiny cache on top of Upstash Redis (REST), with no extra packages.
 *
 * Works with an Upstash database added from the Vercel Marketplace (UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN, or the older KV_REST_API_URL / KV_REST_API_TOKEN names).
 * Without those variables everything still works: it falls back to a short memory cache.
 *
 * - Fresh entries come straight from Redis, shared by every visitor and every serverless instance.
 * - If the source fails (AniList 429, provider down), an expired entry is served instead
 *   ("stale if error") for as long as `stale` allows.
 * - Identical requests running at the same moment share one upstream call.
 */
import { createHash } from "node:crypto"

const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

export const redisEnabled = Boolean(URL_ && TOKEN)

async function command(args: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(1500),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`)
  const json = (await res.json()) as { result?: unknown; error?: string }
  if (json.error) throw new Error(json.error)
  return json.result
}

type Entry<T> = { v: T; exp: number }

const memory = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const MEMORY_MAX = 300
const MEMORY_MS = 30_000

function remember(key: string, entry: Entry<unknown>) {
  if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value as string)
  memory.set(key, { v: entry.v, exp: Math.min(entry.exp, Date.now() + MEMORY_MS) })
}

async function read<T>(key: string): Promise<Entry<T> | null> {
  if (!redisEnabled) return null
  try {
    const raw = await command(["GET", key])
    return typeof raw === "string" ? (JSON.parse(raw) as Entry<T>) : null
  } catch {
    return null
  }
}

async function write<T>(key: string, entry: Entry<T>, keepSeconds: number) {
  if (!redisEnabled) return
  try {
    await command(["SET", key, JSON.stringify(entry), "EX", Math.max(1, Math.round(keepSeconds))])
  } catch {
    /* the cache is an extra: never fail a request because of it */
  }
}

/**
 * @param ttl   seconds an entry counts as fresh
 * @param stale extra seconds an expired entry may still be served when `load` fails
 */
export async function cached<T>(key: string, ttl: number, load: () => Promise<T>, opts: { stale?: number } = {}): Promise<T> {
  const stale = opts.stale ?? 0
  const now = Date.now()

  const local = memory.get(key) as Entry<T> | undefined
  if (local && local.exp > now) return local.v

  const stored = await read<T>(key)
  if (stored && stored.exp > now) {
    remember(key, stored)
    return stored.v
  }

  const running = inflight.get(key) as Promise<T> | undefined
  if (running) return running

  const job = (async () => {
    try {
      const value = await load()
      const entry: Entry<T> = { v: value, exp: Date.now() + ttl * 1000 }
      remember(key, entry)
      void write(key, entry, ttl + stale)
      return value
    } catch (error) {
      const fallback = stored ?? (local && local.exp + stale * 1000 > Date.now() ? local : null)
      if (fallback && fallback.exp + stale * 1000 > Date.now()) return fallback.v
      throw error
    }
  })()
  inflight.set(key, job)
  try {
    return await job
  } finally {
    inflight.delete(key)
  }
}

export const digest = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 24)
