"use client"

import * as React from "react"

import pkg from "../package.json"
import {
  AddIcon,
  CheckIcon,
  ClosedCaptionsIcon,
  ComputerIcon,
  InfoIcon,
  LinkIcon,
  PlayIcon,
  SubtitlesIcon,
  XMarkIcon,
} from "@/components/icons/vidstack"
import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoPlayer, type VideoTrack } from "@/components/ui/video-player"
import {
  decodeText,
  isThumbnailTrack,
  parseCaptions,
  type CaptionFormat,
  type Cue,
} from "@/lib/captions"
import { VIDEOS, type Video } from "@/lib/videos"
import { cn } from "@/lib/utils"

type Subtitle = { id: string; name: string; format: CaptionFormat; cues: Cue[] }
type Status = {
  kind: "success" | "error"
  title: string
  text: string
} | null

const VIDEO_ACCEPT = "video/*,.mp4,.m4v,.webm,.mkv,.mov,.ogv,.avi,.3gp"
const SUBTITLE_ACCEPT = ".srt,.vtt,.ass,.ssa,text/vtt,application/x-subrip"
const VIDEO_EXT = /\.(mp4|m4v|webm|mkv|mov|ogv|avi|3gp)$/i
const SUBTITLE_EXT = /\.(srt|vtt|ass|ssa)$/i

const isVideoFile = (file: File) =>
  file.type.startsWith("video/") || VIDEO_EXT.test(file.name)
const isSubtitleFile = (file: File) => SUBTITLE_EXT.test(file.name)

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
  const [subtitles, setSubtitles] = React.useState<Subtitle[]>([])
  const [status, setStatus] = React.useState<Status>(null)
  const [dragging, setDragging] = React.useState(false)
  const [tab, setTab] = React.useState("playlist")
  const [subtitleUrl, setSubtitleUrl] = React.useState("")
  const [subtitleUrlError, setSubtitleUrlError] = React.useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = React.useState(false)

  const localVideoUrl = React.useRef<string | null>(null)
  const videoInput = React.useRef<HTMLInputElement>(null)
  const subtitleInput = React.useRef<HTMLInputElement>(null)
  const dragDepth = React.useRef(0)

  const index = VIDEOS.findIndex((v) => v.id === current.id)
  const inPlaylist = index !== -1

  const tracks = React.useMemo<VideoTrack[]>(
    () => [
      ...subtitles.map((s) => ({
        id: s.id,
        srclang: "und",
        label: s.name,
        cues: s.cues,
      })),
      ...current.tracks,
    ],
    [subtitles, current.tracks]
  )

  React.useEffect(() => {
    // Without this, dropping a file outside the drop area makes the browser
    // navigate away to the file.
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener("dragover", prevent)
    window.addEventListener("drop", prevent)
    return () => {
      window.removeEventListener("dragover", prevent)
      window.removeEventListener("drop", prevent)
      revoke(localVideoUrl)
    }
  }, [])

  /* ---------- playing things ---------- */
  const play = React.useCallback((video: Video) => {
    revoke(localVideoUrl)
    setSubtitles([])
    setStatus(null)
    setCurrent(video)
    setAutoPlay(true)
  }, [])

  const goTo = (offset: number) => {
    if (!inPlaylist) return
    play(VIDEOS[(index + offset + VIDEOS.length) % VIDEOS.length])
  }

  const loadVideoFile = (file: File) => {
    revoke(localVideoUrl)
    const blobUrl = URL.createObjectURL(file)
    localVideoUrl.current = blobUrl
    setSubtitles([])
    setStatus(null)
    setCurrent({
      id: `local-${Date.now()}`,
      title: stripExtension(file.name),
      description: "Played from your device. Nothing is uploaded.",
      src: blobUrl,
      tracks: [],
    })
    setAutoPlay(true)
  }

  const addSubtitleFiles = async (files: File[]) => {
    const added: Subtitle[] = []
    const failed: string[] = []

    for (const file of files) {
      try {
        const { cues, format } = parseCaptions(decodeText(await file.arrayBuffer()))
        if (cues.length === 0) {
          failed.push(file.name)
          continue
        }
        // Newest first: the player switches to the first subtitle in the list.
        added.unshift({
          id: `${Date.now()}-${added.length}-${file.name}`,
          name: stripExtension(file.name),
          format,
          cues,
        })
      } catch {
        failed.push(file.name)
      }
    }

    if (added.length > 0) {
      setSubtitles((previous) => [...added, ...previous])
      const lines = added.reduce((sum, s) => sum + s.cues.length, 0)
      setStatus({
        kind: "success",
        title: added.length === 1 ? "Subtitles added" : `${added.length} subtitle files added`,
        text:
          `${lines} lines loaded and turned on.` +
          (failed.length ? ` Couldn't read: ${failed.join(", ")}.` : ""),
      })
    } else if (failed.length > 0) {
      setStatus({
        kind: "error",
        title: "No subtitles found",
        text: `Couldn't read any subtitle lines from ${failed.join(", ")}. Supported formats: SRT, VTT, ASS and SSA.`,
      })
    }
  }

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    const video = files.find(isVideoFile)
    const subtitleFiles = files.filter(isSubtitleFile)

    if (!video && subtitleFiles.length === 0) {
      setStatus({
        kind: "error",
        title: "Unsupported file",
        text: "Choose a video (MP4, WebM, MKV, MOV) or subtitles (SRT, VTT, ASS).",
      })
      return
    }
    if (video) loadVideoFile(video)
    if (subtitleFiles.length > 0) await addSubtitleFiles(subtitleFiles)
    setTab("upload")
  }

  const submitSubtitleUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    let parsed: URL
    try {
      parsed = new URL(subtitleUrl.trim())
    } catch {
      setSubtitleUrlError("Enter a valid link, e.g. https://example.com/subtitles.vtt")
      return
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setSubtitleUrlError("Only http and https links are supported.")
      return
    }
    if (parsed.protocol === "http:" && window.location.protocol === "https:") {
      setSubtitleUrlError("This site uses HTTPS, so the subtitle link must be https:// too.")
      return
    }

    setSubtitleUrlError(null)
    setSubtitleLoading(true)
    try {
      const response = await fetch(parsed.toString())
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const { cues, format } = parseCaptions(
        decodeText(await response.arrayBuffer())
      )

      if (isThumbnailTrack(cues)) {
        setSubtitleUrlError(
          "That link is a thumbnail preview track (image references for the seek bar), not subtitles. Use a link to an SRT, VTT or ASS subtitle file."
        )
        return
      }
      if (cues.length === 0) {
        setSubtitleUrlError("No subtitle lines were found in that file.")
        return
      }

      const lastSegment = safeDecode(
        parsed.pathname.split("/").filter(Boolean).pop() ?? ""
      )
      setSubtitles((previous) => [
        {
          id: `${Date.now()}-link`,
          name: stripExtension(lastSegment) || parsed.hostname,
          format,
          cues,
        },
        ...previous,
      ])
      setSubtitleUrl("")
      setStatus({
        kind: "success",
        title: "Subtitles added",
        text: `${cues.length} lines loaded from ${parsed.hostname} and turned on.`,
      })
    } catch {
      setSubtitleUrlError(
        "Couldn't load that link. Check the address. The host may also block other websites from reading it (CORS)."
      )
    } finally {
      setSubtitleLoading(false)
    }
  }

  const removeSubtitle = (id: string) => {
    setSubtitles((previous) => previous.filter((s) => s.id !== id))
    setStatus(null)
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

  /* ---------- drag and drop ---------- */
  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("Files")

  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    void handleFiles(Array.from(e.dataTransfer.files))
  }

  /* ---------- file pickers ---------- */
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Copy first: clearing the input empties its live FileList.
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    void handleFiles(files)
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <PlayIcon className="size-6" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Videoplayer
            </span>
            <Badge variant="outline" className="hidden sm:inline-flex">
              v{pkg.version}
            </Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:py-8">
        <section className="min-w-0 space-y-5">
          <div
            className="relative"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
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
            {dragging && (
              <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-background/85 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-center">
                  <AddIcon className="size-12" />
                  <p className="text-sm font-semibold sm:text-base">
                    Drop to play or add subtitles
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Video, SRT, VTT or ASS files
                  </p>
                </div>
              </div>
            )}
          </div>

          <Card className="gap-3 py-5">
            <CardHeader className="gap-1">
              <CardTitle className="text-xl tracking-tight text-balance sm:text-2xl">
                {current.title}
              </CardTitle>
              <CardDescription className="sm:text-base">
                {current.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {tracks.length === 0 && (
                <Badge variant="outline">No subtitles</Badge>
              )}
              {tracks.map((t) => (
                <Badge key={t.id ?? `${t.srclang}:${t.src}`} variant="secondary">
                  <ClosedCaptionsIcon className="size-4!" />
                  {t.label}
                </Badge>
              ))}
              {!inPlaylist && (
                <Badge variant="outline">
                  {current.id.startsWith("local-") ? "Local file" : "Custom link"}
                </Badge>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card className="gap-0 overflow-hidden py-0">
            <Tabs value={tab} onValueChange={setTab} className="gap-0">
              <div className="border-b p-3">
                <TabsList>
                  <TabsTrigger value="playlist">
                    <PlayIcon className="size-5" />
                    Up next
                  </TabsTrigger>
                  <TabsTrigger value="upload">
                    <AddIcon className="size-5" />
                    Upload
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="playlist">
                <ScrollArea className="h-[26rem]">
                  <ul className="space-y-1 p-2">
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
                                  <PlayIcon className="size-8" />
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
                </ScrollArea>
              </TabsContent>

              <TabsContent value="upload">
                <div className="space-y-5 p-4">
                  <div
                    className={cn(
                      "flex flex-col items-center gap-3 rounded-xl border border-dashed p-5 text-center transition-colors",
                      dragging ? "border-primary bg-accent" : "bg-muted/40"
                    )}
                    onDragEnter={onDragEnter}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                  >
                    <span className="grid size-11 place-items-center rounded-full bg-background shadow-xs ring-1 ring-border">
                      <AddIcon className="size-7" />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Drop files here</p>
                      <p className="text-xs text-muted-foreground">
                        Video: MP4, WebM, MKV. Subtitles: SRT, VTT, ASS.
                      </p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={() => videoInput.current?.click()}
                      >
                        <ComputerIcon className="size-5" />
                        Open video
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => subtitleInput.current?.click()}
                      >
                        <SubtitlesIcon className="size-5" />
                        Add subtitles
                      </Button>
                    </div>
                  </div>

                  <input
                    ref={videoInput}
                    type="file"
                    accept={VIDEO_ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Open a video file"
                    onChange={onPickFiles}
                  />
                  <input
                    ref={subtitleInput}
                    type="file"
                    accept={SUBTITLE_ACCEPT}
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Add subtitle files"
                    onChange={onPickFiles}
                  />

                  {status && (
                    <Alert variant={status.kind === "error" ? "destructive" : "default"}>
                      {status.kind === "error" ? <InfoIcon /> : <CheckIcon />}
                      <AlertTitle>{status.title}</AlertTitle>
                      <AlertDescription>{status.text}</AlertDescription>
                    </Alert>
                  )}

                  {subtitles.length > 0 && (
                    <div className="space-y-2">
                      <Label>Subtitles for this video</Label>
                      <ul className="space-y-2">
                        {subtitles.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center gap-3 rounded-lg border bg-card py-2 pr-2 pl-3"
                          >
                            <SubtitlesIcon className="size-6 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {s.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {s.format.toUpperCase()} · {s.cues.length} lines
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              aria-label={`Remove ${s.name}`}
                              onClick={() => removeSubtitle(s.id)}
                            >
                              <XMarkIcon className="size-5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => void submitSubtitleUrl(e)}
                    className="space-y-2"
                    noValidate
                  >
                    <Label htmlFor="subtitle-link">Add subtitles from a link</Label>
                    <div className="flex gap-2">
                      <Input
                        id="subtitle-link"
                        type="url"
                        inputMode="url"
                        placeholder="https://example.com/subtitles.vtt"
                        value={subtitleUrl}
                        onChange={(e) => {
                          setSubtitleUrl(e.target.value)
                          setSubtitleUrlError(null)
                        }}
                        aria-invalid={subtitleUrlError ? true : undefined}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        aria-label="Add subtitles from link"
                        disabled={!subtitleUrl.trim() || subtitleLoading}
                        className="shrink-0"
                      >
                        {subtitleLoading ? (
                          <Spinner className="size-5" />
                        ) : (
                          <AddIcon className="size-6" />
                        )}
                      </Button>
                    </div>
                    {subtitleUrlError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {subtitleUrlError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        SRT, VTT or ASS. The host must allow other websites to
                        load the file.
                      </p>
                    )}
                  </form>

                  <Separator />

                  <form onSubmit={submitUrl} className="space-y-2" noValidate>
                    <Label htmlFor="video-link">Stream from a link</Label>
                    <div className="flex gap-2">
                      <Input
                        id="video-link"
                        type="url"
                        inputMode="url"
                        placeholder="https://example.com/video.mp4"
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value)
                          setUrlError(null)
                        }}
                        aria-invalid={urlError ? true : undefined}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        aria-label="Play link"
                        disabled={!url.trim()}
                        className="shrink-0"
                      >
                        <LinkIcon className="size-6" />
                      </Button>
                    </div>
                    {urlError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {urlError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Direct MP4 or WebM links work best.
                      </p>
                    )}
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="hidden gap-4 sm:flex">
            <CardHeader>
              <CardTitle className="text-base">Keyboard shortcuts</CardTitle>
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
                      <Kbd>{keys}</Kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 text-sm text-muted-foreground sm:px-6">
          Built with Next.js, shadcn/ui and Tailwind CSS. Icons by Vidstack.
        </div>
      </footer>
    </div>
  )
}
