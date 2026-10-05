import { friendlyError, FriendlyError } from './errors'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'profile-photos'
const MAX_SIDE = 1024
const MAX_INPUT_BYTES = 20 * 1024 * 1024

/**
 * Crops the photo to a centred square, redraws it onto a canvas and saves
 * it as a new JPEG. Only the
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
  // A centred square, so faces sit in the middle of the round photo.
  const side = Math.min(bitmap.width, bitmap.height)
  const out = Math.min(side, MAX_SIDE)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
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
