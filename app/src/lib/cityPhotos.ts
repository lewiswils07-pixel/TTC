import { useEffect, useState } from 'react'

/** Unsplash "Access Key": public by design (it is sent from every browser). Lewis's app, 13 Oct. */
const UNSPLASH_KEY = '8CWZhEKyowOoLx59SBUTjaba30tgTsperzkOf3XTkJ4'
const APP = 'sodalis_collective'
/** Kept for a month: Unsplash's limit is per hour across all members. */
const KEEP_MS = 30 * 24 * 3600 * 1000
/** A stand-in photo found while Unsplash was busy is kept for a day, then Unsplash is asked again. */
const BUSY_KEEP_MS = 24 * 3600 * 1000

export type CityPhoto = { url: string; author: string; authorUrl: string; link: string; color: string | null; source?: 'unsplash' | 'wikipedia' }

const regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' })
const countryName = (code?: string | null) => {
  if (!code) return null
  try {
    return regionNames.of(code) ?? null
  } catch {
    return null
  }
}

const withUtm = (url: string) => `${url}${url.includes('?') ? '&' : '?'}utm_source=${APP}&utm_medium=referral`
const placeKey = (city: string, country?: string | null) => `${city}|${country ?? ''}`.toLowerCase()
const key = (place: string) => `sodalis.cityPhoto.${place}`
const pending = new Map<string, Promise<CityPhoto | null>>()

function cached(place: string): CityPhoto | null | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(key(place)) ?? 'null') as { at: number; photo: CityPhoto | null; keep?: number } | null
    if (saved && Date.now() - saved.at < (saved.keep ?? KEEP_MS)) return saved.photo
  } catch {
    // Private mode or bad data: ask again.
  }
  return undefined
}

function save(place: string, photo: CityPhoto | null, keep = KEEP_MS) {
  try {
    localStorage.setItem(key(place), JSON.stringify({ at: Date.now(), photo, keep }))
  } catch {
    // Not saved: fine, it is asked for again next time.
  }
}

/** Unsplash's best landscape photo for "Hallstatt Austria". Undefined when Unsplash is busy (its hourly limit). */
async function fromUnsplash(city: string, country: string | null): Promise<CityPhoto | null | undefined> {
  const query = new URLSearchParams({ query: country ? `${city} ${country}` : city, per_page: '1', orientation: 'landscape', content_filter: 'high' })
  const res = await fetch(`https://api.unsplash.com/search/photos?${query}`, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } })
  if (!res.ok) return undefined
  const hit = (await res.json()).results?.[0]
  if (!hit) return null
  // Unsplash asks apps to count each photo they show.
  if (hit.links?.download_location) void fetch(hit.links.download_location, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }).catch(() => {})
  return { url: hit.urls.raw, author: hit.user.name, authorUrl: withUtm(hit.user.links.html), link: withUtm('https://unsplash.com'), color: hit.color ?? null, source: 'unsplash' }
}

/** Maps, flags and crests make poor trip photos. */
const NOT_A_VIEW = /\.svg|map|flag|coat|arms|wappen|blason|stemma|escudo|herb|locator|location|logo|seal/i

/** The photo on the place's Wikipedia page, for small towns Unsplash doesn't know (Lewis, 24 Oct).
 *  Tries "St Ives, Cornwall" and "Positano, Italy" before plain "Positano", skipping pages that list several places. */
async function fromWikipedia(city: string, region: string | null, country: string | null): Promise<CityPhoto | null> {
  const titles = [...new Set([region && `${city}, ${region}`, country && `${city}, ${country}`, city].filter((t): t is string => !!t))]
  const query = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    prop: 'pageimages|pageprops',
    piprop: 'thumbnail',
    pithumbsize: '1280',
    redirects: '1',
    format: 'json',
    origin: '*',
  })
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${query}`)
  if (!res.ok) return null
  const data = await res.json()
  const pages = Object.values(data.query?.pages ?? {}) as { title: string; thumbnail?: { source: string }; pageprops?: Record<string, string> }[]
  // Each asked-for title, after redirects, to its page.
  const redirect = new Map<string, string>([...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])].map((r: { from: string; to: string }) => [r.from, r.to]))
  const resolve = (t: string) => {
    let title = t
    for (let i = 0; i < 3 && redirect.has(title); i++) title = redirect.get(title)!
    return title
  }
  for (const t of titles) {
    const page = pages.find((p) => p.title === resolve(t))
    if (!page?.thumbnail || page.pageprops?.disambiguation !== undefined || NOT_A_VIEW.test(page.thumbnail.source)) continue
    return {
      url: page.thumbnail.source,
      author: 'Wikipedia',
      authorUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      link: 'https://en.wikipedia.org',
      color: null,
      source: 'wikipedia',
    }
  }
  return null
}

/** A landscape photo of a place: Unsplash first, then the place's Wikipedia photo. Null when there's neither (the branded art shows instead).
 *  `country` is the two-letter code; `region` the county or region, both to find the right place. */
export function cityPhoto(city: string, country?: string | null, region?: string | null): Promise<CityPhoto | null> {
  const place = placeKey(city, country)
  const saved = cached(place)
  if (saved !== undefined) return Promise.resolve(saved)
  // Automated test browsers would use up the hourly allowance.
  if (navigator.webdriver) return Promise.resolve(null)
  const running = pending.get(place)
  if (running) return running
  const name = countryName(country)
  const job = fromUnsplash(city, name)
    .catch(() => undefined)
    .then(async (photo) => {
      if (photo) {
        save(place, photo)
        return photo
      }
      const wiki = await fromWikipedia(city, region ?? null, name).catch(() => null)
      // Unsplash busy: keep the stand-in for a day only. Unsplash had nothing: keep what Wikipedia had for the month.
      save(place, wiki, photo === undefined ? BUSY_KEEP_MS : KEEP_MS)
      return wiki
    })
    .finally(() => pending.delete(place))
  pending.set(place, job)
  return job
}

/** Wikipedia's standard thumbnail widths. */
const WIKI_WIDTHS = [250, 500, 960, 1280]

/** The photo sized for where it's shown. Unsplash crops and compresses it for us; for Wikipedia we pick the nearest standard width. */
export function sized(photo: CityPhoto, width: number): string {
  if (photo.source !== 'wikipedia') return `${photo.url}&w=${width}&dpr=2&q=60&auto=format&fit=crop`
  const want = WIKI_WIDTHS.find((w) => w >= width * 2) ?? 1280
  return photo.url.replace(/\/(\d+)px-/, `/${want}px-`)
}

export function useCityPhoto(city: string | null | undefined, country?: string | null, region?: string | null): CityPhoto | null {
  const place = city ? placeKey(city, country) : null
  const [photo, setPhoto] = useState<{ place: string; photo: CityPhoto | null } | null>(() => (place ? { place, photo: cached(place) ?? null } : null))
  useEffect(() => {
    if (!city || !place) return
    let live = true
    cityPhoto(city, country, region).then((p) => live && setPhoto({ place, photo: p }))
    return () => {
      live = false
    }
  }, [city, country, region, place])
  return photo && photo.place === place ? photo.photo : null
}
