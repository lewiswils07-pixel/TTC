import { useEffect, useState } from 'react'
import { photoUrl } from '../lib/photo'

/** A member's photo through a short-lived link, or their first initial. */
export function Avatar({ name, path, size = 'md' }: { name: string; path: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (path) photoUrl(path).then(setSrc, () => undefined)
  }, [path])
  const className = `avatar avatar-${size}`
  if (src) return <img className={className} src={src} alt="" />
  return (
    <div className={`${className} avatar-empty`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}
