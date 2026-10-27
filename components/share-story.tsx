"use client"

import * as React from "react"
import { Download, Image as ImageIcon, Share2, X, Zap } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import type { HistoryItem, ListItem } from "@/lib/library"
import { canvasToBlob, FORMAT_LABEL, prepareStory, sizeFor, TAB_LABEL, type StoryFormat, type StoryTab } from "@/lib/story"
import { canMakeVideo, recordScene, type VideoResult } from "@/lib/story-video"
import { cn } from "@/lib/utils"

type Props = {
  tab: StoryTab
  name: string
  handle: string | null
  bio: string | null
  joined: string | null
  avatar: string | null
  banner: string | null
  history: HistoryItem[]
  favorites: ListItem[]
  list: ListItem[]
  onClose: () => void
}

/** Preview of the profile as a 9:16 story picture, with Save and Share. */
export function ShareStory({ tab: startTab, onClose, ...data }: Props) {
  const [tab, setTab] = React.useState<StoryTab>(startTab)
  const [format, setFormat] = React.useState<StoryFormat>("screen")
  const [size, setSize] = React.useState(() => sizeFor("screen"))
  const [blob, setBlob] = React.useState<Blob | null>(null)
  const [url, setUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(null)
  const [kind, setKind] = React.useState<"image" | "live">("image")
  const [seconds, setSeconds] = React.useState(20)
  const [moving, setMoving] = React.useState(false)
  const [video, setVideo] = React.useState<VideoResult | null>(null)
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState(0)
  const videoOk = React.useMemo(() => canMakeVideo(), [])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  React.useEffect(() => {
    if (kind !== "image") return
    let alive = true
    let made: string | null = null
    setBlob(null)
    setUrl(null)
    setError(null)
    setSize(sizeFor(format))
    prepareStory({ ...data, tab, format, host: window.location.host })
      .then((scene) => {
        if (alive) setSize({ w: scene.canvas.width, h: scene.canvas.height })
        return canvasToBlob(scene.canvas)
      })
      .then((b) => {
        if (!alive) return
        made = URL.createObjectURL(b)
        setBlob(b)
        setUrl(made)
      })
      .catch(() => alive && setError("Could not create the image. Please try again."))
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
    // data props change identity every render; the picture only depends on these values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, tab, format, data.name, data.handle, data.bio, data.joined, data.avatar, data.banner, data.history, data.favorites, data.list])

  // Live: the picked tab only, every item (a long list scrolls), GIFs keep moving, any length you choose
  React.useEffect(() => {
    if (kind !== "live") return
    const signal = { cancelled: false }
    let made: string | null = null
    setVideo(null)
    setVideoUrl(null)
    setError(null)
    setProgress(0)
    ;(async () => {
      const scene = await prepareStory({ ...data, tab, format: format === "full" ? "screen" : format, host: window.location.host }, { scroll: true })
      if (signal.cancelled) return
      setMoving(scene.animated)
      setSize({ w: 1080, h: scene.viewH })
      const result = await recordScene(scene, seconds * 1000, (p) => !signal.cancelled && setProgress(p), signal)
      if (signal.cancelled) return
      made = URL.createObjectURL(result.blob)
      setVideo(result)
      setVideoUrl(made)
    })().catch((e) => !signal.cancelled && setError(e?.message === "cancelled" ? null : "Could not make the live photo on this browser. Use the screenshot instead."))
    return () => {
      signal.cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, seconds, tab, format, data.name, data.handle, data.bio, data.joined, data.avatar, data.banner, data.history, data.favorites, data.list])

  const fileName =
    kind !== "image" ? `anibiar-${data.handle ?? "profile"}-${tab}${kind === "live" ? "-live" : ""}.${video?.ext ?? "mp4"}` : `anibiar-${data.handle ?? "profile"}-${tab}-${format}.png`

  const fileUrl = kind !== "image" ? videoUrl : url
  const fileBlob = kind !== "image" ? video?.blob ?? null : blob
  const fileType = kind !== "image" ? video?.mime ?? "video/mp4" : "image/png"

  const save = () => {
    if (!fileUrl) return
    const a = document.createElement("a")
    a.href = fileUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setNote(
      kind !== "image" && video?.ext === "webm"
        ? "Saved as a WebM video. If Instagram does not accept it, use the screenshot instead."
        : "Saved! Now add it to your Instagram or Facebook story."
    )
  }

  const shareable = React.useMemo(() => {
    if (!fileBlob || typeof navigator.canShare !== "function") return false
    try {
      return navigator.canShare({ files: [new File([fileBlob], fileName, { type: fileType })] })
    } catch {
      return false
    }
  }, [fileBlob, fileName, fileType])

  const share = async () => {
    if (!fileBlob) return
    try {
      await navigator.share({ files: [new File([fileBlob], fileName, { type: fileType })], title: "My AniBiar TV profile" })
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/80 sm:place-items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share your profile"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[96svh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/20 bg-[#121113] sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
          <h2 className="text-lg font-semibold text-white">Share your profile</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>

        <div role="tablist" aria-label="Screenshot, live or video" className="mx-4 mt-3 flex gap-1.5 sm:mx-5">
          {(
            [
              { id: "image", label: "Screenshot", icon: ImageIcon },
              { id: "live", label: "Live", icon: Zap },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={kind === id}
              disabled={id === "live" && !videoOk}
              onClick={() => {
                setNote(null)
                setKind(id)
                if (id === "live" && format === "full") setFormat("screen")
              }}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40",
                kind === id ? "border-white bg-white text-black" : "border-white/20 text-white/70 hover:text-white"
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <div role="tablist" aria-label="Show on the picture" className="mx-4 mt-2 flex rounded-full border border-white/20 p-0.5 sm:mx-5">
          {(Object.keys(TAB_LABEL) as StoryTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors",
                tab === t ? "bg-white text-black" : "text-white/70 hover:text-white"
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div role="tablist" aria-label="Picture size" className="mx-4 mt-2 flex gap-1.5 sm:mx-5">
          {(Object.keys(FORMAT_LABEL) as StoryFormat[]).filter((f) => kind === "image" || f !== "full").map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={format === f}
              onClick={() => setFormat(f)}
              className={cn(
                "flex-1 rounded-full border px-2 py-1.5 text-xs font-semibold transition-colors",
                format === f ? "border-white bg-white/15 text-white" : "border-white/20 text-white/60 hover:text-white"
              )}
            >
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>

        {kind === "live" && (
          <div role="tablist" aria-label="Length" className="mx-4 mt-2 flex items-center gap-1.5 sm:mx-5">
            <span className="mr-1 text-xs text-white/60">Length</span>
            {[5, 10, 20, 30, 60].map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={seconds === n}
                onClick={() => setSeconds(n)}
                className={cn(
                  "flex-1 rounded-full border px-2 py-1 text-xs font-semibold transition-colors",
                  seconds === n ? "border-white bg-white/15 text-white" : "border-white/20 text-white/60 hover:text-white"
                )}
              >
                {n}s
              </button>
            ))}
          </div>
        )}

        {/* preview in the chosen shape, as tall as the screen allows */}
        <div className="grid min-h-0 flex-1 place-items-center px-4 py-4 sm:px-5">
          <div
            style={{ aspectRatio: `${size.w} / ${size.h}` }}
            className="relative h-full max-h-[min(54svh,36rem)] max-w-full overflow-hidden rounded-xl border border-white/15 bg-white/[0.04]"
          >
            {kind !== "image" && videoUrl ? (
              <>
                <video key={videoUrl} src={videoUrl} autoPlay loop muted playsInline className="size-full object-contain" />
                {kind === "live" && (
                  <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-white">
                    <Zap className="size-3 fill-current" />
                    LIVE
                  </span>
                )}
              </>
            ) : kind === "image" && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Preview of your profile picture for stories" className="size-full object-contain" />
            ) : (
              <div className="grid size-full place-items-center px-6 text-center text-sm text-white/60">
                {error ? (
                  <p>{error}</p>
                ) : kind !== "image" ? (
                  <div className="w-full">
                    <Spinner className="mx-auto size-6" />
                    <p className="mt-3">Recording your {TAB_LABEL[tab]} live photo… {Math.round(progress * 100)}%</p>
                    <p className="mt-1 text-xs text-white/45">Keep this screen open for a few seconds.</p>
                  </div>
                ) : (
                  <Spinner className="size-6" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
          {note && <p className="text-center text-xs text-white/70">{note}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!fileUrl}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              <Download className="size-4" />
              {kind === "live" ? "Save live photo" : "Save image"}
            </button>
            {shareable && (
              <button
                type="button"
                onClick={share}
                disabled={!fileBlob}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/25 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                <Share2 className="size-4" />
                Share
              </button>
            )}
          </div>
          <p className="text-center text-[0.7rem] text-white/45">
            {kind === "live"
              ? `${seconds} second looping clip of the ${TAB_LABEL[tab]} tab, scrolling through everything${moving ? ", your GIF keeps moving" : ". Set a GIF banner or avatar in Edit profile to make it move"}.`
              : `${size.w} × ${size.h}px${format === "story" ? ", the size of an Instagram or Facebook story" : format === "post" ? ", a feed post" : format === "full" ? ", every item on one tall picture" : ", the same shape as this device's screen"}.`}
          </p>
        </div>
      </div>
    </div>
  )
}
