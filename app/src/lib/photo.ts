import { useEffect, useState } from 'react'
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

// Photo links (Lewis, 11 Oct: photos were slow to load). Each link lasts
// LINK_HOURS and is reused until it's nearly expired, so the same photo keeps
// the same address and the browser shows it from its cache. Photos asked for
// together go to the server in one request. Links are kept for the tab's
// session, so a reload doesn't fetch them again.
const LINK_HOURS = 6
const REUSE_MS = (LINK_HOURS - 1) * 60 * 60 * 1000
const STORE = 'sodalis-photo-links'
type Link = { url: string; at: number }
const links = new Map<string, Link>(readStore())
const waiting = new Map<string, ((url: string | null) => void)[]>()
let flush: ReturnType<typeof setTimeout> | null = null

function readStore(): [string, Link][] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as [string, Link][]
    return saved.filter(([, l]) => Date.now() - l.at < REUSE_MS)
  } catch {
    return []
  }
}

function writeStore() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify([...links]))
  } catch {
    // Private browsing or full storage: the links still work for this page.
  }
}

/** A photo's link if we already have a fresh one, without waiting. */
export function cachedPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const link = links.get(path)
  return link && Date.now() - link.at < REUSE_MS ? link.url : null
}

async function fetchWaiting() {
  flush = null
  const batch = new Map(waiting)
  waiting.clear()
  const paths = [...batch.keys()]
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, LINK_HOURS * 60 * 60)
  const at = Date.now()
  for (const path of paths) {
    const url = data?.find((d) => d.path === path)?.signedUrl ?? null
    if (url) links.set(path, { url, at })
    for (const done of batch.get(path) ?? []) done(url)
  }
  writeStore()
}

/** A link to show a private photo, reused while it's fresh. */
export function photoUrl(path: string): Promise<string | null> {
  const ready = cachedPhotoUrl(path)
  if (ready) return Promise.resolve(ready)
  return new Promise((resolve) => {
    waiting.set(path, [...(waiting.get(path) ?? []), resolve])
    flush ??= setTimeout(() => void fetchWaiting().catch(() => undefined), 10)
  })
}

/** Starts loading photos we'll show soon (the next cards), so they appear at once. */
export function preloadPhotos(paths: (string | null | undefined)[]) {
  for (const path of paths) {
    if (!path) continue
    void photoUrl(path).then((url) => {
      if (url) new Image().src = url
    })
  }
}

/** The link for a photo, filled straight away when we already have it. */
export function usePhotoUrl(path: string | null | undefined): string | null {
  const [state, setState] = useState<{ path: string | null | undefined; url: string | null }>(() => ({ path, url: cachedPhotoUrl(path) }))
  useEffect(() => {
    if (!path || cachedPhotoUrl(path)) return
    let live = true
    photoUrl(path).then(
      (url) => live && setState({ path, url }),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [path])
  return cachedPhotoUrl(path) ?? (state.path === path ? state.url : null)
}

/** Adds a photo to the member's photo book (Lewis, 11 Oct: several photos, of
 *  them or their trips). Returns the new list. */
export async function addBookPhoto(userId: string, photo: Blob, book: string[]): Promise<string[]> {
  const path = `${userId}/book-${Date.now()}.jpg`
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: 'image/jpeg' })
  if (upload.error) throw friendlyError(upload.error)
  const next = [...book, path]
  const { error } = await supabase.from('profiles').update({ photo_book: next }).eq('id', userId)
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path])
    throw friendlyError(error)
  }
  return next
}

/** Takes a photo out of the photo book and deletes it. Returns the new list. */
export async function removeBookPhoto(userId: string, path: string, book: string[]): Promise<string[]> {
  const next = book.filter((p) => p !== path)
  const { error } = await supabase.from('profiles').update({ photo_book: next }).eq('id', userId)
  if (error) throw friendlyError(error)
  await supabase.storage.from(PHOTO_BUCKET).remove([path])
  return next
}
