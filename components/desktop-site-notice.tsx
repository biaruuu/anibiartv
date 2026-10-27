"use client"

import * as React from "react"
import { Smartphone, X } from "lucide-react"

/**
 * A phone whose browser is in "Desktop site" mode ignores the page's mobile settings: it lays the page
 * out about 1000px wide. A website cannot switch that mode off, so we detect it and tell the viewer
 * how to turn it off (Chrome can carry the setting over from the Google sign-in tab).
 */
export function DesktopSiteNotice() {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem("anibiar:desktop-notice") === "off") return
    } catch {}
    const phone = window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 600
    const laidOutWide = window.innerWidth >= 900
    if (phone && laidOutWide) setShow(true)
  }, [])

  if (!show) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3">
      <div className="flex w-full max-w-xl items-start gap-3 rounded-2xl border border-white/20 bg-[#000000]/95 p-4 text-white shadow-2xl backdrop-blur-xl">
        <Smartphone className="mt-0.5 size-8 shrink-0 text-white/80" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Your browser is showing the desktop site</p>
          <p className="mt-1 text-white/70">
            Open the browser menu (⋮) and turn off <strong className="text-white">Desktop site</strong>, then reload to get the mobile layout.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90"
          >
            I turned it off, reload
          </button>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setShow(false)
            try {
              sessionStorage.setItem("anibiar:desktop-notice", "off")
            } catch {}
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
