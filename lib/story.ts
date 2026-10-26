"use client"

/** Draws the viewer's profile as a 1080x1920 (9:16) picture for Instagram / Facebook stories. */
import type { HistoryItem, ListItem } from "@/lib/library"

export type StoryTab = "history" | "favorites" | "list"
export type StoryInput = {
  name: string
  handle: string | null
  bio: string | null
  avatar: string | null
  banner: string | null
  tab: StoryTab
  history: HistoryItem[]
  favorites: ListItem[]
  list: ListItem[]
  host: string
}

export const STORY_W = 1080
export const STORY_H = 1920
const PAD = 60
const BG = "#121113"
const CARD = "#26242a"
const FONT = "Poppins, Karla, system-ui, sans-serif"

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

function cover(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, r = 0) {
  ctx.save()
  rr(ctx, x, y, w, h, r)
  ctx.clip()
  if (img) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const dw = img.naturalWidth * s
    const dh = img.naturalHeight * s
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = CARD
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
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

type Card = { image: string | null; title: string; sub?: string; progress?: number }

export async function renderStory(i: StoryInput): Promise<HTMLCanvasElement> {
  try {
    await Promise.all(["400", "600", "700"].map((w) => document.fonts.load(`${w} 40px Poppins`)))
  } catch {
    /* falls back to the system font */
  }

  const landscape = i.tab === "history"
  const cards: Card[] =
    i.tab === "history"
      ? i.history.slice(0, 9).map((h) => ({
          image: h.image,
          title: h.title,
          sub: `Episode ${h.episode}${h.totalEpisodes ? ` / ${h.totalEpisodes}` : ""}${h.audio === "dub" ? " · Dub" : ""}`,
          progress: h.duration > 0 ? Math.min(1, h.position / h.duration) : 0,
        }))
      : (i.tab === "favorites" ? i.favorites : i.list).slice(0, 12).map((l) => ({ image: l.image, title: l.title }))
  const total = i.tab === "history" ? i.history.length : (i.tab === "favorites" ? i.favorites : i.list).length

  // grid geometry
  const gap = landscape ? 24 : 20
  const cols = landscape ? 2 : 4
  const cw = (STORY_W - PAD * 2 - gap * (cols - 1)) / cols
  const ch = landscape ? Math.round(cw * 0.46) : Math.round(cw * 1.5)
  const textH = landscape ? 78 : 50

  const c = document.createElement("canvas")
  c.width = STORY_W
  c.height = STORY_H
  const ctx = c.getContext("2d")!

  const [avatar, banner, logo, ...covers] = await Promise.all([
    loadImage(i.avatar),
    loadImage(i.banner),
    loadImage("/logo-mark.svg"),
    ...cards.map((k) => loadImage(k.image)),
  ])

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, STORY_W, STORY_H)

  // banner
  const BANNER_H = 340
  cover(ctx, banner, 0, 0, STORY_W, BANNER_H)

  // avatar with a solid ring
  const D = 232
  const ax = PAD
  const ay = BANNER_H - D / 2
  ctx.fillStyle = BG
  ctx.beginPath()
  ctx.arc(ax + D / 2, ay + D / 2, D / 2 + 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.arc(ax + D / 2, ay + D / 2, D / 2, 0, Math.PI * 2)
  ctx.clip()
  if (avatar) {
    const s = Math.max(D / avatar.naturalWidth, D / avatar.naturalHeight)
    const dw = avatar.naturalWidth * s
    const dh = avatar.naturalHeight * s
    ctx.drawImage(avatar, ax + (D - dw) / 2, ay + (D - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = "#2a282d"
    ctx.fillRect(ax, ay, D, D)
    ctx.fillStyle = "rgba(255,255,255,.75)"
    ctx.font = `700 110px ${FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((i.name.trim()[0] ?? "?").toUpperCase(), ax + D / 2, ay + D / 2 + 6)
  }
  ctx.restore()

  // name, username, bio
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  let y = ay + D + 84
  ctx.fillStyle = "#ffffff"
  ctx.font = `700 64px ${FONT}`
  ctx.fillText(fit(ctx, i.name, STORY_W - PAD * 2), PAD, y)
  if (i.handle) {
    y += 52
    ctx.fillStyle = "rgba(255,255,255,.65)"
    ctx.font = `400 34px ${FONT}`
    ctx.fillText(`@${i.handle}`, PAD, y)
  }
  if (i.bio) {
    ctx.font = `400 32px ${FONT}`
    ctx.fillStyle = "rgba(255,255,255,.82)"
    for (const line of wrap(ctx, i.bio, STORY_W - PAD * 2, 2)) {
      y += 46
      ctx.fillText(line, PAD, y)
    }
  }

  // section title
  y += 84
  ctx.fillStyle = "#ffffff"
  ctx.font = `700 46px ${FONT}`
  ctx.fillText(TAB_LABEL[i.tab], PAD, y)
  ctx.textAlign = "right"
  ctx.fillStyle = "rgba(255,255,255,.55)"
  ctx.font = `400 30px ${FONT}`
  ctx.fillText(`${total} ${total === 1 ? "title" : "titles"}`, STORY_W - PAD, y)
  ctx.textAlign = "left"
  ctx.fillStyle = "rgba(255,255,255,.15)"
  ctx.fillRect(PAD, y + 20, STORY_W - PAD * 2, 2)

  // grid
  const gridTop = y + 56
  const gridBottom = STORY_H - 152
  const rowH = ch + textH + gap
  const rows = Math.max(1, Math.floor((gridBottom - gridTop + gap) / rowH))
  const shown = Math.min(cards.length, rows * cols)

  if (!cards.length) {
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(255,255,255,.5)"
    ctx.font = `400 36px ${FONT}`
    ctx.fillText("Nothing here yet", STORY_W / 2, gridTop + 140)
    ctx.textAlign = "left"
  }
  for (let n = 0; n < shown; n++) {
    const k = cards[n]
    const x = PAD + (n % cols) * (cw + gap)
    const top = gridTop + Math.floor(n / cols) * rowH
    cover(ctx, covers[n] ?? null, x, top, cw, ch, 22)
    if (k.progress !== undefined) {
      ctx.save()
      rr(ctx, x, top, cw, ch, 22)
      ctx.clip()
      ctx.fillStyle = "rgba(255,255,255,.3)"
      ctx.fillRect(x, top + ch - 8, cw, 8)
      ctx.fillStyle = "#dc2626"
      ctx.fillRect(x, top + ch - 8, cw * Math.max(0.03, k.progress), 8)
      ctx.restore()
    }
    ctx.fillStyle = "#ffffff"
    ctx.font = `600 ${landscape ? 28 : 24}px ${FONT}`
    ctx.fillText(fit(ctx, k.title, cw), x, top + ch + (landscape ? 38 : 34))
    if (k.sub) {
      ctx.fillStyle = "rgba(255,255,255,.6)"
      ctx.font = `400 24px ${FONT}`
      ctx.fillText(fit(ctx, k.sub, cw), x, top + ch + 68)
    }
  }

  // footer
  const fy = STORY_H - 96
  ctx.fillStyle = "rgba(255,255,255,.15)"
  ctx.fillRect(PAD, fy - 40, STORY_W - PAD * 2, 2)
  if (logo) ctx.drawImage(logo, PAD, fy - 6, 64, 64)
  ctx.fillStyle = "#ffffff"
  ctx.font = `700 38px ${FONT}`
  ctx.fillText("AniBiar TV", PAD + 84, fy + 26)
  ctx.fillStyle = "rgba(255,255,255,.6)"
  ctx.font = `400 26px ${FONT}`
  ctx.fillText(i.host, PAD + 84, fy + 62)

  return c
}

export const canvasToBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"))
