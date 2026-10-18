// A square picture of "I'm going to Lisbon in May" to share on WhatsApp or
// Facebook (Lewis, 13 Oct: free word of mouth). Drawn in brand colours.
import data from '../../brand.json'
import { brand } from './brand'
import { PRIMARY_LOGO } from './logo'
import { monthName } from './dates'

const C = data.colors.light
const SIZE = 1080

/** The words that go with the picture. */
export function shareText(city: string, start: string): string {
  return `I’m going to ${city} in ${monthName(start)}. I’m on ${brand.name}, where people find friends to travel with: ${brand.appUrl}`
}

/** Fits a line to the width by shrinking it from `size`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number): number {
  for (; size > 40; size -= 4) {
    ctx.font = `${weight} ${size}px Figtree, system-ui, sans-serif`
    if (ctx.measureText(text).width <= max) break
  }
  return size
}

export async function drawTripCard(city: string, start: string): Promise<Blob> {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const year = start.slice(0, 4)

  // Burgundy, a little deeper at the bottom, with a fine gold frame.
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE)
  bg.addColorStop(0, C.accent)
  bg.addColorStop(1, C.accentDeep)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.strokeStyle = C.brandGold
  ctx.lineWidth = 4
  ctx.strokeRect(48, 48, SIZE - 96, SIZE - 96)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.onAccent
  ctx.font = '600 56px Figtree, system-ui, sans-serif'
  ctx.fillText('I’m going to', SIZE / 2, 380)
  ctx.fillStyle = C.brandGold
  fit(ctx, city, 800, 168, SIZE - 200)
  ctx.fillText(city, SIZE / 2, 560)
  ctx.fillStyle = C.onAccent
  ctx.font = '600 56px Figtree, system-ui, sans-serif'
  ctx.fillText(`in ${monthName(start)} ${year}`, SIZE / 2, 660)

  // The logo and tagline at the foot.
  const [vx, vy, vw, vh] = PRIMARY_LOGO.viewBox.split(' ').map(Number)
  const logoH = 150
  const scale = logoH / vh
  ctx.save()
  ctx.translate(SIZE / 2 - (vw * scale) / 2 - vx * scale, 735 - vy * scale)
  ctx.scale(scale, scale)
  ctx.fillStyle = C.onAccent
  ctx.fill(new Path2D(PRIMARY_LOGO.d))
  ctx.restore()
  ctx.fillStyle = C.onAccent
  ctx.font = '500 34px Figtree, system-ui, sans-serif'
  ctx.globalAlpha = 0.85
  ctx.fillText(brand.tagline, SIZE / 2, 950)
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('We couldn’t make the picture.'))), 'image/png'))
}
