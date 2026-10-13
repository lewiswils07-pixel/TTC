import { Link } from 'react-router'
import { NextIcon } from './Icons'

/** A tappable row with an optional icon, title, one line of text and a chevron. */
export function HubRow({ to, title, text, icon }: { to: string; title: string; text?: string; icon?: string }) {
  return (
    <Link className="hub-row" to={to}>
      {icon && (
        <span className="hub-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d={icon} fill="currentColor" />
          </svg>
        </span>
      )}
      <span className="hub-text">
        <strong>{title}</strong>
        {text && <span>{text}</span>}
      </span>
      <span className="trip-chevron" aria-hidden="true">
        <NextIcon />
      </span>
    </Link>
  )
}
