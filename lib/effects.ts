/** Animated profile effects (a moving ring around the avatar plus particles over the banner), like Discord's. */
export type EffectId = "neon" | "sakura" | "ember"

export const EFFECTS: { id: EffectId; label: string; ring: string[]; kind: "spark" | "petal" | "ember"; colors: string[] }[] = [
  { id: "neon", label: "Neon", ring: ["#5865f2", "#00e5ff", "#a855f7", "#5865f2"], kind: "spark", colors: ["#ffffff", "#00e5ff", "#a78bfa", "#5865f2"] },
  { id: "sakura", label: "Sakura", ring: ["#ffb7d5", "#ff6fa5", "#ffe3ee", "#ff6fa5", "#ffb7d5"], kind: "petal", colors: ["#ffb7d5", "#ff8fb8", "#ffd6e7"] },
  { id: "ember", label: "Ember", ring: ["#ff3d00", "#ffb300", "#ff1744", "#ffb300", "#ff3d00"], kind: "ember", colors: ["#ff7a1a", "#ffb300", "#ff3d00"] },
]

export const isEffect = (v: unknown): v is EffectId => v === "neon" || v === "sakura" || v === "ember"
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
  const r = rng(id.length * 7919 + id.charCodeAt(0))
  const n = e.kind === "spark" ? 20 : 16
  return Array.from({ length: n }, () => ({
    x: r(),
    y: r(),
    delay: r(),
    dur: e.kind === "spark" ? 1.6 + r() * 2.2 : e.kind === "petal" ? 5 + r() * 4 : 3 + r() * 3,
    size: e.kind === "spark" ? 5 + r() * 7 : e.kind === "petal" ? 7 + r() * 6 : 4 + r() * 4,
    sway: 10 + r() * 18,
    color: Math.floor(r() * e.colors.length),
  }))
}

export const conic = (ring: string[], from = 0) => `conic-gradient(from ${from}deg, ${ring.join(", ")})`
