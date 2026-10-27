"use client"

import * as React from "react"
import { Download, Image as ImageIcon, Share2, Video, X } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import type { HistoryItem, ListItem } from "@/lib/library"
import { canvasToBlob, FORMAT_LABEL, renderStory, sizeFor, TAB_LABEL, type StoryFormat, type StoryTab } from "@/lib/story"
import { canMakeVideo, canRecordScreen, makeSlideVideo, startScreenRecording, type VideoResult } from "@/lib/story-video"
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
  const [kind, setKind] = React.useState<"image" | "video">("image")
  const [video, setVideo] = React.useState<VideoResult | null>(null)
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState(0)
  const [recording, setRecording] = React.useState(false)
  const stopRef = React.useRef<null | (() => void)>(null)
  const videoOk = React.useMemo(() => canMakeVideo(), [])
  const screenOk = React.useMemo(() => canRecordScreen(), [])

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
    renderStory({ ...data, tab, format, host: window.location.host })
      .then(canvasToBlob)
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

  // auto-made video: the profile tabs one after another, like a screen recording
  React.useEffect(() => {
    if (kind !== "video" || recording) return
    const signal = { cancelled: false }
    let made: string | null = null
    setVideo(null)
    setVideoUrl(null)
    setError(null)
    setProgress(0)
    ;(async () => {
      const order: StoryTab[] = [tab, ...(["history", "favorites", "list"] as StoryTab[]).filter((t) => t !== tab && data[t].length > 0)]
      const frames: HTMLCanvasElement[] = []
      for (const t of order) frames.push(await renderStory({ ...data, tab: t, format, host: window.location.host }))
      if (signal.cancelled) return
      const result = await makeSlideVideo(frames, (p) => !signal.cancelled && setProgress(p), signal)
      if (signal.cancelled) return
      made = URL.createObjectURL(result.blob)
      setVideo(result)
      setVideoUrl(made)
    })().catch((e) => !signal.cancelled && setError(e?.message === "cancelled" ? null : "Could not make the video on this browser. Use the screenshot instead."))
    return () => {
      signal.cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, recording, tab, format, data.name, data.handle, data.bio, data.joined, data.avatar, data.banner, data.history, data.favorites, data.list])

  const record = async () => {
    setError(null)
    setNote(null)
    try {
      stopRef.current = await startScreenRecording(
        (r) => {
          setRecording(false)
          setKind("video")
          setProgress(1)
          setVideo(r)
          setVideoUrl(URL.createObjectURL(r.blob))
        },
        () => {
          setRecording(false)
          setError("The screen recording did not work. Try again.")
        }
      )
      setRecording(true)
    } catch {
      setError("Screen recording was cancelled or is not allowed here.")
    }
  }

  const fileName =
    kind === "video" ? `anibiar-${data.handle ?? "profile"}-${tab}.${video?.ext ?? "mp4"}` : `anibiar-${data.handle ?? "profile"}-${tab}-${format}.png`

  const fileUrl = kind === "video" ? videoUrl : url
  const fileBlob = kind === "video" ? video?.blob ?? null : blob
  const fileType = kind === "video" ? video?.mime ?? "video/mp4" : "image/png"

  const save = () => {
    if (!fileUrl) return
    const a = document.createElement("a")
    a.href = fileUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setNote(
      kind === "video" && video?.ext === "webm"
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

  // while the screen is being recorded only a small stop button stays on top of the page
  if (recording)
    return (
      <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2">
        <button
          type="button"
          onClick={() => stopRef.current?.()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-lg hover:bg-red-500"
        >
          <span className="size-2.5 animate-pulse rounded-full bg-white" />
          Stop recording
        </button>
      </div>
    )

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

        <div role="tablist" aria-label="Screenshot or video" className="mx-4 mt-3 flex gap-1.5 sm:mx-5">
          {(
            [
              { id: "image", label: "Screenshot", icon: ImageIcon },
              { id: "video", label: "Video", icon: Video },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={kind === id}
              disabled={id === "video" && !videoOk && !screenOk}
              onClick={() => {
                setNote(null)
                setKind(id)
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
          {(Object.keys(FORMAT_LABEL) as StoryFormat[]).map((f) => (
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

        {/* preview in the chosen shape, as tall as the screen allows */}
        <div className="grid min-h-0 flex-1 place-items-center px-4 py-4 sm:px-5">
          <div
            style={{ aspectRatio: `${size.w} / ${size.h}` }}
            className="relative h-full max-h-[min(54svh,36rem)] max-w-full overflow-hidden rounded-xl border border-white/15 bg-white/[0.04]"
          >
            {kind === "video" && videoUrl ? (
              <video key={videoUrl} src={videoUrl} autoPlay loop muted playsInline controls className="size-full object-contain" />
            ) : kind === "image" && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Preview of your profile picture for stories" className="size-full object-contain" />
            ) : (
              <div className="grid size-full place-items-center px-6 text-center text-sm text-white/60">
                {error ? (
                  <p>{error}</p>
                ) : kind === "video" ? (
                  <div className="w-full">
                    <Spinner className="mx-auto size-6" />
                    <p className="mt-3">Making your video… {Math.round(progress * 100)}%</p>
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
              {kind === "video" ? "Save video" : "Save image"}
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
          {screenOk && (
            <button
              type="button"
              onClick={record}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/25 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <span className="size-2.5 rounded-full bg-red-500" />
              Record my screen instead
            </button>
          )}
          <p className="text-center text-[0.7rem] text-white/45">
            {kind === "video"
              ? "Vertical video of your profile tabs, a few seconds, no sound."
              : `${size.w} × ${size.h}px${format === "story" ? ", the size of an Instagram or Facebook story" : format === "post" ? ", a feed post" : ", the same shape as this device's screen"}.`}
          </p>
        </div>
      </div>
    </div>
  )
}
