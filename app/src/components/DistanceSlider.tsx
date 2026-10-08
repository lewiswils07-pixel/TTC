import { useId } from 'react'
import { DISTANCE_MILES, distanceLabel, distanceStop, milesToKm } from '../lib/options'

/** One slider from 5 miles to any distance (Lewis, 6 Oct). */
export function DistanceSlider({ km, onChange }: { km: number | null; onChange: (km: number | null) => void }) {
  const id = useId()
  const stop = distanceStop(km)
  const last = DISTANCE_MILES.length - 1
  const label = distanceLabel(DISTANCE_MILES[stop])
  return (
    <div className="field" data-field="distance">
      <label htmlFor={id}>How far from home?</label>
      <p className="range-readout" aria-hidden="true">
        <strong>{label}</strong>
      </p>
      <div className="range" style={{ ['--from' as string]: '0%', ['--to' as string]: `${(stop / last) * 100}%` }}>
        <input
          id={id}
          type="range"
          min={0}
          max={last}
          step={1}
          value={stop}
          aria-valuetext={label}
          onChange={(e) => onChange(milesToKm(DISTANCE_MILES[Number(e.target.value)]))}
        />
      </div>
      <div className="range-scale" aria-hidden="true">
        <span>0 miles</span>
        <span>Any</span>
      </div>
    </div>
  )
}
