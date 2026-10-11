import { usePhotoUrl } from '../lib/photo'

/** A member's photo through a short-lived link, or their first initial. */
export function Avatar({ name, path, size = 'md' }: { name: string; path: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const src = usePhotoUrl(path)
  const className = `avatar avatar-${size}`
  if (src) return <img className={className} src={src} alt="" decoding="async" />
  return (
    <div className={`${className} avatar-empty`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}
