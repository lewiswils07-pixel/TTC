import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { brand } from '../lib/brand'
import { chosenHere, markChosen, myPrivacyChoices, savePrivacyChoices, type PrivacyChoices } from '../lib/privacy'
import { useSession } from '../lib/session-context'
import { supabase } from '../lib/supabase'

/** "We value your privacy", asked once on Connections after sign-up and the tour (Lewis, 6 Oct). */
export function PrivacyPrompt() {
  const userId = useSession().session?.user.id
  const { pathname, search } = useLocation()
  const [show, setShow] = useState(false)
  // Wait until the tour has closed.
  const ready = pathname === '/connections' && !new URLSearchParams(search).has('tour')

  useEffect(() => {
    if (!userId || !ready || chosenHere(userId)) return
    let live = true
    Promise.all([myPrivacyChoices(), supabase.from('profiles').select('onboarded_at').eq('id', userId).single()]).then(
      ([c, { data }]) => {
        if (!live) return
        // Not until the profile is finished (Connections sends new members there first).
        if (c === null && data?.onboarded_at) setShow(true)
        else if (c) markChosen(userId)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [userId, ready])

  if (!show || !ready || !userId) return null
  const choose = (choices: PrivacyChoices) => {
    setShow(false)
    void savePrivacyChoices(userId, choices).catch(() => undefined)
  }
  return <PrivacyDialog onChoose={choose} onManage={() => setShow(false)} />
}

export function PrivacyDialog({ onChoose, onManage }: { onChoose: (c: PrivacyChoices) => void; onManage: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  const text = useId()
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
      className="confirm privacy-prompt"
      aria-labelledby={title}
      aria-describedby={text}
      // Escape doesn't count as a choice: they're asked again next time.
      onCancel={(e) => {
        e.preventDefault()
        onManage()
      }}
    >
      <div className="confirm-box">
        <span className="privacy-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 13.6-3.4-3.4 1.4-1.4 2 2 4.6-4.6 1.4 1.4-6 6Z" fill="currentColor" />
          </svg>
        </span>
        <h2 id={title} className="confirm-title">
          We value your privacy
        </h2>
        <p id={text} className="confirm-text">
          We use tools to measure the audience and use of our app, personalise ads, enhance our own marketing, enable social features and better understand
          how {brand.name} is used as a whole. These tools don’t track you across other apps and websites.
        </p>
        <div className="privacy-actions">
          <button type="button" className="btn btn-primary btn-block" autoFocus onClick={() => onChoose({ measuring: true, marketing: true })}>
            Accept all
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => onChoose({ measuring: false, marketing: false })}>
            Only what’s needed
          </button>
          <Link className="btn-link" to="/settings/privacy" onClick={onManage}>
            Choose for myself
          </Link>
        </div>
      </div>
    </dialog>
  )
}
