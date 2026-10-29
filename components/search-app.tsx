"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CircleAlert, Search, Captions, Star } from "lucide-react"

import { SiteFooter, SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { airedEpisodes, animeTitle, infoHref, searchAnimePage, type Anime } from "@/lib/anilist"

const PER_PAGE = 24
const PILL =
  "inline-flex items-center gap-1 rounded bg-white/[0.07] px-1.5 py-1 text-[0.65rem] leading-none text-white/70 sm:px-2 sm:py-1.5 sm:text-xs"

export function SearchApp() {
  const q = (useSearchParams().get("q") ?? "").trim()
  const [items, setItems] = React.useState<Anime[] | null>(null)
  const [page, setPage] = React.useState(1)
  const [hasNext, setHasNext] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    document.title = q ? `${q} | AniBiar TV` : "Search | AniBiar TV"
    if (q.length < 1) {
      setItems([])
      return
    }
    const ctrl = new AbortController()
    setItems(null)
    setError(null)
    setPage(1)
    searchAnimePage(q, 1, PER_PAGE, ctrl.signal)
      .then((r) => {
        setItems(r.items)
        setHasNext(r.hasNext)
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message)
      })
    return () => ctrl.abort()
  }, [q])

  const more = async () => {
    setLoadingMore(true)
    try {
      const r = await searchAnimePage(q, page + 1, PER_PAGE)
      setItems((prev) => [...(prev ?? []), ...r.items])
      setHasNext(r.hasNext)
      setPage(page + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="min-h-svh overflow-x-clip bg-[#000000] text-[#f2f3f5]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pt-20 pb-14 sm:px-8 sm:pt-24">
        <h1 className="mb-5 text-lg font-semibold tracking-tight sm:text-2xl">
          {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search"}
        </h1>

        {error && !items?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl glass-card p-10 text-center">
            <CircleAlert className="size-8 text-red-400" />
            <p className="text-white/80">{error}</p>
          </div>
        ) : items && items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-white/60">
            <Search className="size-8" />
            <p>{q ? "No anime found. Try another spelling." : "Use the search button at the top."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-7 lg:grid-cols-5 xl:grid-cols-6">
            {items
              ? items.map((a) => (
                  <Link key={a.id} href={infoHref(a)} className="group block min-w-0">
                    <div className="aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.coverImage.extraLarge ?? a.coverImage.large ?? ""}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {airedEpisodes(a) > 0 ? (
                        <span className={PILL}>
                          <Captions className="size-3" />
                          {airedEpisodes(a)}
                        </span>
                      ) : null}
                      {a.format && <span className={PILL}>{a.format.replace("_", " ")}</span>}
                      {a.seasonYear && <span className={PILL}>{a.seasonYear}</span>}
                      {a.averageScore ? (
                        <span className={PILL}>
                          <Star className="size-3" />
                          {(a.averageScore / 10).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium transition-colors group-hover:text-lime-300 sm:text-sm">
                      {animeTitle(a)}
                    </h3>
                  </Link>
                ))
              : Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-[2/3] rounded-xl bg-white/5" />
                    <Skeleton className="h-3 w-3/4 bg-white/5" />
                  </div>
                ))}
          </div>
        )}

        {items && hasNext && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" disabled={loadingMore} onClick={() => void more()} className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
              {loadingMore ? "Loading" : "Load more"}
            </Button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
