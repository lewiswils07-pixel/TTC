import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { needsPasswordChoice } from '../lib/auth'
import { useSession } from '../lib/session-context'
import { Loading } from './Layout'

/** Sends signed-out visitors to the sign-in screen. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  if (needsPasswordChoice(session.user)) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  return children
}
