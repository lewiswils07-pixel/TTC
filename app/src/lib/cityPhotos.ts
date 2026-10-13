import { useEffect, useState } from 'react'

/** Unsplash "Access Key": public by design (it is sent from every browser). Lewis's app, 13 Oct. */
const UNSPLASH_KEY = '8CWZhEKyowOoLx59SBUTjaba30tgTsperzkOf3XTkJ4'
const APP = 'sodalis_collective'
/** Kept for a month: the free plan allows 50 searches an hour across all members. */
const KEEP_MS = 30 * 24 * 3600 * 1000

export type CityPhoto = { url: string; author: string; authorUrl: string; link: string; color: string | null }

const withUtm = (url: string) => `${url}${url.includes('?') ? '&' : '?'}utm_source=${APP}&utm_medium=referral`
const key = (city: string) => `sodalis.cityPhoto.${city.toLowerCase()}`
const pending = new Map<string, Promise<CityPhoto | null>>()

function cached(city: string): CityPhoto | null | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(key(city)) ?? 'null') as { at: number; photo: CityPhoto | null } | null
    if (saved && Date.now() - saved.at < KEEP_MS) return saved.photo
  } catch {
    // Private mode or bad data: ask again.
  }
  return undefined
}

/** A landscape photo of a city from Unsplash, or null when there's none or the hourly limit is reached (the branded art shows instead). */
export function cityPhoto(city: string): Promise<CityPhoto | null> {
  const saved = cached(city)
  if (saved !== undefined) return Promise.resolve(saved)
  // Automated test browsers would use up the hourly allowance.
  if (navigator.webdriver) return Promise.resolve(null)
  const running = pending.get(city)
  if (running) return running
  const query = new URLSearchParams({ query: `${city} city`, per_page: '1', orientation: 'landscape', content_filter: 'high' })
  const job = fetch(`https://api.unsplash.com/search/photos?${query}`, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } })
    .then(async (res) => {
      if (!res.ok) return null
      const hit = (await res.json()).results?.[0]
      const photo: CityPhoto | null = hit
        ? { url: hit.urls.raw, author: hit.user.name, authorUrl: withUtm(hit.user.links.html), link: withUtm('https://unsplash.com'), color: hit.color ?? null }
        : null
      try {
        localStorage.setItem(key(city), JSON.stringify({ at: Date.now(), photo }))
      } catch {
        // Not saved: fine, it is asked for again next time.
      }
      // Unsplash asks apps to count each photo they show.
      if (hit?.links?.download_location) void fetch(hit.links.download_location, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }).catch(() => {})
      return photo
    })
    .catch(() => null)
    .finally(() => pending.delete(city))
  pending.set(city, job)
  return job
}

/** The photo sized for where it's shown (Unsplash crops and compresses it for us). */
export const sized = (photo: CityPhoto, width: number) => `${photo.url}&w=${width}&dpr=2&q=60&auto=format&fit=crop`

export function useCityPhoto(city: string | null | undefined): CityPhoto | null {
  const [photo, setPhoto] = useState<{ city: string; photo: CityPhoto | null } | null>(() => (city ? { city, photo: cached(city) ?? null } : null))
  useEffect(() => {
    if (!city) return
    let live = true
    cityPhoto(city).then((p) => live && setPhoto({ city, photo: p }))
    return () => {
      live = false
    }
  }, [city])
  return photo && photo.city === city ? photo.photo : null
}
