// The maths for the small maps (Web Mercator, the same as every tile map).
export const TILE = 256
export const MIN_ZOOM = 3
export const MAX_ZOOM = 15

export type Point = { lat: number; lng: number }

const world = (zoom: number) => TILE * 2 ** zoom

/** Where a place sits on the map at this zoom, in pixels from the top left of the world. */
export function project({ lat, lng }: Point, zoom: number): { x: number; y: number } {
  const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)))
  return { x: ((lng + 180) / 360) * world(zoom), y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world(zoom) }
}

/** The place at a pixel: the reverse of project. */
export function unproject(x: number, y: number, zoom: number): Point {
  const lng = (x / world(zoom)) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / world(zoom))) * 180) / Math.PI
  return { lat: Math.max(-85, Math.min(85, lat)), lng: ((((lng + 180) % 360) + 360) % 360) - 180 }
}

export const metresPerPixel = (lat: number, zoom: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom

/** The closest zoom at which `metres` takes up about `pixels` on screen. */
export function zoomFor(lat: number, metres: number, pixels: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180) * pixels) / metres))))
}
