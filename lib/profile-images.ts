"use client"

import { getSupabase } from "@/lib/supabase/client"

const BUCKET = "profiles"
export const MAX_BYTES = 8 * 1024 * 1024
export const ACCEPT = "image/png,image/jpeg,image/webp,image/gif"

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }

function check(file: File) {
  if (!EXT[file.type]) throw new Error("Use a PNG, JPG, WebP or GIF image.")
  if (file.size > MAX_BYTES) throw new Error("Images can be up to 8 MB.")
}

/** Uploads to the viewer's own folder and returns the public address. */
export async function uploadProfileImage(userId: string, file: File, kind: "avatar" | "banner"): Promise<string> {
  check(file)
  const supabase = getSupabase()
  const path = `${userId}/${kind}-${Date.now()}.${EXT[file.type]}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
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
