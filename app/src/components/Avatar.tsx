import { usePhotoUrl } from '../lib/photo'

/** A member's photo through a short-lived link, or their first initial. `square` is the rounded-square photo of the Chat screens (Claude Design, 16 Oct). */
export function Avatar({ name, path, size = 'md', square = false }: { name: string; path: string | null; size?: 'sm' | 'md' | 'lg'; square?: boolean }) {
  const src = usePhotoUrl(path)
  const className = `avatar avatar-${size}${square ? ' avatar-square' : ''}`
  if (src) return <img className={className} src={src} alt="" decoding="async" />
  return (
    <div className={`${className} avatar-empty`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}
