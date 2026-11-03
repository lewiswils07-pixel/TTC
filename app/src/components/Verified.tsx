import { useEffect, useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { Link } from 'react-router'
import { verifiedIds } from '../lib/verify'

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

/** On your profile: check your ID, or see that you're verified. */
export function VerifyCard({ userId }: { userId: string }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  useEffect(() => {
    verifiedIds([userId]).then(
      (s) => setVerified(s.has(userId)),
      () => setVerified(null),
    )
  }, [userId])

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
        <span className="hint">
          {verified
            ? 'Members see the Verified badge on your card.'
            : 'Check your ID with a passport or driving licence and a quick selfie. Members are more likely to say yes when they see the Verified badge.'}
        </span>
      </span>
      {!verified && (
        <Link className="btn btn-primary btn-small" to="/verify-id">
          Check my ID
        </Link>
      )}
    </section>
  )
}
