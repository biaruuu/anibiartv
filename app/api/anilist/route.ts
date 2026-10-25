import { NextResponse } from "next/server"

import { cached, digest } from "@/lib/redis"

export const maxDuration = 30

const ENDPOINT = "https://graphql.anilist.co"

class Upstream extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message)
  }
}

/** How long an answer stays fresh, from what kind of question it is. */
function ttlFor(query: string) {
  if (/airingSchedules/.test(query)) return 120 // latest episodes
  if (/id_in/.test(query)) return 6 * 3600 // franchise graph
  if (/\bsearch\s*:/.test(query)) return 600
  if (/characters\s*\(/.test(query)) return 3600
  return 900
}

/**
 * Shared, cached door to AniList's GraphQL API. Everyone's identical questions are answered
 * from Redis, which also keeps the combined request rate far below AniList's limit.
 * The browser falls back to asking AniList itself whenever this route can't answer.
 */
export async function POST(req: Request) {
  const text = await req.text()
  if (text.length > 12_000) return NextResponse.json({ errors: [{ message: "Request too large." }] }, { status: 413 })

  let body: { query?: unknown; variables?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ errors: [{ message: "Invalid JSON." }] }, { status: 400 })
  }
  const query = typeof body.query === "string" ? body.query : ""
  if (!/^\s*query\b/.test(query)) {
    return NextResponse.json({ errors: [{ message: "Only queries are allowed." }] }, { status: 400 })
  }
  const variables = body.variables && typeof body.variables === "object" ? body.variables : {}

  try {
    const data = await cached(
      `al:v1:${digest(query + JSON.stringify(variables))}`,
      ttlFor(query),
      async () => {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        })
        const json = (await res.json().catch(() => null)) as { data?: unknown; errors?: { message: string }[] } | null
        if (!res.ok || !json || json.errors?.length || !json.data) {
          throw new Upstream(json?.errors?.[0]?.message ?? `AniList HTTP ${res.status}`, res.status, json)
        }
        return json.data
      },
      { stale: 24 * 3600 }
    )
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    if (e instanceof Upstream && e.status >= 400 && e.status < 500 && e.status !== 429) {
      // A real answer such as "not found": pass it on so the page can show it.
      return NextResponse.json({ errors: [{ message: e.message }] }, { status: e.status })
    }
    return NextResponse.json({ errors: [{ message: "AniList is busy." }] }, { status: 503 })
  }
}
