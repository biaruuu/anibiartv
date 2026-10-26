"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Camera, ImagePlus, Trash2, User, X } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { HistoryCard, useHistory } from "@/components/continue-watching"
import { SiteFooter, SiteHeader } from "@/components/site-header"
import { Spinner } from "@/components/ui/spinner"
import { loadList, toggleList, type ListItem } from "@/lib/library"
import { ACCEPT, deleteProfileImage, uploadProfileImage } from "@/lib/profile-images"
import { getSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function Avatar({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#2a282d] text-white/60", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        <User className="size-1/2" />
      )}
    </span>
  )
}

/* ------------------------------ edit panel ------------------------------ */

type Pick = { file: File; preview: string } | null

function EditProfile({ onClose }: { onClose: () => void }) {
  const { user, name, avatar, banner, profile, refreshProfile } = useAuth()
  const [username, setUsername] = React.useState(profile?.username ?? name ?? "")
  const [avatarPick, setAvatarPick] = React.useState<Pick>(null)
  const [bannerPick, setBannerPick] = React.useState<Pick>(null)
  const [dropAvatar, setDropAvatar] = React.useState(false)
  const [dropBanner, setDropBanner] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(
    () => () => {
      if (avatarPick) URL.revokeObjectURL(avatarPick.preview)
      if (bannerPick) URL.revokeObjectURL(bannerPick.preview)
    },
    [avatarPick, bannerPick]
  )
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onClose])

  const choose = (kind: "avatar" | "banner") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!ACCEPT.split(",").includes(file.type)) return setError("Use a PNG, JPG, WebP or GIF image.")
    if (file.size > 8 * 1024 * 1024) return setError("Images can be up to 8 MB.")
    setError(null)
    const pick = { file, preview: URL.createObjectURL(file) }
    if (kind === "avatar") {
      setAvatarPick(pick)
      setDropAvatar(false)
    } else {
      setBannerPick(pick)
      setDropBanner(false)
    }
  }

  const shownAvatar = dropAvatar ? null : (avatarPick?.preview ?? avatar)
  const shownBanner = dropBanner ? null : (bannerPick?.preview ?? banner)

  const save = async () => {
    if (!user) return
    const clean = username.trim()
    if (!clean) return setError("Enter a display name.")
    if (clean.length > 32) return setError("Display names can be up to 32 characters.")
    setBusy(true)
    setError(null)
    try {
      let avatarUrl = profile?.avatar_url ?? null
      let bannerUrl = profile?.banner_url ?? null
      const stale: (string | null)[] = []
      if (avatarPick) {
        stale.push(avatarUrl)
        avatarUrl = await uploadProfileImage(user.id, avatarPick.file, "avatar")
      } else if (dropAvatar) {
        stale.push(avatarUrl)
        avatarUrl = null
      }
      if (bannerPick) {
        stale.push(bannerUrl)
        bannerUrl = await uploadProfileImage(user.id, bannerPick.file, "banner")
      } else if (dropBanner) {
        stale.push(bannerUrl)
        bannerUrl = null
      }
      const { error } = await getSupabase()
        .from("profiles")
        .upsert({ id: user.id, username: clean, avatar_url: avatarUrl, banner_url: bannerUrl }, { onConflict: "id" })
      if (error) throw new Error(error.message)
      await refreshProfile()
      void Promise.all(stale.map(deleteProfileImage))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.")
      setBusy(false)
    }
  }

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 sm:place-items-center sm:p-6" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92svh] w-full overflow-y-auto rounded-t-2xl border border-white/20 bg-[#121113] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-5">
          <h2 className="text-lg font-semibold text-white">Edit profile</h2>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>

        {/* banner + avatar preview, like the real profile */}
        <div className="mt-4 px-4 sm:px-6">
          <div className="relative aspect-[3/1] overflow-hidden rounded-xl bg-white/[0.06]">
            {shownBanner && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownBanner} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="-mt-9 flex items-end gap-3 px-3 sm:-mt-10">
            <Avatar src={shownAvatar} className="size-[4.5rem] border-4 border-[#121113] sm:size-20" />
          </div>
        </div>

        <div className="mt-4 grid gap-5 px-4 pb-5 sm:px-6">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-white/50 uppercase">Avatar</p>
            <div className="flex flex-wrap gap-2">
              <label className={cn(btn, "cursor-pointer")}>
                <Camera className="size-4" /> Change avatar
                <input type="file" accept={ACCEPT} className="sr-only" onChange={choose("avatar")} disabled={busy} />
              </label>
              {(avatarPick || avatar) && (
                <button
                  type="button"
                  className={btn}
                  disabled={busy}
                  onClick={() => {
                    setAvatarPick(null)
                    setDropAvatar(true)
                  }}
                >
                  <Trash2 className="size-4" /> Remove
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-white/50 uppercase">Banner (GIFs work too)</p>
            <div className="flex flex-wrap gap-2">
              <label className={cn(btn, "cursor-pointer")}>
                <ImagePlus className="size-4" /> Change banner
                <input type="file" accept={ACCEPT} className="sr-only" onChange={choose("banner")} disabled={busy} />
              </label>
              {(bannerPick || banner) && (
                <button
                  type="button"
                  className={btn}
                  disabled={busy}
                  onClick={() => {
                    setBannerPick(null)
                    setDropBanner(true)
                  }}
                >
                  <Trash2 className="size-4" /> Remove
                </button>
              )}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-wide text-white/50 uppercase">Display name</span>
            <input
              value={username}
              maxLength={32}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              className="h-12 w-full rounded-xl border border-white/20 bg-transparent px-4 text-base text-white outline-none placeholder:text-white/40 focus:border-white/60 sm:text-sm"
              placeholder="Your name"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-full border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
            >
              {busy && <Spinner className="size-4" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- page -------------------------------- */

export function ProfileApp() {
  const router = useRouter()
  const tab = useSearchParams().get("tab") === "list" ? "list" : "history"
  const { user, ready, name, avatar, banner, signOut } = useAuth()
  const { items, remove } = useHistory()
  const [list, setList] = React.useState<ListItem[] | null>(null)
  const [editing, setEditing] = React.useState(false)

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
      <main className="mx-auto w-full max-w-7xl px-4 pt-[4.5rem] pb-10 sm:px-8 sm:pt-24">
        {/* profile card: banner, avatar, name */}
        <section className="overflow-hidden rounded-2xl border border-white/20">
          <div className="relative aspect-[5/2] bg-white/[0.06] sm:aspect-[4/1]">
            {banner && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={banner} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="px-4 pb-5 sm:px-6">
            <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
              <Avatar src={user ? avatar : null} className="size-24 border-[5px] border-[#121113] sm:size-28" />
              {user && (
                <div className="flex gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-white/90"
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut()
                      router.replace("/")
                    }}
                    className="h-10 rounded-full border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">{user ? name : "Guest"}</h1>
              <p className="truncate text-sm text-white/55">
                {user ? user.email : "Log in to set an avatar and banner and keep your list on every device."}
              </p>
              {ready && !user && (
                <Link href="/login?next=/profile" className="mt-3 inline-flex h-10 items-center rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-white/90">
                  Log in / Sign up
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* tabs */}
        <div role="tablist" className="mt-6 mb-5 inline-flex rounded-full border border-white/20 p-0.5">
          {(["history", "list"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => router.replace(`/profile?tab=${t}`, { scroll: false })}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                tab === t ? "bg-white text-black" : "text-white/70 hover:text-white"
              )}
            >
              {t === "history" ? "History" : "My List"}
            </button>
          ))}
        </div>

        {tab === "history" ? (
          items && items.length === 0 ? (
            <p className="py-14 text-center text-white/60">Nothing watched yet. Start an episode and it will show up here.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {(items ?? []).map((h) => (
                <HistoryCard key={h.animeId} h={h} onRemove={() => remove(h.animeId)} />
              ))}
            </div>
          )
        ) : list && list.length === 0 ? (
          <p className="py-14 text-center text-white/60">Your list is empty. Tap the + on a watch page to add anime.</p>
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
      {editing && user && <EditProfile onClose={() => setEditing(false)} />}
    </div>
  )
}
