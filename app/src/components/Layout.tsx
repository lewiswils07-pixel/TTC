import { useSyncExternalStore, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useSession } from '../lib/session-context'
import { brand } from '../lib/brand'
import { TabBar, type Tab } from './TabBar'

/** The club's initial in a burgundy disc with gold lettering. */
export function Monogram({ size = 36 }: { size?: number }) {
  return (
    <span className="monogram" style={{ width: size, height: size, fontSize: size * 0.56 }} aria-hidden="true">
      {brand.name.slice(0, 1)}
    </span>
  )
}

const WIDE = '(min-width: 900px)'
const wideQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(WIDE) : null

/** True on laptop-sized screens, where the tabs sit along the top. */
function useWide(): boolean {
  return useSyncExternalStore(
    (change) => {
      wideQuery?.addEventListener('change', change)
      return () => wideQuery?.removeEventListener('change', change)
    },
    () => wideQuery?.matches ?? false,
  )
}

export function Layout({ children, actions, wide = false, tab }: { children: ReactNode; actions?: ReactNode; wide?: boolean; tab?: Tab }) {
  const { session } = useSession()
  const path = useLocation().pathname
  const isWide = useWide()
  // On a laptop the tabs stay along the top on every member screen, inner pages included.
  const topTab = isWide && session ? (tab ?? tabFor(path)) : undefined
  return (
    <div className={tab && !isWide ? 'shell has-tabs' : 'shell'}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <Monogram size={32} />
            <span>{brand.name}</span>
          </Link>
          {topTab && <TabBar current={topTab} top />}
          {actions}
        </div>
      </header>
      <main id="main" className={wide ? 'main main-wide' : 'main'} tabIndex={-1}>
        {children}
      </main>
      {tab && !isWide && <TabBar current={tab} />}
    </div>
  )
}

/** Which tab a screen belongs to, so the tab bar stays put while it loads. */
function tabFor(path: string): Tab | undefined {
  if (path.startsWith('/connections') || path.startsWith('/filters')) return 'connections'
  if (path.startsWith('/trips')) return 'trips'
  if (path.startsWith('/messages') || path.startsWith('/groups')) return 'chat'
  if (path.startsWith('/profile') || path.startsWith('/account')) return 'profile'
  return undefined
}

/** Shown while a screen loads. The spinner only appears if it takes more than a moment. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  const { session } = useSession()
  const path = useLocation().pathname
  return (
    <Layout tab={session ? tabFor(path) : undefined}>
      <div className="loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        {label}
      </div>
    </Layout>
  )
}
