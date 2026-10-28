"use client"

import { muxMp4, type Mp4Sample } from "@/lib/mp4"

/**
 * Makes the profile as a short vertical clip in the browser (a long list scrolls down, GIFs keep moving).
 * First choice: encode every frame ourselves with WebCodecs and write the MP4 ourselves, so the file is exactly as long
 * as asked (frames / fps) in every gallery. If the browser cannot do that, fall back to recording the canvas live.
 */

export type VideoResult = { blob: Blob; mime: string; ext: "mp4" | "webm" }
type Scene = { canvas: HTMLCanvasElement; viewH: number; draw: (t: number) => void }

export function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const list = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  return list.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
}

export const canMakeVideo = () =>
  (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") ||
  (typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function")

const finish = (chunks: Blob[], mime: string): VideoResult => {
  const type = (mime || chunks[0]?.type || "video/webm").split(";")[0]
  return { blob: new Blob(chunks, { type }), mime: type, ext: type.includes("mp4") ? "mp4" : "webm" }
}

/** The canvas the clip is drawn on, and how to paint the picture at `t` ms (the page scrolls like a screen recording). */
function painter(scene: Scene, durationMs: number) {
  const src = scene.canvas
  const W = 720
  const H = Math.round((W * scene.viewH) / src.width / 2) * 2
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d", { alpha: false })!
  const maxScroll = Math.max(0, src.height - scene.viewH)
  const rest = Math.min(1500, durationMs / 5)
  const scrollY = (t: number) => {
    if (!maxScroll) return 0
    const k = Math.min(1, Math.max(0, (t - rest) / Math.max(1, durationMs - rest * 2)))
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    return Math.round(e * maxScroll)
  }
  const paint = (t: number) => {
    scene.draw(t)
    ctx.drawImage(src, 0, scrollY(t), src.width, scene.viewH, 0, 0, W, H)
  }
  return { c, ctx, W, H, paint }
}

const FPS = 24
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Encodes frame by frame (not tied to the clock), then writes the MP4. Returns null when the browser cannot encode H.264. */
async function encodeMp4(scene: Scene, durationMs: number, onProgress: (p: number) => void, signal: { cancelled: boolean }): Promise<VideoResult | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return null
  const { c, W, H, paint } = painter(scene, durationMs)
  let config: VideoEncoderConfig | null = null
  for (const codec of ["avc1.420028", "avc1.42001f", "avc1.4d0028", "avc1.640028"]) {
    const cand: VideoEncoderConfig = { codec, width: W, height: H, bitrate: 4_000_000, framerate: FPS, avc: { format: "avc" }, latencyMode: "quality" }
    try {
      if ((await VideoEncoder.isConfigSupported(cand)).supported) {
        config = cand
        break
      }
    } catch {
      /* try the next one */
    }
  }
  if (!config) return null

  const samples: Mp4Sample[] = []
  let avcC: Uint8Array | null = null
  let failure: unknown = null
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const d = new Uint8Array(chunk.byteLength)
      chunk.copyTo(d)
      samples.push({ data: d, key: chunk.type === "key" })
      const desc = meta?.decoderConfig?.description
      if (desc && !avcC) avcC = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as ArrayBufferView).buffer.slice((desc as ArrayBufferView).byteOffset, (desc as ArrayBufferView).byteOffset + (desc as ArrayBufferView).byteLength))
    },
    error: (e) => {
      failure = e
    },
  })
  enc.configure(config)
  const total = Math.max(1, Math.round((durationMs / 1000) * FPS))
  try {
    for (let i = 0; i < total; i++) {
      if (signal.cancelled) throw new Error("cancelled")
      if (failure) throw failure
      paint((i * 1000) / FPS)
      const frame = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
      enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 })
      frame.close()
      while (enc.encodeQueueSize > 8) await sleep(4)
      if (i % 3 === 0) {
        onProgress(i / total)
        await sleep(0) // let the page breathe
      }
    }
    await enc.flush()
  } finally {
    if (enc.state !== "closed") enc.close()
  }
  if (failure) throw failure
  if (!avcC || samples.length < total * 0.9) return null
  const data = muxMp4({ width: W, height: H, fps: FPS, avcC, samples })
  onProgress(1)
  return { blob: new Blob([data as BlobPart], { type: "video/mp4" }), mime: "video/mp4", ext: "mp4" }
}

/** The fallback: records the canvas live for `durationMs`. */
function recordLive(scene: Scene, durationMs: number, onProgress: (p: number) => void, signal: { cancelled: boolean }): Promise<VideoResult> {
  return new Promise((resolve, reject) => {
    const { c, ctx, W, H, paint } = painter(scene, durationMs)
    const mime = pickVideoMime()
    // Frames are pushed by hand (requestFrame) so a still picture is recorded for the whole length too.
    const stream = c.captureStream(0)
    const track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined
    const manual = typeof track?.requestFrame === "function"
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(manual ? stream : c.captureStream(30), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 4_000_000 })
    } catch (e) {
      return reject(e)
    }
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onerror = () => reject(new Error("Recording failed."))
    rec.onstop = () => (signal.cancelled ? reject(new Error("cancelled")) : resolve(finish(chunks, mime)))
    let n = 0
    const draw = (t: number) => {
      paint(t)
      // one almost invisible pixel that changes every frame, so every frame counts as new
      ctx.fillStyle = n++ % 2 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"
      ctx.fillRect(W - 2, H - 2, 2, 2)
      if (manual) track!.requestFrame!()
    }
    draw(0)
    rec.start(1000)
    const t0 = performance.now()
    const tick = () => {
      if (signal.cancelled) return rec.state !== "inactive" ? rec.stop() : undefined
      const t = performance.now() - t0
      draw(Math.min(t, durationMs))
      onProgress(Math.min(1, t / durationMs))
      if (t >= durationMs) {
        draw(durationMs)
        return void setTimeout(() => rec.state !== "inactive" && rec.stop(), 150)
      }
      setTimeout(tick, 33)
    }
    tick()
  })
}

/** One profile picture as a clip of `durationMs`. A moving (GIF) banner or avatar keeps moving in the video. */
export async function recordScene(scene: Scene, durationMs: number, onProgress: (p: number) => void, signal: { cancelled: boolean }): Promise<VideoResult> {
  try {
    const mp4 = await encodeMp4(scene, durationMs, onProgress, signal)
    if (mp4) return mp4
  } catch (e) {
    if (signal.cancelled || (e instanceof Error && e.message === "cancelled")) throw e instanceof Error ? e : new Error("cancelled")
    /* the encoder failed: use the live recorder instead */
  }
  return recordLive(scene, durationMs, onProgress, signal)
}
