"use client"

/** Draws the viewer's profile as a 1080x1920 (9:16) picture for Instagram / Facebook stories. */
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
  tab: StoryTab
  history: HistoryItem[]
  favorites: ListItem[]
  list: ListItem[]
  host: string
  format: StoryFormat
}

export const STORY_W = 1080
const PAD = 60
const BG = "#121113"
const CARD = "#26242a"
const FONT = "Poppins, Karla, system-ui, sans-serif"

export const FORMAT_LABEL: Record<StoryFormat, string> = { story: "Story 9:16", post: "Post 4:5", screen: "My screen" }

/** Picture size for a format. "My screen" follows this device's own shape, kept within a sensible range. */
export function sizeFor(format: StoryFormat): { w: number; h: number } {
  if (format === "story") return { w: STORY_W, h: 1920 }
  if (format === "post") return { w: STORY_W, h: 1350 }
  const ratio = typeof screen !== "undefined" && screen.width > 0 ? Math.max(screen.width, screen.height) / Math.min(screen.width, screen.height) : 16 / 9
  const portrait = typeof screen === "undefined" || screen.height >= screen.width
  const r = portrait ? ratio : 1 / ratio
  return { w: STORY_W, h: Math.round(Math.min(2400, Math.max(1350, STORY_W * r))) }
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

  const { w: W, h: H } = sizeFor(i.format)
  // Shorter pictures use slightly smaller pieces so everything still fits.
  const k = H < 1700 ? 0.8 : 1
  const px = (n: number) => Math.round(n * k)

  const landscape = i.tab === "history"
  const cards: Card[] =
    i.tab === "history"
      ? i.history.slice(0, 12).map((h) => ({
          image: h.image,
          title: h.title,
          sub: `Episode ${h.episode}${h.totalEpisodes ? ` / ${h.totalEpisodes}` : ""}${h.audio === "dub" ? " · Dub" : ""}`,
          progress: h.duration > 0 ? Math.min(1, h.position / h.duration) : 0,
        }))
      : (i.tab === "favorites" ? i.favorites : i.list).slice(0, 16).map((l) => ({ image: l.image, title: l.title }))

  // grid geometry
  const gap = landscape ? 24 : 20
  const cols = landscape ? 2 : 4
  const cw = (W - PAD * 2 - gap * (cols - 1)) / cols
  const ch = landscape ? Math.round(cw * 0.46) : Math.round(cw * 1.5)
  const textH = landscape ? 78 : 50

  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")!

  const [avatar, banner, logo, ...covers] = await Promise.all([
    loadImage(i.avatar),
    loadImage(i.banner),
    loadImage("/logo-mark.svg"),
    ...cards.map((card) => loadImage(card.image)),
  ])

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // banner
  const BANNER_H = px(340)
  cover(ctx, banner, 0, 0, W, BANNER_H)

  // avatar with a solid ring
  const D = px(232)
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
    ctx.font = `700 ${px(110)}px ${FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((i.name.trim()[0] ?? "?").toUpperCase(), ax + D / 2, ay + D / 2 + 6)
  }
  ctx.restore()

  // name and username
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  let y = ay + D + 12 + px(70)
  ctx.fillStyle = "#ffffff"
  ctx.font = `700 ${px(64)}px ${FONT}`
  ctx.fillText(fit(ctx, i.name, W - PAD * 2), PAD, y)
  if (i.handle) {
    y += px(52)
    ctx.fillStyle = "rgba(255,255,255,.65)"
    ctx.font = `400 ${px(34)}px ${FONT}`
    ctx.fillText(`@${i.handle}`, PAD, y)
  }

  // Bio and Member Since, laid out like the profile page
  const label = (text: string) => {
    ctx.fillStyle = "#ffffff"
    ctx.font = `600 ${px(34)}px ${FONT}`
    ctx.fillText(text, PAD, y)
  }
  if (i.bio) {
    y += px(80)
    label("Bio")
    ctx.font = `400 ${px(32)}px ${FONT}`
    ctx.fillStyle = "rgba(255,255,255,.8)"
    for (const line of wrap(ctx, i.bio, W - PAD * 2, k < 1 ? 1 : 2)) {
      y += px(46)
      ctx.fillText(line, PAD, y)
    }
  }
  if (i.joined) {
    y += px(i.bio ? 74 : 80)
    label("Member Since")
    y += px(56)
    const L = px(44)
    if (logo) ctx.drawImage(logo, PAD, y - L + px(8), L, L)
    ctx.fillStyle = "rgba(255,255,255,.8)"
    ctx.font = `400 ${px(32)}px ${FONT}`
    ctx.fillText(i.joined, PAD + L + 18, y)
  }

  // tab bar with an underline under the active tab, like the page
  y += px(92)
  const tabs: StoryTab[] = ["history", "favorites", "list"]
  const tabW = (W - PAD * 2) / 3
  ctx.textAlign = "center"
  tabs.forEach((t, n) => {
    const on = t === i.tab
    ctx.fillStyle = on ? "#ffffff" : "rgba(255,255,255,.55)"
    ctx.font = `600 ${px(36)}px ${FONT}`
    ctx.fillText(TAB_LABEL[t], PAD + tabW * n + tabW / 2, y)
  })
  ctx.textAlign = "left"
  const lineY = y + px(26)
  ctx.fillStyle = "rgba(255,255,255,.15)"
  ctx.fillRect(PAD, lineY, W - PAD * 2, 2)
  const at = tabs.indexOf(i.tab)
  ctx.fillStyle = "#ffffff"
  rr(ctx, PAD + tabW * at + tabW * 0.2, lineY - 3, tabW * 0.6, 6, 3)
  ctx.fill()

  // footer position
  const fy = H - px(96)
  const gridTop = lineY + 44
  const gridBottom = fy - px(56)
  const rows = Math.max(0, Math.floor((gridBottom - gridTop + gap) / (ch + textH + gap)))
  // Use up spare height by making the pictures a little taller (never by more than 30%).
  const cardH = rows ? Math.min(Math.round(ch * 1.3), Math.max(ch, Math.floor((gridBottom - gridTop - rows * textH - (rows - 1) * gap) / rows))) : ch
  const rowH = cardH + textH + gap
  const shown = Math.min(cards.length, rows * cols)

  if (!cards.length) {
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(255,255,255,.5)"
    ctx.font = `400 ${px(34)}px ${FONT}`
    ctx.fillText("Nothing here yet", W / 2, gridTop + px(120))
    ctx.textAlign = "left"
  }
  for (let n = 0; n < shown; n++) {
    const card = cards[n]
    const x = PAD + (n % cols) * (cw + gap)
    const top = gridTop + Math.floor(n / cols) * rowH
    cover(ctx, covers[n] ?? null, x, top, cw, cardH, 22)
    if (card.progress !== undefined) {
      ctx.save()
      rr(ctx, x, top, cw, cardH, 22)
      ctx.clip()
      ctx.fillStyle = "rgba(255,255,255,.3)"
      ctx.fillRect(x, top + cardH - 8, cw, 8)
      ctx.fillStyle = "#dc2626"
      ctx.fillRect(x, top + cardH - 8, cw * Math.max(0.03, card.progress), 8)
      ctx.restore()
    }
    ctx.fillStyle = "#ffffff"
    ctx.font = `600 ${landscape ? 28 : 24}px ${FONT}`
    ctx.fillText(fit(ctx, card.title, cw), x, top + cardH + (landscape ? 38 : 34))
    if (card.sub) {
      ctx.fillStyle = "rgba(255,255,255,.6)"
      ctx.font = `400 24px ${FONT}`
      ctx.fillText(fit(ctx, card.sub, cw), x, top + cardH + 68)
    }
  }

  // footer
  ctx.fillStyle = "rgba(255,255,255,.15)"
  ctx.fillRect(PAD, fy - px(40), W - PAD * 2, 2)
  const F = px(64)
  if (logo) ctx.drawImage(logo, PAD, fy - px(6), F, F)
  ctx.fillStyle = "#ffffff"
  ctx.font = `700 ${px(38)}px ${FONT}`
  ctx.fillText("AniBiar TV", PAD + F + 20, fy + px(26))
  ctx.fillStyle = "rgba(255,255,255,.6)"
  ctx.font = `400 ${px(26)}px ${FONT}`
  ctx.fillText(i.host, PAD + F + 20, fy + px(62))

  return c
}

export const canvasToBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"))
