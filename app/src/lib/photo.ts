import { friendlyError, FriendlyError } from './errors'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'profile-photos'
const MAX_SIDE = 1024
const MAX_INPUT_BYTES = 20 * 1024 * 1024

/**
 * Crops the photo to a centred 3:4 portrait, redraws it onto a canvas and saves
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
    throw new FriendlyError('We couldn’t open that photo. Please try a different one.')
  }
  // A centred 3:4 portrait (Lewis, 5 Oct), so faces sit in the middle of the
  // tall match card; round photos show its centre.
  const width = Math.min(bitmap.width, (bitmap.height * 3) / 4)
  const height = (width * 4) / 3
  const scale = Math.min(1, MAX_SIDE / height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - width) / 2, (bitmap.height - height) / 2, width, height, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new FriendlyError('We couldn’t open that photo. Please try a different one.')
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
