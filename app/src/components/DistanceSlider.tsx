import { useId } from 'react'
import { DISTANCE_MILES, distanceLabel, distanceStop, milesToKm } from '../lib/options'

/** How far away people can be: 1 to 150 miles, or any distance with the box
 *  ticked (Lewis, 11 Oct, like Hinge). */
export function DistanceSlider({ km, onChange }: { km: number | null; onChange: (km: number | null) => void }) {
  const id = useId()
  const stop = distanceStop(km)
  const last = DISTANCE_MILES.length - 1
  const label = distanceLabel(km)
  return (
    <div className="field" data-field="distance">
      <label htmlFor={id}>Maximum distance</label>
      <p className="range-readout" aria-hidden="true">
        <strong>{label}</strong>
      </p>
      <div className="range" style={{ ['--from' as string]: '0%', ['--to' as string]: `${(stop / last) * 100}%` }}>
        <input id={id} type="range" min={0} max={last} step={1} value={stop} aria-valuetext={label} onChange={(e) => onChange(milesToKm(DISTANCE_MILES[Number(e.target.value)]))} />
      </div>
      <div className="range-scale" aria-hidden="true">
        <span>1 mile</span>
        <span>{DISTANCE_MILES[last]} miles</span>
      </div>
      <label className="check-row distance-any">
        Show people further away too
        <input type="checkbox" checked={km === null} onChange={(e) => onChange(e.target.checked ? null : milesToKm(DISTANCE_MILES[stop]))} />
      </label>
    </div>
  )
}
