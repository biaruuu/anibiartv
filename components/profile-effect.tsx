"use client"

import * as React from "react"

import { findDecoration, useDecorations, type DecorationId } from "@/lib/decorations"
import { findArt, thumbOf, useProfileArt } from "@/lib/profile-art"
import { conic, effectOf, EFFECTS, particlesFor, type EffectId } from "@/lib/effects"
import { cn } from "@/lib/utils"

/** Avatar with a solid cut-out ring, and a spinning colour ring when an effect is chosen. */
export function EffectAvatar({
  effect,
  decoration = null,
  still = false,
  children,
  className,
}: {
  effect: EffectId | null
  decoration?: DecorationId | null
  /** Use the small still preview instead of the animation (for pickers). */
  still?: boolean
  children: React.ReactNode
  className?: string
}) {
  const e = effect ? effectOf(effect) : null
  const catalog = useDecorations()
  const deco = findDecoration(decoration, catalog)
  return (
    <div className={cn("relative", className)}>
      {e && <span aria-hidden className="fx-glow absolute inset-0 rounded-full" style={{ background: conic(e.ring) }} />}
      {e && <span aria-hidden className="fx-ring absolute inset-0 rounded-full" style={{ background: conic(e.ring) }} />}
      <span aria-hidden className={cn("absolute rounded-full bg-black", e ? "inset-[2px]" : "inset-0")} />
      {/* crisp picture: a thin surface-coloured ring (4px) around it, like Discord */}
      <div className="absolute inset-[4px] overflow-hidden rounded-full">{children}</div>
      {deco && (
        // Discord-style fit: the decoration is drawn `scale` times the avatar picture, centred on it, on top of it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={still ? deco.apng.replace(/\.png$/, ".thumb.png") : deco.apng}
          alt=""
          draggable={false}
          className="pointer-events-none absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ width: `calc((100% - 8px) * ${deco.scale})`, height: `calc((100% - 8px) * ${deco.scale})` }}
        />
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

/** Avatar decoration picker: None plus everything in the catalog (Supabase). */
export function DecorationPicker({ value, onChange, disabled }: { value: DecorationId | null; onChange: (v: DecorationId | null) => void; disabled?: boolean }) {
  const catalog = useDecorations()
  const items: { id: DecorationId | null; label: string }[] = [{ id: null, label: "None" }, ...catalog.map((d) => ({ id: d.id, label: d.label }))]
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Avatar decoration">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          disabled={disabled}
          onClick={() => onChange(it.id)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border px-1 pt-3.5 pb-2.5 text-xs font-semibold transition-colors",
            value === it.id ? "border-[#5865f2] bg-[#5865f2]/10 text-white" : "border-white/20 text-[#949ba4] hover:text-white"
          )}
        >
          <EffectAvatar effect={null} decoration={it.id} still className="size-12">
            <span className="block size-full bg-[#2b2d31]" />
          </EffectAvatar>
          {it.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Full-profile "intro" effect (like Discord's): the one-shot animation plays when the profile opens,
 * then a soft loop stays on top. Put it inside a `relative overflow-hidden` card.
 */
export function IntroLayer({ intro, className }: { intro: string | null; className?: string }) {
  const art = findArt(intro, "intro", useProfileArt())
  const [playing, setPlaying] = React.useState(true)
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    setPlaying(true)
    setReduced(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    if (!art) return
    const t = window.setTimeout(() => setPlaying(false), art.intro_ms + 300)
    return () => window.clearTimeout(t)
  }, [art?.id, art?.intro_ms]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!art) return null
  const fit = "absolute inset-0 size-full max-w-none object-cover object-bottom select-none"
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-x-0 top-0 z-[30] overflow-hidden", className)}
      style={{ maskImage: "linear-gradient(to bottom, #000 72%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, #000 72%, transparent)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {art.idle && !reduced && <img src={art.idle} alt="" draggable={false} className={fit} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {playing && !reduced && <img key={art.id} src={art.apng} alt="" draggable={false} className={fit} />}
    </div>
  )
}

/** Animated profile frame: a 9-slice border drawn around the card (corners stay, edges repeat). */
export function FrameBorder({ frame, className }: { frame: string | null; className?: string }) {
  const art = findArt(frame, "frame", useProfileArt())
  if (!art) return null
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute z-40", className)}
      style={{
        inset: "calc(var(--fb) * -1)",
        borderStyle: "solid",
        borderColor: "transparent",
        borderWidth: "var(--fb)",
        borderImage: `url(${art.apng}) 100 / var(--fb) round`,
      }}
    />
  )
}

/** Picker for the exclusive intros / frames (None + the catalog from Supabase). */
export function ArtPicker({ kind, value, onChange, disabled }: { kind: "intro" | "frame"; value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const items = useProfileArt().filter((a) => a.kind === kind)
  const label = kind === "intro" ? "Profile effect intro" : "Profile frame"
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
      {[{ id: null as string | null, label: "None", thumb: null as string | null }, ...items.map((a) => ({ id: a.id as string | null, label: a.label, thumb: thumbOf(a) as string | null }))].map((it) => (
        <button
          key={it.label}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          disabled={disabled}
          onClick={() => onChange(it.id)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border px-1.5 pt-2.5 pb-2 text-xs font-semibold transition-colors",
            value === it.id ? "border-[#5865f2] bg-[#5865f2]/10 text-white" : "border-white/20 text-[#949ba4] hover:text-white"
          )}
        >
          <span className="grid h-14 w-full place-items-center overflow-hidden rounded-lg bg-[#141416]">
            {it.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.thumb} alt="" draggable={false} className={cn("max-w-none select-none", kind === "frame" ? "size-12" : "size-full object-cover")} />
            )}
          </span>
          {it.label}
        </button>
      ))}
    </div>
  )
}
