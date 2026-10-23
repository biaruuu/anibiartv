"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type IslandMessage = {
  key: number
  icon: React.ReactNode
  title: string
  subtitle?: string
  /** Short value shown on the right, e.g. "70%" or "1.5x". */
  value?: string
  /** 0 to 1. Shows a progress bar under the title. */
  progress?: number
  tone?: "default" | "error"
}

/**
 * A Dynamic Island style pill. It rests as a small capsule (`compact`) and
 * springs open to show a `message`, then settles back. Flat black, no gradients.
 */
export function DynamicIsland({
  message,
  compact,
  hidden = false,
  className,
}: {
  message: IslandMessage | null
  compact?: React.ReactNode
  hidden?: boolean
  className?: string
}) {
  // Keep the last message around so it can fade out while the pill shrinks.
  const last = React.useRef<IslandMessage | null>(null)
  if (message) last.current = message
  const shown = message ?? last.current
  const expanded = Boolean(message)
  const progress =
    shown?.progress === undefined
      ? undefined
      : Math.round(Math.min(Math.max(shown.progress, 0), 1) * 100)

  return (
    <div className={cn("@container pointer-events-none flex justify-center", className)}>
      <div
        role="status"
        aria-live="polite"
        data-slot="dynamic-island"
        data-state={expanded ? "expanded" : hidden ? "hidden" : "compact"}
        className={cn(
          "relative overflow-hidden rounded-full bg-black font-poppins text-white shadow-lg ring-1 ring-white/10",
          "transition-[width,height,opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none",
          expanded
            ? "h-14 w-[min(21rem,100%)] opacity-100"
            : hidden
              ? "h-8 w-8 scale-75 opacity-0"
              : "h-8 w-44 opacity-100 max-sm:w-8 max-sm:scale-75 max-sm:opacity-0"
        )}
      >
        {/* Resting state */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
            expanded || hidden ? "opacity-0" : "opacity-100 delay-150"
          )}
        >
          {compact}
        </div>

        {/* Expanded state */}
        {shown && (
          <div
            className={cn(
              "absolute inset-y-0 left-1/2 flex w-[min(21rem,100cqw)] -translate-x-1/2 items-center gap-3 px-3 transition-opacity duration-200",
              expanded ? "opacity-100 delay-150" : "opacity-0"
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                shown.tone === "error" ? "bg-red-500" : "bg-white/15"
              )}
            >
              {shown.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight font-semibold">
                {shown.title}
              </p>
              {progress !== undefined ? (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : shown.subtitle ? (
                <p className="truncate text-xs text-white/60">{shown.subtitle}</p>
              ) : null}
            </div>
            {shown.value && (
              <span className="shrink-0 pr-1 text-sm font-semibold tabular-nums">
                {shown.value}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Tiny animated equalizer used in the resting pill while a video plays. */
export function Equalizer({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-3.5 items-end gap-0.5", className)}
    >
      {[0, 0.25, 0.5].map((delay) => (
        <span
          key={delay}
          className="h-full w-0.5 origin-bottom animate-eq rounded-full bg-white motion-reduce:animate-none"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}
