// Loads each main screen's data in the background once a member is signed
// in, so the first visit to a tab shows straight away instead of filling in.
// Each screen still refreshes its own data when opened.
import { iAmAdmin, myNotices } from './admin'
import { remember } from './cache'
import { myConversations } from './chat'
import { myConnections } from './connections'
import { loadFeed } from './feed'
import { groupsICanStart, myGroups } from './groups'
import { npsDue } from './kpis'
import { meetPrompts } from './meet'
import { loadRequests } from './plan'
import { getMyProfile, listInterests } from './profile'
import { myBlocks } from './safety'
import { listMyTrips, listWishlist } from './trips'

export function warmUp(userId: string): void {
  const loads: [string, () => Promise<unknown>][] = [
    ['feed', loadFeed],
    ['requests', loadRequests],
    ['connections', myConnections],
    ['blocks', myBlocks],
    ['trips', listMyTrips],
    ['wishlist', listWishlist],
    ['conversations', myConversations],
    ['groups', myGroups],
    ['canStart', () => groupsICanStart().catch(() => 0)],
    ['interests', listInterests],
    ['notices', myNotices],
    ['admin', iAmAdmin],
    ['meetPrompts', meetPrompts],
    ['npsDue', npsDue],
  ]
  // Only for members who have finished sign-up: before that the screens would
  // remember an empty feed. Anything that fails just loads when it's opened.
  remember(`profile:${userId}`, getMyProfile(userId)).then(
    (me) => {
      if (me.profile.onboarded_at) for (const [key, load] of loads) void remember(key, load()).catch(() => undefined)
    },
    () => undefined,
  )
}
