"use client"

import { getSupabase } from "@/lib/supabase/client"

const BUCKET = "profiles"
export const MAX_BYTES = 8 * 1024 * 1024
export const ACCEPT = "image/png,image/jpeg,image/webp,image/gif"

const load = (file: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That image could not be read."))
    }
    img.src = url
  })

/** Squares (avatar) are center-cropped, banners keep their shape. Both are shrunk. GIFs are kept so they stay animated. */
async function prepare(file: File, kind: "avatar" | "banner"): Promise<{ blob: Blob; ext: string }> {
  if (!ACCEPT.split(",").includes(file.type)) throw new Error("Use a PNG, JPG, WebP or GIF image.")
  if (file.type === "image/gif") {
    if (file.size > MAX_BYTES) throw new Error("GIFs can be up to 8 MB.")
    return { blob: file, ext: "gif" }
  }
  const img = await load(file)
  const out = kind === "avatar" ? { w: 512, h: 512 } : { w: 1500, h: 500 }
  // Cover-crop to the target ratio, never upscale beyond the source.
  const ratio = out.w / out.h
  let sw = img.width
  let sh = img.height
  if (sw / sh > ratio) sw = sh * ratio
  else sh = sw / ratio
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  const scale = Math.min(1, out.w / sw)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9))
  if (!blob) throw new Error("That image could not be processed.")
  return { blob, ext: "webp" }
}

/** Uploads to the viewer's own folder and returns the public address. */
export async function uploadProfileImage(userId: string, file: File, kind: "avatar" | "banner"): Promise<string> {
  const { blob, ext } = await prepare(file, kind)
  const supabase = getSupabase()
  const path = `${userId}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || `image/${ext}`,
    cacheControl: "31536000",
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best effort: deletes our own old image once it has been replaced. */
export async function deleteProfileImage(url: string | null | undefined) {
  if (!url) return
  const marker = `/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return
  try {
    await getSupabase().storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marker.length).split("?")[0])])
  } catch {
    /* the file may already be gone */
  }
}
