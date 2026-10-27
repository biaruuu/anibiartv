"use client"

/**
 * Animated avatar decorations. The list lives in Supabase (`avatar_decorations`) and comes through
 * /api/decorations (cached in Upstash Redis); the copy below is only used until that answers or if it fails.
 * Each decoration is an animated PNG (plays by itself on the page) plus a sprite sheet (for the share picture and Live clip).
 */
import * as React from "react"

export type Decoration = {
  id: string
  label: string
  apng: string
  sheet: string
  frames: number
  cols: number
  frame_size: number
  fps: number
  /** Decoration width relative to the avatar picture (Discord draws its decorations at 1.2). */
  scale: number
}
export type DecorationId = string

export const DECORATION_FALLBACK: Decoration[] = [
  {
    "id": "cozy-cat",
    "label": "Cat ears",
    "apng": "/decorations/cozy-cat.png",
    "sheet": "/decorations/cozy-cat.sheet.png",
    "frames": 60,
    "cols": 10,
    "frame_size": 288,
    "fps": 12.0,
    "scale": 1.2
  },
  {
    "id": "bunny",
    "label": "Bunny",
    "apng": "/decorations/bunny.png",
    "sheet": "/decorations/bunny.sheet.png",
    "frames": 24,
    "cols": 10,
    "frame_size": 256,
    "fps": 12.05,
    "scale": 1.5
  },
  {
    "id": "halo",
    "label": "Halo",
    "apng": "/decorations/halo.png",
    "sheet": "/decorations/halo.sheet.png",
    "frames": 24,
    "cols": 10,
    "frame_size": 256,
    "fps": 12.05,
    "scale": 1.5
  },
  {
    "id": "crown",
    "label": "Crown",
    "apng": "/decorations/crown.png",
    "sheet": "/decorations/crown.sheet.png",
    "frames": 24,
    "cols": 10,
    "frame_size": 256,
    "fps": 12.05,
    "scale": 1.5
  },
  {
    "id": "flames",
    "label": "Flames",
    "apng": "/decorations/flames.png",
    "sheet": "/decorations/flames.sheet.png",
    "frames": 24,
    "cols": 10,
    "frame_size": 256,
    "fps": 12.05,
    "scale": 1.5
  },
  {
    "id": "frost",
    "label": "Frost",
    "apng": "/decorations/frost.png",
    "sheet": "/decorations/frost.sheet.png",
    "frames": 24,
    "cols": 10,
    "frame_size": 256,
    "fps": 12.05,
    "scale": 1.5
  }
]

let list: Decoration[] = DECORATION_FALLBACK
let pending: Promise<Decoration[]> | null = null

export function loadDecorations(): Promise<Decoration[]> {
  if (pending) return pending
  pending = fetch("/api/decorations")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { decorations?: Decoration[] } | null) => {
      if (j?.decorations?.length) list = j.decorations
      return list
    })
    .catch(() => list)
  return pending
}

export const findDecoration = (id: string | null | undefined, from: Decoration[] = list) => (id ? from.find((d) => d.id === id) ?? null : null)

/** The decoration list (starts with the built-in copy, then switches to the database one). */
export function useDecorations(): Decoration[] {
  const [items, setItems] = React.useState(list)
  React.useEffect(() => {
    let alive = true
    void loadDecorations().then((l) => alive && setItems(l))
    return () => {
      alive = false
    }
  }, [])
  return items
}
