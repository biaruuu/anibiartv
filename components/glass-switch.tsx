"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type SwitchOption<T extends string> = { id: T; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }

/**
 * A segmented switch on dark glass with a white glass bubble that slides to the chosen option
 * (same glass look as the bottom bar). Every option has the same width.
 */
export function GlassSwitch<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  itemClassName,
}: {
  value: T
  onChange: (v: T) => void
  options: SwitchOption<T>[]
  label: string
  className?: string
  itemClassName?: string
}) {
  const n = options.length
  const index = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div role="tablist" aria-label={label} className={cn("glass-track relative grid rounded-full p-[3px]", className)} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="glass-thumb pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)]"
        style={{ width: `calc((100% - 6px) / ${n})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "relative inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40 sm:text-sm",
            value === o.id ? "text-black" : "text-white/75 hover:text-white",
            itemClassName
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
