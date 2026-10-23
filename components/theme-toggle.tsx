"use client"

import { useTheme } from "next-themes"

import { MoonIcon, SunIcon } from "@/components/icons/vidstack"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="size-6 dark:hidden" />
      <MoonIcon className="hidden size-6 dark:block" />
    </Button>
  )
}
