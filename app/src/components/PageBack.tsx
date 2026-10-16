import { Link, useNavigate } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { BackIcon } from './Icons'

/** A quiet back arrow at the top of a settings page (Claude Design, 16 Oct). */
export function PageBack({ to, label }: { to: string; label: string }) {
  return (
    <Link className="icon-btn page-back" to={to} aria-label={label}>
      <BackIcon />
    </Link>
  )
}

/** Back, and a small gold tag naming the page's kind ("Safety guide", "Help"), over a guide page (Claude Design, 16 Oct). */
export function PageTop({ tag, fallback }: { tag: string; fallback: string }) {
  const navigate = useNavigate()
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1
  return (
    <div className="page-top">
      {canGoBack ? (
        <button type="button" className="icon-btn page-back" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
      ) : (
        <Link className="icon-btn page-back" to={fallback} aria-label="Back">
          <BackIcon />
        </Link>
      )}
      <span className="page-tag">
        <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
        {tag}
      </span>
    </div>
  )
}
