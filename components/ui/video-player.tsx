"use client"

import * as React from "react"
import {
  AlertCircle,
  Captions,
  CaptionsOff,
  Check,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type VideoTrack = {
  src: string
  srclang: string
  label: string
}

export type VideoPlayerProps = {
  src: string
  poster?: string
  title?: string
  tracks?: VideoTrack[]
  autoPlay?: boolean
  className?: string
  onEnded?: () => void
  onNext?: () => void
  onPrevious?: () => void
}

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SEEK_STEP = 10

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ss = s.toString().padStart(2, "0")
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

function ControlButton({
  label,
  onClick,
  children,
  className,
  active,
  container,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
  active?: boolean
  container: HTMLElement | null
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "size-9 rounded-full text-white hover:bg-white/15 hover:text-white active:scale-95 sm:size-10 dark:hover:bg-white/15",
            active && "bg-white/20",
            className
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        container={container}
        className="border border-white/10 bg-black/85 text-white"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function VideoPlayer({
  src,
  poster,
  title,
  tracks = [],
  autoPlay = false,
  className,
  onEnded,
  onNext,
  onPrevious,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerType = React.useRef("mouse")

  // The player element itself. Kept in state so tooltips can portal into it
  // (required for them to stay visible in fullscreen).
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)

  const [playing, setPlaying] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [volume, setVolume] = React.useState(1)
  const [muted, setMuted] = React.useState(false)
  const [speed, setSpeed] = React.useState(1)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [showControls, setShowControls] = React.useState(true)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [pipSupported, setPipSupported] = React.useState(false)
  const [scrubbing, setScrubbing] = React.useState(false)
  const [cueText, setCueText] = React.useState("")
  const [flash, setFlash] = React.useState<{
    dir: "back" | "forward"
    key: number
  } | null>(null)

  const firstLang = tracks[0]?.srclang ?? null
  const trackKey = tracks.map((t) => `${t.srclang}:${t.src}`).join("|")
  const [captionLang, setCaptionLang] = React.useState<string | null>(
    firstLang
  )

  /* ---------- playback helpers ---------- */
  const togglePlay = React.useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => undefined)
    else v.pause()
  }, [])

  const seekBy = React.useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.min(
      Math.max(v.currentTime + delta, 0),
      v.duration || 0
    )
  }, [])

  const toggleMute = React.useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const changeVolume = React.useCallback((value: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = value
    v.muted = value === 0
    setVolume(value)
    setMuted(value === 0)
  }, [])

  const changeSpeed = (value: number) => {
    if (videoRef.current) videoRef.current.playbackRate = value
    setSpeed(value)
  }

  const toggleFullscreen = React.useCallback(async () => {
    if (!container) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (document.fullscreenEnabled) await container.requestFullscreen()
      else (videoRef.current as WebkitVideo | null)?.webkitEnterFullscreen?.()
    } catch {
      // Fullscreen can be refused by the browser; nothing to do.
    }
  }, [container])

  const togglePip = React.useCallback(async () => {
    const v = videoRef.current
    if (!v || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await v.requestPictureInPicture()
    } catch {
      // Picture-in-picture can be refused by the browser.
    }
  }, [])

  const toggleCaptions = React.useCallback(() => {
    setCaptionLang((current) => (current ? null : firstLang))
  }, [firstLang])

  const flashSeek = (dir: "back" | "forward") => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash({ dir, key: Date.now() })
    flashTimer.current = setTimeout(() => setFlash(null), 650)
  }

  /* ---------- controls auto-hide ---------- */
  const revealControls = React.useCallback(() => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false)
        setSettingsOpen(false)
      }
    }, 2800)
  }, [])

  React.useEffect(() => {
    if (playing) {
      revealControls()
    } else {
      setShowControls(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [playing, revealControls])

  React.useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (clickTimer.current) clearTimeout(clickTimer.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    []
  )

  /* ---------- environment ---------- */
  React.useEffect(() => {
    setPipSupported(Boolean(document.pictureInPictureEnabled))
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  /* ---------- captions (custom overlay, rendered in Poppins) ---------- */
  React.useEffect(() => {
    setCaptionLang(firstLang)
  }, [firstLang])

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const cleanups: Array<() => void> = []

    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i]
      if (captionLang && track.language === captionLang) {
        // "hidden" loads cues and fires events without the browser drawing them.
        track.mode = "hidden"
        const onCue = () => {
          const text = Array.from(track.activeCues ?? [])
            .map((cue) => (cue as VTTCue).text)
            .join("\n")
            .replace(/<[^>]+>/g, "")
          setCueText(text)
        }
        track.addEventListener("cuechange", onCue)
        cleanups.push(() => track.removeEventListener("cuechange", onCue))
        onCue()
      } else {
        track.mode = "disabled"
      }
    }
    if (!captionLang) setCueText("")

    return () => cleanups.forEach((fn) => fn())
  }, [captionLang, trackKey])

  /* ---------- gestures ---------- */
  const onVideoClick = () => {
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }
    // On touch, the first tap while playing just brings the controls back.
    if (pointerType.current === "touch" && playing && !showControls) {
      revealControls()
      return
    }
    if (clickTimer.current) clearTimeout(clickTimer.current)
    // Wait briefly so a double click doesn't also toggle playback.
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      togglePlay()
    }, 220)
  }

  const onVideoDoubleClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    if (ratio < 0.33) {
      seekBy(-SEEK_STEP)
      flashSeek("back")
    } else if (ratio > 0.67) {
      seekBy(SEEK_STEP)
      flashSeek("forward")
    } else {
      void toggleFullscreen()
    }
  }

  /* ---------- keyboard shortcuts ---------- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement
    // Let sliders and buttons keep their own keyboard behaviour.
    if (target.closest('[role="slider"]')) return
    if (e.key === " " && target.closest("button")) return

    switch (e.key.toLowerCase()) {
      case " ":
      case "k":
        e.preventDefault()
        togglePlay()
        break
      case "arrowleft":
      case "j":
        e.preventDefault()
        seekBy(-SEEK_STEP)
        flashSeek("back")
        break
      case "arrowright":
      case "l":
        e.preventDefault()
        seekBy(SEEK_STEP)
        flashSeek("forward")
        break
      case "arrowup":
        e.preventDefault()
        changeVolume(Math.min(volume + 0.1, 1))
        break
      case "arrowdown":
        e.preventDefault()
        changeVolume(Math.max(volume - 0.1, 0))
        break
      case "m":
        toggleMute()
        break
      case "f":
        void toggleFullscreen()
        break
      case "c":
        if (tracks.length > 0) toggleCaptions()
        break
      default:
        return
    }
    revealControls()
  }

  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const controlsHidden = !showControls && playing

  return (
    <TooltipProvider delayDuration={250}>
      <div
        ref={setContainer}
        tabIndex={0}
        role="region"
        aria-label={title ? `Video player: ${title}` : "Video player"}
        onKeyDown={onKeyDown}
        onMouseMove={revealControls}
        onMouseLeave={() => playing && setShowControls(false)}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType
        }}
        className={cn(
          "group relative aspect-video w-full overflow-hidden rounded-xl border bg-black outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&:fullscreen]:rounded-none [&:fullscreen]:border-0",
          controlsHidden && "cursor-none",
          className
        )}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          preload="metadata"
          playsInline
          className="size-full object-contain"
          onClick={onVideoClick}
          onDoubleClick={onVideoDoubleClick}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onPlaying={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => {
            setLoading(false)
            setError(false)
          }}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
          onEnded={() => {
            setPlaying(false)
            onEnded?.()
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            if (!scrubbing) setCurrentTime(e.currentTarget.currentTime)
          }}
        >
          {tracks.map((t) => (
            <track
              key={`${t.srclang}:${t.src}`}
              kind="captions"
              src={t.src}
              srcLang={t.srclang}
              label={t.label}
            />
          ))}
        </video>

        {/* Captions overlay: Poppins */}
        {cueText && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 flex justify-center px-4 transition-all duration-300 ease-out",
              controlsHidden
                ? "bottom-4 sm:bottom-8"
                : "bottom-28 sm:bottom-32"
            )}
          >
            <span className="max-w-[92%] rounded-lg bg-black/75 px-3 py-1.5 text-center font-poppins text-sm leading-snug font-medium whitespace-pre-line text-white sm:max-w-[75%] sm:px-4 sm:py-2 sm:text-lg md:text-xl [:fullscreen_&]:text-2xl">
              {cueText}
            </span>
          </div>
        )}

        {/* Double-tap seek feedback */}
        {flash && (
          <div
            key={flash.key}
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2",
              flash.dir === "back" ? "left-[12%]" : "right-[12%]"
            )}
          >
            <div className="flex size-20 animate-in flex-col items-center justify-center gap-0.5 rounded-full bg-black/60 text-white backdrop-blur-md duration-200 fade-in-0 zoom-in-90">
              {flash.dir === "back" ? (
                <RotateCcw className="size-6" />
              ) : (
                <RotateCw className="size-6" />
              )}
              <span className="font-poppins text-xs font-medium">
                {SEEK_STEP}s
              </span>
            </div>
          </div>
        )}

        {/* Buffering */}
        {loading && playing && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="grid size-14 place-items-center rounded-full bg-black/60 backdrop-blur-md">
              <Loader2 className="size-7 animate-spin text-white" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black p-6 text-center">
            <div className="flex max-w-xs flex-col items-center gap-2 font-poppins text-white">
              <AlertCircle className="size-9 text-white/70" />
              <p className="text-sm font-semibold sm:text-base">
                This video couldn&apos;t be loaded
              </p>
              <p className="text-xs text-white/60 sm:text-sm">
                Check the link or try a different file.
              </p>
            </div>
          </div>
        )}

        {/* Big play button (only the circle is clickable) */}
        {!playing && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25">
            <button
              type="button"
              aria-label="Play video"
              onClick={togglePlay}
              className="pointer-events-auto grid size-16 place-items-center rounded-full bg-white text-black shadow-lg transition-transform duration-200 outline-none hover:scale-105 focus-visible:ring-4 focus-visible:ring-white/40 active:scale-95 sm:size-20"
            >
              <Play className="size-7 translate-x-0.5 fill-current sm:size-9" />
            </button>
          </div>
        )}

        {/* Title */}
        {title && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-2 top-2 z-10 flex transition-all duration-300 ease-out sm:inset-x-3 sm:top-3",
              controlsHidden
                ? "-translate-y-2 opacity-0"
                : "translate-y-0 opacity-100"
            )}
          >
            <span className="max-w-full truncate rounded-lg border border-white/10 bg-black/55 px-3 py-1.5 font-poppins text-xs font-medium text-white backdrop-blur-xl sm:text-sm">
              {title}
            </span>
          </div>
        )}

        {/* Floating control panel */}
        <div
          className={cn(
            "absolute inset-x-2 bottom-2 z-10 transition-all duration-300 ease-out sm:inset-x-3 sm:bottom-3",
            controlsHidden
              ? "pointer-events-none translate-y-3 opacity-0"
              : "translate-y-0 opacity-100"
          )}
        >
          {/* Settings popover */}
          {settingsOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-64 max-w-full animate-in rounded-xl border border-white/10 bg-black/85 p-3 font-poppins text-white backdrop-blur-xl duration-200 fade-in-0 slide-in-from-bottom-2">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-white/50 uppercase">
                Speed
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeSpeed(s)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      speed === s
                        ? "bg-white text-black"
                        : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {tracks.length > 0 && (
                <>
                  <p className="mt-3 mb-1.5 text-[11px] font-semibold tracking-wider text-white/50 uppercase">
                    Captions
                  </p>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => setCaptionLang(null)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/10"
                    >
                      Off
                      {captionLang === null && <Check className="size-4" />}
                    </button>
                    {tracks.map((t) => (
                      <button
                        key={`${t.srclang}:${t.src}`}
                        type="button"
                        onClick={() => setCaptionLang(t.srclang)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/10"
                      >
                        <span className="truncate">{t.label}</span>
                        {captionLang === t.srclang && (
                          <Check className="size-4 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-black/60 px-2.5 pt-2.5 pb-1.5 backdrop-blur-xl sm:px-4 sm:pt-3 sm:pb-2">
            {/* Seek bar */}
            <div className="flex items-center gap-3">
              <span className="min-w-10 text-right font-poppins text-xs text-white/90 tabular-nums">
                {formatTime(currentTime)}
              </span>
              <Slider
                aria-label="Seek"
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={([v]) => {
                  setScrubbing(true)
                  setCurrentTime(v)
                }}
                onValueCommit={([v]) => {
                  if (videoRef.current) videoRef.current.currentTime = v
                  setScrubbing(false)
                }}
                className="cursor-pointer [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-track]]:bg-white/25"
              />
              <span className="min-w-10 font-poppins text-xs text-white/60 tabular-nums">
                {formatTime(duration)}
              </span>
            </div>

            {/* Buttons */}
            <div className="mt-1 flex items-center gap-0.5 sm:gap-1">
              {onPrevious && (
                <ControlButton
                  label="Previous video"
                  onClick={onPrevious}
                  container={container}
                >
                  <SkipBack className="size-5 fill-current" />
                </ControlButton>
              )}

              <ControlButton
                label={playing ? "Pause (k)" : "Play (k)"}
                onClick={togglePlay}
                container={container}
                className="bg-white text-black hover:bg-white/85 hover:text-black dark:hover:bg-white/85"
              >
                {playing ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="size-5 translate-x-px fill-current" />
                )}
              </ControlButton>

              {onNext && (
                <ControlButton
                  label="Next video"
                  onClick={onNext}
                  container={container}
                >
                  <SkipForward className="size-5 fill-current" />
                </ControlButton>
              )}

              <ControlButton
                label="Back 10s (←)"
                onClick={() => {
                  seekBy(-SEEK_STEP)
                  flashSeek("back")
                }}
                container={container}
                className="hidden sm:inline-flex"
              >
                <RotateCcw className="size-5" />
              </ControlButton>
              <ControlButton
                label="Forward 10s (→)"
                onClick={() => {
                  seekBy(SEEK_STEP)
                  flashSeek("forward")
                }}
                container={container}
                className="hidden sm:inline-flex"
              >
                <RotateCw className="size-5" />
              </ControlButton>

              {/* Volume: slider expands on hover (md and up) */}
              <div className="group/vol flex items-center">
                <ControlButton
                  label={muted ? "Unmute (m)" : "Mute (m)"}
                  onClick={toggleMute}
                  container={container}
                >
                  <VolumeIcon className="size-5" />
                </ControlButton>
                <div className="hidden w-0 overflow-hidden transition-all duration-300 ease-out group-focus-within/vol:w-24 group-hover/vol:w-24 md:block">
                  <div className="w-24 px-2">
                    <Slider
                      aria-label="Volume"
                      value={[muted ? 0 : volume]}
                      max={1}
                      step={0.02}
                      onValueChange={([v]) => changeVolume(v)}
                      className="cursor-pointer [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-track]]:bg-white/25"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1" />

              {tracks.length > 0 && (
                <ControlButton
                  label={captionLang ? "Hide captions (c)" : "Show captions (c)"}
                  onClick={toggleCaptions}
                  active={Boolean(captionLang)}
                  container={container}
                >
                  {captionLang ? (
                    <Captions className="size-5" />
                  ) : (
                    <CaptionsOff className="size-5" />
                  )}
                </ControlButton>
              )}

              <ControlButton
                label="Settings"
                onClick={() => setSettingsOpen((open) => !open)}
                active={settingsOpen}
                container={container}
              >
                <Settings
                  className={cn(
                    "size-5 transition-transform duration-300",
                    settingsOpen && "rotate-45"
                  )}
                />
              </ControlButton>

              {pipSupported && (
                <ControlButton
                  label="Picture in picture"
                  onClick={() => void togglePip()}
                  container={container}
                  className="hidden sm:inline-flex"
                >
                  <PictureInPicture2 className="size-5" />
                </ControlButton>
              )}

              <ControlButton
                label={fullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
                onClick={() => void toggleFullscreen()}
                container={container}
              >
                {fullscreen ? (
                  <Minimize className="size-5" />
                ) : (
                  <Maximize className="size-5" />
                )}
              </ControlButton>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
