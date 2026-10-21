import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Lock, MapPin, Route, Tag } from 'lucide-react'
import { CardBack } from './CardBack'
import { loadCard, type CardAnswer } from '../lib/card'
import { listLabels } from '../lib/matching'
import { loadExtras, sharedStyle, whatWeShare, type MemberExtras } from '../lib/member'
import type { MyProfile } from '../lib/profile'
import { brand } from '../lib/brand'
import { plusLink } from '../lib/plan'

/** On a connection request: their one line, what you share, and their card for Sodalis+ members (Lewis, 16 Oct). */
export function RequestShare({ profileId, name, mine, plus }: { profileId: string; name: string; mine: MyProfile['profile'] | undefined; plus: boolean }) {
  const [extras, setExtras] = useState<MemberExtras | null>(null)
  const [shared, setShared] = useState<{ interests: string[]; places: string[] } | null>(null)
  const [answers, setAnswers] = useState<CardAnswer[] | 'error' | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    loadExtras(profileId).then(setExtras)
    whatWeShare(profileId).then(setShared)
  }, [profileId])
  useEffect(() => {
    if (open && answers === null)
      loadCard(profileId).then(
        (c) => setAnswers(c.card_answers),
        () => setAnswers('error'),
      )
  }, [open, answers, profileId])

  const style = sharedStyle(extras, mine)
  const shares = [
    shared?.interests.length && {
      Icon: Tag,
      label: 'Interests',
      text: listLabels(
        shared.interests.map((x) => x.toLowerCase()),
        4,
      ),
    },
    shared?.places.length && { Icon: MapPin, label: 'Places', text: `you both want to see ${listLabels(shared.places, 3)}` },
    style.length > 0 && { Icon: Route, label: 'Travel style', text: listLabels(style, 3) },
  ].filter((x) => !!x)
  const cardId = `request-card-${profileId}`

  return (
    <>
      {extras?.headline && <p className="going-headline request-headline">“{extras.headline}”</p>}
      {shares.length > 0 && (
        <div className="going-share request-share">
          <h4>What you share</h4>
          <ul>
            {shares.map(({ Icon, label, text }) => (
              <li key={label}>
                <span className="going-share-icon" aria-hidden="true">
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <p>
                  <strong>{label}</strong> · {text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {plus ? (
        <>
          <button type="button" className="request-read" aria-expanded={open} aria-controls={cardId} onClick={() => setOpen(!open)}>
            {open ? 'Hide their card' : 'Read their card'}
            <ChevronDown size={18} strokeWidth={2} aria-hidden="true" className={open ? 'is-flipped' : undefined} />
          </button>
          {open && (
            <div id={cardId} className="request-card-back going-words">
              {answers === null ? (
                <p className="hint" role="status">
                  Loading their card…
                </p>
              ) : answers === 'error' ? (
                <p className="hint">We couldn’t load this just now.</p>
              ) : (
                <CardBack name={name} answers={answers} />
              )}
            </div>
          )}
        </>
      ) : (
        <Link className="request-read is-locked" to={plusLink('request_card')}>
          <Lock size={16} strokeWidth={2} aria-hidden="true" />
          Read their card
          <span className="going-badge is-gold">{brand.plusName}</span>
        </Link>
      )}
    </>
  )
}
