"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Play, X } from "lucide-react"

import { useLibrarySync } from "@/lib/use-library-sync"
import { useAuth } from "@/components/auth-provider"
import { isFinished, loadHistory, removeHistory, type HistoryItem } from "@/lib/library"
import { cn } from "@/lib/utils"

export const resumeHref = (h: Pick<HistoryItem, "animeId" | "episode" | "audio">) =>
  `/watch/${h.animeId}?ep=${h.episode}${h.audio === "dub" ? "&audio=dub" : ""}`

const clock = (s: number) => {
  const t = Math.max(0, Math.round(s))
  const m = Math.floor(t / 60)
  return `${m}:${String(t % 60).padStart(2, "0")}`
}

export function useHistory() {
  const { user, ready } = useAuth()
  const [items, setItems] = React.useState<HistoryItem[] | null>(null)
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!ready) return
    let alive = true
    loadHistory(user?.id).then((h) => alive && setItems(h))
    return () => {
      alive = false
    }
  }, [user?.id, ready, tick])
  useLibrarySync(user?.id, () => setTick((n) => n + 1))
  const remove = (animeId: number) => {
    setItems((list) => list?.filter((h) => h.animeId !== animeId) ?? null)
    void removeHistory(animeId, user?.id)
  }
  return { items, remove }
}

export function HistoryCard({ h, onRemove, className }: { h: HistoryItem; onRemove: () => void; className?: string }) {
  const pct = h.duration > 0 ? Math.min(100, Math.max(2, (h.position / h.duration) * 100)) : 2
  return (
    <div className={cn("group relative min-w-0", className)}>
      <Link href={resumeHref(h)} className="block">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-white/5">
          {h.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={h.image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
          )}
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" />
          <span className="absolute inset-0 grid place-items-center text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-10 fill-current drop-shadow-lg" />
          </span>
          {h.duration > 0 && (
            <span className="absolute right-2 bottom-3 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
              {clock(h.duration - h.position)} left
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <h3 className="mt-2 truncate text-sm font-semibold text-white group-hover:text-lime-300 sm:text-base">{h.title}</h3>
        <p className="text-xs text-white/60 sm:text-sm">
          Episode {h.episode}
          {h.totalEpisodes ? ` / ${h.totalEpisodes}` : ""}
          {h.audio === "dub" ? " · Dub" : ""}
        </p>
      </Link>
      <button
        type="button"
        aria-label={`Remove ${h.title} from history`}
        onClick={onRemove}
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur transition-colors hover:bg-black/80"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

/** Home page row. Hidden until there is something to continue. */
export function ContinueWatching() {
  const { items, remove } = useHistory()
  const list = (items ?? []).filter((h) => !isFinished(h)).slice(0, 12)
  if (!list.length) return null
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-8 sm:pt-8">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">Continue Watching</h2>
        <Link href="/profile?tab=history" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
          View all <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:gap-4 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((h) => (
          <HistoryCard key={h.animeId} h={h} onRemove={() => remove(h.animeId)} className="w-[78%] shrink-0 snap-start sm:w-72 lg:w-80" />
        ))}
      </div>
    </section>
  )
}
