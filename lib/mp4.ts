/**
 * A tiny MP4 writer for H.264 video (one track, no audio). The browser's video encoder gives us the encoded frames;
 * this puts them in a normal .mp4 whose length is exactly frames / fps, so a gallery shows the real duration.
 */

export type Mp4Sample = { data: Uint8Array; key: boolean }

type Part = Uint8Array | number[]

const u16 = (n: number) => [(n >> 8) & 255, n & 255]
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const str = (s: string) => Array.from(s, (c) => c.charCodeAt(0))

function concat(parts: Part[]): Uint8Array {
  let n = 0
  for (const p of parts) n += p.length
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const box = (type: string, ...payload: Part[]) => {
  const body = concat(payload)
  return concat([u32(8 + body.length), str(type), body])
}
const fullBox = (type: string, version: number, flags: number, ...payload: Part[]) => box(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...payload)

const MATRIX = [...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)]

/** `avcC`: the H.264 decoder configuration from the encoder. `fps` must be a whole number. */
export function muxMp4(o: { width: number; height: number; fps: number; avcC: Uint8Array; samples: Mp4Sample[] }): Uint8Array {
  const { width, height, fps, avcC, samples } = o
  const n = samples.length
  const TS = fps * 1000 // media timescale: one frame lasts exactly 1000 ticks
  const mediaDur = n * 1000
  const movieDur = Math.round((n * 1000) / fps) // movie timescale is 1000 (ms)

  const ftyp = box("ftyp", str("isom"), u32(512), str("isom"), str("iso2"), str("avc1"), str("mp41"))

  const build = (chunkOffset: number) => {
    const mvhd = fullBox("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(movieDur), u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0), MATRIX, new Array(24).fill(0), u32(2))
    const tkhd = fullBox("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(movieDur), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width << 16), u32(height << 16))
    const mdhd = fullBox("mdhd", 0, 0, u32(0), u32(0), u32(TS), u32(mediaDur), u16(0x55c4), u16(0))
    const hdlr = fullBox("hdlr", 0, 0, u32(0), str("vide"), u32(0), u32(0), u32(0), str("VideoHandler"), [0])
    const vmhd = fullBox("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0))
    const dinf = box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1)))
    const avc1 = box(
      "avc1",
      new Array(6).fill(0),
      u16(1),
      u16(0),
      u16(0),
      u32(0),
      u32(0),
      u32(0),
      u16(width),
      u16(height),
      u32(0x00480000),
      u32(0x00480000),
      u32(0),
      u16(1),
      new Array(32).fill(0),
      u16(0x0018),
      u16(0xffff),
      box("avcC", avcC)
    )
    const stsd = fullBox("stsd", 0, 0, u32(1), avc1)
    const stts = fullBox("stts", 0, 0, u32(1), u32(n), u32(1000))
    const keys: number[] = []
    samples.forEach((s, i) => s.key && keys.push(i + 1))
    const stss = fullBox("stss", 0, 0, u32(keys.length), ...keys.map(u32))
    const stsc = fullBox("stsc", 0, 0, u32(1), u32(1), u32(n), u32(1))
    const stsz = fullBox("stsz", 0, 0, u32(0), u32(n), ...samples.map((s) => u32(s.data.length)))
    const stco = fullBox("stco", 0, 0, u32(1), u32(chunkOffset))
    const stbl = box("stbl", stsd, stts, stss, stsc, stsz, stco)
    const minf = box("minf", vmhd, dinf, stbl)
    const mdia = box("mdia", mdhd, hdlr, minf)
    return box("moov", mvhd, box("trak", tkhd, mdia))
  }

  const probe = build(0)
  const moov = build(ftyp.length + probe.length + 8)
  let total = 0
  for (const s of samples) total += s.data.length
  return concat([ftyp, moov, u32(8 + total), str("mdat"), ...samples.map((s) => s.data)])
}
