import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CHAT_NAV } from '../lib/nav'
import { cachedTabCounts, loadTabCounts } from '../lib/tabCounts'

/** Two or three page-level tabs at the top of a screen, such as "Connections", "Groups" and "Requests". */
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

/** Connections, Groups and Requests, with the number of requests waiting for an answer. Pass `requests` when the page already knows it. */
export function ChatNav({ current, requests }: { current: string; requests?: number }) {
  const [waiting, setWaiting] = useState(() => cachedTabCounts()?.requests ?? 0)
  useEffect(() => {
    let live = true
    loadTabCounts().then((c) => live && setWaiting(c.requests ?? 0))
    return () => {
      live = false
    }
  }, [])
  const n = requests ?? waiting
  return <SubNav label="Chat" items={CHAT_NAV.map((i) => (i.to === '/requests' ? { ...i, count: n } : i))} current={current} />
}
