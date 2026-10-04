import { Link, Navigate } from 'react-router'
import { Layout, Loading } from '../components/Layout'
import { brand } from '../lib/brand'
import { useSession } from '../lib/session-context'

export function Home() {
  const { session, loading } = useSession()
  if (loading) return <Loading />
  if (session) return <Navigate to="/dashboard" replace />
  return (
    <Layout>
      <div className="stack">
        <h1>Welcome to {brand.name}</h1>
        <p>{brand.tagline}. Meet like-minded people going to the same places as you, at your own pace.</p>
        <Link className="btn btn-primary btn-block" to="/sign-in">
          Join or sign in
        </Link>
        <p className="hint center">New here? Signing in for the first time creates your free account.</p>
      </div>
    </Layout>
  )
}
