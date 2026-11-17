import { BadgeCheck, EyeOff, Flag, HeartHandshake } from 'lucide-react'
import { MIN_AGE } from '../lib/options'

const POINTS = [
  { Icon: BadgeCheck, text: `Adults only: every member is ${MIN_AGE} or over` },
  { Icon: EyeOff, text: 'Your phone number and email stay private' },
  { Icon: Flag, text: 'Block or report anyone in two taps' },
  { Icon: HeartHandshake, text: 'Here for friendship and travel, never dating' },
] as const

/** What keeps members safe, said plainly (Lewis, 17 Nov). On the first screen, and in short on trip pages. */
export function SafetyPromise({ compact = false }: { compact?: boolean }) {
  const shown = compact ? POINTS.slice(0, 3) : POINTS
  return (
    <section className={compact ? 'card safety-promise is-compact' : 'card safety-promise'} aria-labelledby="safety-promise-title">
      <h2 id="safety-promise-title">{compact ? 'Travelling with members' : 'Safe by design'}</h2>
      <ul>
        {shown.map(({ Icon, text }) => (
          <li key={text}>
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
