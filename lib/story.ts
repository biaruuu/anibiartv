"use client"

/** Draws the viewer's profile page as a picture (a clean "screenshot") for Instagram / Facebook stories and posts. */
import { findDecoration, loadDecorations, type DecorationId } from "@/lib/decorations"
import { decodeGif, isGif } from "@/lib/gif"
import type { HistoryItem, ListItem } from "@/lib/library"

export type StoryTab = "history" | "favorites" | "list"
export type StoryFormat = "story" | "post" | "screen"
export type StoryInput = {
  name: string
  handle: string | null
  bio: string | null
  joined: string | null
  avatar: string | null
  banner: string | null
  decoration?: DecorationId | null
  tab: StoryTab
  history: HistoryItem[]
  favorites: ListItem[]
  list: ListItem[]
  host: string
  format: StoryFormat
}

export const STORY_W = 1080
const BG = "#000000"
const ACCENT = "#5865f2"
const CARD = "#141416"
const FONT = '"Karla Variable", Karla, system-ui, sans-serif'

export const FORMAT_LABEL: Record<StoryFormat, string> = { story: "Story 9:16", post: "Post 4:5", screen: "My screen" }

/** Height / width of the picture for each format. "My screen" follows this device's own screen shape. */
export function ratioFor(format: StoryFormat): number {
  if (format === "story") return 16 / 9
  if (format === "post") return 5 / 4
  if (typeof screen === "undefined" || !screen.width || !screen.height) return 19.5 / 9
  const r = screen.height / screen.width
  // phones and tablets in portrait keep their own shape; landscape screens get a tall phone-like picture
  return r >= 1 ? Math.min(2.4, Math.max(1.25, r)) : 19.5 / 9
}

export function sizeFor(format: StoryFormat): { w: number; h: number } {
  return { w: STORY_W, h: Math.round(STORY_W * ratioFor(format)) }
}

export const TAB_LABEL: Record<StoryTab, string> = { history: "History", favorites: "Favorites", list: "Watchlist" }

const viaProxy = (src: string) => (src.startsWith("/") || src.startsWith("blob:") || src.startsWith("data:") ? src : `/api/img?u=${encodeURIComponent(src)}`)

function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = viaProxy(src)
  })
}

/** A picture that may move: `at(t)` gives what to draw `t` milliseconds into the clip. */
export type Media = { w: number; h: number; animated: boolean; loopMs: number; at: (t: number) => CanvasImageSource }

/** Loads a picture; GIFs are decoded into frames so they keep moving. */
async function loadMedia(src: string | null | undefined, maxW: number): Promise<Media | null> {
  if (!src) return null
  try {
    const res = await fetch(viaProxy(src))
    if (!res.ok) throw new Error("bad")
    const buf = new Uint8Array(await res.arrayBuffer())
    if (isGif(buf)) {
      const g = decodeGif(buf, maxW)
      if (g && g.frames.length > 1) {
        const starts: number[] = []
        let acc = 0
        for (const f of g.frames) {
          starts.push(acc)
          acc += f.delay
        }
        return {
          w: g.width,
          h: g.height,
          animated: true,
          loopMs: g.total,
          at: (t) => {
            const m = t % g.total
            let lo = 0
            for (let n = starts.length - 1; n >= 0; n--) {
              if (starts[n] <= m) {
                lo = n
                break
              }
            }
            return g.frames[lo].canvas
          },
        }
      }
    }
    const url = URL.createObjectURL(new Blob([buf], { type: res.headers.get("content-type") ?? "image/png" }))
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => resolve(null)
      el.src = url
    })
    if (!img) return loadImage(src).then((i) => (i ? { w: i.naturalWidth, h: i.naturalHeight, animated: false, loopMs: 0, at: () => i } : null))
    return { w: img.naturalWidth, h: img.naturalHeight, animated: false, loopMs: 0, at: () => img }
  } catch {
    const i = await loadImage(src)
    return i ? { w: i.naturalWidth, h: i.naturalHeight, animated: false, loopMs: 0, at: () => i } : null
  }
}

type Ctx = CanvasRenderingContext2D

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.arcTo(x + w, y, x + w, y + h, k)
  ctx.arcTo(x + w, y + h, x, y + h, k)
  ctx.arcTo(x, y + h, x, y, k)
  ctx.arcTo(x, y, x + w, y, k)
  ctx.closePath()
}

function fit(ctx: Ctx, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxW || !line) line = test
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = fit(ctx, `${lines[maxLines - 1]}…`, maxW)
  }
  return lines
}

type Card = { image: string | null; title: string; sub?: string; progress?: number; left?: string }

const clock = (s: number) => {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

type Variant = 0 | 1 | 2 // 0 everything, 1 without Member Since, 2 without Bio and Member Since

type Plan = {
  Wc: number
  Hl: number
  variant: Variant
  bannerH: number
  nameY: number
  handleY: number | null
  bioY: number | null
  bioLines: string[]
  memberY: number | null
  tabsY: number
  gridTop: number
  cols: number
  cw: number
  gapX: number
  gapY: number
  landscape: boolean
  posterH: number
  rows: { start: number; count: number; top: number; lines: string[][]; textH: number }[]
  fits: boolean
  contentH: number
}

const PX = 16 // the page's side padding
const BANNER = 144
const AV = 96
const TITLE_LH = 16

/** Lays the picture out in the same CSS pixels the profile page uses on a phone, so it looks like a screenshot. */
/** `scrollMaxH`: lay out every row (the picture is as tall as the content), up to that height. */
function layout(ctx: Ctx, i: StoryInput, cards: Card[], Wc: number, Hl: number, variant: Variant, scrollMaxH?: number): Plan {
  const landscape = i.tab === "history"
  const inner = Wc - PX * 2
  const cols = landscape ? (Wc >= 480 ? 2 : 1) : 3
  const gapX = landscape ? 16 : 10
  const gapY = landscape ? 24 : 20
  const cw = (inner - gapX * (cols - 1)) / cols
  const posterH = landscape ? cw * (9 / 16) : cw * 1.5

  let y = BANNER + AV / 2 + 12 // below the avatar, like `mt-3`
  const nameY = y + 28
  y += 36
  let handleY: number | null = null
  if (i.handle) {
    handleY = y + 2 + 18
    y += 2 + 24
  }

  let bioY: number | null = null
  let bioLines: string[] = []
  if (variant === 0 || variant === 1) {
    if (i.bio) {
      ctx.font = `400 16px ${FONT}`
      bioLines = i.bio
        .split("\n")
        .flatMap((l) => wrap(ctx, l || " ", inner, 3))
        .slice(0, 3)
      y += 24
      bioY = y
      y += 24 + 8 + 24 * bioLines.length
    }
  }
  let memberY: number | null = null
  if (variant === 0 && i.joined) {
    y += 24
    memberY = y
    y += 24 + 8 + 24
  }

  y += 24 // mt-6
  const tabsY = y
  y += 44
  const gridTop = y + 20

  const rows: Plan["rows"] = []
  let top = gridTop
  const limit = scrollMaxH ?? Hl - 12
  for (let start = 0; start < cards.length; start += cols) {
    const slice = cards.slice(start, start + cols)
    let lines: string[][]
    let textH: number
    if (landscape) {
      lines = slice.map(() => [])
      textH = 8 + 20 + 16
    } else {
      ctx.font = `500 12px ${FONT}`
      lines = slice.map((c) => wrap(ctx, c.title, cw, 2))
      textH = 6 + TITLE_LH * Math.max(...lines.map((l) => l.length))
    }
    if (top + posterH + textH > limit) break
    rows.push({ start, count: slice.length, top, lines, textH })
    top += posterH + textH + gapY
  }
  const fits = cards.length === 0 || rows.length > 0
  const contentH = Math.max(Hl, rows.length ? top - gapY + 20 : gridTop + 80)
  return { contentH, Wc, Hl, variant, bannerH: BANNER, nameY, handleY, bioY, bioLines, memberY, tabsY, gridTop, cols, cw, gapX, gapY, landscape, posterH, rows, fits }
}

/** `canvas` may be taller than one screen (`viewH` pixels): the whole page, for scrolling clips and full-page pictures. */
export type StoryScene = { canvas: HTMLCanvasElement; animated: boolean; loopMs: number; viewH: number; draw: (t: number) => void }

/** The still picture (a GIF banner or avatar shows its first frame). */
export async function renderStory(i: StoryInput): Promise<HTMLCanvasElement> {
  return (await prepareStory(i)).canvas
}

/** Builds the profile picture and returns a `draw(t)` that advances any moving banner or avatar. */
export async function prepareStory(i: StoryInput, opts: { scroll?: boolean } = {}): Promise<StoryScene> {
  const scroll = !!opts.scroll
  try {
    await Promise.all(["400", "500", "600", "700"].map((w) => document.fonts.load(`${w} 16px "Karla Variable"`)))
  } catch {
    /* falls back to the system font */
  }

  const { w: W, h: H } = sizeFor(i.format)
  const ratio = H / W

  const all: Card[] =
    i.tab === "history"
      ? i.history.map((h) => ({
          image: h.image,
          title: h.title,
          sub: `Episode ${h.episode}${h.totalEpisodes ? ` / ${h.totalEpisodes}` : ""}${h.audio === "dub" ? " · Dub" : ""}`,
          progress: h.duration > 0 ? Math.min(1, Math.max(0.02, h.position / h.duration)) : 0.02,
          left: h.duration > 0 ? `${clock(h.duration - h.position)} left` : undefined,
        }))
      : (i.tab === "favorites" ? i.favorites : i.list).map((l) => ({ image: l.image, title: l.title }))
  const cards = all.slice(0, 3) // the picture shows the first 3, like a row on the page

  const measure = document.createElement("canvas").getContext("2d")!
  const ctx0 = measure

  // Try the phone-sized layout first; if this shape is too short, make the pieces a bit smaller, then drop the extras.
  let plan: Plan | null = null
  if (scroll) {
    // everything is laid out in full at phone size; a canvas can only be so tall, so very long lists stop there
    plan = layout(ctx0, i, cards, 390, 390 * ratio, 0, 14000 / (W / 390))
  } else {
    search: for (const variant of [0, 1, 2] as Variant[]) {
      for (let Wc = 390; Wc <= 620; Wc += 5) {
        const p = layout(ctx0, i, cards, Wc, Wc * ratio, variant)
        plan = p
        if (p.fits) break search
      }
    }
  }
  const p = plan!
  const s = W / p.Wc
  const pageH = scroll ? Math.round(p.contentH * s) : H
  const c = document.createElement("canvas")
  c.width = W
  c.height = pageH
  const ctx = c.getContext("2d")!
  ctx.setTransform(s, 0, 0, s, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  const decos = await loadDecorations()
  const deco = findDecoration(i.decoration, decos)
  const [avatar, banner, logo, decoSheet, ...covers] = await Promise.all([
    loadMedia(i.avatar, 360),
    loadMedia(i.banner, 800),
    loadImage("/logo-mark.svg"),
    loadImage(deco?.sheet),
    ...cards.map((card) => loadImage(card.image)),
  ])

  const Wc = p.Wc
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, Wc, pageH / s)

  // banner and avatar are redrawn on their own for every frame of a moving picture
  const ax = PX
  const ay = p.bannerH - AV / 2
  const inset = 4
  const D = AV - inset * 2
  const drawBanner = (t: number) => {
    if (banner) {
      const src = banner.at(t)
      const k = Math.max(Wc / banner.w, p.bannerH / banner.h)
      const dw = banner.w * k
      const dh = banner.h * k
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, Wc, p.bannerH)
      ctx.clip()
      ctx.drawImage(src, (Wc - dw) / 2, (p.bannerH - dh) / 2, dw, dh)
      ctx.restore()
    } else {
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, Wc, p.bannerH)
      ctx.fillStyle = "rgba(255,255,255,.08)"
      ctx.fillRect(0, 0, Wc, p.bannerH)
    }
  }
  /** The decoration (animated sprite sheet) drawn on top of the avatar, Discord style: `scale` x the avatar picture, centred. */
  const drawDecoration = (t: number) => {
    if (!deco || !decoSheet) return
    const box = deco.scale * D
    const idx = Math.floor((t / 1000) * deco.fps) % deco.frames
    const fs = deco.frame_size
    ctx.drawImage(
      decoSheet,
      (idx % deco.cols) * fs,
      Math.floor(idx / deco.cols) * fs,
      fs,
      fs,
      ax + AV / 2 - box / 2,
      ay + AV / 2 - box / 2,
      box,
      box
    )
  }
  const drawAvatar = (t: number) => {
    ctx.fillStyle = BG
    ctx.beginPath()
    ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2 + 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.beginPath()
    ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2 - inset, 0, Math.PI * 2)
    ctx.clip()
    if (avatar) {
      const k = Math.max(D / avatar.w, D / avatar.h)
      const dw = avatar.w * k
      const dh = avatar.h * k
      ctx.drawImage(avatar.at(t), ax + inset + (D - dw) / 2, ay + inset + (D - dh) / 2, dw, dh)
    } else {
      ctx.fillStyle = "#141416"
      ctx.fillRect(ax, ay, AV, AV)
      ctx.fillStyle = "rgba(255,255,255,.6)"
      ctx.font = `700 44px ${FONT}`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText((i.name.trim()[0] ?? "?").toUpperCase(), ax + AV / 2, ay + AV / 2 + 2)
    }
    ctx.restore()
    drawDecoration(t)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
  }
  const drawName = () => {
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = "#ffffff"
    ctx.font = `700 30px ${FONT}`
    ctx.fillText(fit(ctx, i.name, Wc - PX * 2), PX, p.nameY)
  }
  /** One frame of the header: banner, the name, then the avatar and its decoration on top. */
  const drawHeader = (t: number) => {
    drawBanner(t)
    ctx.fillStyle = BG
    ctx.fillRect(0, p.bannerH, Wc, AV / 2 + 30)
    drawName()
    drawAvatar(t)
  }
  drawHeader(0)

  // username
  if (i.handle && p.handleY !== null) {
    ctx.textAlign = "left"
    ctx.fillStyle = "rgba(255,255,255,.7)"
    ctx.font = `400 16px ${FONT}`
    ctx.fillText(i.handle, PX, p.handleY)
  }

  // Bio and Member Since
  if (p.bioY !== null) {
    ctx.fillStyle = "#ffffff"
    ctx.font = `600 16px ${FONT}`
    ctx.fillText("Bio", PX, p.bioY + 17)
    ctx.fillStyle = "rgba(255,255,255,.8)"
    ctx.font = `400 16px ${FONT}`
    p.bioLines.forEach((line, n) => ctx.fillText(line, PX, p.bioY! + 24 + 8 + 17 + n * 24))
  }
  if (p.memberY !== null && i.joined) {
    ctx.fillStyle = "#ffffff"
    ctx.font = `600 16px ${FONT}`
    ctx.fillText("Member Since", PX, p.memberY + 17)
    const iy = p.memberY + 24 + 8
    if (logo) ctx.drawImage(logo, PX, iy, 24, 24)
    ctx.fillStyle = "rgba(255,255,255,.8)"
    ctx.font = `400 16px ${FONT}`
    ctx.fillText(i.joined, PX + 24 + 12, iy + 17)
  }

  // tabs with counts and an underline under the active one
  const tabs: StoryTab[] = ["history", "favorites", "list"]
  const tabW = (Wc - PX * 2) / 3
  tabs.forEach((t, n) => {
    const on = t === i.tab
    ctx.font = `600 14px ${FONT}`
    ctx.textAlign = "center"
    ctx.fillStyle = on ? ACCENT : "#949ba4"
    ctx.fillText(TAB_LABEL[t], PX + tabW * n + tabW / 2, p.tabsY + 27)
    ctx.textAlign = "left"
  })
  ctx.fillStyle = "rgba(255,255,255,.15)"
  ctx.fillRect(0, p.tabsY + 44 - 1, Wc, 1)
  const at = tabs.indexOf(i.tab)
  ctx.fillStyle = ACCENT
  rr(ctx, PX + tabW * at + 12, p.tabsY + 44 - 2, tabW - 24, 2, 1)
  ctx.fill()

  // the list itself, using the page's own card sizes
  if (!cards.length) {
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(255,255,255,.6)"
    ctx.font = `400 14px ${FONT}`
    ctx.fillText("Nothing here yet", Wc / 2, p.gridTop + 56)
    ctx.textAlign = "left"
  }
  for (const row of p.rows) {
    for (let n = 0; n < row.count; n++) {
      const idx = row.start + n
      const card = cards[idx]
      const x = PX + n * (p.cw + p.gapX)
      const top = row.top
      ctx.save()
      rr(ctx, x, top, p.cw, p.posterH, 12)
      ctx.clip()
      ctx.fillStyle = "rgba(255,255,255,.05)"
      ctx.fillRect(x, top, p.cw, p.posterH)
      const img = covers[idx]
      if (img) {
        const k = Math.max(p.cw / img.naturalWidth, p.posterH / img.naturalHeight)
        const dw = img.naturalWidth * k
        const dh = img.naturalHeight * k
        ctx.drawImage(img, x + (p.cw - dw) / 2, top + (p.posterH - dh) / 2, dw, dh)
      }
      if (card.progress !== undefined) {
        ctx.fillStyle = "rgba(255,255,255,.25)"
        ctx.fillRect(x, top + p.posterH - 4, p.cw, 4)
        ctx.fillStyle = "#dc2626"
        ctx.fillRect(x, top + p.posterH - 4, p.cw * card.progress, 4)
      }
      ctx.restore()
      if (card.left) {
        ctx.font = `500 12px ${FONT}`
        const bw = ctx.measureText(card.left).width + 12
        ctx.fillStyle = "rgba(0,0,0,.6)"
        rr(ctx, x + p.cw - 8 - bw, top + p.posterH - 12 - 20, bw, 20, 4)
        ctx.fill()
        ctx.fillStyle = "#ffffff"
        ctx.fillText(card.left, x + p.cw - 8 - bw + 6, top + p.posterH - 12 - 6)
      }
      ctx.fillStyle = "#ffffff"
      if (p.landscape) {
        ctx.font = `600 14px ${FONT}`
        ctx.fillText(fit(ctx, card.title, p.cw), x, top + p.posterH + 8 + 15)
        if (card.sub) {
          ctx.fillStyle = "rgba(255,255,255,.6)"
          ctx.font = `400 12px ${FONT}`
          ctx.fillText(card.sub, x, top + p.posterH + 8 + 20 + 12)
        }
      } else {
        ctx.font = `500 12px ${FONT}`
        row.lines[n].forEach((line, l) => ctx.fillText(line, x, top + p.posterH + 6 + l * TITLE_LH + 12))
      }
    }
  }

  const animated = !!(banner?.animated || avatar?.animated || (deco && deco.frames > 1))
  return {
    canvas: c,
    animated,
    loopMs: Math.max(banner?.loopMs ?? 0, avatar?.loopMs ?? 0),
    viewH: H,
    draw: (t: number) => {
      if (!animated) return
      drawHeader(t)
    },
  }
}

export const canvasToBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"))
