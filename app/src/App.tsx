import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { RequireSession } from './components/Guards'
import { Loading } from './components/Layout'
import { SessionProvider } from './lib/session'
import { Home } from './routes/Home'
import { NotFound } from './routes/NotFound'
import { SignIn } from './routes/SignIn'

// Screens for signed-in members load on demand, so the first screen is quick.
const Onboarding = lazy(() => import('./routes/Onboarding').then((m) => ({ default: m.Onboarding })))
const TripMatches = lazy(() => import('./routes/TripMatches').then((m) => ({ default: m.TripMatches })))
const Connections = lazy(() => import('./routes/Connections').then((m) => ({ default: m.Connections })))
const TripForm = lazy(() => import('./routes/TripForm').then((m) => ({ default: m.TripForm })))
const ForYou = lazy(() => import('./routes/ForYou').then((m) => ({ default: m.ForYou })))
const Trips = lazy(() => import('./routes/Trips').then((m) => ({ default: m.Trips })))
const Filters = lazy(() => import('./routes/Filters').then((m) => ({ default: m.Filters })))
const Messages = lazy(() => import('./routes/Messages').then((m) => ({ default: m.Messages })))
const Chat = lazy(() => import('./routes/Chat').then((m) => ({ default: m.Chat })))
const Admin = lazy(() => import('./routes/Admin').then((m) => ({ default: m.Admin })))
const account = () => import('./routes/Account')
const Account = lazy(() => account().then((m) => ({ default: m.Account })))
const AccountDeleted = lazy(() => account().then((m) => ({ default: m.AccountDeleted })))
const Insights = lazy(() => import('./routes/Insights').then((m) => ({ default: m.Insights })))
const MeetingSafely = lazy(() => import('./routes/MeetingSafely').then((m) => ({ default: m.MeetingSafely })))
const Groups = lazy(() => import('./routes/Groups').then((m) => ({ default: m.Groups })))
const GroupForm = lazy(() => import('./routes/GroupForm').then((m) => ({ default: m.GroupForm })))
const GroupDetail = lazy(() => import('./routes/GroupDetail').then((m) => ({ default: m.GroupDetail })))
const PlanBoard = lazy(() => import('./routes/PlanBoard').then((m) => ({ default: m.PlanBoard })))
const legal = () => import('./routes/Legal')
const Terms = lazy(() => legal().then((m) => ({ default: m.Terms })))
const Privacy = lazy(() => legal().then((m) => ({ default: m.Privacy })))
const CommunityRules = lazy(() => legal().then((m) => ({ default: m.CommunityRules })))
const WelcomeScreen = lazy(() => import('./routes/Welcome').then((m) => ({ default: m.WelcomeScreen })))
const Profile = lazy(() => import('./routes/Profile').then((m) => ({ default: m.Profile })))

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
        path="/profile"
        element={
          <RequireSession>
            <Profile />
          </RequireSession>
        }
      />
      <Route
        path="/trips"
        element={
          <RequireSession>
            <Trips />
          </RequireSession>
        }
      />
      {/* Old addresses from before the tab bar (5 Oct). */}
      <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
      <Route path="/people" element={<Navigate to="/connections" replace />} />
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
      <Route
        path="/filters"
        element={
          <RequireSession>
            <Filters />
          </RequireSession>
        }
      />
      <Route
        path="/connections"
        element={
          <RequireSession>
            <ForYou />
          </RequireSession>
        }
      />
      <Route
        path="/connections/requests"
        element={
          <RequireSession>
            <Connections />
          </RequireSession>
        }
      />
      <Route
        path="/messages"
        element={
          <RequireSession>
            <Messages />
          </RequireSession>
        }
      />
      <Route
        path="/messages/:id"
        element={
          <RequireSession>
            <Chat />
          </RequireSession>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireSession>
            <Admin />
          </RequireSession>
        }
      />
      <Route
        path="/admin/insights"
        element={
          <RequireSession>
            <Insights />
          </RequireSession>
        }
      />
      <Route
        path="/groups"
        element={
          <RequireSession>
            <Groups />
          </RequireSession>
        }
      />
      <Route
        path="/groups/new"
        element={
          <RequireSession>
            <GroupForm />
          </RequireSession>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <RequireSession>
            <GroupDetail />
          </RequireSession>
        }
      />
      <Route
        path="/messages/:id/plan"
        element={
          <RequireSession>
            <PlanBoard />
          </RequireSession>
        }
      />
      <Route
        path="/account"
        element={
          <RequireSession>
            <Account />
          </RequireSession>
        }
      />
      <Route path="/account-deleted" element={<AccountDeleted />} />
      <Route path="/meeting-safely" element={<MeetingSafely />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/community-rules" element={<CommunityRules />} />
      <Route
        path="/welcome"
        element={
          <RequireSession>
            <WelcomeScreen />
          </RequireSession>
        }
      />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
