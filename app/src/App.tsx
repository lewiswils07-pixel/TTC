import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { RequireSession } from './components/Guards'
import { HeardFromPrompt } from './components/HeardFromPrompt'
import { PrivacyPrompt } from './components/PrivacyPrompt'
import { Loading } from './components/Layout'
import { SessionProvider } from './lib/session'
import { useSession } from './lib/session-context'
import { warmUp } from './lib/warm'
import { Home } from './routes/Home'
import { NotFound } from './routes/NotFound'
import { SignIn } from './routes/SignIn'

// Screens for signed-in members load on demand, so the first screen is quick.
const Onboarding = lazy(() => import('./routes/Onboarding').then((m) => ({ default: m.Onboarding })))
const TripMatches = lazy(() => import('./routes/TripMatches').then((m) => ({ default: m.TripMatches })))
const Connections = lazy(() => import('./routes/Connections').then((m) => ({ default: m.Connections })))
const TripForm = lazy(() => import('./routes/TripForm').then((m) => ({ default: m.TripForm })))
const MemberProfile = lazy(() => import('./routes/MemberProfile').then((m) => ({ default: m.MemberProfile })))
const SameTime = lazy(() => import('./routes/SameTime').then((m) => ({ default: m.SameTime })))
const ForYou = lazy(() => import('./routes/ForYou').then((m) => ({ default: m.ForYou })))
const Trips = lazy(() => import('./routes/Trips').then((m) => ({ default: m.Trips })))
const Filters = lazy(() => import('./routes/Filters').then((m) => ({ default: m.Filters })))
const Messages = lazy(() => import('./routes/Messages').then((m) => ({ default: m.Messages })))
const Chat = lazy(() => import('./routes/Chat').then((m) => ({ default: m.Chat })))
const CardPreview = lazy(() => import('./routes/CardPreview').then((m) => ({ default: m.CardPreview })))
const PlanTogether = lazy(() => import('./routes/PlanTogether').then((m) => ({ default: m.PlanTogether })))
const Help = lazy(() => import('./routes/Help').then((m) => ({ default: m.Help })))
const Admin = lazy(() => import('./routes/Admin').then((m) => ({ default: m.Admin })))
const account = () => import('./routes/Account')
const Account = lazy(() => account().then((m) => ({ default: m.Account })))
const AccountDeleted = lazy(() => account().then((m) => ({ default: m.AccountDeleted })))
const Insights = lazy(() => import('./routes/Insights').then((m) => ({ default: m.Insights })))
const MeetingSafely = lazy(() => import('./routes/MeetingSafely').then((m) => ({ default: m.MeetingSafely })))
const Groups = lazy(() => import('./routes/Groups').then((m) => ({ default: m.Groups })))
const GroupForm = lazy(() => import('./routes/GroupForm').then((m) => ({ default: m.GroupForm })))
const GroupDetail = lazy(() => import('./routes/GroupDetail').then((m) => ({ default: m.GroupDetail })))
const ShareMeetup = lazy(() => import('./routes/ShareMeetup').then((m) => ({ default: m.ShareMeetup })))
const SafeView = lazy(() => import('./routes/SafeView').then((m) => ({ default: m.SafeView })))
const PlanBoard = lazy(() => import('./routes/PlanBoard').then((m) => ({ default: m.PlanBoard })))
const legal = () => import('./routes/Legal')
const Terms = lazy(() => legal().then((m) => ({ default: m.Terms })))
const Privacy = lazy(() => legal().then((m) => ({ default: m.Privacy })))
const CommunityRules = lazy(() => legal().then((m) => ({ default: m.CommunityRules })))
const WelcomeScreen = lazy(() => import('./routes/Welcome').then((m) => ({ default: m.WelcomeScreen })))
const Profile = lazy(() => import('./routes/Profile').then((m) => ({ default: m.Profile })))
const settings = () => import('./routes/Settings')
const Settings = lazy(() => settings().then((m) => ({ default: m.Settings })))
const PrivacyChoices = lazy(() => settings().then((m) => ({ default: m.PrivacyChoicesPage })))

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  )
}

// Once a member is signed in, the other screens download quietly in the
// background, so moving between them doesn't wait for the network.
const MEMBER_SCREENS = [
  () => import('./routes/ForYou'),
  () => import('./routes/Connections'),
  () => import('./routes/Trips'),
  () => import('./routes/TripMatches'),
  () => import('./routes/TripForm'),
  () => import('./routes/Messages'),
  () => import('./routes/Chat'),
  () => import('./routes/Groups'),
  () => import('./routes/GroupDetail'),
  () => import('./routes/GroupForm'),
  () => import('./routes/PlanBoard'),
  () => import('./routes/ShareMeetup'),
  () => import('./routes/Profile'),
  () => import('./routes/Filters'),
  () => import('./routes/Account'),
  () => import('./routes/Settings'),
  () => import('./routes/MeetingSafely'),
  () => import('./routes/Onboarding'),
]

function usePreloadScreens() {
  const userId = useSession().session?.user.id
  useEffect(() => {
    if (!userId) return
    warmUp(userId)
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1200))
    const id = idle(() => MEMBER_SCREENS.forEach((load) => void load().catch(() => undefined)))
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id)
  }, [userId])
}

export function AppRoutes() {
  usePreloadScreens()
  return (
    <Suspense fallback={<Loading />}>
      <HeardFromPrompt />
      <PrivacyPrompt />
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
        path="/connections/same-time"
        element={
          <RequireSession>
            <SameTime />
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
        path="/connections/people/:id"
        element={
          <RequireSession>
            <MemberProfile />
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
        path="/messages/:id/share"
        element={
          <RequireSession>
            <ShareMeetup />
          </RequireSession>
        }
      />
      <Route
        path="/profile/preview"
        element={
          <RequireSession>
            <CardPreview />
          </RequireSession>
        }
      />
      <Route
        path="/plan-together/:id"
        element={
          <RequireSession>
            <PlanTogether />
          </RequireSession>
        }
      />
      <Route path="/help" element={<Help />} />
      <Route path="/safe/:token" element={<SafeView />} />
      <Route
        path="/account"
        element={
          <RequireSession>
            <Account />
          </RequireSession>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireSession>
            <Settings />
          </RequireSession>
        }
      />
      <Route
        path="/settings/privacy"
        element={
          <RequireSession>
            <PrivacyChoices />
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
