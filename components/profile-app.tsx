"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Camera, ImagePlus, Pencil, Share2, Trash2, User, X } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { HistoryCard, useHistory } from "@/components/continue-watching"
import { useLibrarySync } from "@/lib/use-library-sync"
import { ShareStory } from "@/components/share-story"
import { DecorationPicker, EffectAvatar, EffectLayer, EffectPicker } from "@/components/profile-effect"
import { Spinner } from "@/components/ui/spinner"
import type { DecorationId } from "@/lib/decorations"
import { isEffect, type EffectId } from "@/lib/effects"
import { loadFavorites, loadList, toggleFavorite, toggleList, type ListItem } from "@/lib/library"
import { ACCEPT, deleteProfileImage, MAX_BYTES, uploadProfileImage } from "@/lib/profile-images"
import { getSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function Avatar({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#141416] text-white/60", className)}>
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
  const [bio, setBio] = React.useState(profile?.bio ?? "")
  const [effect, setEffect] = React.useState<EffectId | null>(isEffect(profile?.effect) ? (profile!.effect as EffectId) : null)
  const [decoration, setDecoration] = React.useState<DecorationId | null>(profile?.decoration ?? null)
  const [avatarPick, setAvatarPick] = React.useState<Pick>(null)
  const [bannerPick, setBannerPick] = React.useState<Pick>(null)
  const [dropAvatar, setDropAvatar] = React.useState(false)
  const [dropBanner, setDropBanner] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Previews are released when replaced and when the panel closes.
  const previews = React.useRef<string[]>([])
  React.useEffect(
    () => () => {
      previews.current.forEach((u) => URL.revokeObjectURL(u))
    },
    []
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
    if (file.size > MAX_BYTES) return setError("Images can be up to 8 MB.")
    setError(null)
    const preview = URL.createObjectURL(file)
    previews.current.push(preview)
    if (kind === "avatar") {
      setAvatarPick({ file, preview })
      setDropAvatar(false)
    } else {
      setBannerPick({ file, preview })
      setDropBanner(false)
    }
  }

  const shownAvatar = dropAvatar ? null : (avatarPick?.preview ?? avatar)
  const shownBanner = dropBanner ? null : (bannerPick?.preview ?? banner)

  const save = async () => {
    if (!user) return
    const clean = username.trim()
    if (!clean) return setError("Enter a display name.")
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
        .upsert({ id: user.id, username: clean, bio: bio.trim() || null, avatar_url: avatarUrl, banner_url: bannerUrl, effect, decoration }, { onConflict: "id" })
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
    "inline-flex h-10 items-center gap-1.5 rounded-full border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
  const input =
    "w-full rounded-xl border border-white/20 bg-transparent px-4 text-base text-white outline-none placeholder:text-white/40 focus:border-white/60 sm:text-sm"
  const label = "mb-2 block text-xs font-semibold tracking-wide text-white/50 uppercase"

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 sm:place-items-center sm:p-6" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94svh] w-full overflow-y-auto rounded-t-2xl border border-white/20 bg-[#000000] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-5">
          <h2 className="text-lg font-semibold text-white">Edit profile</h2>
          <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>

        {/* live preview, laid out like the real profile */}
        <div className="mt-3 px-4 sm:px-6">
          <div className="relative">
            <div className="relative h-24 overflow-hidden rounded-xl bg-white/[0.08] sm:h-28">
              {shownBanner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownBanner} alt="" className="size-full object-cover" />
              )}
            </div>
            <EffectLayer effect={effect} className="h-[8.5rem] rounded-xl sm:h-[9.5rem]" />
            <EffectAvatar effect={effect} decoration={decoration} className="relative z-10 -mt-9 ml-3 size-[4.5rem] sm:size-20">
              <Avatar src={shownAvatar} className="size-full" />
            </EffectAvatar>
          </div>
        </div>

        <div className="mt-4 grid gap-5 px-4 pb-5 sm:px-6">
          <div className="grid gap-4 min-[440px]:grid-cols-2">
            <div>
              <span className={label}>Avatar</span>
              <div className="flex flex-wrap gap-2">
                <label className={cn(btn, "cursor-pointer")}>
                  <Camera className="size-4" /> Change
                  <input type="file" accept={ACCEPT} className="sr-only" onChange={choose("avatar")} disabled={busy} />
                </label>
                {(avatarPick || avatar) && (
                  <button
                    type="button"
                    aria-label="Remove avatar"
                    className={cn(btn, "px-3")}
                    disabled={busy}
                    onClick={() => {
                      setAvatarPick(null)
                      setDropAvatar(true)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className={label}>Banner · GIFs work</span>
              <div className="flex flex-wrap gap-2">
                <label className={cn(btn, "cursor-pointer")}>
                  <ImagePlus className="size-4" /> Change
                  <input type="file" accept={ACCEPT} className="sr-only" onChange={choose("banner")} disabled={busy} />
                </label>
                {(bannerPick || banner) && (
                  <button
                    type="button"
                    aria-label="Remove banner"
                    className={cn(btn, "px-3")}
                    disabled={busy}
                    onClick={() => {
                      setBannerPick(null)
                      setDropBanner(true)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <span className={label}>Avatar decoration</span>
            <DecorationPicker value={decoration} onChange={setDecoration} disabled={busy} />
          </div>

          <div>
            <span className={label}>Profile effect</span>
            <EffectPicker value={effect} onChange={setEffect} disabled={busy} />
          </div>

          <label className="block">
            <span className={label}>Display name</span>
            <input value={username} maxLength={32} onChange={(e) => setUsername(e.target.value)} disabled={busy} className={cn(input, "h-12")} placeholder="Your name" />
          </label>

          <label className="block">
            <span className={label}>Bio</span>
            <textarea
              value={bio}
              maxLength={190}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              disabled={busy}
              className={cn(input, "resize-none py-3")}
              placeholder="Tell people what you watch"
            />
            <span className="mt-1 block text-right text-xs text-white/40">{bio.length}/190</span>
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

const TABS = [
  { id: "history", label: "History" },
  { id: "favorites", label: "Favorites" },
  { id: "list", label: "Watchlist" },
] as const
type Tab = (typeof TABS)[number]["id"]

function PosterGrid({ items, onRemove, empty }: { items: ListItem[] | null; onRemove: (it: ListItem) => void; empty: string }) {
  if (items && items.length === 0) return <p className="py-12 text-center text-sm text-white/60">{empty}</p>
  return (
    <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-5">
      {(items ?? []).map((it) => (
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
            aria-label={`Remove ${it.title}`}
            onClick={() => onRemove(it)}
            className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ProfileApp() {
  const router = useRouter()
  const raw = useSearchParams().get("tab")
  const tab: Tab = raw === "favorites" || raw === "list" ? raw : "history"
  const { user, ready, name, handle, avatar, banner, profile } = useAuth()
  const { items, remove } = useHistory()
  const [list, setList] = React.useState<ListItem[] | null>(null)
  const [favorites, setFavorites] = React.useState<ListItem[] | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [sharing, setSharing] = React.useState(false)
  const deco: DecorationId | null = profile?.decoration ?? null
  const fx: EffectId | null = isEffect(profile?.effect) ? (profile!.effect as EffectId) : null
  const storyHistory = React.useMemo(() => items ?? [], [items])
  const storyFavorites = React.useMemo(() => favorites ?? [], [favorites])
  const storyList = React.useMemo(() => list ?? [], [list])

  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!ready) return
    let alive = true
    loadList(user?.id).then((l) => alive && setList(l))
    loadFavorites(user?.id).then((l) => alive && setFavorites(l))
    return () => {
      alive = false
    }
  }, [user?.id, ready, tick])
  useLibrarySync(user?.id, () => setTick((n) => n + 1))

  const unlist = (it: ListItem) => {
    setList((l) => l?.filter((x) => x.animeId !== it.animeId) ?? null)
    void toggleList(it, user?.id)
  }
  const unfavorite = (it: ListItem) => {
    setFavorites((l) => l?.filter((x) => x.animeId !== it.animeId) ?? null)
    void toggleFavorite(it, user?.id)
  }

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null
  const counts: Record<Tab, number | null> = {
    history: items?.length ?? null,
    favorites: favorites?.length ?? null,
    list: list?.length ?? null,
  }

  const close = () => (window.history.length > 1 ? router.back() : router.push("/"))

  return (
    <div className="min-h-svh bg-[#000000] text-[#f2f3f5]">
      <main className="mx-auto w-full max-w-4xl pb-10 sm:px-8 sm:py-10">
        <div className="relative overflow-hidden bg-[#000000] sm:rounded-2xl sm:border sm:border-white/20">
          <EffectLayer effect={fx} className="h-[12.5rem] sm:h-[17rem]" />
          {/* banner, plain and fully visible (no header on this page) */}
          <div className="relative h-36 bg-white/[0.08] sm:h-52">
            {banner && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={banner} alt="" className="size-full object-cover" />
            )}
            <button
              type="button"
              aria-label="Close profile"
              onClick={close}
              className="absolute top-3 left-3 grid size-11 place-items-center rounded-xl bg-black/65 text-white transition-colors hover:bg-black/80 sm:top-4 sm:left-4"
            >
              <X className="size-6" />
            </button>
          </div>

          <div className="px-4 sm:px-6">
            <EffectAvatar effect={fx} decoration={deco} className="relative z-10 -mt-14 size-28 sm:-mt-16 sm:size-32">
              <Avatar src={user ? avatar : null} className="size-full" />
            </EffectAvatar>

            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-bold tracking-tight text-white">{user ? name : "Guest"}</h1>
                <p className="mt-0.5 truncate text-base text-white/70">
                  {user ? handle : "Log in to set an avatar and banner and keep your lists on every device."}
                </p>
              </div>

              {user ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#5865f2] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4752c4] sm:flex-none"
                  >
                    <Pencil className="size-4" />
                    Edit profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharing(true)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:flex-none"
                  >
                    <Share2 className="size-4" />
                    Share
                  </button>
                </div>
              ) : (
                ready && (
                  <Link
                    href="/login?next=/profile"
                    className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90 sm:w-auto"
                  >
                    Log in / Sign up
                  </Link>
                )
              )}
            </div>

            {user && (
              <div className="mt-6 space-y-6">
                <section>
                  <h2 className="text-base font-semibold text-white">Bio</h2>
                  <p className={cn("mt-2 text-base whitespace-pre-wrap", profile?.bio ? "text-white/80" : "text-white/40")}>
                    {profile?.bio || "No bio yet."}
                  </p>
                </section>
                <section>
                  <h2 className="text-base font-semibold text-white">Member Since</h2>
                  <p className="mt-2 flex items-center gap-3 text-base text-white/80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-mark.svg" alt="" className="size-6" />
                    {joined}
                  </p>
                </section>
              </div>
            )}
          </div>

          {/* tabs with an underline, like the Discord profile */}
          <div role="tablist" aria-label="Profile sections" className="mt-6 flex border-b border-white/15 px-4 sm:px-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => router.replace(`/profile?tab=${t.id}`, { scroll: false })}
                className={cn(
                  "relative flex-1 py-3 text-sm font-semibold transition-colors sm:flex-none sm:px-6",
                  tab === t.id ? "text-[#5865f2]" : "text-[#949ba4] hover:text-white"
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t.label}
                </span>
                {tab === t.id && <span className="absolute inset-x-3 bottom-[-1px] h-0.5 rounded-full bg-[#5865f2]" />}
              </button>
            ))}
          </div>

          <div className="px-4 py-5 sm:px-6">
            {tab === "history" &&
              (items && items.length === 0 ? (
                <p className="py-12 text-center text-sm text-white/60">Nothing watched yet. Start an episode and it will show up here.</p>
              ) : (
                <div className="grid grid-cols-1 gap-x-4 gap-y-6 min-[480px]:grid-cols-2 lg:grid-cols-3">
                  {(items ?? []).map((h) => (
                    <HistoryCard key={h.animeId} h={h} onRemove={() => remove(h.animeId)} />
                  ))}
                </div>
              ))}
            {tab === "favorites" && <PosterGrid items={favorites} onRemove={unfavorite} empty="No favorites yet. Tap the heart on a watch page to add anime." />}
            {tab === "list" && <PosterGrid items={list} onRemove={unlist} empty="Your watchlist is empty. Tap the + on a watch page to add anime." />}
          </div>
        </div>
      </main>
      {editing && user && <EditProfile onClose={() => setEditing(false)} />}
      {sharing && user && (
        <ShareStory
          tab={tab}
          name={name ?? "AniBiar viewer"}
          handle={handle}
          bio={profile?.bio ?? null}
          joined={joined}
          avatar={avatar}
          banner={banner}
          effect={fx}
          decoration={deco}
          history={storyHistory}
          favorites={storyFavorites}
          list={storyList}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  )
}
