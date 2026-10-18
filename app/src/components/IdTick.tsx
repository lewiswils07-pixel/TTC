import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { idChecked } from '../lib/idCheck'

// Asked once per member per visit: the answer rarely changes.
const known = new Map<string, Promise<boolean>>()
function isChecked(id: string): Promise<boolean> {
  let p = known.get(id)
  if (!p) {
    p = idChecked([id]).then((s) => s.has(id))
    known.set(id, p)
  }
  return p
}

/** "ID checked" by a member's name, once they've passed the ID check. */
export function IdTick({ id, className = 'going-badge is-id' }: { id: string; className?: string }) {
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    let alive = true
    isChecked(id).then((c) => alive && setChecked(c))
    return () => {
      alive = false
    }
  }, [id])
  if (!checked) return null
  return (
    <span className={className}>
      <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
      ID checked
    </span>
  )
}
