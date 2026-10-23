"use client"

import * as React from "react"
import {
  AlertCircle,
  Camera,
  Cast,
  Captions,
  CaptionsOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
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
type CastVideo = HTMLVideoElement & {
  remote?: { prompt: () => Promise<void> }
}
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>
}
type MenuView = "main" | "captions" | "speed"

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SEEK_STEP = 10
const ICON = "size-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ss = s.toString().padStart(2, "0")
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

/** Rotate the device to landscape (or portrait for tall videos) while fullscreen. */
async function lockOrientation(video: HTMLVideoElement | null) {
  const orientation = screen.orientation as LockableOrientation | undefined
  if (!orientation?.lock) return
  const portrait = video ? video.videoHeight > video.videoWidth : false
  try {
    await orientation.lock(portrait ? "portrait" : "landscape")
  } catch {
    // Not supported here (desktop, iOS) or refused. Fullscreen still works.
  }
}

function unlockOrientation() {
  try {
    screen.orientation?.unlock?.()
  } catch {
    // Nothing to unlock.
  }
}

function ControlButton({
  label,
  onClick,
  children,
  className,
  container,
  disabled,
  side = "bottom",
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
  container: HTMLElement | null
  disabled?: boolean
  side?: "top" | "bottom"
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "size-10 rounded-full text-white hover:bg-white/15 hover:text-white active:scale-95 sm:size-11 dark:hover:bg-white/15",
            className
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        container={container}
        className="border border-white/10 bg-black/85 font-poppins text-white"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function MenuRow({
  icon,
  label,
  value,
  onClick,
  chevron = true,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onClick: () => void
  chevron?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-white/10"
    >
      <span className="shrink-0 text-white/80 [&_svg]:size-5">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {value && <span className="truncate text-white/70">{value}</span>}
      {chevron && <ChevronRight className="size-4 shrink-0 text-white/70" />}
    </button>
  )
}

function OptionRow({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="size-4 shrink-0" />}
    </button>
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
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsOpenRef = React.useRef(false)
  const pointerType = React.useRef("mouse")

  // The player element itself. Kept in state so tooltips can portal into it
  // (required for them to stay visible in fullscreen).
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null)

  const [playing, setPlaying] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [buffered, setBuffered] = React.useState(0)
  const [volume, setVolume] = React.useState(1)
  const [muted, setMuted] = React.useState(false)
  const [speed, setSpeed] = React.useState(1)
  const [loop, setLoop] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [showControls, setShowControls] = React.useState(true)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [menuView, setMenuView] = React.useState<MenuView>("main")
  const [pipSupported, setPipSupported] = React.useState(false)
  const [castSupported, setCastSupported] = React.useState(false)
  const [scrubbing, setScrubbing] = React.useState(false)
  const [cueText, setCueText] = React.useState("")
  const [notice, setNotice] = React.useState<string | null>(null)
  const [flash, setFlash] = React.useState<{
    dir: "back" | "forward"
    key: number
  } | null>(null)

  const firstLang = tracks[0]?.srclang ?? null
  const trackKey = tracks.map((t) => `${t.srclang}:${t.src}`).join("|")
  const [captionLang, setCaptionLang] = React.useState<string | null>(
    firstLang
  )

  /* ---------- helpers ---------- */
  const showNotice = React.useCallback((text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(text)
    noticeTimer.current = setTimeout(() => setNotice(null), 2600)
  }, [])

  const updateBuffered = (v: HTMLVideoElement) => {
    const ranges = v.buffered
    let end = 0
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= v.currentTime + 0.5 && ranges.end(i) >= v.currentTime) {
        end = ranges.end(i)
        break
      }
    }
    setBuffered(end)
  }

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
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        unlockOrientation()
      } else if (document.fullscreenEnabled) {
        await container.requestFullscreen()
        // Rotate to landscape automatically (Android and other supporting browsers).
        await lockOrientation(videoRef.current)
      } else {
        // iPhone Safari: the native player handles rotation itself.
        ;(videoRef.current as WebkitVideo | null)?.webkitEnterFullscreen?.()
      }
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

  const castVideo = async () => {
    try {
      await (videoRef.current as CastVideo | null)?.remote?.prompt()
    } catch {
      // Cancelled or no device available.
    }
  }

  const takeScreenshot = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    try {
      const canvas = document.createElement("canvas")
      canvas.width = v.videoWidth
      canvas.height = v.videoHeight
      canvas.getContext("2d")?.drawImage(v, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) {
          showNotice("Screenshot isn't available for this video")
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${title ?? "video"}-${formatTime(v.currentTime).replace(/:/g, "-")}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        showNotice("Screenshot saved")
      }, "image/png")
    } catch {
      // Cross-origin videos without CORS headers can't be captured.
      showNotice("This video's host doesn't allow screenshots")
    }
  }

  const downloadVideo = () => {
    const a = document.createElement("a")
    a.href = src
    a.download = title ?? "video"
    a.target = "_blank"
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
    let external = false
    try {
      external =
        !src.startsWith("blob:") &&
        new URL(src, window.location.href).origin !== window.location.origin
    } catch {
      external = true
    }
    showNotice(
      external
        ? "Opened in a new tab. Use your browser's save option."
        : "Download started"
    )
  }

  const flashSeek = (dir: "back" | "forward") => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash({ dir, key: Date.now() })
    flashTimer.current = setTimeout(() => setFlash(null), 650)
  }

  /* ---------- settings menu ---------- */
  const revealControls = React.useCallback(() => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !settingsOpenRef.current) {
        setShowControls(false)
      }
    }, 2800)
  }, [])

  const closeSettings = () => {
    setSettingsOpen(false)
    setMenuView("main")
    revealControls()
  }

  const toggleSettings = () => {
    if (settingsOpen) {
      closeSettings()
    } else {
      setMenuView("main")
      setSettingsOpen(true)
    }
  }

  /* ---------- effects ---------- */
  React.useEffect(() => {
    settingsOpenRef.current = settingsOpen
  }, [settingsOpen])

  // Reset per-video state when the source changes (the element is reused so
  // fullscreen survives moving to the next video).
  React.useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setBuffered(0)
    setError(false)
    setPlaying(false)
    setCueText("")
  }, [src])

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
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    []
  )

  React.useEffect(() => {
    setPipSupported(Boolean(document.pictureInPictureEnabled))
    setCastSupported(
      Boolean((videoRef.current as CastVideo | null)?.remote)
    )
    const onChange = () => {
      const active = Boolean(document.fullscreenElement)
      setFullscreen(active)
      // Leaving fullscreen (button, Esc or back gesture) frees the rotation lock.
      if (!active) unlockOrientation()
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      unlockOrientation()
    }
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
      closeSettings()
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
      case "escape":
        if (settingsOpen) {
          e.preventDefault()
          closeSettings()
        }
        break
      default:
        return
    }
    revealControls()
  }

  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const controlsHidden = !showControls && playing
  const interactive = controlsHidden ? "pointer-events-none" : "pointer-events-auto"
  const bufferedPct = duration ? Math.min(100, (buffered / duration) * 100) : 0
  const activeCaption = tracks.find((t) => t.srclang === captionLang)
  const buffering = loading && playing && !error

  return (
    <TooltipProvider delayDuration={250}>
      <div
        ref={setContainer}
        tabIndex={0}
        role="region"
        aria-label={title ? `Video player: ${title}` : "Video player"}
        onKeyDown={onKeyDown}
        onMouseMove={revealControls}
        onMouseLeave={() => playing && !settingsOpen && setShowControls(false)}
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
          loop={loop}
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
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration)
            // A new source resets the rate, so re-apply the chosen speed.
            e.currentTarget.playbackRate = speed
            updateBuffered(e.currentTarget)
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onProgress={(e) => updateBuffered(e.currentTarget)}
          onTimeUpdate={(e) => {
            if (!scrubbing) setCurrentTime(e.currentTarget.currentTime)
            updateBuffered(e.currentTarget)
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

        {/* Flat dim layer while controls are visible */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-black/35 transition-opacity duration-300",
            controlsHidden ? "opacity-0" : "opacity-100"
          )}
        />

        {/* Captions overlay: Poppins */}
        {cueText && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 flex justify-center px-4 transition-all duration-300 ease-out",
              controlsHidden ? "bottom-4 sm:bottom-8" : "bottom-16 sm:bottom-20"
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

        {/* Buffering while controls are hidden */}
        {buffering && controlsHidden && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2 className="size-12 animate-spin text-white drop-shadow" />
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

        {/* Notice (screenshot, download) */}
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-16 left-1/2 z-30 max-w-[90%] -translate-x-1/2 animate-in rounded-full bg-black/80 px-4 py-2 text-center font-poppins text-xs font-medium text-white duration-200 fade-in-0 slide-in-from-top-2 sm:text-sm"
          >
            {notice}
          </div>
        )}

        {/* Top bar: volume + cast on the left, tools on the right */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2 transition-all duration-300 ease-out sm:p-4",
            controlsHidden && "-translate-y-2 opacity-0"
          )}
        >
          <div className={cn("flex items-center gap-1", interactive)}>
            <div className="group/vol flex items-center">
              <ControlButton
                label={muted ? "Unmute (m)" : "Mute (m)"}
                onClick={toggleMute}
                container={container}
              >
                <VolumeIcon className={ICON} />
              </ControlButton>
              <div className="hidden w-0 overflow-hidden transition-all duration-300 ease-out group-focus-within/vol:w-24 group-hover/vol:w-24 md:block">
                <div className="w-24 px-2">
                  <Slider
                    aria-label="Volume"
                    value={[muted ? 0 : volume]}
                    max={1}
                    step={0.02}
                    onValueChange={([v]) => changeVolume(v)}
                    className="cursor-pointer [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-track]]:bg-white/30"
                  />
                </div>
              </div>
            </div>

            {castSupported && (
              <ControlButton
                label="Cast"
                onClick={() => void castVideo()}
                container={container}
              >
                <Cast className={ICON} />
              </ControlButton>
            )}
          </div>

          <div className={cn("flex items-center gap-1", interactive)}>
            <ControlButton
              label="Screenshot"
              onClick={takeScreenshot}
              container={container}
            >
              <Camera className={ICON} />
            </ControlButton>
            <ControlButton
              label="Download"
              onClick={downloadVideo}
              container={container}
            >
              <Download className={ICON} />
            </ControlButton>
            {tracks.length > 0 && (
              <ControlButton
                label={captionLang ? "Hide captions (c)" : "Show captions (c)"}
                onClick={toggleCaptions}
                container={container}
              >
                {captionLang ? (
                  <Captions className={ICON} />
                ) : (
                  <CaptionsOff className={ICON} />
                )}
              </ControlButton>
            )}
            <ControlButton
              label="Settings"
              onClick={toggleSettings}
              container={container}
            >
              <Settings
                className={cn(
                  ICON,
                  "transition-transform duration-300",
                  settingsOpen && "rotate-45"
                )}
              />
            </ControlButton>
          </div>
        </div>

        {/* Centre: previous, play/pause, next */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-5 transition-opacity duration-300 sm:gap-10",
            controlsHidden || error ? "opacity-0" : "opacity-100"
          )}
        >
          {onPrevious && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous video"
              onClick={onPrevious}
              className={cn(
                "size-11 rounded-full text-white hover:bg-white/15 hover:text-white active:scale-95 sm:size-12 dark:hover:bg-white/15",
                interactive
              )}
            >
              <SkipBack className="size-6 fill-current drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
            </Button>
          )}

          <button
            type="button"
            aria-label={playing ? "Pause video" : "Play video"}
            onClick={togglePlay}
            className={cn(
              "grid size-16 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-200 outline-none hover:scale-105 hover:bg-black/70 focus-visible:ring-4 focus-visible:ring-white/40 active:scale-95 sm:size-20",
              interactive
            )}
          >
            {buffering ? (
              <Loader2 className="size-8 animate-spin sm:size-10" />
            ) : playing ? (
              <Pause className="size-8 fill-current sm:size-10" />
            ) : (
              <Play className="size-8 translate-x-0.5 fill-current sm:size-10" />
            )}
          </button>

          {onNext && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next video"
              onClick={onNext}
              className={cn(
                "size-11 rounded-full text-white hover:bg-white/15 hover:text-white active:scale-95 sm:size-12 dark:hover:bg-white/15",
                interactive
              )}
            >
              <SkipForward className="size-6 fill-current drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
            </Button>
          )}
        </div>

        {/* Bottom: time + fullscreen above a thin progress bar */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-2.5 transition-all duration-300 ease-out sm:px-5 sm:pb-4",
            controlsHidden && "translate-y-2 opacity-0"
          )}
        >
          <div className="flex items-end justify-between">
            <span className="pb-1 font-poppins text-sm font-medium text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] sm:text-base">
              {formatTime(currentTime)}
              <span className="text-white/75"> / {formatTime(duration)}</span>
            </span>
            <div className={interactive}>
              <ControlButton
                label={fullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
                onClick={() => void toggleFullscreen()}
                container={container}
                side="top"
                className="-mr-2 -mb-1"
              >
                {fullscreen ? (
                  <Minimize className={ICON} />
                ) : (
                  <Maximize className={ICON} />
                )}
              </ControlButton>
            </div>
          </div>

          <div
            className={cn(
              "group/seek relative flex h-5 items-center",
              interactive
            )}
          >
            <div className="absolute inset-x-0 h-1 rounded-full bg-white/30 transition-all group-hover/seek:h-1.5" />
            <div
              className="absolute left-0 h-1 rounded-full bg-white/50 transition-all group-hover/seek:h-1.5"
              style={{ width: `${bufferedPct}%` }}
            />
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
              className={cn(
                "h-5 cursor-pointer [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:opacity-0 [&_[data-slot=slider-thumb]:focus-visible]:opacity-100 group-hover/seek:[&_[data-slot=slider-thumb]]:opacity-100 [&_[data-slot=slider-track]]:h-1! [&_[data-slot=slider-track]]:bg-transparent group-hover/seek:[&_[data-slot=slider-track]]:h-1.5!",
                scrubbing && "[&_[data-slot=slider-thumb]]:opacity-100"
              )}
            />
          </div>
        </div>

        {/* Settings menu */}
        {settingsOpen && (
          <div className="absolute top-14 right-2 z-30 max-h-[calc(100%-4.5rem)] w-[min(20rem,calc(100%-1rem))] origin-top-right animate-in overflow-y-auto rounded-xl border border-white/10 bg-black/85 p-1.5 font-poppins text-white shadow-2xl backdrop-blur-xl duration-150 fade-in-0 zoom-in-95 sm:top-[4.5rem] sm:right-4">
            {menuView === "main" && (
              <>
                {tracks.length > 0 && (
                  <MenuRow
                    icon={<Captions />}
                    label="Captions"
                    value={activeCaption?.label ?? "Off"}
                    onClick={() => setMenuView("captions")}
                  />
                )}
                <MenuRow
                  icon={<Gauge />}
                  label="Speed"
                  value={speed === 1 ? "Normal" : `${speed}x`}
                  onClick={() => setMenuView("speed")}
                />
                <MenuRow
                  icon={<Repeat />}
                  label="Loop"
                  value={loop ? "On" : "Off"}
                  chevron={false}
                  onClick={() => setLoop((l) => !l)}
                />
                {pipSupported && (
                  <MenuRow
                    icon={<PictureInPicture2 />}
                    label="Picture in picture"
                    chevron={false}
                    onClick={() => {
                      closeSettings()
                      void togglePip()
                    }}
                  />
                )}
              </>
            )}

            {menuView !== "main" && (
              <>
                <button
                  type="button"
                  onClick={() => setMenuView("main")}
                  className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
                >
                  <ChevronLeft className="size-4" />
                  {menuView === "captions" ? "Captions" : "Speed"}
                </button>
                <div className="mx-2 mb-1 h-px bg-white/10" />
              </>
            )}

            {menuView === "captions" && (
              <>
                <OptionRow
                  label="Off"
                  selected={captionLang === null}
                  onClick={() => setCaptionLang(null)}
                />
                {tracks.map((t) => (
                  <OptionRow
                    key={`${t.srclang}:${t.src}`}
                    label={t.label}
                    selected={captionLang === t.srclang}
                    onClick={() => setCaptionLang(t.srclang)}
                  />
                ))}
              </>
            )}

            {menuView === "speed" &&
              SPEEDS.map((s) => (
                <OptionRow
                  key={s}
                  label={s === 1 ? "Normal" : `${s}x`}
                  selected={speed === s}
                  onClick={() => changeSpeed(s)}
                />
              ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
