import { useEffect, useState, type CSSProperties } from 'react'
import { NavLink } from 'react-router'
import { BriefcaseBusiness, Compass, MessageCircle, UserRound, type LucideIcon } from 'lucide-react'
import { cachedTabCounts, loadTabCounts, type Tab } from '../lib/tabCounts'

export type { Tab }

const TABS: { tab: Tab; to: string; label: string; Icon: LucideIcon }[] = [
  { tab: 'connections', to: '/connections', label: 'Who’s going', Icon: Compass },
  { tab: 'trips', to: '/trips', label: 'Trips', Icon: BriefcaseBusiness },
  { tab: 'chat', to: '/messages', label: 'Chat', Icon: MessageCircle },
  { tab: 'profile', to: '/profile', label: 'Profile', Icon: UserRound },
]

/** The tab the slider last sat under. Each screen draws its own bar, so this lets the new bar slide over from the old tab. */
let lastShown: number | null = null

/** The bar along the bottom of the main screens on a phone, or along the top on a laptop. */
export function TabBar({ current, top = false }: { current: Tab; top?: boolean }) {
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>(cachedTabCounts() ?? {})
  const index = TABS.findIndex((t) => t.tab === current)
  const [slider, setSlider] = useState(lastShown ?? index)

  // Start under the old tab, then slide to this one on the next frame.
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setSlider(index)))
    lastShown = index
    return () => cancelAnimationFrame(frame)
  }, [index])

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
        {!top && <li className="tab-slider" aria-hidden="true" style={{ '--i': slider } as CSSProperties} />}
        {TABS.map(({ tab, to, label, Icon }, i) => {
          const n = counts[tab] ?? 0
          return (
            <li key={tab}>
              <NavLink
                to={to}
                className={tab === current ? 'tab is-current' : 'tab'}
                aria-current={tab === current ? 'page' : undefined}
                // Slide straight away, before the next screen has loaded.
                onClick={() => setSlider(i)}
              >
                <span className="tab-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={tab === current ? 2.1 : 1.8} aria-hidden={true} focusable={false} />
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
