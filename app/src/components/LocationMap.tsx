import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { MAX_ZOOM, MIN_ZOOM, TILE, metresPerPixel, project, unproject, zoomFor, type Point } from '../lib/map'

const TILES = 'https://tile.openstreetmap.org'

type Props = {
  center: Point
  /** How close in to start (otherwise from `km`, or street level). */
  zoom?: number
  /** The town name shown above the dot. */
  label?: string
  /** Draws how far the member will go around the dot. */
  km?: number | null
  /** Lets the member drag the map or tap it to move the dot. */
  onMove?: (spot: Point) => void
  /** Shows the find-me button. */
  onLocate?: () => void
  locating?: boolean
}

/** A square map with the member's spot in the middle, like Hinge (Lewis,
 *  11 Oct). Only the town name is ever shown to other members. */
export function LocationMap({ center, zoom: startZoom, label, km, onMove, onLocate, locating }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(320)
  const [ownZoom, setOwnZoom] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const watch = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width) || 320))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const metres = km === undefined ? null : km === null ? null : Math.max(km, 2) * 1000
  const zoom = ownZoom ?? startZoom ?? (km === undefined ? 12 : metres === null ? 5 : zoomFor(center.lat, metres, size * 0.42))
  const mid = project(center, zoom)
  const cx = mid.x - (drag?.dx ?? 0)
  const cy = mid.y - (drag?.dy ?? 0)
  const count = 2 ** zoom
  const tiles: { tx: number; ty: number }[] = []
  for (let tx = Math.floor((cx - size / 2) / TILE); tx <= Math.floor((cx + size / 2) / TILE); tx++) {
    for (let ty = Math.floor((cy - size / 2) / TILE); ty <= Math.floor((cy + size / 2) / TILE); ty++) {
      if (ty >= 0 && ty < count) tiles.push({ tx, ty })
    }
  }
  const circle = metres === null ? null : metres / metresPerPixel(center.lat, zoom)

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!onMove || (e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 })
  }
  const move = (e: PointerEvent<HTMLDivElement>) => drag && setDrag({ ...drag, dx: e.clientX - drag.x, dy: e.clientY - drag.y })
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || !onMove) return
    setDrag(null)
    if (Math.hypot(drag.dx, drag.dy) > 6) return onMove(unproject(cx, cy, zoom))
    // A tap moves the dot to where they tapped.
    const rect = e.currentTarget.getBoundingClientRect()
    onMove(unproject(mid.x + e.clientX - rect.left - size / 2, mid.y + e.clientY - rect.top - size / 2, zoom))
  }
  const zoomBy = (by: number) => setOwnZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + by)))

  return (
    <figure className={`location-map${onMove ? ' is-movable' : ''}`} aria-label={label ? `Map around ${label}` : 'Map'}>
      <div ref={box} className="location-map-tiles" style={{ height: size }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
        {tiles.map(({ tx, ty }) => (
          <img
            key={`${zoom}-${tx}-${ty}`}
            src={`${TILES}/${zoom}/${((tx % count) + count) % count}/${ty}.png`}
            alt=""
            draggable={false}
            decoding="async"
            style={{ left: Math.round(tx * TILE - cx + size / 2), top: Math.round(ty * TILE - cy + size / 2) }}
          />
        ))}
        {circle !== null && <span className="location-map-circle" style={{ width: circle * 2, height: circle * 2 }} />}
        <span className="location-map-dot" />
        {label && <span className="location-map-label">{label}</span>}
        {onLocate && (
          <button type="button" className="location-map-btn location-map-find" onClick={onLocate} disabled={locating} aria-label={locating ? 'Finding you…' : 'Use my location'}>
            <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true" focusable="false">
              <circle cx="10" cy="10" r="2.5" fill="currentColor" />
              <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        )}
        {onMove && (
          <div className="location-map-zoom">
            <button type="button" className="location-map-btn" onClick={() => zoomBy(1)} aria-label="Zoom in" disabled={zoom >= MAX_ZOOM}>
              +
            </button>
            <button type="button" className="location-map-btn" onClick={() => zoomBy(-1)} aria-label="Zoom out" disabled={zoom <= MIN_ZOOM}>
              −
            </button>
          </div>
        )}
        <small className="location-map-credit">© OpenStreetMap</small>
      </div>
    </figure>
  )
}
