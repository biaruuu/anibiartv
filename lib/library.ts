"use client"

/**
 * Continue Watching and My List. Always saved in this browser; when the viewer is signed in
 * it is also saved in Supabase, so it follows them to other devices.
 */
import { getSupabase } from "@/lib/supabase/client"

export type HistoryItem = {
  animeId: number
  episode: number
  audio: "sub" | "dub"
  position: number
  duration: number
  title: string
  image: string | null
  totalEpisodes: number | null
  updatedAt: number
}
export type ListItem = { animeId: number; title: string; image: string | null; addedAt: number }

/* ---------------- Upstash-backed bundle (fast reads, real-time versions) ---------------- */

type ListRow = { anime_id: number; title: string; image: string | null; added_at: string }
export type ProfileRow = { username: string | null; avatar_url: string | null; banner_url: string | null; bio: string | null; handle: string | null; effect?: string | null; decoration?: string | null; intro?: string | null; frame?: string | null }
type Bundle = { v: string; profile: ProfileRow | null; history: HistoryRow[]; favorites: ListRow[]; list: ListRow[] }

let lastV: string | null = null
let cache: { b: Bundle; at: number } | null = null
let inflight: Promise<Bundle | null> | null = null
let lastBump = 0

/** One request for profile + History + Favorites + Watchlist, served from Upstash Redis by /api/me/library. */
export function fetchBundle(): Promise<Bundle | null> {
  if (cache && Date.now() - cache.at < 3000) return Promise.resolve(cache.b)
  if (inflight) return inflight
  inflight = fetch("/api/me/library", { cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) return null
      const j = (await r.json()) as Bundle
      if (!Array.isArray(j.history)) return null
      lastV = j.v
      cache = { b: j, at: Date.now() }
      return j
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Real time: true when this account's data changed somewhere else (another device) since the last read. */
export async function pollLibrary(): Promise<boolean> {
  if (lastV === null) return false
  try {
    const r = await fetch(`/api/me/library?v=${encodeURIComponent(lastV)}`, { cache: "no-store" })
    if (!r.ok) return false
    const j = (await r.json()) as Bundle & { changed: boolean }
    if (!j.changed) return false
    lastV = j.v
    cache = { b: j, at: Date.now() }
    return true
  } catch {
    return false
  }
}

/** Tell the server something was written, so its Redis copy is refreshed and other devices update. */
export function bumpLibrary(throttleMs = 0): Promise<void> {
  const now = Date.now()
  if (now - lastBump < throttleMs) return Promise.resolve()
  lastBump = now
  cache = null
  inflight = null
  return fetch("/api/me/library", { method: "POST", keepalive: true })
    .then(async (r) => {
      if (r.ok) lastV = ((await r.json()) as { v: string }).v
    })
    .catch(() => {})
}

const HISTORY_KEY = "anibiar:history"
const LIST_KEY = "anibiar:mylist"

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode: it just won't persist locally */
  }
}

type HistoryRow = {
  anime_id: number
  episode: number
  audio: string
  position: number
  duration: number
  title: string
  image: string | null
  total_episodes: number | null
  updated_at: string
}
const fromRow = (r: HistoryRow): HistoryItem => ({
  animeId: r.anime_id,
  episode: r.episode,
  audio: r.audio === "dub" ? "dub" : "sub",
  position: r.position,
  duration: r.duration,
  title: r.title,
  image: r.image,
  totalEpisodes: r.total_episodes,
  updatedAt: new Date(r.updated_at).getTime(),
})
const toRow = (userId: string, h: HistoryItem) => ({
  user_id: userId,
  anime_id: h.animeId,
  episode: h.episode,
  audio: h.audio,
  position: h.position,
  duration: h.duration,
  title: h.title,
  image: h.image,
  total_episodes: h.totalEpisodes,
  updated_at: new Date(h.updatedAt).toISOString(),
})

/** A show you finished (past 92%) of its last episode is not worth "continuing". */
export const isFinished = (h: HistoryItem) =>
  h.duration > 0 && h.position / h.duration > 0.92 && (!h.totalEpisodes || h.episode >= h.totalEpisodes)

export function localHistory(): HistoryItem[] {
  return read<HistoryItem>(HISTORY_KEY).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveProgress(item: Omit<HistoryItem, "updatedAt">, userId?: string | null) {
  const full: HistoryItem = { ...item, updatedAt: Date.now() }
  write(HISTORY_KEY, [full, ...read<HistoryItem>(HISTORY_KEY).filter((h) => h.animeId !== item.animeId)].slice(0, 60))
  if (!userId) return
  try {
    await getSupabase().from("watch_history").upsert(toRow(userId, full), { onConflict: "user_id,anime_id" })
    void bumpLibrary(15000)
  } catch {
    /* offline: the local copy is still there */
  }
}

/** Local + account history, newest first. Local-only entries are pushed to the account. */
export async function loadHistory(userId?: string | null): Promise<HistoryItem[]> {
  const local = localHistory()
  if (!userId) return local
  try {
    let rows = (await fetchBundle())?.history
    if (!rows) {
      const { data, error } = await getSupabase()
        .from("watch_history")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(60)
      if (error || !data) return local
      rows = data as HistoryRow[]
    }
    const remote = rows.map(fromRow)
    const byId = new Map(remote.map((h) => [h.animeId, h]))
    const push: HistoryItem[] = []
    for (const h of local) {
      const r = byId.get(h.animeId)
      if (!r || h.updatedAt > r.updatedAt) {
        byId.set(h.animeId, h)
        push.push(h)
      }
    }
    if (push.length) {
      await getSupabase().from("watch_history").upsert(push.map((h) => toRow(userId, h)), { onConflict: "user_id,anime_id" })
      void bumpLibrary()
    }
    const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
    write(HISTORY_KEY, merged.slice(0, 60))
    return merged
  } catch {
    return local
  }
}

export async function removeHistory(animeId: number, userId?: string | null) {
  write(HISTORY_KEY, read<HistoryItem>(HISTORY_KEY).filter((h) => h.animeId !== animeId))
  if (!userId) return
  try {
    await getSupabase().from("watch_history").delete().eq("user_id", userId).eq("anime_id", animeId)
    void bumpLibrary()
  } catch {}
}

/* ------------------- my list and favorites (same shape) ------------------- */

function collection(table: "my_list" | "favorites", key: string) {
  const local = () => read<ListItem>(key).sort((a, b) => b.addedAt - a.addedAt)

  async function load(userId?: string | null): Promise<ListItem[]> {
    const mine = local()
    if (!userId) return mine
    try {
      const bundle = await fetchBundle()
      let rows: ListRow[] | undefined = bundle ? (table === "favorites" ? bundle.favorites : bundle.list) : undefined
      if (!rows) {
        const { data, error } = await getSupabase().from(table).select("*").eq("user_id", userId).order("added_at", { ascending: false })
        if (error || !data) return mine
        rows = data as ListRow[]
      }
      const remote = rows.map((r) => ({
        animeId: r.anime_id,
        title: r.title,
        image: r.image,
        addedAt: new Date(r.added_at).getTime(),
      }))
      const have = new Set(remote.map((r) => r.animeId))
      const extra = mine.filter((l) => !have.has(l.animeId))
      if (extra.length) {
        await getSupabase().from(table).upsert(
          extra.map((l) => ({ user_id: userId, anime_id: l.animeId, title: l.title, image: l.image, added_at: new Date(l.addedAt).toISOString() })),
          { onConflict: "user_id,anime_id" }
        )
        void bumpLibrary()
      }
      const merged = [...remote, ...extra].sort((a, b) => b.addedAt - a.addedAt)
      write(key, merged)
      return merged
    } catch {
      return mine
    }
  }

  /** Returns true when the title is in the collection afterwards. */
  async function toggle(item: Omit<ListItem, "addedAt">, userId?: string | null): Promise<boolean> {
    const all = read<ListItem>(key)
    const has = all.some((l) => l.animeId === item.animeId)
    write(key, has ? all.filter((l) => l.animeId !== item.animeId) : [{ ...item, addedAt: Date.now() }, ...all])
    if (userId) {
      try {
        const t = getSupabase().from(table)
        if (has) await t.delete().eq("user_id", userId).eq("anime_id", item.animeId)
        else await t.upsert({ user_id: userId, anime_id: item.animeId, title: item.title, image: item.image }, { onConflict: "user_id,anime_id" })
        void bumpLibrary()
      } catch {}
    }
    return !has
  }
  return { local, load, toggle }
}

const myList = collection("my_list", LIST_KEY)
const favs = collection("favorites", "anibiar:favorites")

export const localList = myList.local
export const loadList = myList.load
export const toggleList = myList.toggle
export const localFavorites = favs.local
export const loadFavorites = favs.load
export const toggleFavorite = favs.toggle
