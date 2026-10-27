"use client"

import * as React from "react"

import { conic, DECORATIONS, decorationOf, effectOf, EFFECTS, particlesFor, type DecorationId, type EffectId } from "@/lib/effects"
import { cn } from "@/lib/utils"

/** Avatar with a solid cut-out ring, and a spinning colour ring when an effect is chosen. */
export function EffectAvatar({
  effect,
  decoration = null,
  children,
  className,
}: {
  effect: EffectId | null
  decoration?: DecorationId | null
  children: React.ReactNode
  className?: string
}) {
  const e = effect ? effectOf(effect) : null
  const deco = decoration ? decorationOf(decoration) : null
  return (
    <div className={cn("relative", className)}>
      {e && <span aria-hidden className="fx-glow absolute inset-0 rounded-full" style={{ background: conic(e.ring) }} />}
      {e && <span aria-hidden className="fx-ring absolute inset-0 rounded-full" style={{ background: conic(e.ring) }} />}
      <span aria-hidden className={cn("absolute rounded-full bg-black", e ? "inset-[3px]" : "inset-0")} />
      <div className="absolute inset-[6px] overflow-hidden rounded-full">{children}</div>
      {deco && (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="pointer-events-none absolute overflow-visible"
          style={{ width: "138.89%", height: "138.89%", left: "-19.44%", top: "-19.44%" }}
        >
          {deco.shapes.map((sh, n) => (
            <path
              key={n}
              d={sh.d}
              fill={sh.fill ?? "none"}
              stroke={sh.stroke}
              strokeWidth={sh.sw}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={sh.op}
              className={sh.g ? `deco-${sh.g}` : undefined}
              style={sh.glow ? { filter: `drop-shadow(0 0 2px ${sh.glow})` } : undefined}
            />
          ))}
        </svg>
      )}
    </div>
  )
}

/** Particles drifting over the banner (put it inside a `relative overflow-hidden` area). */
export function EffectLayer({ effect, className }: { effect: EffectId | null; className?: string }) {
  if (!effect) return null
  const e = effectOf(effect)
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 z-[5] overflow-hidden", className)}>
      {particlesFor(effect).map((p, n) => {
        const k = e.kind
        const color = e.colors[p.color]
        const style: Record<string, string | number | undefined> = {
          left: `${p.x * 100}%`,
          top: ["spark", "firework", "koi", "wash"].includes(k) ? `${p.y * 100}%` : undefined,
          width: p.size,
          height: p.size,
          background: color,
          color,
          animationDuration: `${p.dur}s`,
          animationDelay: `-${p.delay * p.dur}s`,
          "--sway": `${p.sway}px`,
        }
        if (k === "petal") style.height = p.size * 0.7
        if (k === "lantern") style.height = p.size * 1.25
        if (k === "koi") style.width = p.size * 2.4
        if (k === "rain") {
          style.width = 1.5
        }
        if (k === "wash") {
          style.marginLeft = -p.size / 2
          style.marginTop = -p.size / 2
        }
        if (k === "firework") {
          style.width = 4
          style.height = 4
          style.fontSize = p.size
        }
        if (k === "note") {
          style.background = "transparent"
          style.width = "auto"
          style.height = "auto"
          style.fontSize = p.size * 1.6
        }
        return (
          <span key={n} className={cn("absolute block", `fx-${k}`)} style={style as React.CSSProperties}>
            {k === "note" ? (p.color % 2 ? "\u266B" : "\u266A") : null}
          </span>
        )
      })}
    </div>
  )
}

/** The little picker used in Edit profile: None plus the 3 effects. */
export function EffectPicker({ value, onChange, disabled }: { value: EffectId | null; onChange: (v: EffectId | null) => void; disabled?: boolean }) {
  const items: { id: EffectId | null; label: string }[] = [{ id: null, label: "None" }, ...EFFECTS.map((e) => ({ id: e.id, label: e.label }))]
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Profile effect">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          disabled={disabled}
          onClick={() => onChange(it.id)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs font-semibold transition-colors",
            value === it.id ? "border-[#5865f2] bg-[#5865f2]/10 text-white" : "border-white/20 text-[#949ba4] hover:text-white"
          )}
        >
          <EffectAvatar effect={it.id} className="size-11">
            <span className="block size-full bg-[#141416]" />
          </EffectAvatar>
          {it.label}
        </button>
      ))}
    </div>
  )
}

/** Avatar decoration picker (None + 4), separate from the effect. */
export function DecorationPicker({ value, onChange, disabled }: { value: DecorationId | null; onChange: (v: DecorationId | null) => void; disabled?: boolean }) {
  const items: { id: DecorationId | null; label: string }[] = [{ id: null, label: "None" }, ...DECORATIONS.map((d) => ({ id: d.id, label: d.label }))]
  return (
    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Avatar decoration">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          disabled={disabled}
          onClick={() => onChange(it.id)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border px-1 pt-4 pb-2.5 text-xs font-semibold transition-colors",
            value === it.id ? "border-[#5865f2] bg-[#5865f2]/10 text-white" : "border-white/20 text-[#949ba4] hover:text-white"
          )}
        >
          <EffectAvatar effect={null} decoration={it.id} className="size-9">
            <span className="block size-full bg-[#2b2d31]" />
          </EffectAvatar>
          {it.label}
        </button>
      ))}
    </div>
  )
}
