// A square picture of "I'm going to Lisbon in May" to share on WhatsApp or
// Facebook (Lewis, 13 Oct: free word of mouth). Drawn in brand colours.
import data from '../../brand.json'
import { brand } from './brand'
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

  // The monogram and name at the foot.
  const y = 860
  ctx.beginPath()
  ctx.arc(SIZE / 2, y - 70, 44, 0, Math.PI * 2)
  ctx.fillStyle = C.brandDisc
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = C.brandGold
  ctx.stroke()
  ctx.fillStyle = C.brandGold
  ctx.font = '800 52px Figtree, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(brand.name.slice(0, 1), SIZE / 2, y - 68)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.onAccent
  ctx.font = '700 44px Figtree, system-ui, sans-serif'
  ctx.fillText(brand.name, SIZE / 2, y + 30)
  ctx.font = '500 34px Figtree, system-ui, sans-serif'
  ctx.globalAlpha = 0.85
  ctx.fillText(brand.tagline, SIZE / 2, y + 84)
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('We couldn’t make the picture.'))), 'image/png'))
}
