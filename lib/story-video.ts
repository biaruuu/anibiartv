"use client"

/** Records the profile picture as a short vertical video, or records this screen, all in the browser. */

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

/** Records one profile picture for `durationMs`. A moving (GIF) banner or avatar keeps moving in the video. */
export function recordScene(
  scene: { canvas: HTMLCanvasElement; draw: (t: number) => void },
  durationMs: number,
  onProgress: (p: number) => void,
  signal: { cancelled: boolean }
): Promise<VideoResult> {
  return new Promise((resolve, reject) => {
    const src = scene.canvas
    const W = 720
    const H = Math.round((W * src.height) / src.width / 2) * 2
    const c = document.createElement("canvas")
    c.width = W
    c.height = H
    const ctx = c.getContext("2d")!
    const mime = pickVideoMime()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(c.captureStream(30), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 5_000_000 })
    } catch (e) {
      return reject(e)
    }
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onerror = () => reject(new Error("Recording failed."))
    rec.onstop = () => (signal.cancelled ? reject(new Error("cancelled")) : resolve(finish(chunks, mime)))

    const paint = (t: number) => {
      scene.draw(t)
      ctx.drawImage(src, 0, 0, W, H)
    }
    paint(0)
    rec.start(250)
    const t0 = performance.now()
    const tick = () => {
      if (signal.cancelled) return rec.state !== "inactive" ? rec.stop() : undefined
      const t = performance.now() - t0
      paint(Math.min(t, durationMs))
      onProgress(Math.min(1, t / durationMs))
      if (t >= durationMs) return rec.stop()
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
