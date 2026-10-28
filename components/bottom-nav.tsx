"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bookmark, Home, Search, Settings, User } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

// Pages that are full screen on their own (no bottom bar).
const HIDDEN = ["/profile", "/settings", "/login", "/watch", "/auth"]

/** One tab: icon + label, with a glass bubble behind it when it is the current page or while it is pressed. */
function Tab({ on, label, children, className }: { on?: boolean; label: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("group relative flex h-full w-full flex-col items-center justify-center gap-0.5", className)}>
      <span
        aria-hidden
        className={cn(
          "glass-bubble absolute inset-x-0.5 inset-y-0 rounded-full transition-all duration-300 ease-out",
          on ? "scale-100 opacity-100" : "scale-75 opacity-0 group-active:scale-100 group-active:opacity-100"
        )}
      />
      <span className={cn("relative grid size-6 place-items-center transition-transform duration-200 group-active:scale-90", on ? "text-white" : "text-white/80")}>{children}</span>
      <span className={cn("relative text-[0.66rem] leading-none font-semibold tracking-tight", on ? "text-white" : "text-white/75")}>{label}</span>
    </span>
  )
}

/** Phone navigation as a floating liquid-glass pill: Home, Saved, Search (centre), Settings and Profile. */
export function BottomNav() {
  const path = usePathname()
  const { user, avatar, ready } = useAuth()
  if (HIDDEN.some((p) => path === p || path.startsWith(`${p}/`))) return null

  const slot = "block h-full flex-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"

  return (
    <>
      {/* keeps the end of the page from hiding behind the bar */}
      <div aria-hidden className="h-[calc(5.75rem+env(safe-area-inset-bottom))]" />
      <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 px-3">
        <div className="glass-nav pointer-events-auto mx-auto flex h-[4.1rem] max-w-md items-center gap-0.5 rounded-full p-1.5">
          <Link href="/" className={slot} aria-current={path === "/" ? "page" : undefined}>
            <Tab on={path === "/"} label="Home">
              <Home className="size-[1.35rem]" fill={path === "/" ? "currentColor" : "none"} />
            </Tab>
          </Link>
          <Link href={user || !ready ? "/profile?tab=favorites" : "/login?next=/profile"} className={slot}>
            <Tab label="Saved">
              <Bookmark className="size-[1.35rem]" />
            </Tab>
          </Link>
          <button type="button" aria-label="Search" onClick={() => window.dispatchEvent(new Event("anibiar:search"))} className="group relative mx-1 grid h-full w-[3.7rem] shrink-0 place-items-center outline-none">
            <span className="relative block h-[2.6rem] w-[3.1rem] transition-transform duration-200 group-active:scale-90">
              <span aria-hidden className="absolute inset-0 -translate-x-[3px] rounded-[0.85rem] bg-[#22d3ee]" />
              <span aria-hidden className="absolute inset-0 translate-x-[3px] rounded-[0.85rem] bg-[#ff2d6f]" />
              <span className="absolute inset-0 grid place-items-center rounded-[0.85rem] bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,.35)]">
                <Search className="size-6" strokeWidth={2.6} />
              </span>
            </span>
          </button>
          <Link href="/settings" className={slot}>
            <Tab label="Settings">
              <Settings className="size-[1.35rem]" />
            </Tab>
          </Link>
          <Link href={user || !ready ? "/profile" : "/login?next=/profile"} className={slot}>
            <Tab label="Profile">
              {user && avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-[1.45rem] rounded-full object-cover ring-1 ring-white/40" />
              ) : (
                <User className="size-[1.35rem]" />
              )}
            </Tab>
          </Link>
        </div>
      </nav>
    </>
  )
}
