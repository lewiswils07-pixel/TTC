import { sized, useCityPhoto } from '../lib/cityPhotos'

/** A city's photo filling its box, over the branded art while it loads or when there's none. With `credit`, the photographer's name (Unsplash asks for it). */
export function CityPhoto({ city, width = 400, credit = false, className = '' }: { city: string; width?: number; credit?: boolean; className?: string }) {
  const photo = useCityPhoto(city)
  return (
    <span className={`city-photo ${className}`} style={photo?.color ? { backgroundColor: photo.color } : undefined}>
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
