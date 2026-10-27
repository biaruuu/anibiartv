"use client"

/** Small GIF decoder so animated banners and avatars can be drawn frame by frame onto a canvas. */

export type GifFrames = { width: number; height: number; frames: { canvas: HTMLCanvasElement; delay: number }[]; total: number }

function lzw(minCode: number, data: Uint8Array, total: number): Uint8Array {
  const clear = 1 << minCode
  const eoi = clear + 1
  let next = eoi + 1
  let size = minCode + 1
  let mask = (1 << size) - 1
  const prefix = new Uint16Array(4096)
  const suffix = new Uint8Array(4096)
  const stack = new Uint8Array(4097)
  for (let i = 0; i < clear; i++) suffix[i] = i
  const out = new Uint8Array(total)
  let o = 0
  let bits = 0
  let datum = 0
  let pos = 0
  let prev = -1
  let first = 0
  while (o < total) {
    while (bits < size) {
      if (pos >= data.length) return out
      datum |= data[pos++] << bits
      bits += 8
    }
    let code = datum & mask
    datum >>= size
    bits -= size
    if (code === clear) {
      size = minCode + 1
      mask = (1 << size) - 1
      next = eoi + 1
      prev = -1
      continue
    }
    if (code === eoi) break
    if (prev === -1) {
      out[o++] = suffix[code]
      prev = code
      first = code
      continue
    }
    const inCode = code
    let sp = 0
    if (code >= next) {
      stack[sp++] = first
      code = prev
    }
    while (code >= clear) {
      stack[sp++] = suffix[code]
      code = prefix[code]
    }
    first = suffix[code]
    stack[sp++] = first
    if (next < 4096) {
      prefix[next] = prev
      suffix[next] = first
      next++
      if ((next & mask) === 0 && next < 4096) {
        size++
        mask = (1 << size) - 1
      }
    }
    prev = inCode
    while (sp > 0 && o < total) out[o++] = stack[--sp]
  }
  return out
}

export const isGif = (b: Uint8Array) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38

/** Decodes every frame (up to `maxMs` of animation) and scales them down to at most `maxW` pixels wide. */
export function decodeGif(bytes: Uint8Array, maxW: number, maxMs = 10000, maxFrames = 150): GifFrames | null {
  if (!isGif(bytes)) return null
  let p = 6
  const u16 = () => {
    const v = bytes[p] | (bytes[p + 1] << 8)
    p += 2
    return v
  }
  const W = u16()
  const H = u16()
  const flags = bytes[p++]
  p += 2 // background colour, aspect ratio
  if (!W || !H) return null
  let globalTable: Uint8Array | null = null
  if (flags & 0x80) {
    const n = 3 * (1 << ((flags & 7) + 1))
    globalTable = bytes.subarray(p, p + n)
    p += n
  }

  const scale = Math.min(1, maxW / W)
  const ow = Math.max(1, Math.round(W * scale))
  const oh = Math.max(1, Math.round(H * scale))
  const full = document.createElement("canvas")
  full.width = W
  full.height = H
  const fctx = full.getContext("2d", { willReadFrequently: true })!
  const frames: GifFrames["frames"] = []
  let total = 0

  let delay = 100
  let disposal = 0
  let trans = -1
  let lastDisposal = 0
  let lastRect = { x: 0, y: 0, w: 0, h: 0 }
  let saved: ImageData | null = null

  while (p < bytes.length) {
    const block = bytes[p++]
    if (block === 0x3b) break
    if (block === 0x21) {
      const label = bytes[p++]
      if (label === 0xf9) {
        const pk = bytes[p + 1]
        disposal = (pk >> 2) & 7
        delay = (bytes[p + 2] | (bytes[p + 3] << 8)) * 10
        if (delay < 20) delay = 100
        trans = pk & 1 ? bytes[p + 4] : -1
      }
      while (p < bytes.length) {
        const n = bytes[p++]
        if (!n) break
        p += n
      }
      continue
    }
    if (block !== 0x2c) break
    const x = u16()
    const y = u16()
    const w = u16()
    const h = u16()
    const pk = bytes[p++]
    let table = globalTable
    if (pk & 0x80) {
      const n = 3 * (1 << ((pk & 7) + 1))
      table = bytes.subarray(p, p + n)
      p += n
    }
    const minCode = bytes[p++]
    const chunks: Uint8Array[] = []
    let len = 0
    while (p < bytes.length) {
      const n = bytes[p++]
      if (!n) break
      chunks.push(bytes.subarray(p, p + n))
      len += n
      p += n
    }
    const data = new Uint8Array(len)
    let at = 0
    for (const c of chunks) {
      data.set(c, at)
      at += c.length
    }
    if (!table || !w || !h) continue
    let idx = lzw(minCode, data, w * h)
    if (pk & 0x40) {
      // interlaced rows
      const out = new Uint8Array(w * h)
      let row = 0
      for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
        for (let r = start; r < h; r += step) out.set(idx.subarray(row * w, (row + 1) * w), r * w)
        row = row + Math.ceil((h - start) / step)
      }
      idx = out
    }

    // undo the previous frame as its disposal method asks
    if (lastDisposal === 2) fctx.clearRect(lastRect.x, lastRect.y, lastRect.w, lastRect.h)
    else if (lastDisposal === 3 && saved) fctx.putImageData(saved, 0, 0)
    saved = disposal === 3 ? fctx.getImageData(0, 0, W, H) : null

    const patch = new ImageData(w, h)
    for (let i = 0; i < idx.length; i++) {
      const c = idx[i]
      const o = i * 4
      if (c === trans) {
        patch.data[o + 3] = 0
      } else {
        patch.data[o] = table[c * 3]
        patch.data[o + 1] = table[c * 3 + 1]
        patch.data[o + 2] = table[c * 3 + 2]
        patch.data[o + 3] = 255
      }
    }
    const tmp = document.createElement("canvas")
    tmp.width = w
    tmp.height = h
    tmp.getContext("2d")!.putImageData(patch, 0, 0)
    fctx.drawImage(tmp, x, y)

    const snap = document.createElement("canvas")
    snap.width = ow
    snap.height = oh
    snap.getContext("2d")!.drawImage(full, 0, 0, ow, oh)
    frames.push({ canvas: snap, delay })
    total += delay
    lastDisposal = disposal
    lastRect = { x, y, w, h }
    disposal = 0
    trans = -1
    if (total >= maxMs || frames.length >= maxFrames) break
  }
  return frames.length ? { width: ow, height: oh, frames, total } : null
}
