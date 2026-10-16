import { Link } from 'react-router'
import { BackIcon } from './Icons'

/** A quiet back arrow at the top of a settings page (Claude Design, 16 Oct). */
export function PageBack({ to, label }: { to: string; label: string }) {
  return (
    <Link className="icon-btn page-back" to={to} aria-label={label}>
      <BackIcon />
    </Link>
  )
}
