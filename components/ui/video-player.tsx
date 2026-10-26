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
  PlaybackSpeedCircleIcon,
  PlayIcon,
  SeekBackward10Icon,
  SeekForward10Icon,
  SettingsIcon,
  VolumeHighIcon,
  VolumeLowIcon,
} from "@/components/icons/vidstack"
import { castMedia, CastCancelled, loadCastSdk } from "@/lib/cast"
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
  /** "hls" plays .m3u8 streams (hls.js, or native HLS on Safari). Detected from the URL when omitted. */
  type?: "hls" | "file"
  /** Called when the source can't be played, so the page can try another server. */
  onFail?: () => void
  /** Adds an Autoplay switch to the settings menu. */
  autoplayOption?: { value: boolean; onChange: (value: boolean) => void }
  /** Adds an "Auto next episode" switch to the settings menu. */
  autoNextOption?: { value: boolean; onChange: (value: boolean) => void }
  /** Intro / outro times in seconds. Shows Skip buttons while playing through them. */
  intro?: { start: number; end: number } | null
  outro?: { start: number; end: number } | null
  /** Adds an "Auto skip intro/outro" switch to the settings menu and skips by itself when on. */
  autoSkipOption?: { value: boolean; onChange: (value: boolean) => void }
  /** Length the intro/outro times were made for. If the video is much longer or shorter, they are ignored. */
  skipLength?: number | null
  /** Start here (seconds) instead of at 0; used to resume. Applied once per source. */
  startAt?: number | null
  /** Called about every 10 seconds while playing, and when paused, with the position and length. */
  onTime?: (position: number, duration: number) => void
}

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }
type CastVideo = HTMLVideoElement & {
  remote?: { prompt: () => Promise<void> }
}
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>
}
type MenuView = "main" | "captions" | "style" | "speed" | "boost" | "quality"
type Notice = { text: string; tone: "default" | "error" }

// Subtitle font, the same family Miruro uses for its captions.
// Open Sans is bundled so phones and Linux, which have no Trebuchet MS, still get a similar humanist look.
const CAPTION_FONT = '"Trebuchet MS", "Open Sans", "Segoe UI", Tahoma, sans-serif'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SEEK_STEP = 10
const AUTO_HIDE_MS = 3000

const CAPTION_SIZES = {
  sm: { label: "Small", scale: 0.88 },
  md: { label: "Medium", scale: 1.1 },
  lg: { label: "Large", scale: 1.4 },
} as const
const CAPTION_STYLES = {
  box: "Dark box",
  outline: "Outline",
} as const
type CaptionSize = keyof typeof CAPTION_SIZES
type CaptionStyle = keyof typeof CAPTION_STYLES
const CAPTION_PREFS_KEY = "videoplayer:caption-style:v2"

const MENU_TITLES: Record<MenuView, string> = {
  main: "Settings",
  captions: "Captions",
  style: "Caption style",
  speed: "Speed",
  quality: "Quality",
  boost: "Volume boost",
}

const QUALITY_KEY = "videoplayer:quality"

const BOOSTS = [1, 2, 3, 4] as const
// Shown as the extra volume on top of 100%: 0%, 100%, 200%, 300%.
const boostLabel = (b: number) => `${Math.round((b - 1) * 100)}%`

// Everything is sized from the player's own width (container queries, `cqw`),
// so controls stay in proportion from a small phone to a fullscreen 4K screen.
const BAR_BUTTON = "size-[clamp(1.8rem,4cqw,2.75rem)]"
const BAR_ICON = "size-[clamp(1.5rem,3.6cqw,2.2rem)]"
const SHADOW = "drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
const TEXT_SHADOW = "[text-shadow:0_1px_2px_rgb(0_0_0/0.6)]"
const PILL_HEIGHT = "h-[clamp(1.8rem,4.1cqw,2.6rem)]"

// Thin frosted glass: a light translucent fill, background blur, a hairline
// edge and a faint highlight along the top. Flat colours only, no gradients.
const GLASS =
  "border border-white/15 bg-white/10 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.22),0_4px_14px_rgb(0_0_0/0.22)] backdrop-blur-lg backdrop-saturate-150"
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

// Each row is its own thin glass capsule. Sizes are in `em`, so the whole menu
// scales with the font size set on the menu from the player width.
const ROW =
  "flex w-full items-center gap-[0.75em] rounded-[1em] border border-white/10 bg-white/[0.07] px-[0.9em] py-[0.6em] text-left shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)] transition-colors hover:bg-white/15 active:bg-white/20"

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
    <button type="button" onClick={onClick} className={ROW}>
      <span className="shrink-0 text-white [&_svg]:size-[1.6em]">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {value && <span className="max-w-[45%] truncate text-white/60">{value}</span>}
      {chevron && <ChevronRightIcon className="size-[1.4em] shrink-0" />}
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
      className={cn(ROW, "justify-between", selected && "border-white/25 bg-white/15")}
    >
      <span className="truncate">{label}</span>
      {selected && <CheckIcon className="size-[1.4em] shrink-0" />}
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
  type,
  onFail,
  autoplayOption,
  autoNextOption,
  intro,
  outro,
  autoSkipOption,
  skipLength,
  startAt,
  onTime,
}: VideoPlayerProps) {
  const onFailRef = React.useRef(onFail)
  React.useEffect(() => {
    onFailRef.current = onFail
  })
  // True once this source has really started playing. Before that a failure may mean the
  // server is bad (so the page can try another); after it, a hiccup must never swap servers.
  const startedRef = React.useRef(false)
  const autoTriedRef = React.useRef(false)
  const endedRef = React.useRef(false)
  const autoPlayRef = React.useRef(autoPlay)
  React.useEffect(() => {
    autoPlayRef.current = autoPlay
  })
  const startAtRef = React.useRef(startAt)
  const resumedRef = React.useRef<string | null>(null)
  const onTimeRef = React.useRef(onTime)
  const lastReportRef = React.useRef(0)
  React.useEffect(() => {
    startAtRef.current = startAt
    onTimeRef.current = onTime
  })
  const fireEnded = () => {
    if (endedRef.current) return
    endedRef.current = true
    setPlaying(false)
    onEnded?.()
  }
  // ---- intro / outro skipping ----
  type SkipKind = "intro" | "outro"
  const skipRef = React.useRef({ intro, outro, auto: Boolean(autoSkipOption?.value), length: skipLength })
  React.useEffect(() => {
    skipRef.current = { intro, outro, auto: Boolean(autoSkipOption?.value), length: skipLength }
  })
  const skippedRef = React.useRef<Record<SkipKind, boolean>>({ intro: false, outro: false })
  const lastTimeRef = React.useRef(0)
  const skipToastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [skipTarget, setSkipTarget] = React.useState<SkipKind | null>(null)
  const [skipToast, setSkipToast] = React.useState<{ kind: SkipKind; from: number } | null>(null)

  const skipTo = (kind: SkipKind, automatic: boolean) => {
    const v = videoRef.current
    const range = kind === "intro" ? skipRef.current.intro : skipRef.current.outro
    if (!v || !range) return
    const from = v.currentTime
    skippedRef.current[kind] = true
    setSkipTarget(null)
    // An outro that runs to the end jumps to the very end, so the next episode can start.
    const end = Number.isFinite(v.duration) && range.end >= v.duration - 2 ? Math.max(0, v.duration - 0.05) : range.end
    v.currentTime = end
    if (v.paused && !automatic) void v.play().catch(() => {})
    if (automatic) {
      setSkipToast({ kind, from })
      if (skipToastTimer.current) clearTimeout(skipToastTimer.current)
      skipToastTimer.current = setTimeout(() => setSkipToast(null), 5000)
    }
  }
  const undoSkip = () => {
    const v = videoRef.current
    if (v && skipToast) v.currentTime = skipToast.from
    setSkipToast(null)
  }
  const insideRef = React.useRef<Record<SkipKind, boolean>>({ intro: false, outro: false })
  const checkSkip = (v: HTMLVideoElement) => {
    const t = v.currentTime
    const { intro: i, outro: o, auto, length } = skipRef.current
    // Times made for a differently cut video would skip the wrong part: ignore them.
    const mismatch = Boolean(length) && Number.isFinite(v.duration) && v.duration > 0 && Math.abs(v.duration - length!) > 20
    const inside = (r: { start: number; end: number } | null | undefined) =>
      !mismatch && Boolean(r) && t >= r!.start - 0.3 && t < r!.end - 0.6
    const now: Record<SkipKind, boolean> = { intro: inside(i), outro: inside(o) }
    const natural = Math.abs(t - lastTimeRef.current) < 3
    lastTimeRef.current = t
    for (const kind of ["intro", "outro"] as const) {
      // Playback jumped straight into the range (the viewer scrubbed, or pressed Undo):
      // never auto-skip it, but keep the Skip button.
      if (now[kind] && !insideRef.current[kind] && !natural) skippedRef.current[kind] = true
    }
    insideRef.current = now
    const kind: SkipKind | null = now.intro ? "intro" : now.outro ? "outro" : null
    if (kind && auto && !skippedRef.current[kind] && !v.paused) {
      skipTo(kind, true)
      return
    }
    setSkipTarget((cur) => (cur === kind ? cur : kind))
  }
  React.useEffect(() => {
    // New video: forget what was skipped.
    skippedRef.current = { intro: false, outro: false }
    insideRef.current = { intro: false, outro: false }
    lastTimeRef.current = 0
    setSkipTarget(null)
    setSkipToast(null)
  }, [src])

  const reportFail = () => {
    if (!startedRef.current) onFailRef.current?.()
  }
  type HlsInstance = import("hls.js").default
  const hlsRef = React.useRef<HlsInstance | null>(null)
  const [levels, setLevels] = React.useState<{ index: number; height: number; bitrate: number }[]>([])
  const [quality, setQuality] = React.useState(-1) // -1 = Auto
  const [liveLevel, setLiveLevel] = React.useState(-1)
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
  // Volume boost runs the audio through a Web Audio gain node. That needs the
  // video to be CORS readable, so we ask for it and fall back if the server refuses.
  const [boost, setBoost] = React.useState(1)
  const [cors, setCors] = React.useState(true)
  const audioRef = React.useRef<{
    ctx: AudioContext
    gain: GainNode
  } | null>(null)
  const [speed, setSpeed] = React.useState(1)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [showControls, setShowControls] = React.useState(true)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [menuView, setMenuView] = React.useState<MenuView>("main")
  const [castSupported, setCastSupported] = React.useState(false)
  const [scrubbing, setScrubbing] = React.useState(false)
  const [cueText, setCueText] = React.useState("")
  const [cueVersion, setCueVersion] = React.useState(0)
  const [captionOffset, setCaptionOffset] = React.useState(0)
  const [captionSize, setCaptionSize] = React.useState<CaptionSize>("sm")
  const [captionStyle, setCaptionStyle] = React.useState<CaptionStyle>("outline")
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const [flash, setFlash] = React.useState<{
    dir: "back" | "forward"
    key: number
  } | null>(null)

  const trackKey = tracks.map(trackId).join("|")
  // English is always the default caption; otherwise the first track.
  const defaultTrack =
    tracks.find((t) => /^en(\b|-|_)/i.test(t.srclang) || /^english\b/i.test(t.label)) ?? tracks[0]
  const firstId = defaultTrack ? trackId(defaultTrack) : null
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

  const changeBoost = React.useCallback((value: number) => {
    const v = videoRef.current
    if (!v) return
    try {
      if (!audioRef.current) {
        if (value === 1) {
          setBoost(1)
          return
        }
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx()
        const source = ctx.createMediaElementSource(v)
        const gain = ctx.createGain()
        // A fast limiter just under 0 dB stops boosted peaks from clipping, without
        // squashing normal dialogue (a low threshold would cancel the boost).
        const limiter = ctx.createDynamicsCompressor()
        limiter.threshold.value = -2
        limiter.knee.value = 2
        limiter.ratio.value = 20
        limiter.attack.value = 0.002
        limiter.release.value = 0.12
        source.connect(gain).connect(limiter).connect(ctx.destination)
        audioRef.current = { ctx, gain }
      }
      const { ctx, gain } = audioRef.current
      gain.gain.value = value
      if (ctx.state === "suspended") void ctx.resume()
      setBoost(value)
    } catch {
      setBoost(1)
    }
  }, [])

  // The audio context can be suspended by the browser; wake it on play.
  React.useEffect(() => {
    if (playing && audioRef.current?.ctx.state === "suspended") {
      void audioRef.current.ctx.resume()
    }
  }, [playing])

  React.useEffect(() => {
    setCors(true)
  }, [src])

  // HLS (.m3u8) streams: hls.js wherever it can run (it gives us quality levels and
  // error recovery); the browser's own HLS only when hls.js is not supported.
  const isHls = type === "hls" || (type === undefined && /\.m3u8(\?|$)/i.test(src))
  React.useEffect(() => {
    startedRef.current = false
    autoTriedRef.current = false
    endedRef.current = false
  }, [src])
  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !isHls) return
    let cancelled = false
    let native = false
    setLevels([])
    setQuality(-1)
    setLiveLevel(-1)
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          native = true
          video.src = src
          return
        }
        setLoading(false)
        setError(true)
        reportFail()
        return
      }
      let netRetries = 0
      let mediaRetries = 0
      const hls = new Hls({ enableWorker: true, maxBufferLength: 40, backBufferLength: 30 })
      hlsRef.current = hls
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        // One entry per picture height (the best bitrate of each), tallest first.
        const best = new Map<number, { index: number; height: number; bitrate: number }>()
        data.levels.forEach((l, index) => {
          const key = l.height || Math.round(l.bitrate / 1000)
          const have = best.get(key)
          if (!have || l.bitrate > have.bitrate) best.set(key, { index, height: l.height || 0, bitrate: l.bitrate })
        })
        const list = [...best.values()].sort((x, y) => y.height - x.height || y.bitrate - x.bitrate)
        setLevels(list)
        try {
          const saved = Number(localStorage.getItem(QUALITY_KEY))
          const match = saved ? list.find((l) => l.height === saved) : undefined
          if (match) {
            hls.currentLevel = match.index
            setQuality(match.index)
          }
        } catch {
          /* private mode: start on Auto */
        }
      })
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setLiveLevel(d.level))
      hls.on(Hls.Events.FRAG_LOADED, () => {
        netRetries = 0
        mediaRetries = 0
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 4) {
          netRetries += 1
          window.setTimeout(() => hlsRef.current === hls && hls.startLoad(), 500 * netRetries)
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 3) {
          mediaRetries += 1
          if (mediaRetries === 2) hls.swapAudioCodec()
          hls.recoverMediaError()
        } else {
          setLoading(false)
          setError(true)
          reportFail()
        }
      })
      hls.loadSource(src)
      hls.attachMedia(video)
    })
    return () => {
      cancelled = true
      const hls = hlsRef.current
      hlsRef.current = null
      hls?.destroy()
      if (native) {
        video.removeAttribute("src")
        video.load()
      }
    }
  }, [src, isHls]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeQuality = (index: number) => {
    const hls = hlsRef.current
    if (!hls) return
    hls.currentLevel = index
    setQuality(index)
    try {
      const height = levels.find((l) => l.index === index)?.height
      if (index === -1 || !height) localStorage.removeItem(QUALITY_KEY)
      else localStorage.setItem(QUALITY_KEY, String(height))
    } catch {
      /* ignore */
    }
  }
  const levelLabel = (l: { height: number; bitrate: number }) =>
    l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps`
  const qualityValue = () => {
    if (quality !== -1) {
      const l = levels.find((x) => x.index === quality)
      return l ? levelLabel(l) : "Auto"
    }
    const playing = hlsRef.current?.levels[liveLevel]
    return playing?.height ? `Auto (${playing.height}p)` : "Auto"
  }

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

  const castVideo = async () => {
    const v = videoRef.current as CastVideo | null
    if (!v) return
    if (!/^(https?:|\/)/i.test(src)) {
      showNotice("Videos from your device can't be cast", "error")
      return
    }
    try {
      const device = await castMedia({
        url: new URL(src, window.location.href).href,
        contentType: isHls ? "application/x-mpegURL" : "video/mp4",
        title: title ?? "Video",
        poster: poster ? new URL(poster, window.location.href).href : undefined,
        startTime: v.currentTime,
      })
      v.pause()
      showNotice(`Casting to ${device}`)
      return
    } catch (e) {
      if (e instanceof CastCancelled) return
    }
    // Browsers without the Cast SDK (Safari AirPlay and similar).
    try {
      if (v.remote) await v.remote.prompt()
      else showNotice("Casting isn't available in this browser", "error")
    } catch {
      showNotice("Couldn't start casting", "error")
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
    if (v.error) {
      setError(true)
      reportFail()
    }
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
    const chromium = "chrome" in window && !/Firefox/i.test(navigator.userAgent)
    setCastSupported(Boolean((videoRef.current as CastVideo | null)?.remote) || chromium)
    if (chromium) void loadCastSdk()
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

  /* ---------- captions (own parser, own timing, rendered in Trebuchet MS) ---------- */
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
          "@container group relative font-poppins aspect-video w-full touch-manipulation overflow-hidden rounded-xl border bg-black shadow-sm outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&:fullscreen]:aspect-auto [&:fullscreen]:rounded-none [&:fullscreen]:border-0",
          controlsHidden && "cursor-none",
          className
        )}
      >
        <video
          ref={videoRef}
          src={isHls ? undefined : src}
          poster={poster}
          autoPlay={autoPlay}
          preload="metadata"
          playsInline
          crossOrigin={cors ? "anonymous" : undefined}
          className="size-full object-contain"
          onClick={onVideoClick}
          onDoubleClick={onVideoDoubleClick}
          onLoadStart={() => {
            endedRef.current = false
            setCurrentTime(0)
            setDuration(0)
            setBuffered(0)
            setError(false)
            setLoading(true)
          }}
          onEmptied={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onPlaying={() => {
            startedRef.current = true
            setLoading(false)
          }}
          onWaiting={() => setLoading(true)}
          onCanPlay={(e) => {
            setLoading(false)
            setError(false)
            const v = e.currentTarget
            // Start by ourselves: the autoplay attribute is unreliable with hls.js and when the
            // source changes. A browser that blocks sound autoplay gets a muted start instead.
            if (autoPlayRef.current && !autoTriedRef.current && !startedRef.current && v.paused) {
              autoTriedRef.current = true
              v.play().catch((err: unknown) => {
                if ((err as DOMException)?.name !== "NotAllowedError") return
                v.muted = true
                setMuted(true)
                v.play()
                  .then(() => showNotice("Playing muted. Tap the volume button to unmute."))
                  .catch(() => {
                    v.muted = false
                    setMuted(false)
                  })
              })
            }
          }}
          onError={() => {
            // hls.js reports and recovers from its own errors; this event would only repeat them.
            if (hlsRef.current) return
            // A server without CORS headers rejects the request. Retry once
            // without CORS (playback works, volume boost is unavailable).
            if (cors && /^https?:/i.test(src) && !audioRef.current) {
              setCors(false)
              return
            }
            setLoading(false)
            setError(true)
            reportFail()
          }}
          onEnded={fireEnded}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            setDuration(v.duration)
            // Resume once per source (a server switch keeps the spot the viewer was at).
            const from = startAtRef.current
            if (from && from > 3 && Number.isFinite(v.duration) && from < v.duration - 15 && resumedRef.current !== src) {
              v.currentTime = from
            }
            resumedRef.current = src
            // A new source resets the rate, so re-apply the chosen speed.
            v.playbackRate = speed
            updateBuffered(v)
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onProgress={(e) => updateBuffered(e.currentTarget)}
          onSeeked={syncCue}
          onTimeUpdate={(e) => {
            const v = e.currentTarget
            if (!scrubbing) setCurrentTime(v.currentTime)
            updateBuffered(v)
            checkSkip(v)
            if (onTimeRef.current && Number.isFinite(v.duration) && v.duration > 0 && v.currentTime > 5 && Math.abs(v.currentTime - lastReportRef.current) >= 10) {
              lastReportRef.current = v.currentTime
              onTimeRef.current(v.currentTime, v.duration)
            }
            // Some streams never fire "ended"; treat the last quarter second as the end.
            if (Number.isFinite(v.duration) && v.duration > 1 && v.currentTime >= v.duration - 0.25) fireEnded()
          }}
        />

        {/* Flat dim layer while controls are visible */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-black/20 transition-opacity duration-300",
            controlsHidden ? "opacity-0" : "opacity-100"
          )}
        />

        {/* Captions: Trebuchet MS like Miruro, sized from the player width, with a readable style */}
        {/* Skip intro / outro: shown while playback is inside the range, and a note when it skipped by itself */}
        {(skipTarget || skipToast) && (
          <div className="absolute right-[clamp(0.5rem,2.2cqw,1.25rem)] bottom-[clamp(4.6rem,11.5cqw,7.5rem)] z-20 flex flex-col items-end gap-[0.5em] font-poppins text-[length:clamp(0.75rem,1.9cqw,1.05rem)]">
            {skipToast && (
              <div
                role="status"
                className="flex animate-in items-center gap-[0.7em] rounded-full border border-white/15 bg-black/70 py-[0.45em] pr-[0.5em] pl-[1em] text-white shadow-[0_6px_20px_rgb(0_0_0/0.4)] backdrop-blur-xl duration-200 fade-in-0 slide-in-from-bottom-2"
              >
                <span className="font-medium">{skipToast.kind === "intro" ? "Intro skipped" : "Outro skipped"}</span>
                <button
                  type="button"
                  onClick={undoSkip}
                  className="rounded-full bg-white/15 px-[0.9em] py-[0.25em] font-semibold hover:bg-white/25 active:scale-95"
                >
                  Undo
                </button>
              </div>
            )}
            {skipTarget && !skipToast && (
              <button
                type="button"
                onClick={() => skipTo(skipTarget, false)}
                className="flex animate-in items-center gap-[0.5em] rounded-full bg-white px-[1.1em] py-[0.6em] font-semibold text-black shadow-[0_6px_20px_rgb(0_0_0/0.4)] duration-200 fade-in-0 slide-in-from-bottom-2 hover:bg-white/90 active:scale-95"
              >
                {skipTarget === "intro" ? "Skip Intro" : "Skip Outro"}
                <SeekForward10Icon className="size-[1.5em]" />
              </button>
            )}
          </div>
        )}

        {cueText && (
          // The position never changes when the controls appear or hide, so captions don't jump
          // under your finger. They sit just above the seek bar, centred, so the time (left) and
          // fullscreen button (right) stay clear of them.
          <div className="pointer-events-none absolute inset-x-0 bottom-[clamp(2.1rem,6.5cqw,5rem)] z-[5] flex justify-center px-[5cqw]">
            <p
              style={{
                fontSize: `calc(clamp(0.85rem, 2.6cqw, 2.5rem) * ${CAPTION_SIZES[captionSize].scale})`,
                fontFamily: CAPTION_FONT,
              }}
              className="max-w-[min(100%,52em)] text-center leading-[1.35] font-bold tracking-[0.005em] text-balance whitespace-pre-line text-white"
            >
              <span
                className={
                  captionStyle === "box"
                    ? "rounded-[0.35em] bg-black/75 px-[0.6em] py-[0.12em] box-decoration-clone shadow-[0_0.1em_0.4em_rgb(0_0_0/0.4)]"
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
              "flex items-center rounded-full p-[clamp(0.125rem,0.32cqw,0.25rem)]",
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
              "flex items-center rounded-full p-[clamp(0.125rem,0.32cqw,0.25rem)]",
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
              "absolute top-1/2 left-[25%] size-[clamp(2.2rem,5.7cqw,3.8rem)] -translate-x-1/2 -translate-y-1/2 rounded-full text-white hover:text-white active:scale-95",
              GLASS,
              GLASS_HOVER,
              interactive
            )}
          >
            <SeekBackward10Icon className={cn("size-[74%]", SHADOW)} />
          </Button>

          <button
            type="button"
            aria-label={playing ? "Pause video" : "Play video"}
            onClick={togglePlay}
            className={cn(
              "absolute top-1/2 left-1/2 grid size-[clamp(2.6rem,6.3cqw,4.2rem)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-white/40 active:scale-95",
              GLASS,
              GLASS_HOVER,
              interactive
            )}
          >
            {buffering ? (
              <Spinner className="size-1/2" />
            ) : playing ? (
              <PauseIcon className="size-[74%]" />
            ) : (
              <PlayIcon className="size-[74%]" />
            )}
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Forward 10 seconds"
            onClick={() => seekBy(SEEK_STEP)}
            className={cn(
              "absolute top-1/2 left-[75%] size-[clamp(2.2rem,5.7cqw,3.8rem)] -translate-x-1/2 -translate-y-1/2 rounded-full text-white hover:text-white active:scale-95",
              GLASS,
              GLASS_HOVER,
              interactive
            )}
          >
            <SeekForward10Icon className={cn("size-[74%]", SHADOW)} />
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
                "inline-flex min-w-0 items-center rounded-full font-poppins text-[length:clamp(0.75rem,1.8cqw,1rem)] font-medium text-white tabular-nums",
                PILL_HEIGHT,
                TEXT_SHADOW
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
                shape={cn(PILL_HEIGHT, "w-[clamp(2.4rem,5.6cqw,3.4rem)]")}
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

        {/* Settings menu: a glass panel of glass rows with a notch pointing at the button */}
        {settingsOpen && (
          <div className="absolute top-[clamp(3.1rem,7.4cqw,4.4rem)] right-[clamp(0.5rem,2.2cqw,1.25rem)] z-30 flex max-h-[calc(100%_-_clamp(3.1rem,7.4cqw,4.4rem)_-_clamp(0.5rem,5cqw,3.5rem))] w-[clamp(14rem,39cqw,26rem)] max-w-[calc(100%_-_1rem)] origin-top-right animate-in flex-col font-poppins text-[length:clamp(0.75rem,1.9cqw,1.05rem)] text-white duration-150 fade-in-0 zoom-in-95">
            <span
              aria-hidden="true"
              className="absolute -top-[0.5em] right-[calc(clamp(0.9rem,2.1cqw,1.4rem)+clamp(0.125rem,0.32cqw,0.25rem)-0.55em)] h-[0.55em] w-[1.1em] bg-black/55 backdrop-blur-2xl [clip-path:polygon(50%_0,100%_100%,0_100%)]"
            />
            <div className="min-h-0 space-y-[0.4em] overflow-y-auto rounded-[1.5em] border border-white/15 bg-black/55 p-[0.55em] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.15),0_12px_40px_rgb(0_0_0/0.4)] backdrop-blur-2xl backdrop-saturate-150">
              {menuView === "main" && (
                <>
                  {levels.length > 1 && (
                    <MenuRow
                      icon={<SettingsIcon />}
                      label="Quality"
                      value={qualityValue()}
                      onClick={() => setMenuView("quality")}
                    />
                  )}
                  <MenuRow
                    icon={<VolumeHighIcon />}
                    label="Volume boost"
                    value={cors ? boostLabel(boost) : "Unavailable"}
                    onClick={() => setMenuView("boost")}
                  />
                  {tracks.length > 0 && (
                    <MenuRow
                      icon={<ClosedCaptionsIcon />}
                      label="Captions"
                      value={activeTrack?.label ?? "Off"}
                      onClick={() => setMenuView("captions")}
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
                  {autoplayOption && (
                    <MenuRow
                      icon={<PlayIcon />}
                      label="Autoplay"
                      value={autoplayOption.value ? "On" : "Off"}
                      chevron={false}
                      onClick={() => autoplayOption.onChange(!autoplayOption.value)}
                    />
                  )}
                  {autoSkipOption && (
                    <MenuRow
                      icon={<SeekForward10Icon />}
                      label="Auto skip intro/outro"
                      value={!intro && !outro ? "No data" : autoSkipOption.value ? "On" : "Off"}
                      chevron={false}
                      onClick={() => autoSkipOption.onChange(!autoSkipOption.value)}
                    />
                  )}
                  {autoNextOption && (
                    <MenuRow
                      icon={<SeekForward10Icon />}
                      label="Auto next episode"
                      value={autoNextOption.value ? "On" : "Off"}
                      chevron={false}
                      onClick={() => autoNextOption.onChange(!autoNextOption.value)}
                    />
                  )}
                </>
              )}

              {menuView !== "main" && (
                <button
                  type="button"
                  onClick={() => setMenuView("main")}
                  className={cn(ROW, "font-semibold")}
                >
                  <ChevronLeftIcon className="size-[1.4em] shrink-0" />
                  {MENU_TITLES[menuView]}
                </button>
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

              {menuView === "style" && (
                <>
                  <p className="px-[0.9em] pt-[0.3em] text-[0.75em] font-semibold tracking-wider text-white/50 uppercase">
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
                  <p className="px-[0.9em] pt-[0.6em] text-[0.75em] font-semibold tracking-wider text-white/50 uppercase">
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

              {menuView === "boost" && (
                <>
                  {cors ? (
                    BOOSTS.map((b) => (
                      <OptionRow
                        key={b}
                        label={boostLabel(b)}
                        selected={boost === b}
                        onClick={() => changeBoost(b)}
                      />
                    ))
                  ) : (
                    <p className="px-[0.9em] py-[0.5em] text-white/70">
                      This video&apos;s server doesn&apos;t allow volume boost. Videos you open from
                      your device always support it.
                    </p>
                  )}
                  {cors && (
                    <p className="px-[0.9em] pt-[0.3em] text-[0.8em] text-white/60">
                      Raises the sound above 100%. Lower your device volume if it gets too loud.
                    </p>
                  )}
                </>
              )}

              {menuView === "quality" && (
                <>
                  <OptionRow label="Auto" selected={quality === -1} onClick={() => changeQuality(-1)} />
                  {levels.map((l) => (
                    <OptionRow
                      key={l.index}
                      label={levelLabel(l)}
                      selected={quality === l.index}
                      onClick={() => changeQuality(l.index)}
                    />
                  ))}
                  <p className="px-[0.9em] pt-[0.3em] text-[0.8em] text-white/60">
                    Auto picks the best quality your connection can handle.
                  </p>
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
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
