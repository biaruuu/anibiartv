/** Animated profile effects (a moving ring around the avatar plus particles over the banner), like Discord's. */
export type EffectId = "neon" | "sakura" | "ember" | "lantern" | "firework" | "koi" | "rain" | "wash" | "lofi"
export type EffectKind = "spark" | "petal" | "ember" | "lantern" | "firework" | "koi" | "rain" | "wash" | "note"

export const EFFECTS: { id: EffectId; label: string; ring: string[]; kind: EffectKind; colors: string[] }[] = [
  { id: "neon", label: "Neon", ring: ["#5865f2", "#00e5ff", "#a855f7", "#5865f2"], kind: "spark", colors: ["#ffffff", "#00e5ff", "#a78bfa", "#5865f2"] },
  { id: "sakura", label: "Sakura", ring: ["#ffb7d5", "#ff6fa5", "#ffe3ee", "#ff6fa5", "#ffb7d5"], kind: "petal", colors: ["#ffb7d5", "#ff8fb8", "#ffd6e7"] },
  { id: "ember", label: "Ember", ring: ["#ff3d00", "#ffb300", "#ff1744", "#ffb300", "#ff3d00"], kind: "ember", colors: ["#ff7a1a", "#ffb300", "#ff3d00"] },
  { id: "lantern", label: "Lanterns", ring: ["#ff3b30", "#ffd166", "#ff7a1a", "#ffd166", "#ff3b30"], kind: "lantern", colors: ["#ff3b30", "#ffb300", "#ff7a1a"] },
  { id: "firework", label: "Fireworks", ring: ["#ffd166", "#ff5c8a", "#7ae7ff", "#ff5c8a", "#ffd166"], kind: "firework", colors: ["#ffd166", "#ff5c8a", "#7ae7ff", "#ffffff"] },
  { id: "koi", label: "Koi", ring: ["#2ec4b6", "#ffffff", "#ff6b35", "#ffffff", "#2ec4b6"], kind: "koi", colors: ["#ff6b35", "#ffffff", "#ff3d3d", "#ffb199"] },
  { id: "rain", label: "Rain", ring: ["#4a6fa5", "#9ecbff", "#e3f0ff", "#9ecbff", "#4a6fa5"], kind: "rain", colors: ["#9ecbff", "#7aa7e0", "#cfe3ff"] },
  { id: "wash", label: "Watercolor", ring: ["#ff9ecd", "#ffd97a", "#7ad7c9", "#a78bfa", "#ff9ecd"], kind: "wash", colors: ["#ff9ecd", "#7ad7c9", "#ffd97a", "#a78bfa"] },
  { id: "lofi", label: "Lofi", ring: ["#ffb86b", "#cbb2ff", "#ffd9a0", "#cbb2ff", "#ffb86b"], kind: "note", colors: ["#ffd9a0", "#cbb2ff", "#9be7ff"] },
]

export const isEffect = (v: unknown): v is EffectId => typeof v === "string" && EFFECTS.some((e) => e.id === v)
export const effectOf = (id: EffectId) => EFFECTS.find((e) => e.id === id)!

export type Particle = { x: number; y: number; delay: number; dur: number; size: number; sway: number; color: number }

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The same particles every time (so the page and the picture agree). x and y are 0..1 of the area. */
export function particlesFor(id: EffectId): Particle[] {
  const e = effectOf(id)
  const r = rng(id.charCodeAt(0) * 7919 + id.length * 104729 + id.charCodeAt(id.length - 1))
  const k = e.kind
  const n = { spark: 20, petal: 16, ember: 16, lantern: 9, firework: 6, koi: 5, rain: 28, wash: 6, note: 10 }[k]
  return Array.from({ length: n }, () => {
    const x = r()
    let y = r()
    if (k === "firework") y = 0.14 + y * 0.5
    if (k === "koi") y = 0.14 + y * 0.66
    if (k === "wash") y = 0.1 + y * 0.7
    const delay = r()
    const dur = { spark: 1.6 + r() * 2.2, petal: 5 + r() * 4, ember: 3 + r() * 3, lantern: 7 + r() * 4, firework: 2.2 + r() * 1.6, koi: 10 + r() * 7, rain: 0.8 + r() * 0.7, wash: 9 + r() * 6, note: 5 + r() * 4 }[k]
    const size = { spark: 5 + r() * 7, petal: 7 + r() * 6, ember: 4 + r() * 4, lantern: 8 + r() * 6, firework: 22 + r() * 22, koi: 7 + r() * 4, rain: 10 + r() * 9, wash: 50 + r() * 45, note: 10 + r() * 6 }[k]
    const sway = { spark: 0, petal: 10 + r() * 18, ember: 10 + r() * 18, lantern: 8 + r() * 12, firework: 0, koi: 0, rain: 0, wash: 14 + r() * 18, note: 6 + r() * 10 }[k]
    return { x, y, delay, dur, size, sway, color: Math.floor(r() * e.colors.length) }
  })
}

export const conic = (ring: string[], from = 0) => `conic-gradient(from ${from}deg, ${ring.join(", ")})`

/* ------------- avatar decorations: original artwork drawn from SVG paths (page = SVG, picture = canvas) ------------- */

export type DecorationId = "cat" | "bunny" | "halo" | "crown"
type DecoShape = { d: string; fill?: string; stroke?: string; sw?: number; op?: number; g?: "twL" | "twR" | "float" | "spark"; glow?: string }

/** Drawn on a 100 x 100 box; the avatar (with its ring) is the circle at 50,50 with radius 36. */
export const DECORATIONS: { id: DecorationId; label: string; shapes: DecoShape[] }[] = [
  {
    id: "cat",
    label: "Cat",
    shapes: [
      { d: "M19 36 L20 9 Q21 6 24 8 L45 21 Z", fill: "#f6eff1", stroke: "#a98791", sw: 1.3, g: "twL" },
      { d: "M24 31 L24.5 14 L38 23 Z", fill: "#ee9cc8", g: "twL" },
      { d: "M81 36 L80 9 Q79 6 76 8 L55 21 Z", fill: "#f6eff1", stroke: "#a98791", sw: 1.3, g: "twR" },
      { d: "M76 31 L75.5 14 L62 23 Z", fill: "#ee9cc8", g: "twR" },
      { d: "M27 60 a6 3.5 0 1 0 12 0 a6 3.5 0 1 0 -12 0", fill: "#ff7ac8", op: 0.45 },
      { d: "M61 60 a6 3.5 0 1 0 12 0 a6 3.5 0 1 0 -12 0", fill: "#ff7ac8", op: 0.45 },
      { d: "M31 58 l-1.6 5 M33.5 57.5 l-1.6 5.5 M36 58 l-1.6 5", stroke: "#c0399a", sw: 1 },
      { d: "M64 58 l-1.6 5 M66.5 57.5 l-1.6 5.5 M69 58 l-1.6 5", stroke: "#c0399a", sw: 1 },
      { d: "M8 55 L19 58 M7 61 L19 61 M8 67 L19 64 M92 55 L81 58 M93 61 L81 61 M92 67 L81 64", stroke: "#e9e4ec", sw: 1.6 },
      { d: "M86 22 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z", fill: "#ffe08a", glow: "#ffd54a", g: "spark" },
    ],
  },
  {
    id: "bunny",
    label: "Bunny",
    shapes: [
      { d: "M28 26 C21 12 23 1 31 2 C39 3 41 16 38 24 Z", fill: "#fff5f8", stroke: "#b79aa4", sw: 1.3, g: "twL" },
      { d: "M30 22 C27 14 28 7 31 7 C34 7 35 14 35 21 Z", fill: "#ffb3cf", g: "twL" },
      { d: "M72 26 C79 12 77 1 69 2 C61 3 59 16 62 24 Z", fill: "#fff5f8", stroke: "#b79aa4", sw: 1.3, g: "twR" },
      { d: "M70 22 C73 14 72 7 69 7 C66 7 65 14 65 21 Z", fill: "#ffb3cf", g: "twR" },
    ],
  },
  {
    id: "halo",
    label: "Halo",
    shapes: [{ d: "M32 8 a18 5 0 1 0 36 0 a18 5 0 1 0 -36 0", stroke: "#ffd54a", sw: 3, glow: "#ffd54a", g: "float" }],
  },
  {
    id: "crown",
    label: "Crown",
    shapes: [
      { d: "M29 21 L33 4 L41 14 L50 2 L59 14 L67 4 L71 21 Z", fill: "#ffcc33", stroke: "#b8860b", sw: 1.2 },
      { d: "M50 11 m-2.2 0 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0", fill: "#ff4d6d", g: "spark" },
      { d: "M33 9 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0", fill: "#7ae7ff" },
      { d: "M67 9 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0", fill: "#7ae7ff" },
    ],
  },
]

export const isDecoration = (v: unknown): v is DecorationId => typeof v === "string" && DECORATIONS.some((d) => d.id === v)
export const decorationOf = (id: DecorationId) => DECORATIONS.find((d) => d.id === id)!
