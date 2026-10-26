"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { HistoryCard, useHistory } from "@/components/continue-watching"
import { SiteFooter, SiteHeader } from "@/components/site-header"
import { loadList, toggleList, type ListItem } from "@/lib/library"
import { cn } from "@/lib/utils"

export function LibraryApp() {
  const router = useRouter()
  const tab = useSearchParams().get("tab") === "list" ? "list" : "history"
  const { user, ready } = useAuth()
  const { items, remove } = useHistory()
  const [list, setList] = React.useState<ListItem[] | null>(null)

  React.useEffect(() => {
    if (!ready) return
    let alive = true
    loadList(user?.id).then((l) => alive && setList(l))
    return () => {
      alive = false
    }
  }, [user?.id, ready])

  const unlist = (it: ListItem) => {
    setList((l) => l?.filter((x) => x.animeId !== it.animeId) ?? null)
    void toggleList(it, user?.id)
  }

  return (
    <div className="min-h-svh bg-[#121113] text-[#eeeef0]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pt-20 pb-10 sm:px-8 sm:pt-24">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="flex rounded-full border border-white/20 p-0.5">
            {(["history", "list"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => router.replace(`/library?tab=${t}`)}
                className={cn(
                  "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                  tab === t ? "bg-white text-black" : "text-white/70 hover:text-white"
                )}
              >
                {t === "history" ? "History" : "My List"}
              </button>
            ))}
          </div>
          {ready && !user && (
            <p className="text-xs text-white/55">
              Saved on this device only.{" "}
              <Link href="/login?next=/library" className="text-white underline">
                Log in
              </Link>{" "}
              to keep it everywhere.
            </p>
          )}
        </div>

        {tab === "history" ? (
          items && items.length === 0 ? (
            <p className="py-16 text-center text-white/60">Nothing watched yet. Start an episode and it will show up here.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {(items ?? []).map((h) => (
                <HistoryCard key={h.animeId} h={h} onRemove={() => remove(h.animeId)} />
              ))}
            </div>
          )
        ) : list && list.length === 0 ? (
          <p className="py-16 text-center text-white/60">Your list is empty. Tap the + on a watch page to add anime.</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {(list ?? []).map((it) => (
              <div key={it.animeId} className="group relative min-w-0">
                <Link href={`/anime/${it.animeId}`} className="block">
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
                    {it.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    )}
                  </div>
                  <h3 className="mt-1.5 line-clamp-2 text-xs font-medium text-white group-hover:text-lime-300 sm:text-sm">{it.title}</h3>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${it.title} from my list`}
                  onClick={() => unlist(it)}
                  className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
