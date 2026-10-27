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
