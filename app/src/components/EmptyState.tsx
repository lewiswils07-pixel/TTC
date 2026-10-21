import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Monogram } from './Layout'

/** The monogram in a dotted gold ring, with a small badge saying what's missing (Claude Design, 16 Oct). */
export function EmptyArt({ icon, alert = false, compact = false }: { icon: ReactNode; alert?: boolean; compact?: boolean }) {
  return (
    <span className={compact ? 'empty-art is-small' : 'empty-art'} aria-hidden="true">
      <Monogram size={compact ? 56 : 96} />
      <span className={alert ? 'empty-badge is-alert' : 'empty-badge'}>{icon}</span>
    </span>
  )
}

/** An empty screen: the art, a serif line, a sentence and what to do next. */
/** `compact` keeps the art small where useful things sit below it (testers, 21 Oct). */
export function EmptyState({
  icon,
  title,
  text,
  children,
  level = 2,
  alert = false,
  compact = false,
}: {
  icon: ReactNode
  title: string
  text: ReactNode
  children?: ReactNode
  level?: 2 | 3
  alert?: boolean
  compact?: boolean
}) {
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <div className={compact ? 'empty-state is-compact' : 'empty-state'}>
      <EmptyArt icon={icon} alert={alert} compact={compact} />
      <H>{title}</H>
      <p>{text}</p>
      {children}
    </div>
  )
}

/** A soft placeholder card with the monogram and what's happening, while a page loads. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="skeleton loading-line" aria-hidden="true" />
      <span className="loading-row" aria-hidden="true">
        <span className="skeleton loading-photo" />
        <span className="loading-lines">
          <span className="skeleton loading-line" />
          <span className="skeleton loading-line is-short" />
        </span>
      </span>
      <span className="loading-mark">
        <span className="empty-art is-small" aria-hidden="true">
          <Monogram size={56} />
        </span>
        <span>{label}</span>
      </span>
    </div>
  )
}

/** Something didn't load: say so kindly, with a way to try again and a person to talk to. */
export function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState icon="!" alert title="Something went wrong" text={text}>
        <button type="button" className="btn btn-primary btn-block" onClick={onRetry}>
          Try again
        </button>
        <Link className="btn btn-secondary btn-block" to="/help">
          Talk to us
        </Link>
      </EmptyState>
    </div>
  )
}
