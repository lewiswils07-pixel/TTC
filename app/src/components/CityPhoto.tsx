import { sized, useCityPhoto } from '../lib/cityPhotos'

/** A city's photo filling its box, over the branded art while it loads or when there's none. With `credit`, the photographer's name (Unsplash asks for it). */
/** `code` shows the first three letters (LIS) in gold under the photo, so a missing photo still looks finished (Claude Design, 15 Oct). */
export function CityPhoto({ city, width = 400, credit = false, code = false, className = '' }: { city: string; width?: number; credit?: boolean; code?: boolean; className?: string }) {
  const photo = useCityPhoto(city)
  return (
    <span className={`city-photo ${className}`} style={photo?.color ? { backgroundColor: photo.color } : undefined}>
      {code && (
        <span className="city-code" aria-hidden="true">
          {city.slice(0, 3).toUpperCase()}
        </span>
      )}
      {photo && <img src={sized(photo, width)} alt="" loading="lazy" onLoad={(e) => e.currentTarget.classList.add('is-loaded')} />}
      {photo && credit && (
        <span className="city-photo-credit">
          Photo by{' '}
          <a href={photo.authorUrl} target="_blank" rel="noreferrer">
            {photo.author}
          </a>{' '}
          on{' '}
          <a href={photo.link} target="_blank" rel="noreferrer">
            Unsplash
          </a>
        </span>
      )}
    </span>
  )
}
