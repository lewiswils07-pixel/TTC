import { useEffect, useState, type ReactNode } from 'react'
import { SessionContext, type SessionState } from './session-context'
import { supabase } from './supabase'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false })
      // Members away for 60 days drop out of suggestions; opening the app
      // brings them back. The database writes at most once an hour. Called
      // after this callback returns, as supabase-js asks.
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        setTimeout(() => void supabase.rpc('touch_last_active').then(() => undefined, () => undefined), 0)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}

