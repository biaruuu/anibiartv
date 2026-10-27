"use client"

/** Turns profile pictures into a short vertical video, or records this screen, all in the browser. */

export type VideoResult = { blob: Blob; mime: string; ext: "mp4" | "webm" }

export function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const list = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  return list.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
}

export const canMakeVideo = () =>
  typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"

export const canRecordScreen = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function" && typeof MediaRecorder !== "undefined"

const finish = (chunks: Blob[], mime: string): VideoResult => {
  const type = (mime || chunks[0]?.type || "video/webm").split(";")[0]
  return { blob: new Blob(chunks, { type }), mime: type, ext: type.includes("mp4") ? "mp4" : "webm" }
}

const HOLD = 2300 // how long each tab stays on screen
const FADE = 500 // crossfade into the next tab

/** Plays the given profile pictures one after another (slow zoom + crossfade) and records it as a video. */
export function makeSlideVideo(frames: HTMLCanvasElement[], onProgress: (p: number) => void, signal: { cancelled: boolean }): Promise<VideoResult> {
  return new Promise((resolve, reject) => {
    const first = frames[0]
    if (!first) return reject(new Error("Nothing to record."))
    const W = 720
    const H = Math.round((W * first.height) / first.width / 2) * 2
    const c = document.createElement("canvas")
    c.width = W
    c.height = H
    const ctx = c.getContext("2d")!
    const mime = pickVideoMime()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(c.captureStream(30), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 4_000_000 })
    } catch (e) {
      return reject(e)
    }
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onerror = () => reject(new Error("Recording failed."))
    rec.onstop = () => (signal.cancelled ? reject(new Error("cancelled")) : resolve(finish(chunks, mime)))

    const n = frames.length
    const total = n * HOLD
    const drawOne = (f: HTMLCanvasElement, progress: number, alpha: number) => {
      const z = 1 + 0.03 * progress
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(W / 2, H / 2)
      ctx.scale(z, z)
      ctx.drawImage(f, -W / 2, -H / 2, W, H)
      ctx.restore()
    }
    const draw = (t: number) => {
      const i = Math.min(n - 1, Math.floor(t / HOLD))
      const local = t - i * HOLD
      ctx.fillStyle = "#121113"
      ctx.fillRect(0, 0, W, H)
      drawOne(frames[i], local / HOLD, 1)
      if (i < n - 1 && local > HOLD - FADE) drawOne(frames[i + 1], 0, (local - (HOLD - FADE)) / FADE)
    }

    draw(0)
    rec.start(250)
    const t0 = performance.now()
    const tick = () => {
      if (signal.cancelled) return rec.state !== "inactive" ? rec.stop() : undefined
      const t = performance.now() - t0
      draw(Math.min(t, total - 1))
      onProgress(Math.min(1, t / total))
      if (t >= total) return rec.stop()
      setTimeout(tick, 33)
    }
    tick()
  })
}

/** Records the screen with the browser's own screen-capture picker (desktop browsers). */
export async function startScreenRecording(onEnded: (r: VideoResult) => void, onFail: () => void) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
  const mime = pickVideoMime()
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.onerror = onFail
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop())
    if (chunks.length) onEnded(finish(chunks, mime))
    else onFail()
  }
  stream.getVideoTracks()[0]?.addEventListener("ended", () => rec.state !== "inactive" && rec.stop())
  rec.start(500)
  return () => rec.state !== "inactive" && rec.stop()
}
