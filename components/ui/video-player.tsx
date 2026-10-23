"use client"

import * as React from "react"
import {
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
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

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
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
  active?: boolean
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
            "size-9 shrink-0 rounded-full text-white transition-all duration-200 hover:scale-110 hover:bg-white/20 hover:text-white active:scale-95 sm:size-10",
            active && "bg-white/20",
            className
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
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
}: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playing, setPlaying] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [volume, setVolume] = React.useState(1)
  const [muted, setMuted] = React.useState(false)
  const [speed, setSpeed] = React.useState(1)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [showControls, setShowControls] = React.useState(true)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [captionLang, setCaptionLang] = React.useState<string | null>(
    tracks[0]?.srclang ?? null
  )
  const [cueText, setCueText] = React.useState("")
  const [scrubbing, setScrubbing] = React.useState(false)

  /* ---------- playback helpers ---------- */
  const togglePlay = React.useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
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

  const toggleFullscreen = React.useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await el.requestFullscreen()
  }, [])

  const togglePip = React.useCallback(async () => {
    const v = videoRef.current
    if (!v || !document.pictureInPictureEnabled) return
    if (document.pictureInPictureElement) await document.exitPictureInPicture()
    else await v.requestPictureInPicture()
  }, [])

  const toggleCaptions = React.useCallback(() => {
    setCaptionLang((cur) => (cur ? null : tracks[0]?.srclang ?? null))
  }, [tracks])

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
    if (!playing) {
      setShowControls(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    } else {
      revealControls()
    }
  }, [playing, revealControls])

  /* ---------- fullscreen state ---------- */
  React.useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  /* ---------- custom captions (rendered in Poppins) ---------- */
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const cleanups: Array<() => void> = []

    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i]
      if (captionLang && track.language === captionLang) {
        track.mode = "hidden" // loads cues without the browser drawing them
        const onCue = () => {
          const text = Array.from(track.activeCues ?? [])
            .map((c) => (c as VTTCue).text)
            .join("\n")
            .replace(/<[^>]+>/g, "")
          setCueText(text)
        }
        track.addEventListener("cuechange", onCue)
        cleanups.push(() => track.removeEventListener("cuechange", onCue))
      } else {
        track.mode = "disabled"
      }
    }
    if (!captionLang) setCueText("")
    return () => cleanups.forEach((fn) => fn())
  }, [captionLang, tracks])

  /* ---------- keyboard shortcuts ---------- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key.toLowerCase()) {
      case " ":
      case "k":
        e.preventDefault()
        togglePlay()
        break
      case "arrowleft":
      case "j":
        e.preventDefault()
        seekBy(-10)
        break
      case "arrowright":
      case "l":
        e.preventDefault()
        seekBy(10)
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
        toggleCaptions()
        break
    }
    revealControls()
  }

  const changeVolume = (value: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = value
    v.muted = value === 0
    setVolume(value)
    setMuted(value === 0)
  }

  const changeSpeed = (value: number) => {
    if (videoRef.current) videoRef.current.playbackRate = value
    setSpeed(value)
  }

  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-label={title ? `Video player: ${title}` : "Video player"}
        onKeyDown={onKeyDown}
        onMouseMove={revealControls}
        onMouseLeave={() => playing && setShowControls(false)}
        className={cn(
          "group relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "fullscreen:rounded-none fullscreen:ring-0",
          !showControls && playing && "cursor-none",
          className
        )}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          playsInline
          crossOrigin="anonymous"
          className="size-full object-contain"
          onClick={() => {
            if (settingsOpen) setSettingsOpen(false)
            else togglePlay()
          }}
          onDoubleClick={() => void toggleFullscreen()}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            if (!scrubbing) setCurrentTime(e.currentTarget.currentTime)
          }}
        >
          {tracks.map((t) => (
            <track
              key={t.srclang}
              kind="captions"
              src={t.src}
              srcLang={t.srclang}
              label={t.label}
            />
          ))}
        </video>

        {/* Captions overlay — Poppins */}
        {cueText && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 flex justify-center px-4 transition-all duration-300 ease-out",
              showControls ? "bottom-20 sm:bottom-24" : "bottom-5 sm:bottom-8"
            )}
          >
            <span
              style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
              className="max-w-[90%] rounded-lg bg-black/70 px-3 py-1.5 text-center text-sm leading-snug font-medium whitespace-pre-line text-white shadow-lg backdrop-blur-sm sm:max-w-[75%] sm:px-4 sm:py-2 sm:text-lg md:text-xl"
            >
              {cueText}
            </span>
          </div>
        )}

        {/* Loading spinner */}
        {loading && playing && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2 className="size-12 animate-spin text-white/90" />
          </div>
        )}

        {/* Big center play button */}
        {!playing && (
          <button
            type="button"
            aria-label="Play video"
            onClick={togglePlay}
            className="absolute inset-0 grid place-items-center bg-black/20 transition-colors hover:bg-black/30"
          >
            <span className="grid size-16 place-items-center rounded-full bg-white/20 text-white shadow-xl ring-1 ring-white/30 backdrop-blur-md transition-transform duration-300 hover:scale-110 sm:size-20">
              <Play className="size-7 translate-x-0.5 fill-white sm:size-9" />
            </span>
          </button>
        )}

        {/* Title */}
        {title && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 pt-3 pb-10 transition-opacity duration-300 sm:px-6 sm:pt-4",
              showControls ? "opacity-100" : "opacity-0"
            )}
          >
            <h2
              style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
              className="truncate text-sm font-semibold text-white sm:text-base"
            >
              {title}
            </h2>
          </div>
        )}

        {/* Settings panel (kept inside the container so it works in fullscreen) */}
        {settingsOpen && (
          <div
            style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
            className="animate-in fade-in slide-in-from-bottom-2 absolute right-3 bottom-16 z-20 max-h-[70%] w-52 overflow-y-auto rounded-xl border border-white/10 bg-black/85 p-2 text-sm text-white shadow-2xl backdrop-blur-xl duration-200 sm:right-4 sm:bottom-20"
          >
            <p className="px-2 pt-1 pb-1 text-xs font-semibold tracking-wide text-white/50 uppercase">
              Speed
            </p>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/15"
              >
                {s === 1 ? "Normal" : `${s}x`}
                {speed === s && <Check className="size-4" />}
              </button>
            ))}

            {tracks.length > 0 && (
              <>
                <div className="my-2 h-px bg-white/10" />
                <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-white/50 uppercase">
                  Captions
                </p>
                <button
                  type="button"
                  onClick={() => setCaptionLang(null)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/15"
                >
                  Off
                  {captionLang === null && <Check className="size-4" />}
                </button>
                {tracks.map((t) => (
                  <button
                    key={t.srclang}
                    type="button"
                    onClick={() => setCaptionLang(t.srclang)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/15"
                  >
                    {t.label}
                    {captionLang === t.srclang && <Check className="size-4" />}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Bottom controls */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pt-10 pb-2 transition-all duration-300 ease-out sm:px-4 sm:pb-3",
            showControls
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          )}
        >
          {/* Seek bar */}
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
            className="mb-1 cursor-pointer px-1 sm:mb-2 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:opacity-0 [&_[data-slot=slider-thumb]]:transition-opacity group-hover:[&_[data-slot=slider-thumb]]:opacity-100 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-white/25 [&_[data-slot=slider-track]]:transition-all hover:[&_[data-slot=slider-track]]:h-1.5"
          />

          <div className="flex items-center gap-0.5 sm:gap-1">
            <ControlButton
              label={playing ? "Pause (k)" : "Play (k)"}
              onClick={togglePlay}
            >
              {playing ? (
                <Pause className="size-5 fill-white" />
              ) : (
                <Play className="size-5 fill-white" />
              )}
            </ControlButton>

            <ControlButton label="Back 10s (←)" onClick={() => seekBy(-10)}>
              <RotateCcw className="size-5" />
            </ControlButton>
            <ControlButton label="Forward 10s (→)" onClick={() => seekBy(10)}>
              <RotateCw className="size-5" />
            </ControlButton>

            {/* Volume — slider expands on hover (md+) */}
            <div className="group/vol flex items-center">
              <ControlButton
                label={muted ? "Unmute (m)" : "Mute (m)"}
                onClick={toggleMute}
              >
                <VolumeIcon className="size-5" />
              </ControlButton>
              <div className="hidden w-0 overflow-hidden transition-all duration-300 ease-out group-hover/vol:w-20 group-hover/vol:pr-2 group-focus-within/vol:w-20 group-focus-within/vol:pr-2 md:block">
                <Slider
                  aria-label="Volume"
                  value={[muted ? 0 : volume]}
                  max={1}
                  step={0.02}
                  onValueChange={([v]) => changeVolume(v)}
                  className="w-18 cursor-pointer [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-track]]:bg-white/25"
                />
              </div>
            </div>

            <span
              style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}
              className="ml-1 text-[11px] font-medium text-white/90 tabular-nums sm:ml-2 sm:text-sm"
            >
              {formatTime(currentTime)}
              <span className="text-white/50"> / {formatTime(duration)}</span>
            </span>

            <div className="flex-1" />

            {tracks.length > 0 && (
              <ControlButton
                label={captionLang ? "Hide captions (c)" : "Show captions (c)"}
                onClick={toggleCaptions}
                active={Boolean(captionLang)}
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
              onClick={() => setSettingsOpen((o) => !o)}
              active={settingsOpen}
            >
              <Settings
                className={cn(
                  "size-5 transition-transform duration-300",
                  settingsOpen && "rotate-45"
                )}
              />
            </ControlButton>

            <ControlButton
              label="Picture in picture"
              onClick={() => void togglePip()}
              className="hidden sm:inline-flex"
            >
              <PictureInPicture2 className="size-5" />
            </ControlButton>

            <ControlButton
              label={fullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
              onClick={() => void toggleFullscreen()}
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
    </TooltipProvider>
  )
}
