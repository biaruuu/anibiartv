"use client"

import * as React from "react"

import {
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChromecastIcon,
  ClosedCaptionsIcon,
  ClosedCaptionsOnIcon,
  DownloadIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  InfoIcon,
  MuteIcon,
  PauseIcon,
  PictureInPictureIcon,
  PlaybackSpeedCircleIcon,
  PlayIcon,
  RepeatIcon,
  RepeatOnIcon,
  SeekBackward10Icon,
  SeekForward10Icon,
  SettingsIcon,
  TimerIcon,
  VolumeHighIcon,
  VolumeLowIcon,
} from "@/components/icons/vidstack"
import { cn } from "@/lib/utils"
import { activeText, decodeText, parseCaptions, type Cue } from "@/lib/captions"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type VideoTrack = {
  /** Unique id. Defaults to srclang + src/label. */
  id?: string
  srclang: string
  label: string
  /** URL of an SRT, VTT or ASS file to fetch... */
  src?: string
  /** ...or already parsed cues (used for files the viewer adds). */
  cues?: Cue[]
}

export type VideoPlayerProps = {
  src: string
  poster?: string
  title?: string
  tracks?: VideoTrack[]
  autoPlay?: boolean
  className?: string
  onEnded?: () => void
}

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }
type CastVideo = HTMLVideoElement & {
  remote?: { prompt: () => Promise<void> }
}
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>
}
type MenuView = "main" | "captions" | "style" | "speed" | "sync"
type Notice = { text: string; tone: "default" | "error" }

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SEEK_STEP = 10
const AUTO_HIDE_MS = 3000

const CAPTION_SIZES = {
  sm: { label: "Small", scale: 0.85 },
  md: { label: "Medium", scale: 1 },
  lg: { label: "Large", scale: 1.3 },
} as const
const CAPTION_STYLES = {
  box: "Dark box",
  outline: "Outline",
} as const
type CaptionSize = keyof typeof CAPTION_SIZES
type CaptionStyle = keyof typeof CAPTION_STYLES
const CAPTION_PREFS_KEY = "videoplayer:caption-style"

const MENU_TITLES: Record<MenuView, string> = {
  main: "Settings",
  captions: "Captions",
  style: "Caption style",
  speed: "Speed",
  sync: "Subtitle delay",
}

// Everything is sized from the player's own width (container queries, `cqw`),
// so controls stay in proportion from a small phone to a fullscreen 4K screen.
const BAR_BUTTON = "size-[clamp(1.9rem,4.6cqw,3rem)]"
const BAR_ICON = "size-[clamp(1.6rem,4cqw,2.4rem)]"
const SHADOW = "drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
const TEXT_SHADOW = "[text-shadow:0_1px_2px_rgb(0_0_0/0.6)]"
const PILL_HEIGHT = "h-[clamp(1.9rem,4.6cqw,2.75rem)]"

// Frosted glass: translucent fill, background blur, a light edge and a soft
// highlight along the top. Flat colours only, no gradients.
const GLASS =
  "border border-white/20 bg-white/15 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3),0_6px_20px_rgb(0_0_0/0.25)] backdrop-blur-xl backdrop-saturate-150"
const GLASS_FROM_MD =
  "@md:border @md:border-white/20 @md:bg-white/15 @md:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3),0_6px_20px_rgb(0_0_0/0.25)] @md:backdrop-blur-xl @md:backdrop-saturate-150"
const GLASS_HOVER = "hover:bg-white/25 dark:hover:bg-white/25"

const trackId = (t: VideoTrack) => t.id ?? `${t.srclang}:${t.src ?? t.label}`

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ss = s.toString().padStart(2, "0")
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

function formatOffset(seconds: number) {
  return `${seconds > 0 ? "+" : seconds < 0 ? "-" : ""}${Math.abs(seconds).toFixed(1)}s`
}

function volumeIcon(volume: number, muted: boolean) {
  if (muted || volume === 0) return MuteIcon
  return volume < 0.5 ? VolumeLowIcon : VolumeHighIcon
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
  side = "bottom",
  shape,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
  container: HTMLElement | null
  side?: "top" | "bottom"
  /** Replaces the default round icon-button size. */
  shape?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={shape ? "default" : "icon"}
          aria-label={label}
          onClick={onClick}
          className={cn(
            shape ?? BAR_BUTTON,
            shape && "p-0",
            "rounded-full text-white hover:bg-white/15 hover:text-white active:scale-95 dark:hover:bg-white/15",
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
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
    >
      <span className="shrink-0 text-white/80 [&_svg]:size-6">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {value && <span className="max-w-[40%] truncate text-white/70">{value}</span>}
      {chevron && <ChevronRightIcon className="size-5 shrink-0 text-white/70" />}
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
      {selected && <CheckIcon className="size-5 shrink-0" />}
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
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsOpenRef = React.useRef(false)
  const cueCache = React.useRef(new Map<string, Cue[]>())
  const cuesRef = React.useRef<Cue[]>([])
  const offsetRef = React.useRef(0)

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
  const [cueVersion, setCueVersion] = React.useState(0)
  const [captionOffset, setCaptionOffset] = React.useState(0)
  const [captionSize, setCaptionSize] = React.useState<CaptionSize>("md")
  const [captionStyle, setCaptionStyle] = React.useState<CaptionStyle>("box")
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const [flash, setFlash] = React.useState<{
    dir: "back" | "forward"
    key: number
  } | null>(null)

  const trackKey = tracks.map(trackId).join("|")
  const firstId = tracks[0] ? trackId(tracks[0]) : null
  const [captionId, setCaptionId] = React.useState<string | null>(firstId)
  const activeTrack = tracks.find((t) => trackId(t) === captionId)

  /* ---------- small feedback ---------- */
  const showNotice = React.useCallback(
    (text: string, tone: Notice["tone"] = "default") => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
      setNotice({ text, tone })
      noticeTimer.current = setTimeout(() => setNotice(null), 2800)
    },
    []
  )

  const flashSeek = (dir: "back" | "forward") => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash({ dir, key: Date.now() })
    flashTimer.current = setTimeout(() => setFlash(null), 650)
  }

  /* ---------- helpers ---------- */
  const updateBuffered = (v: HTMLVideoElement) => {
    const ranges = v.buffered
    let end = 0
    for (let i = 0; i < ranges.length; i++) {
      if (
        ranges.start(i) <= v.currentTime + 0.5 &&
        ranges.end(i) >= v.currentTime
      ) {
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
    v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration || 0)
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

  const selectCaption = (id: string | null) => setCaptionId(id)
  const toggleCaptions = () => setCaptionId(captionId ? null : firstId)

  const adjustOffset = (delta: number | "reset") => {
    setCaptionOffset((current) =>
      delta === "reset"
        ? 0
        : Math.min(30, Math.max(-30, Math.round((current + delta) * 10) / 10))
    )
  }

  const saveCaptionPrefs = (size: CaptionSize, style: CaptionStyle) => {
    try {
      localStorage.setItem(CAPTION_PREFS_KEY, JSON.stringify({ size, style }))
    } catch {
      // Storage blocked; the choice still applies for this visit.
    }
  }

  const chooseCaptionSize = (size: CaptionSize) => {
    setCaptionSize(size)
    saveCaptionPrefs(size, captionStyle)
  }

  const chooseCaptionStyle = (style: CaptionStyle) => {
    setCaptionStyle(style)
    saveCaptionPrefs(captionSize, style)
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
          showNotice("Screenshot isn't available for this video", "error")
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
      showNotice("This video's host doesn't allow screenshots", "error")
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

  /* ---------- controls visibility ---------- */
  const revealControls = React.useCallback(() => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (
        videoRef.current &&
        !videoRef.current.paused &&
        !settingsOpenRef.current
      ) {
        setShowControls(false)
      }
    }, AUTO_HIDE_MS)
  }, [])

  const hideControls = React.useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShowControls(false)
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

  // Remember the viewer's caption style. Storage can be blocked, so it is optional.
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CAPTION_PREFS_KEY) ?? "null")
      if (saved?.size in CAPTION_SIZES) setCaptionSize(saved.size)
      if (saved?.style in CAPTION_STYLES) setCaptionStyle(saved.style)
    } catch {
      // Ignore: defaults are fine.
    }
  }, [])

  // The video can finish loading metadata before React hydrates, so catch up.
  React.useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (v.error) setError(true)
    if (v.readyState >= 1) {
      setDuration(v.duration)
      updateBuffered(v)
    }
  }, [src])

  // Controls are always visible while paused; while playing they auto-hide.
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
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    []
  )

  React.useEffect(() => {
    setPipSupported(Boolean(document.pictureInPictureEnabled))
    setCastSupported(Boolean((videoRef.current as CastVideo | null)?.remote))
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

  /* ---------- captions (own parser, own timing, rendered in Poppins) ---------- */
  // When the available tracks change (for example a subtitle was added),
  // switch to the first one.
  React.useEffect(() => {
    setCaptionId(firstId)
  }, [firstId])

  // Download and parse any caption file that is referenced by URL.
  React.useEffect(() => {
    const controller = new AbortController()
    for (const track of tracks) {
      const id = trackId(track)
      if (track.cues || !track.src || cueCache.current.has(id)) continue
      fetch(track.src, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status))
          return response.arrayBuffer()
        })
        .then((buffer) => {
          cueCache.current.set(id, parseCaptions(decodeText(buffer)).cues)
          setCueVersion((v) => v + 1)
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return
          showNotice(`Couldn't load ${track.label} captions`, "error")
        })
    }
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, showNotice])

  const activeCues = React.useMemo(() => {
    if (!activeTrack) return []
    return activeTrack.cues ?? cueCache.current.get(trackId(activeTrack)) ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionId, trackKey, cueVersion])

  const syncCue = React.useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const text = activeText(cuesRef.current, v.currentTime - offsetRef.current)
    setCueText((previous) => (previous === text ? previous : text))
  }, [])

  React.useEffect(() => {
    cuesRef.current = activeCues
    offsetRef.current = captionOffset
    syncCue()
  }, [activeCues, captionOffset, syncCue])

  // Check the cue on every frame while playing so captions are frame accurate.
  React.useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      syncCue()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, syncCue])

  /* ---------- gestures ---------- */
  // Tapping the picture only shows or hides the controls. It never pauses:
  // use the play/pause button (or Space / K) for that.
  const onVideoClick = () => {
    if (settingsOpen) {
      closeSettings()
      return
    }
    if (!playing) return // controls stay visible while paused
    if (showControls) hideControls()
    else revealControls()
  }

  // Double tap: left third rewinds, right third skips, middle toggles fullscreen.
  const onVideoDoubleClick = (e: React.MouseEvent<HTMLVideoElement>) => {
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

  const VolumeIcon = volumeIcon(volume, muted)
  const controlsHidden = !showControls && playing
  const interactive = controlsHidden ? "pointer-events-none" : "pointer-events-auto"
  const bufferedPct = duration ? Math.min(100, (buffered / duration) * 100) : 0
  const buffering = loading && playing && !error

  return (
    <TooltipProvider delayDuration={250}>
      <div
        ref={setContainer}
        tabIndex={0}
        role="region"
        aria-label={title ? `Video player: ${title}` : "Video player"}
        onKeyDown={onKeyDown}
        // Only a real mouse reveals controls on hover. Touch screens send
        // emulated mouse events after a tap, which would instantly undo it.
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") revealControls()
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && playing && !settingsOpen) {
            hideControls()
          }
        }}
        className={cn(
          "@container group relative aspect-video w-full touch-manipulation overflow-hidden rounded-xl border bg-black shadow-sm outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&:fullscreen]:aspect-auto [&:fullscreen]:rounded-none [&:fullscreen]:border-0",
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
          onLoadStart={() => {
            setCurrentTime(0)
            setDuration(0)
            setBuffered(0)
            setError(false)
            setLoading(true)
          }}
          onEmptied={() => setPlaying(false)}
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
            const v = e.currentTarget
            setDuration(v.duration)
            // A new source resets the rate, so re-apply the chosen speed.
            v.playbackRate = speed
            updateBuffered(v)
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onProgress={(e) => updateBuffered(e.currentTarget)}
          onSeeked={syncCue}
          onTimeUpdate={(e) => {
            if (!scrubbing) setCurrentTime(e.currentTarget.currentTime)
            updateBuffered(e.currentTarget)
          }}
        />

        {/* Flat dim layer while controls are visible */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-black/20 transition-opacity duration-300",
            controlsHidden ? "opacity-0" : "opacity-100"
          )}
        />

        {/* Captions: Poppins, sized from the player width, with a readable style */}
        {cueText && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-[5] flex justify-center px-[4cqw] transition-all duration-300 ease-out",
              controlsHidden
                ? "bottom-[clamp(0.75rem,3.5cqw,2.5rem)]"
                : "bottom-[clamp(5.5rem,14cqw,8.5rem)]"
            )}
          >
            <p
              style={{
                fontSize: `calc(clamp(0.9rem, 2.8cqw, 2.75rem) * ${CAPTION_SIZES[captionSize].scale})`,
              }}
              className="max-w-full text-center font-poppins leading-[1.55] font-semibold whitespace-pre-line text-white"
            >
              <span
                className={
                  captionStyle === "box"
                    ? "rounded-[0.3em] bg-black/80 px-[0.55em] py-[0.1em] box-decoration-clone"
                    : "caption-outline"
                }
              >
                {cueText}
              </span>
            </p>
          </div>
        )}

        {/* Double-tap / arrow-key seek feedback */}
        {flash && (
          <div
            key={flash.key}
            className={cn(
              "pointer-events-none absolute top-1/2 z-[5] -translate-y-1/2",
              flash.dir === "back" ? "left-[12%]" : "right-[12%]"
            )}
          >
            <div className="flex size-[clamp(3rem,10cqw,5rem)] animate-in items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md duration-200 fade-in-0 zoom-in-90">
              {flash.dir === "back" ? (
                <SeekBackward10Icon className="size-full" />
              ) : (
                <SeekForward10Icon className="size-full" />
              )}
            </div>
          </div>
        )}

        {/* Buffering while controls are hidden */}
        {buffering && controlsHidden && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Spinner className="size-[clamp(2rem,6cqw,3.5rem)] text-white drop-shadow" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black p-4 text-center">
            <div className="flex max-w-sm flex-col items-center gap-2 font-poppins text-white">
              <InfoIcon className="size-10 text-white/70" />
              <p className="text-sm font-semibold">
                This video couldn&apos;t be played
              </p>
              <p className="text-xs text-white/60">
                Check the link, or try another file. MP4 (H.264) and WebM play
                in every browser; some formats like MKV or AVI don&apos;t.
              </p>
            </div>
          </div>
        )}

        {/* Notice (screenshot, download, caption errors) */}
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute top-[clamp(3.5rem,9.5cqw,5rem)] left-1/2 z-30 max-w-[90%] -translate-x-1/2 animate-in rounded-full px-4 py-2 text-center font-poppins text-xs font-medium text-white duration-200 fade-in-0 slide-in-from-top-2",
              notice.tone === "error" ? "bg-red-600" : "bg-black/85"
            )}
          >
            {notice.text}
          </div>
        )}

        {/* Top bar: volume + cast on the left, tools on the right */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-[clamp(0.5rem,2.2cqw,1.25rem)] transition-all duration-300 ease-out",
            controlsHidden && "-translate-y-2 opacity-0"
          )}
        >
          <div
            className={cn(
              "flex items-center rounded-full p-[clamp(0.125rem,0.5cqw,0.25rem)]",
              GLASS,
              interactive
            )}
          >
            <div className="group/vol flex items-center">
              <ControlButton
                label={muted ? "Unmute (m)" : "Mute (m)"}
                onClick={toggleMute}
                container={container}
              >
                <VolumeIcon className={cn(BAR_ICON, SHADOW)} />
              </ControlButton>
              <div className="hidden w-0 overflow-hidden transition-all duration-300 ease-out group-focus-within/vol:w-24 group-hover/vol:w-24 @lg:block">
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
                <ChromecastIcon className={cn(BAR_ICON, SHADOW)} />
              </ControlButton>
            )}
          </div>

          <div
            className={cn(
              "flex items-center rounded-full p-[clamp(0.125rem,0.5cqw,0.25rem)]",
              GLASS,
              interactive
            )}
          >
            <ControlButton
              label="Screenshot"
              onClick={takeScreenshot}
              container={container}
            >
              <CameraIcon className={cn(BAR_ICON, SHADOW)} />
            </ControlButton>
            <ControlButton
              label="Download"
              onClick={downloadVideo}
              container={container}
            >
              <DownloadIcon className={cn(BAR_ICON, SHADOW)} />
            </ControlButton>
            {tracks.length > 0 && (
              <ControlButton
                label={captionId ? "Hide captions (c)" : "Show captions (c)"}
                onClick={toggleCaptions}
                container={container}
              >
                {captionId ? (
                  <ClosedCaptionsOnIcon className={cn(BAR_ICON, SHADOW)} />
                ) : (
                  <ClosedCaptionsIcon className={cn(BAR_ICON, SHADOW)} />
                )}
              </ControlButton>
            )}
            <ControlButton
              label="Settings"
              onClick={toggleSettings}
              container={container}
            >
              <SettingsIcon
                className={cn(
                  BAR_ICON,
                  SHADOW,
                  "transition-transform duration-300",
                  settingsOpen && "rotate-45"
                )}
              />
            </ControlButton>
          </div>
        </div>

        {/* Centre: play/pause, with the 10 second buttons well to either side (Netflix style) */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 transition-opacity duration-300",
            controlsHidden || error ? "opacity-0" : "opacity-100"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back 10 seconds"
            onClick={() => seekBy(-SEEK_STEP)}
            className={cn(
              "absolute top-1/2 left-[25%] size-[clamp(2.6rem,7cqw,4.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-full text-white hover:text-white active:scale-95",
              GLASS,
              GLASS_HOVER,
              interactive
            )}
          >
            <SeekBackward10Icon className={cn("size-[78%]", SHADOW)} />
          </Button>

          <button
            type="button"
            aria-label={playing ? "Pause video" : "Play video"}
            onClick={togglePlay}
            className={cn(
              "absolute top-1/2 left-1/2 grid size-[clamp(3.1rem,7.5cqw,5rem)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-white/40 active:scale-95",
              GLASS,
              GLASS_HOVER,
              interactive
            )}
          >
            {buffering ? (
              <Spinner className="size-1/2" />
            ) : playing ? (
              <PauseIcon className="size-[80%]" />
            ) : (
              <PlayIcon className="size-[80%]" />
            )}
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Forward 10 seconds"
            onClick={() => seekBy(SEEK_STEP)}
            className={cn(
              "absolute top-1/2 left-[75%] size-[clamp(2.6rem,7cqw,4.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-full text-white hover:text-white active:scale-95",
              GLASS,
              GLASS_HOVER,
              interactive
            )}
          >
            <SeekForward10Icon className={cn("size-[78%]", SHADOW)} />
          </Button>
        </div>

        {/* Bottom: time pill + glass fullscreen button above a thin progress bar */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 px-[clamp(0.75rem,3.5cqw,3rem)] pb-[clamp(1rem,3.2cqw,2.25rem)] transition-all duration-300 ease-out",
            controlsHidden && "translate-y-2 opacity-0"
          )}
        >
          <div className="mb-[clamp(0.25rem,1cqw,0.75rem)] flex items-end justify-between gap-3">
            <span
              className={cn(
                "inline-flex min-w-0 items-center rounded-full font-poppins text-[length:clamp(0.75rem,1.8cqw,1rem)] font-medium text-white tabular-nums @md:px-[clamp(0.75rem,2.4cqw,1.5rem)]",
                PILL_HEIGHT,
                TEXT_SHADOW,
                GLASS_FROM_MD
              )}
            >
              <span className="truncate">
                {formatTime(currentTime)}
                <span className="text-white/75"> / {formatTime(duration)}</span>
                {title && (
                  <span className="hidden text-white/75 @md:inline"> • {title}</span>
                )}
              </span>
            </span>
            <div className={cn("shrink-0", interactive)}>
              <ControlButton
                label={fullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
                onClick={() => void toggleFullscreen()}
                container={container}
                side="top"
                shape={cn(PILL_HEIGHT, "w-[clamp(2.5rem,6.2cqw,3.75rem)]")}
                className={cn(
                  "rounded-[clamp(0.9rem,2.4cqw,1.4rem)]",
                  GLASS,
                  GLASS_HOVER
                )}
              >
                {fullscreen ? (
                  <FullscreenExitIcon className={cn(BAR_ICON, SHADOW)} />
                ) : (
                  <FullscreenIcon className={cn(BAR_ICON, SHADOW)} />
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
          <div className="absolute top-[clamp(3.25rem,9cqw,5rem)] right-[clamp(0.5rem,2.2cqw,1.25rem)] z-30 max-h-[calc(100%-3.5rem)] w-[min(20rem,calc(100%-0.5rem))] origin-top-right animate-in overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-1.5 font-poppins text-white shadow-2xl backdrop-blur-2xl backdrop-saturate-150 duration-150 fade-in-0 zoom-in-95">
            {menuView === "main" && (
              <>
                {tracks.length > 0 && (
                  <MenuRow
                    icon={<ClosedCaptionsIcon />}
                    label="Captions"
                    value={activeTrack?.label ?? "Off"}
                    onClick={() => setMenuView("captions")}
                  />
                )}
                {captionId && (
                  <MenuRow
                    icon={<TimerIcon />}
                    label="Subtitle delay"
                    value={formatOffset(captionOffset)}
                    onClick={() => setMenuView("sync")}
                  />
                )}
                {tracks.length > 0 && (
                  <MenuRow
                    icon={<ClosedCaptionsOnIcon />}
                    label="Caption style"
                    value={CAPTION_SIZES[captionSize].label}
                    onClick={() => setMenuView("style")}
                  />
                )}
                <MenuRow
                  icon={<PlaybackSpeedCircleIcon />}
                  label="Speed"
                  value={speed === 1 ? "Normal" : `${speed}x`}
                  onClick={() => setMenuView("speed")}
                />
                <MenuRow
                  icon={loop ? <RepeatOnIcon /> : <RepeatIcon />}
                  label="Loop"
                  value={loop ? "On" : "Off"}
                  chevron={false}
                  onClick={() => setLoop((l) => !l)}
                />
                {pipSupported && (
                  <MenuRow
                    icon={<PictureInPictureIcon />}
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
                  className="mb-1 flex w-full items-center gap-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
                >
                  <ChevronLeftIcon className="size-5" />
                  {MENU_TITLES[menuView]}
                </button>
                <div className="mx-2 mb-1 h-px bg-white/10" />
              </>
            )}

            {menuView === "captions" && (
              <>
                <OptionRow
                  label="Off"
                  selected={captionId === null}
                  onClick={() => selectCaption(null)}
                />
                {tracks.map((t) => (
                  <OptionRow
                    key={trackId(t)}
                    label={t.label}
                    selected={captionId === trackId(t)}
                    onClick={() => selectCaption(trackId(t))}
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

            {menuView === "style" && (
              <>
                <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wider text-white/50 uppercase">
                  Size
                </p>
                {(Object.keys(CAPTION_SIZES) as CaptionSize[]).map((key) => (
                  <OptionRow
                    key={key}
                    label={CAPTION_SIZES[key].label}
                    selected={captionSize === key}
                    onClick={() => chooseCaptionSize(key)}
                  />
                ))}
                <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-white/50 uppercase">
                  Background
                </p>
                {(Object.keys(CAPTION_STYLES) as CaptionStyle[]).map((key) => (
                  <OptionRow
                    key={key}
                    label={CAPTION_STYLES[key]}
                    selected={captionStyle === key}
                    onClick={() => chooseCaptionStyle(key)}
                  />
                ))}
              </>
            )}

            {menuView === "sync" && (
              <div className="space-y-3 p-2">
                <p className="text-center text-2xl font-semibold tabular-nums">
                  {formatOffset(captionOffset)}
                </p>
                <p className="text-center text-xs text-white/60">
                  Positive delays subtitles. Negative shows them earlier.
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[-0.5, -0.1, 0.1, 0.5].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => adjustOffset(step)}
                      className="rounded-md bg-white/10 py-2 text-xs font-medium tabular-nums transition-colors hover:bg-white/20"
                    >
                      {step > 0 ? "+" : "-"}
                      {Math.abs(step)}s
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => adjustOffset("reset")}
                  className="w-full rounded-md bg-white py-2 text-xs font-semibold text-black transition-colors hover:bg-white/85"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
