"use client"

import * as React from "react"
import { Smartphone } from "lucide-react"

const QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)"

function subscribe(cb: () => void) {
  const m = window.matchMedia(QUERY)
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}

/**
 * AniBiar TV is phone-only for now. On a PC / desktop browser (wide screen with a mouse) the site does not open and
 * a notice is shown instead. A phone that asks for the "desktop site" has a touch screen, so it is never blocked.
 * The CSS in globals.css hides the app and shows the notice before the page has loaded, so there is no flash.
 */
export function DesktopGate({ children }: { children: React.ReactNode }) {
  const desktop = React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
  return (
    <>
      <div className="app-shell">{desktop ? null : children}</div>
      <main className="desktop-block min-h-svh place-items-center bg-black px-6 text-center text-white">
        <div className="max-w-md">
          <span className="mx-auto grid size-20 place-items-center rounded-3xl border border-white/15 bg-white/[0.06]">
            <Smartphone className="size-10" />
          </span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">AniBiar TV is mobile only for now</h1>
          <p className="mt-3 text-base text-white/70">
            Desktop and PC are not supported yet. Open this site on your phone to watch. We will expand to desktop soon.
          </p>
          <p className="mt-6 text-sm text-white/40">Coming soon to PC</p>
        </div>
      </main>
    </>
  )
}
