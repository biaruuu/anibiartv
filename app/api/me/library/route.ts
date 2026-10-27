import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { redisBump, redisEnabled, redisGetJson, redisGetText, redisSetJson } from "@/lib/redis"
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "private, no-store" }

async function whoAmI() {
  const store = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          /* read-only context: fine */
        }
      },
    },
  })
  const { data } = await supabase.auth.getUser()
  return data.user ? { id: data.user.id, supabase } : null
}

type Bundle = { v: string; profile: unknown; history: unknown[]; favorites: unknown[]; list: unknown[] }

/**
 * The signed-in viewer's profile + History + Favorites + Watchlist in one request, served from Upstash Redis
 * when it is there and rebuilt from Supabase when it is not. `?v=` is the version the browser already has:
 * if nothing changed only `{ changed: false }` comes back (this is what the real-time polling uses).
 */
export async function GET(req: Request) {
  const me = await whoAmI()
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: NO_STORE })

  const known = new URL(req.url).searchParams.get("v")
  const version = (await redisGetText(`libv:${me.id}`)) ?? "0"
  if (known !== null && known === version) return NextResponse.json({ changed: false, v: version }, { headers: NO_STORE })

  const hit = await redisGetJson<Bundle>(`lib:${me.id}`)
  if (hit && hit.v === version) return NextResponse.json({ changed: true, source: "redis", ...hit }, { headers: NO_STORE })

  const [profile, history, favorites, list] = await Promise.all([
    me.supabase.from("profiles").select("username, avatar_url, banner_url, bio, handle, effect").eq("id", me.id).maybeSingle(),
    me.supabase.from("watch_history").select("*").eq("user_id", me.id).order("updated_at", { ascending: false }).limit(60),
    me.supabase.from("favorites").select("*").eq("user_id", me.id).order("added_at", { ascending: false }).limit(500),
    me.supabase.from("my_list").select("*").eq("user_id", me.id).order("added_at", { ascending: false }).limit(500),
  ])
  if (history.error || favorites.error || list.error) {
    return NextResponse.json({ error: "Could not load your library" }, { status: 502, headers: NO_STORE })
  }
  const bundle: Bundle = {
    v: version,
    profile: profile.data ?? null,
    history: history.data ?? [],
    favorites: favorites.data ?? [],
    list: list.data ?? [],
  }
  void redisSetJson(`lib:${me.id}`, bundle, 60 * 60 * 24)
  return NextResponse.json({ changed: true, source: redisEnabled ? "supabase+redis" : "supabase", ...bundle }, { headers: NO_STORE })
}

/** Called after a write to Supabase: clears the cached copy and moves the version (so other devices update). */
export async function POST() {
  const me = await whoAmI()
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: NO_STORE })
  const v = await redisBump(me.id)
  return NextResponse.json({ ok: true, v }, { headers: NO_STORE })
}
