import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { cachedTabCounts, loadTabCounts, type Tab } from '../lib/tabCounts'

export type { Tab }

const TABS: { tab: Tab; to: string; label: string; icon: string }[] = [
  {
    tab: 'connections',
    to: '/connections',
    label: 'Connections',
    icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM1.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5v1h-15v-1Zm16.4 1v-1c0-2-.8-3.8-2.1-5.2.5-.1 1.1-.2 1.7-.2 3.3 0 6 2.3 6 5.4v1h-5.6Z',
  },
  {
    tab: 'trips',
    to: '/trips',
    label: 'Trips',
    icon: 'M21.5 15.5v-2l-8-5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5V18.5l-2 1.5v1.5l3.5-1 3.5 1v-1.5l-2-1.5V13l8 2.5Z',
  },
  {
    tab: 'chat',
    to: '/messages',
    label: 'Chat',
    icon: 'M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  },
  {
    tab: 'profile',
    to: '/profile',
    label: 'Profile',
    icon: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-9 9c0-4.4 4-8 9-8s9 3.6 9 8v1H3v-1Z',
  },
]

/** The bar along the bottom of the main screens on a phone, or along the top on a laptop. */
export function TabBar({ current, top = false }: { current: Tab; top?: boolean }) {
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>(cachedTabCounts() ?? {})

  useEffect(() => {
    let live = true
    loadTabCounts().then((c) => live && setCounts(c))
    return () => {
      live = false
    }
  }, [])

  return (
    <nav className={top ? 'tabbar tabbar-top' : 'tabbar'} aria-label="Main">
      <ul>
        {TABS.map(({ tab, to, label, icon }) => {
          const n = counts[tab] ?? 0
          return (
            <li key={tab}>
              <NavLink to={to} className={tab === current ? 'tab is-current' : 'tab'} aria-current={tab === current ? 'page' : undefined}>
                <span className="tab-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d={icon} fill="currentColor" />
                  </svg>
                  {n > 0 && <span className="tab-badge">{n > 9 ? '9+' : n}</span>}
                </span>
                <span className="tab-label">{label}</span>
                {n > 0 && <span className="visually-hidden">, {n} new</span>}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
