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
  NextIcon,
  PauseIcon,
  PictureInPictureIcon,
  PlaybackSpeedCircleIcon,
  PlayIcon,
  PreviousIcon,
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
import {
  DynamicIsland,
  Equalizer,
  type IslandMessage,
} from "@/components/ui/dynamic-island"
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
type MenuView = "main" | "captions" | "speed" | "sync"
type IslandInput = Omit<IslandMessage, "key">

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SEEK_STEP = 10
const ICON = "size-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"

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
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
  container: HTMLElement | null
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
  onNext,
  onPrevious,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const islandTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsOpenRef = React.useRef(false)
  const pointerType = React.useRef("mouse")
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
  const [island, setIsland] = React.useState<IslandMessage | null>(null)

  const trackKey = tracks.map(trackId).join("|")
  const firstId = tracks[0] ? trackId(tracks[0]) : null
  const [captionId, setCaptionId] = React.useState<string | null>(firstId)
  const activeTrack = tracks.find((t) => trackId(t) === captionId)

  /* ---------- Dynamic Island ---------- */
  const pushIsland = React.useCallback((message: IslandInput, ms = 2000) => {
    if (islandTimer.current) clearTimeout(islandTimer.current)
    setIsland({ ...message, key: Date.now() })
    islandTimer.current = setTimeout(() => setIsland(null), ms)
  }, [])

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
    if (v.paused) {
      void v.play().catch(() => undefined)
      pushIsland({
        icon: <PlayIcon className="size-6" />,
        title: "Playing",
        subtitle: title,
      })
    } else {
      v.pause()
      pushIsland({
        icon: <PauseIcon className="size-6" />,
        title: "Paused",
        subtitle: title,
      })
    }
  }, [pushIsland, title])

  const seekBy = React.useCallback(
    (delta: number) => {
      const v = videoRef.current
      if (!v) return
      const next = Math.min(Math.max(v.currentTime + delta, 0), v.duration || 0)
      v.currentTime = next
      pushIsland(
        {
          icon:
            delta < 0 ? (
              <SeekBackward10Icon className="size-6" />
            ) : (
              <SeekForward10Icon className="size-6" />
            ),
          title: delta < 0 ? "Back 10 seconds" : "Forward 10 seconds",
          value: formatTime(next),
          progress: v.duration ? next / v.duration : 0,
        },
        1400
      )
    },
    [pushIsland]
  )

  const toggleMute = React.useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    const Icon = volumeIcon(v.volume, v.muted)
    pushIsland(
      {
        icon: <Icon className="size-6" />,
        title: v.muted ? "Muted" : "Sound on",
        progress: v.muted ? 0 : v.volume,
        value: v.muted ? undefined : `${Math.round(v.volume * 100)}%`,
      },
      1400
    )
  }, [pushIsland])

  const changeVolume = React.useCallback(
    (value: number) => {
      const v = videoRef.current
      if (!v) return
      v.volume = value
      v.muted = value === 0
      setVolume(value)
      setMuted(value === 0)
      const Icon = volumeIcon(value, value === 0)
      pushIsland(
        {
          icon: <Icon className="size-6" />,
          title: value === 0 ? "Muted" : "Volume",
          progress: value,
          value: `${Math.round(value * 100)}%`,
        },
        1400
      )
    },
    [pushIsland]
  )

  const changeSpeed = (value: number) => {
    if (videoRef.current) videoRef.current.playbackRate = value
    setSpeed(value)
    pushIsland({
      icon: <PlaybackSpeedCircleIcon className="size-6" />,
      title: "Playback speed",
      value: value === 1 ? "Normal" : `${value}x`,
    })
  }

  const toggleLoop = () => {
    const next = !loop
    setLoop(next)
    pushIsland({
      icon: next ? (
        <RepeatOnIcon className="size-6" />
      ) : (
        <RepeatIcon className="size-6" />
      ),
      title: next ? "Loop on" : "Loop off",
    })
  }

  const selectCaption = (id: string | null) => {
    setCaptionId(id)
    const track = tracks.find((t) => trackId(t) === id)
    pushIsland({
      icon: id ? (
        <ClosedCaptionsOnIcon className="size-6" />
      ) : (
        <ClosedCaptionsIcon className="size-6" />
      ),
      title: "Captions",
      value: track?.label ?? "Off",
    })
  }

  const toggleCaptions = () => selectCaption(captionId ? null : firstId)

  const adjustOffset = (delta: number | "reset") => {
    const next =
      delta === "reset"
        ? 0
        : Math.min(30, Math.max(-30, Math.round((captionOffset + delta) * 10) / 10))
    setCaptionOffset(next)
    pushIsland(
      {
        icon: <TimerIcon className="size-6" />,
        title: "Subtitle delay",
        value: formatOffset(next),
      },
      1400
    )
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
          pushIsland({
            icon: <InfoIcon className="size-6" />,
            title: "Screenshot unavailable",
            tone: "error",
          })
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
        pushIsland({
          icon: <CameraIcon className="size-6" />,
          title: "Screenshot saved",
          subtitle: formatTime(v.currentTime),
        })
      }, "image/png")
    } catch {
      // Cross-origin videos without CORS headers can't be captured.
      pushIsland({
        icon: <InfoIcon className="size-6" />,
        title: "Screenshot blocked",
        subtitle: "This video's host doesn't allow it",
        tone: "error",
      })
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
    pushIsland({
      icon: <DownloadIcon className="size-6" />,
      title: external ? "Opened in a new tab" : "Download started",
      subtitle: external ? "Use your browser's save option" : title,
    })
  }

  /* ---------- controls ---------- */
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
      if (islandTimer.current) clearTimeout(islandTimer.current)
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
  // When the available tracks change (for example a subtitle file was added),
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
          pushIsland({
            icon: <InfoIcon className="size-6" />,
            title: "Couldn't load captions",
            subtitle: track.label,
            tone: "error",
          })
        })
    }
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, pushIsland])

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
    const loopFrame = () => {
      syncCue()
      frame = requestAnimationFrame(loopFrame)
    }
    frame = requestAnimationFrame(loopFrame)
    return () => cancelAnimationFrame(frame)
  }, [playing, syncCue])

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
    if (ratio < 0.33) seekBy(-SEEK_STEP)
    else if (ratio > 0.67) seekBy(SEEK_STEP)
    else void toggleFullscreen()
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
        break
      case "arrowright":
      case "l":
        e.preventDefault()
        seekBy(SEEK_STEP)
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

  const compact = (
    <div className="flex max-w-full items-center gap-2 px-3">
      {playing ? (
        <Equalizer />
      ) : (
        <PlayIcon className="size-5 shrink-0" />
      )}
      <span className="truncate text-xs font-medium">{title ?? "Video"}</span>
    </div>
  )

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
          "group relative aspect-video w-full overflow-hidden rounded-xl border bg-black shadow-sm outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&:fullscreen]:rounded-none [&:fullscreen]:border-0",
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
            pushIsland(
              {
                icon: <PlayIcon className="size-6" />,
                title: "Now playing",
                subtitle: title,
                value: formatTime(v.duration),
              },
              2400
            )
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

        {/* Buffering while controls are hidden */}
        {buffering && controlsHidden && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Spinner className="size-12 text-white drop-shadow" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black p-6 text-center">
            <div className="flex max-w-sm flex-col items-center gap-2 font-poppins text-white">
              <InfoIcon className="size-10 text-white/70" />
              <p className="text-sm font-semibold sm:text-base">
                This video couldn&apos;t be played
              </p>
              <p className="text-xs text-white/60 sm:text-sm">
                Check the link, or try another file. MP4 (H.264) and WebM play
                in every browser; some formats like MKV or AVI don&apos;t.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Island */}
        <DynamicIsland
          message={island}
          compact={compact}
          hidden={controlsHidden}
          className="absolute inset-x-2 top-2 z-20 sm:top-3"
        />

        {/* Top bar: volume + cast on the left, tools on the right */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2 transition-all duration-300 ease-out sm:p-4",
            controlsHidden && "-translate-y-2 opacity-0"
          )}
        >
          <div className={cn("flex items-center", interactive)}>
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
                <ChromecastIcon className={ICON} />
              </ControlButton>
            )}
          </div>

          <div className={cn("flex items-center", interactive)}>
            <ControlButton
              label="Screenshot"
              onClick={takeScreenshot}
              container={container}
            >
              <CameraIcon className={ICON} />
            </ControlButton>
            <ControlButton
              label="Download"
              onClick={downloadVideo}
              container={container}
            >
              <DownloadIcon className={ICON} />
            </ControlButton>
            {tracks.length > 0 && (
              <ControlButton
                label={captionId ? "Hide captions (c)" : "Show captions (c)"}
                onClick={toggleCaptions}
                container={container}
              >
                {captionId ? (
                  <ClosedCaptionsOnIcon className={ICON} />
                ) : (
                  <ClosedCaptionsIcon className={ICON} />
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
                  ICON,
                  "transition-transform duration-300",
                  settingsOpen && "rotate-45"
                )}
              />
            </ControlButton>
          </div>
        </div>

        {/* Centre: skip, previous, play/pause, next, skip */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-3 transition-opacity duration-300 sm:gap-6",
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
              "hidden size-12 rounded-full text-white hover:bg-white/15 hover:text-white active:scale-95 sm:inline-flex dark:hover:bg-white/15",
              interactive
            )}
          >
            <SeekBackward10Icon className="size-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          </Button>

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
              <PreviousIcon className="size-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] sm:size-9" />
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
              <Spinner className="size-9 sm:size-11" />
            ) : playing ? (
              <PauseIcon className="size-11 sm:size-14" />
            ) : (
              <PlayIcon className="size-11 sm:size-14" />
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
              <NextIcon className="size-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] sm:size-9" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Forward 10 seconds"
            onClick={() => seekBy(SEEK_STEP)}
            className={cn(
              "hidden size-12 rounded-full text-white hover:bg-white/15 hover:text-white active:scale-95 sm:inline-flex dark:hover:bg-white/15",
              interactive
            )}
          >
            <SeekForward10Icon className="size-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          </Button>
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
                  <FullscreenExitIcon className={ICON} />
                ) : (
                  <FullscreenIcon className={ICON} />
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
                  onClick={toggleLoop}
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
                  {menuView === "captions"
                    ? "Captions"
                    : menuView === "speed"
                      ? "Speed"
                      : "Subtitle delay"}
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
