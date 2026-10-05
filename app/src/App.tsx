import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { RequireSession } from './components/Guards'
import { Loading } from './components/Layout'
import { SessionProvider } from './lib/session'
import { Home } from './routes/Home'
import { NotFound } from './routes/NotFound'
import { SignIn } from './routes/SignIn'

// Screens for signed-in members load on demand, so the first screen is quick.
const Onboarding = lazy(() => import('./routes/Onboarding').then((m) => ({ default: m.Onboarding })))
const TripMatches = lazy(() => import('./routes/TripMatches').then((m) => ({ default: m.TripMatches })))
const TripForm = lazy(() => import('./routes/TripForm').then((m) => ({ default: m.TripForm })))
const Dashboard = lazy(() => import('./routes/Dashboard').then((m) => ({ default: m.Dashboard })))

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route
        path="/onboarding"
        element={
          <RequireSession>
            <Onboarding />
          </RequireSession>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireSession>
            <Dashboard />
          </RequireSession>
        }
      />
      <Route
        path="/trips/new"
        element={
          <RequireSession>
            <TripForm />
          </RequireSession>
        }
      />
      <Route
        path="/trips/:id"
        element={
          <RequireSession>
            <TripMatches />
          </RequireSession>
        }
      />
      <Route
        path="/trips/:id/edit"
        element={
          <RequireSession>
            <TripForm />
          </RequireSession>
        }
      />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
