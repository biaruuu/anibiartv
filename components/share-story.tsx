"use client"

import * as React from "react"
import { Download, Share2, X } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import type { HistoryItem, ListItem } from "@/lib/library"
import { canvasToBlob, FORMAT_LABEL, renderStory, sizeFor, TAB_LABEL, type StoryFormat, type StoryTab } from "@/lib/story"
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
  const [format, setFormat] = React.useState<StoryFormat>("story")
  const [size, setSize] = React.useState({ w: 1080, h: 1920 })
  const [blob, setBlob] = React.useState<Blob | null>(null)
  const [url, setUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [canShare, setCanShare] = React.useState(false)
  const [note, setNote] = React.useState<string | null>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  React.useEffect(() => {
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
        try {
          const f = new File([b], "profile.png", { type: "image/png" })
          setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [f] }))
        } catch {
          setCanShare(false)
        }
      })
      .catch(() => alive && setError("Could not create the image. Please try again."))
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
    // data props change identity every render; the picture only depends on these values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, format, data.name, data.handle, data.bio, data.joined, data.avatar, data.banner, data.history, data.favorites, data.list])

  const fileName = `anibiar-${data.handle ?? "profile"}-${tab}-${format}.png`

  const save = () => {
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setNote("Saved! Now add it to your Instagram or Facebook story.")
  }

  const share = async () => {
    if (!blob) return
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title: "My AniBiar TV profile" })
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

        <div role="tablist" aria-label="Show on the picture" className="mx-4 mt-3 flex rounded-full border border-white/20 p-0.5 sm:mx-5">
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
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Preview of your profile picture for stories" className="size-full object-contain" />
            ) : (
              <div className="grid size-full place-items-center text-sm text-white/60">
                {error ? <p className="px-6 text-center">{error}</p> : <Spinner className="size-6" />}
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
              disabled={!url}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              <Download className="size-4" />
              Save image
            </button>
            {canShare && (
              <button
                type="button"
                onClick={share}
                disabled={!blob}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/25 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                <Share2 className="size-4" />
                Share
              </button>
            )}
          </div>
          <p className="text-center text-[0.7rem] text-white/45">{size.w} × {size.h}px{format === "story" ? ", the size of an Instagram or Facebook story" : format === "post" ? ", a feed post" : ", the shape of this device's screen"}.</p>
        </div>
      </div>
    </div>
  )
}
