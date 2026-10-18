import { useSyncExternalStore, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useSession } from '../lib/session-context'
import { brand } from '../lib/brand'
import { TabBar, type Tab } from './TabBar'
import { SkeletonRows } from './Skeleton'
import { MONOGRAM, PRIMARY_LOGO } from '../lib/logo'

/** The SC monogram (the secondary logo), in the colour of the text around it. */
export function Monogram({ size = 36 }: { size?: number }) {
  return (
    <svg className="monogram" width={size} height={size} viewBox={MONOGRAM.viewBox} aria-hidden="true" focusable="false">
      <path d={MONOGRAM.d} fill="currentColor" />
    </svg>
  )
}

/** The main logo: SODALIS over a script "Collective". `height` is in pixels. */
export function Logo({ height = 44, label = false }: { height?: number; label?: boolean }) {
  const [, , w, h] = PRIMARY_LOGO.viewBox.split(' ').map(Number)
  return (
    <svg
      className="logo"
      height={height}
      width={Math.round((height * w) / h)}
      viewBox={PRIMARY_LOGO.viewBox}
      role={label ? 'img' : undefined}
      aria-label={label ? brand.name : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PRIMARY_LOGO.d} fill="currentColor" />
    </svg>
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

/** `bare` drops the logo bar, for screens that carry their own (welcome, join and sign in). */
export function Layout({ children, actions, wide = false, tab, bare = false }: { children: ReactNode; actions?: ReactNode; wide?: boolean; tab?: Tab; bare?: boolean }) {
  const { session } = useSession()
  const path = useLocation().pathname
  const isWide = useWide()
  // On a laptop the tabs stay along the top on every member screen, inner pages included.
  const topTab = isWide && session ? (tab ?? tabFor(path)) : undefined
  // On a phone, members don't need the logo on every screen: the page gets the room instead.
  const showBrand = !bare && (isWide || !session)
  return (
    <div className={['shell', tab && !isWide && 'has-tabs', !showBrand && !actions && 'no-topbar'].filter(Boolean).join(' ')}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {(showBrand || actions) && (
        <header className="topbar">
          <div className="topbar-inner">
            {showBrand && (
              <Link className="brand" to="/" aria-label={brand.name}>
                <Logo height={46} />
              </Link>
            )}
            {topTab && <TabBar current={topTab} top />}
            {actions}
          </div>
        </header>
      )}
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
  if (path.startsWith('/messages') || path.startsWith('/groups') || path.startsWith('/requests')) return 'chat'
  if (path.startsWith('/profile') || path.startsWith('/account') || path.startsWith('/settings')) return 'profile'
  return undefined
}

/** Shown while a screen loads: grey placeholders shaped like a page, never a spinner. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  const { session } = useSession()
  const path = useLocation().pathname
  return (
    <Layout tab={session ? tabFor(path) : undefined}>
      <div className="skeleton-page" aria-hidden="true">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-line" />
      </div>
      <SkeletonRows rows={3} label={label} />
    </Layout>
  )
}
