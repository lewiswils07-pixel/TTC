import { friendlyError, FriendlyError } from './errors'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'profile-photos'
const MAX_SIDE = 1024
const MAX_INPUT_BYTES = 20 * 1024 * 1024

/**
 * Redraws the photo onto a canvas and saves it as a new JPEG. Only the
 * pixels survive, so location and camera details (EXIF) are removed before
 * the file ever leaves the phone. The phone's rotation is applied first.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new FriendlyError('Please choose a photo.')
  if (file.size > MAX_INPUT_BYTES) throw new FriendlyError('That photo is too big. Please choose a smaller one.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new FriendlyError("We couldn't open that photo. Please try a different one.")
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new FriendlyError("We couldn't open that photo. Please try a different one.")
  return blob
}

/** Uploads to the member's own private folder and points their profile at it. */
export async function uploadPhoto(userId: string, photo: Blob, previousPath: string | null): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: 'image/jpeg' })
  if (upload.error) throw friendlyError(upload.error)
  const { error } = await supabase.from('profiles').update({ photo_path: path }).eq('id', userId)
  if (error) throw friendlyError(error)
  if (previousPath) await supabase.storage.from(PHOTO_BUCKET).remove([previousPath])
  return path
}

/** A short-lived link to show a private photo. */
export async function photoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}
