import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { brand } from '../lib/brand'

export function Layout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="topbar">
        <Link className="brand" to="/">
          {brand.name}
        </Link>
        {actions}
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <Layout>
      <p role="status" aria-live="polite">
        {label}
      </p>
    </Layout>
  )
}
