"use client"

import * as React from "react"

import { pollLibrary } from "@/lib/library"

/**
 * Real time across devices: asks the server (Upstash Redis holds a tiny version number per account)
 * whether anything changed, a few seconds apart while the page is open, and on coming back to it.
 */
export function useLibrarySync(userId: string | null | undefined, onChange: () => void) {
  const cb = React.useRef(onChange)
  React.useEffect(() => {
    cb.current = onChange
  })
  React.useEffect(() => {
    if (!userId) return
    let busy = false
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return
      busy = true
      try {
        if (await pollLibrary()) cb.current()
      } finally {
        busy = false
      }
    }
    const timer = window.setInterval(check, 6000)
    const wake = () => void check()
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("focus", wake)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", wake)
      window.removeEventListener("focus", wake)
    }
  }, [userId])
}
