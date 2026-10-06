import { useEffect, useId, useRef, useState } from 'react'
import { HEARD_FROM, saveHeardFrom, type HeardFrom } from '../lib/kpis'
import { rules } from '../lib/rules'
import { useSession } from '../lib/session-context'
import { supabase } from '../lib/supabase'

const TICK_MS = 60_000
const AFTER_MS = rules.survey.heardFromAfterMinutes * 60_000

// Kept on this phone: minutes of use so far, and whether we've already asked.
const usedKey = (id: string) => `sodalis.usedMs.${id}`
const askedKey = (id: string) => `sodalis.heardAsked.${id}`
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private browsing: we just won't remember.
  }
}

/** "Where did you hear about us?", asked once, after half an hour of using the app (Lewis, 6 Oct). */
export function HeardFromPrompt() {
  const userId = useSession().session?.user.id
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!userId || read(askedKey(userId))) return
    let cancelled = false
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      const used = Number(read(usedKey(userId)) ?? 0) + TICK_MS
      write(usedKey(userId), String(used))
      if (used < AFTER_MS) return
      window.clearInterval(timer)
      const { data } = await supabase.from('profiles').select('heard_from, onboarded_at').eq('id', userId).single()
      if (cancelled || !data?.onboarded_at) return
      if (data.heard_from) write(askedKey(userId), '1')
      else setShow(true)
    }
    const timer = window.setInterval(() => void tick(), TICK_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [userId])

  if (!show || !userId) return null
  const close = () => {
    write(askedKey(userId), '1')
    setShow(false)
  }
  return <HeardFromDialog onPick={(v) => void saveHeardFrom(userId, v).catch(() => undefined).finally(close)} onSkip={close} />
}

export function HeardFromDialog({ onPick, onSkip }: { onPick: (value: HeardFrom) => void; onSkip: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    const before = document.activeElement as HTMLElement | null
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
    return () => before?.focus?.()
  }, [])
  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault()
        onSkip()
      }}
    >
      <div className="confirm-box">
        <h2 id={title} className="confirm-title">
          Where did you hear about us?
        </h2>
        <div className="pill-row">
          {HEARD_FROM.map((o) => (
            <button key={o.value} type="button" className="pill" onClick={() => onPick(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn btn-link" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </dialog>
  )
}
