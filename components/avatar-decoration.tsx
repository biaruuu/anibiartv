"use client"

import * as React from "react"

import { findDecoration, useDecorations, type DecorationId } from "@/lib/decorations"
import { cn } from "@/lib/utils"

/**
 * Avatar with a thin surface-coloured ring and an animated decoration on top, fitted the way Discord does it:
 * the decoration is drawn `scale` times the avatar picture, centred on it.
 */
export function DecoratedAvatar({
  decoration = null,
  still = false,
  children,
  className,
}: {
  decoration?: DecorationId | null
  /** Use the small still preview instead of the animation (for pickers). */
  still?: boolean
  children: React.ReactNode
  className?: string
}) {
  const catalog = useDecorations()
  const deco = findDecoration(decoration, catalog)
  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="absolute inset-0 rounded-full bg-black" />
      {/* crisp picture with a thin (4px) ring around it, like Discord */}
      <div className="absolute inset-[4px] overflow-hidden rounded-full">{children}</div>
      {deco && (
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
          <DecoratedAvatar decoration={it.id} still className="size-12">
            <span className="block size-full bg-[#2b2d31]" />
          </DecoratedAvatar>
          {it.label}
        </button>
      ))}
    </div>
  )
}
