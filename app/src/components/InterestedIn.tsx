import { useId } from 'react'
import { peek } from '../lib/cache'
import { INTERESTED_IN, type Gender } from '../lib/options'
import type { MyProfile } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { FieldError } from './Field'

/** "I’d like to travel with" (was "I’m interested in", testers 13 Oct: too dating-like): one row each, plus Everyone (Lewis, 11 Oct). */
export function InterestedIn({ value, onChange, error, legend = 'I’d like to travel with' }: { value: readonly Gender[]; onChange: (next: Gender[]) => void; error?: string | null; legend?: string }) {
  const id = useId()
  const { session } = useSession()
  const isWoman = (session && peek<MyProfile>(`profile:${session.user.id}`))?.profile.gender === 'woman'
  const all = INTERESTED_IN.map((o) => o.value as Gender)
  const everyone = all.every((g) => value.includes(g))
  const rows = [...INTERESTED_IN.map((o) => ({ key: o.value as string, label: o.label, checked: !everyone && value.includes(o.value) })), { key: 'all', label: 'Everyone', checked: everyone }]
  return (
    <fieldset className="field check-rows" data-field="genders" aria-describedby={error ? `${id}-error` : undefined}>
      <legend>{legend}</legend>
      <p className="hint">Select all who you’re open to meeting.</p>
      {rows.map((r) => (
        <label className="check-row" key={r.key}>
          <span>{r.label}</span>
          <input
            type="checkbox"
            checked={r.checked}
            onChange={() => {
              if (r.key === 'all') return onChange(everyone ? [] : all)
              const g = r.key as Gender
              const base = everyone ? [] : value.filter((v) => v !== g)
              onChange(r.checked ? base : [...base, g])
            }}
          />
        </label>
      ))}
      {/* Women only works both ways (survey, 13 Oct): men don't see a woman who picks only women. */}
      {isWoman && value.length === 1 && value[0] === 'woman' && <p className="hint women-only-hint">Women only: you’ll see only women, and only women will see you.</p>}
      <FieldError id={`${id}-error`} error={error} />
    </fieldset>
  )
}
