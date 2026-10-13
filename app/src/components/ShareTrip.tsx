import { useState } from 'react'
import { drawTripCard, shareText } from '../lib/shareCard'

/** "Share my trip": a picture for WhatsApp or Facebook. Uses the phone's share menu, or saves the picture where that isn't there. */
export function ShareTrip({ city, start }: { city: string; start: string }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function share() {
    setBusy(true)
    setNote(null)
    try {
      const blob = await drawTripCard(city, start)
      const file = new File([blob], `${city.toLowerCase().replace(/[^a-z]+/g, '-')}-trip.png`, { type: 'image/png' })
      const text = shareText(city, start)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(file)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
        setNote('Picture saved. Add it to a WhatsApp or Facebook post.')
      }
    } catch (e) {
      // Closing the share menu isn't a problem.
      if ((e as Error).name !== 'AbortError') setNote('We couldn’t make the picture. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="share-trip">
      <button type="button" className="btn btn-secondary btn-small" onClick={share} disabled={busy} aria-describedby={note ? 'share-trip-note' : undefined}>
        {busy ? 'Making your picture…' : 'Share my trip'}
      </button>
      {note && (
        <p className="hint" id="share-trip-note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}
