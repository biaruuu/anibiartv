"use client"

/** Records the profile as a short vertical clip in the browser (a long list scrolls down, GIFs keep moving). */

export type VideoResult = { blob: Blob; mime: string; ext: "mp4" | "webm" }

export function pickVideoMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const list = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  return list.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
}

export const canMakeVideo = () =>
  typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"

const finish = (chunks: Blob[], mime: string): VideoResult => {
  const type = (mime || chunks[0]?.type || "video/webm").split(";")[0]
  return { blob: new Blob(chunks, { type }), mime: type, ext: type.includes("mp4") ? "mp4" : "webm" }
}

/** Records one profile picture for `durationMs`. A moving (GIF) banner or avatar keeps moving in the video. */
export function recordScene(
  scene: { canvas: HTMLCanvasElement; viewH: number; draw: (t: number) => void },
  durationMs: number,
  onProgress: (p: number) => void,
  signal: { cancelled: boolean }
): Promise<VideoResult> {
  return new Promise((resolve, reject) => {
    const src = scene.canvas
    const W = 720
    const H = Math.round((W * scene.viewH) / src.width / 2) * 2
    const c = document.createElement("canvas")
    c.width = W
    c.height = H
    const ctx = c.getContext("2d")!
    const mime = pickVideoMime()
    let rec: MediaRecorder
    // Frames are pushed by hand (requestFrame) so a still picture is recorded for the whole length too:
    // a canvas that does not change would otherwise give the recorder no frames and the clip ends after a few seconds.
    const stream = c.captureStream(0)
    const track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined
    const manual = typeof track?.requestFrame === "function"
    try {
      rec = new MediaRecorder(manual ? stream : c.captureStream(30), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 4_000_000 })
    } catch (e) {
      return reject(e)
    }
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onerror = () => reject(new Error("Recording failed."))
    rec.onstop = () => (signal.cancelled ? reject(new Error("cancelled")) : resolve(finish(chunks, mime)))

    // The page scrolls like a screen recording: rest at the top, glide down through everything, rest at the end.
    const maxScroll = Math.max(0, src.height - scene.viewH)
    const rest = Math.min(1500, durationMs / 5)
    const scrollY = (t: number) => {
      if (!maxScroll) return 0
      const k = Math.min(1, Math.max(0, (t - rest) / Math.max(1, durationMs - rest * 2)))
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      return Math.round(e * maxScroll)
    }
    let n = 0
    const paint = (t: number) => {
      scene.draw(t)
      ctx.drawImage(src, 0, scrollY(t), src.width, scene.viewH, 0, 0, W, H)
      // one almost invisible pixel that changes every frame, so every frame counts as new
      ctx.fillStyle = n++ % 2 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"
      ctx.fillRect(W - 2, H - 2, 2, 2)
      if (manual) track!.requestFrame!()
    }
    paint(0)
    rec.start(1000)
    const t0 = performance.now()
    const tick = () => {
      if (signal.cancelled) return rec.state !== "inactive" ? rec.stop() : undefined
      const t = performance.now() - t0
      paint(Math.min(t, durationMs))
      onProgress(Math.min(1, t / durationMs))
      if (t >= durationMs) {
        // hold the last frame a moment so the clip really lasts the full length
        paint(durationMs)
        return void setTimeout(() => rec.state !== "inactive" && rec.stop(), 150)
      }
      setTimeout(tick, 33)
    }
    tick()
  })
}
