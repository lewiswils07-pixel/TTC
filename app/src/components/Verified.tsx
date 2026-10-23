import { useEffect, useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { messageOf } from '../lib/errors'
import { verifiedIds, verifyMe } from '../lib/verify'

/** The badge on a verified member's card. */
export function VerifiedBadge() {
  return (
    <span className="going-badge is-verified">
      <BadgeCheck size={16} strokeWidth={2} aria-hidden="true" />
      Verified
    </span>
  )
}

/** Shows the badge when this member is verified. */
export function VerifiedFor({ id }: { id: string }) {
  const [yes, setYes] = useState(false)
  useEffect(() => {
    verifiedIds([id]).then(
      (s) => setYes(s.has(id)),
      () => setYes(false),
    )
  }, [id])
  return yes ? <VerifiedBadge /> : null
}

/** On your profile: get verified in one tap, or see that you are. */
export function VerifyCard({ userId }: { userId: string }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    verifiedIds([userId]).then(
      (s) => setVerified(s.has(userId)),
      () => setVerified(null),
    )
  }, [userId])

  async function verify() {
    setBusy(true)
    setError(null)
    try {
      await verifyMe()
      setVerified(true)
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  if (verified === null) return null
  return (
    <section className={verified ? 'card verify-card is-done' : 'card verify-card'} aria-labelledby="verify-title">
      <span className="verify-icon" aria-hidden="true">
        <BadgeCheck size={24} strokeWidth={1.8} />
      </span>
      <span className="verify-text">
        <h2 id="verify-title" className="card-title">
          {verified ? 'You’re verified' : 'Get verified'}
        </h2>
        <span className="hint">{verified ? 'Members see the Verified badge on your card.' : 'Members are more likely to say yes when they see the Verified badge on your card.'}</span>
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </span>
      {!verified && (
        <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={verify}>
          {busy ? 'Verifying…' : 'Verify me'}
        </button>
      )}
    </section>
  )
}
