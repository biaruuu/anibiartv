"use client"

/**
 * Exclusive profile art: full-profile "intro" effects and animated profile frames.
 * The list lives in Supabase (`profile_art`) and comes through /api/profile-art (cached in Upstash Redis);
 * the copy below is only used until that answers or if it fails.
 */
import * as React from "react"

export type ArtKind = "intro" | "frame"
export type ProfileArt = {
  id: string
  kind: ArtKind
  label: string
  /** intro: the one-shot animation (plays once). frame: the looping 9-slice frame. */
  apng: string
  /** intro only: the soft loop that stays after the intro. */
  idle: string | null
  /** Sprite sheet for the share picture / Live clip. */
  sheet: string
  frames: number
  cols: number
  frame_w: number
  frame_h: number
  fps: number
  /** intro only: how long the one-shot lasts. */
  intro_ms: number
}

export const ART_FALLBACK: ProfileArt[] = [
  { id: "tybw-intro", kind: "intro", label: "Blood War", apng: "/profile-art/tybw-intro.webp", idle: "/profile-art/tybw-intro.idle.webp", sheet: "/profile-art/tybw-intro.sheet.png", frames: 30, cols: 10, frame_w: 320, frame_h: 240, fps: 10, intro_ms: 2000 },
  { id: "tybw-frame", kind: "frame", label: "Blood War", apng: "/profile-art/tybw-frame.webp", idle: null, sheet: "/profile-art/tybw-frame.sheet.png", frames: 24, cols: 10, frame_w: 150, frame_h: 150, fps: 12.05, intro_ms: 0 },
]

let list: ProfileArt[] = ART_FALLBACK
let pending: Promise<ProfileArt[]> | null = null

export function loadProfileArt(): Promise<ProfileArt[]> {
  if (pending) return pending
  pending = fetch("/api/profile-art")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { art?: ProfileArt[] } | null) => {
      if (j?.art?.length) list = j.art
      return list
    })
    .catch(() => list)
  return pending
}

export const findArt = (id: string | null | undefined, kind: ArtKind, from: ProfileArt[] = list) => (id ? from.find((a) => a.id === id && a.kind === kind) ?? null : null)
export const thumbOf = (a: ProfileArt) => a.apng.replace(/\.(png|webp)$/, ".thumb.png")

export function useProfileArt(): ProfileArt[] {
  const [items, setItems] = React.useState(list)
  React.useEffect(() => {
    let alive = true
    void loadProfileArt().then((l) => alive && setItems(l))
    return () => {
      alive = false
    }
  }, [])
  return items
}
