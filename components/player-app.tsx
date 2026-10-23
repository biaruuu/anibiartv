"use client"

import * as React from "react"
import { AudioLines, Captions, FileVideo, Link2, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { VideoPlayer, type VideoTrack } from "@/components/ui/video-player"
import { VIDEOS, type Video } from "@/lib/videos"

const SHORTCUTS: Array<[string, string]> = [
  ["Space / K", "Play or pause"],
  ["← / →", "Seek 10 seconds"],
  ["↑ / ↓", "Volume"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
  ["C", "Captions"],
]

function revoke(ref: { current: string | null }) {
  if (ref.current) {
    URL.revokeObjectURL(ref.current)
    ref.current = null
  }
}

function stripExtension(name: string) {
  return name.replace(/\.[^./]+$/, "")
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function PlayerApp() {
  const [current, setCurrent] = React.useState<Video>(VIDEOS[0])
  const [autoPlay, setAutoPlay] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [urlError, setUrlError] = React.useState<string | null>(null)
  const [customTrack, setCustomTrack] = React.useState<VideoTrack | null>(null)

  const localVideoUrl = React.useRef<string | null>(null)
  const captionUrl = React.useRef<string | null>(null)
  const videoInput = React.useRef<HTMLInputElement>(null)
  const vttInput = React.useRef<HTMLInputElement>(null)

  const index = VIDEOS.findIndex((v) => v.id === current.id)
  const inPlaylist = index !== -1

  const tracks = React.useMemo(
    () => (customTrack ? [customTrack, ...current.tracks] : current.tracks),
    [customTrack, current.tracks]
  )

  React.useEffect(
    () => () => {
      revoke(localVideoUrl)
      revoke(captionUrl)
    },
    []
  )

  const play = React.useCallback((video: Video) => {
    revoke(captionUrl)
    revoke(localVideoUrl)
    setCustomTrack(null)
    setCurrent(video)
    setAutoPlay(true)
  }, [])

  const goTo = (offset: number) => {
    if (!inPlaylist) return
    play(VIDEOS[(index + offset + VIDEOS.length) % VIDEOS.length])
  }

  const submitUrl = (e: React.FormEvent) => {
    e.preventDefault()
    let parsed: URL
    try {
      parsed = new URL(url.trim())
    } catch {
      setUrlError("Enter a valid link, e.g. https://example.com/video.mp4")
      return
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setUrlError("Only http and https links are supported.")
      return
    }
    if (parsed.protocol === "http:" && window.location.protocol === "https:") {
      setUrlError("This site uses HTTPS, so the video link must be https:// too.")
      return
    }
    setUrlError(null)
    const lastSegment = safeDecode(
      parsed.pathname.split("/").filter(Boolean).pop() ?? ""
    )
    play({
      id: `url-${Date.now()}`,
      title: stripExtension(lastSegment) || parsed.hostname,
      description: `Streaming from ${parsed.hostname}`,
      src: parsed.toString(),
      tracks: [],
    })
  }

  const onVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    revoke(localVideoUrl)
    revoke(captionUrl)
    const blobUrl = URL.createObjectURL(file)
    localVideoUrl.current = blobUrl
    setCustomTrack(null)
    setCurrent({
      id: `local-${Date.now()}`,
      title: stripExtension(file.name),
      description: "Played from your device. Nothing is uploaded.",
      src: blobUrl,
      tracks: [],
    })
    setAutoPlay(true)
  }

  const onCaptionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    revoke(captionUrl)
    const blobUrl = URL.createObjectURL(file)
    captionUrl.current = blobUrl
    setCustomTrack({
      src: blobUrl,
      srclang: "und",
      label: stripExtension(file.name),
    })
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Play className="size-4 fill-current" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Videoplayer
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:py-8">
        <section className="min-w-0 space-y-5">
          <VideoPlayer
            src={current.src}
            poster={current.poster}
            title={current.title}
            tracks={tracks}
            autoPlay={autoPlay}
            onEnded={() => {
              if (inPlaylist && index < VIDEOS.length - 1) goTo(1)
            }}
            onNext={inPlaylist ? () => goTo(1) : undefined}
            onPrevious={inPlaylist ? () => goTo(-1) : undefined}
          />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                {current.title}
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                {current.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tracks.map((t) => (
                <Badge key={`${t.srclang}:${t.src}`} variant="secondary">
                  <Captions />
                  {t.label}
                </Badge>
              ))}
              {!inPlaylist && (
                <Badge variant="outline">
                  {current.id.startsWith("local-") ? "Local file" : "Custom link"}
                </Badge>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle>Up next</CardTitle>
              <CardDescription>{VIDEOS.length} sample videos</CardDescription>
            </CardHeader>
            <ul className="max-h-[26rem] space-y-1 overflow-y-auto p-2">
              {VIDEOS.map((video) => {
                const active = video.id === current.id
                return (
                  <li key={video.id}>
                    <button
                      type="button"
                      onClick={() => play(video)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                        {video.poster && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={video.poster}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                        {active && (
                          <div className="absolute inset-0 grid place-items-center bg-black/55 text-white">
                            <AudioLines className="size-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {video.title}
                        </p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {video.description}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Play your own</CardTitle>
              <CardDescription>
                Paste a direct MP4 or WebM link, or open a file from your
                device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={submitUrl} className="space-y-2" noValidate>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/video.mp4"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value)
                      setUrlError(null)
                    }}
                    aria-label="Video link"
                    aria-invalid={urlError ? true : undefined}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Play link"
                    disabled={!url.trim()}
                    className="shrink-0"
                  >
                    <Link2 />
                  </Button>
                </div>
                {urlError && (
                  <p role="alert" className="text-sm text-destructive">
                    {urlError}
                  </p>
                )}
              </form>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => videoInput.current?.click()}
                >
                  <FileVideo />
                  Open file
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => vttInput.current?.click()}
                >
                  <Captions />
                  Add captions
                </Button>
              </div>
              <input
                ref={videoInput}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={onVideoFile}
              />
              <input
                ref={vttInput}
                type="file"
                accept=".vtt,text/vtt"
                className="hidden"
                onChange={onCaptionFile}
              />
              <p className="text-xs text-muted-foreground">
                Captions use WebVTT (.vtt) files and show in Poppins.
              </p>
            </CardContent>
          </Card>

          <Card className="hidden sm:flex">
            <CardHeader>
              <CardTitle>Keyboard shortcuts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5">
                {SHORTCUTS.map(([keys, action]) => (
                  <div
                    key={keys}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <dt className="text-muted-foreground">{action}</dt>
                    <dd>
                      <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">
                        {keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 text-sm text-muted-foreground sm:px-6">
          Built with Next.js, shadcn/ui and Tailwind CSS.
        </div>
      </footer>
    </div>
  )
}
