"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Settings, User } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

// Pages that are full screen on their own (no bottom bar).
const HIDDEN = ["/profile", "/settings", "/login", "/watch", "/auth"]

/** One tab: icon + label, with a glass bubble behind it when it is the current page or while it is pressed. */
function Tab({ on, label, children }: { on?: boolean; label: string; children: React.ReactNode }) {
  return (
    <span className="group relative flex h-full w-full flex-col items-center justify-center gap-[0.15rem]">
      <span
        aria-hidden
        className={cn(
          "glass-bubble absolute inset-x-0 inset-y-0 rounded-full transition-all duration-300 ease-out",
          on ? "scale-100 opacity-100" : "scale-75 opacity-0 group-active:scale-100 group-active:opacity-100"
        )}
      />
      <span className={cn("relative grid size-5 place-items-center transition-transform duration-200 group-active:scale-90", on ? "text-white" : "text-white/80")}>{children}</span>
      <span className={cn("relative text-[0.62rem] leading-none font-semibold tracking-tight", on ? "text-white" : "text-white/75")}>{label}</span>
    </span>
  )
}

/** Phone navigation as a small floating liquid-glass pill: Home, Search, Profile and Settings. */
export function BottomNav() {
  const path = usePathname()
  const { user, avatar, ready } = useAuth()
  if (HIDDEN.some((p) => path === p || path.startsWith(`${p}/`))) return null

  const slot = "block h-full flex-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"

  return (
    <>
      {/* keeps the end of the page from hiding behind the bar */}
      <div aria-hidden className="h-[calc(4.6rem+env(safe-area-inset-bottom))]" />
      <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-[calc(0.7rem+env(safe-area-inset-bottom))] z-40 px-4">
        <div className="glass-nav pointer-events-auto mx-auto flex h-[3.25rem] w-full max-w-[21rem] items-stretch gap-0.5 rounded-full p-[0.3rem] sm:max-w-sm">
          <Link href="/" className={slot} aria-current={path === "/" ? "page" : undefined}>
            <Tab on={path === "/"} label="Home">
              <Home className="size-5" fill={path === "/" ? "currentColor" : "none"} />
            </Tab>
          </Link>
          <button type="button" aria-label="Search" onClick={() => window.dispatchEvent(new Event("anibiar:search"))} className={slot}>
            <Tab label="Search">
              <Search className="size-5" />
            </Tab>
          </button>
          <Link href={user || !ready ? "/profile" : "/login?next=/profile"} className={slot}>
            <Tab label="Profile">
              {user && avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-5 rounded-full object-cover ring-1 ring-white/40" />
              ) : (
                <User className="size-5" />
              )}
            </Tab>
          </Link>
          <Link href="/settings" className={slot}>
            <Tab label="Settings">
              <Settings className="size-5" />
            </Tab>
          </Link>
        </div>
      </nav>
    </>
  )
}
