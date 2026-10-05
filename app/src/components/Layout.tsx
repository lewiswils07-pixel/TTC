import type { ReactNode } from 'react'
import { Link } from 'react-router'
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

export function Layout({ children, actions, wide = false, tab }: { children: ReactNode; actions?: ReactNode; wide?: boolean; tab?: Tab }) {
  return (
    <div className={tab ? 'shell has-tabs' : 'shell'}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <Monogram size={32} />
            <span>{brand.name}</span>
          </Link>
          {actions}
        </div>
      </header>
      <main id="main" className={wide ? 'main main-wide' : 'main'} tabIndex={-1}>
        {children}
      </main>
      {tab && <TabBar current={tab} />}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <Layout>
      <div className="loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        {label}
      </div>
    </Layout>
  )
}
