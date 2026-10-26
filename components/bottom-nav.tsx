"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, Settings, User } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

// Pages that are full screen on their own (no bottom bar).
const HIDDEN = ["/profile", "/settings", "/login", "/watch", "/auth"]

/** Phone / tablet navigation: Home, Search, Profile (your avatar) and Settings. */
export function BottomNav() {
  const path = usePathname()
  const { user, avatar, ready } = useAuth()
  if (HIDDEN.some((p) => path === p || path.startsWith(`${p}/`))) return null

  const item = "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.7rem] font-medium transition-colors"
  const tone = (on: boolean) => (on ? "text-white" : "text-white/55 hover:text-white")

  return (
    <>
      {/* keeps the end of the page from hiding behind the bar */}
      <div aria-hidden className="h-[calc(3.75rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#121113] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex h-[3.75rem] max-w-xl items-stretch">
          <Link href="/" className={cn(item, tone(path === "/"))} aria-current={path === "/" ? "page" : undefined}>
            <Home className="size-6" />
            Home
          </Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event("anibiar:search"))} className={cn(item, tone(false))}>
            <Search className="size-6" />
            Search
          </button>
          <Link href={user || !ready ? "/profile" : "/login?next=/profile"} className={cn(item, tone(false))}>
            <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-[#2a282d] text-white/70">
              {user && avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
              ) : (
                <User className="size-4" />
              )}
            </span>
            Profile
          </Link>
          <Link href="/settings" className={cn(item, tone(false))}>
            <Settings className="size-6" />
            Settings
          </Link>
        </div>
      </nav>
    </>
  )
}
