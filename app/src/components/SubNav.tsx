import { Link } from 'react-router'

/** Two or three page-level tabs at the top of a screen, such as "For you" and "Requests & matches". */
export function SubNav({ label, items, current }: { label: string; items: { to: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="subnav" aria-label={label}>
      {items.map((item) => (
        <Link key={item.to} to={item.to} className={item.to === current ? 'subnav-item is-current' : 'subnav-item'} aria-current={item.to === current ? 'page' : undefined}>
          {item.label}
          {!!item.count && (
            <span className="badge">
              {item.count}
              <span className="visually-hidden"> new</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
