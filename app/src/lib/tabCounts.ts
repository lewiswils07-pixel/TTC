// Badge counts for the bottom tab bar: on Chat, unread messages plus requests waiting for an answer.
import { myConversations } from './chat'
import { myConnections } from './connections'

export type Tab = 'connections' | 'trips' | 'chat' | 'profile'
/** Tab badges, plus requests on their own for the Requests tab on Chat. */
export type Counts = Partial<Record<Tab | 'requests', number>>

// Counts are shared between pages for a short while, so moving between
// tabs doesn't ask the database every time.
let cached: { at: number; counts: Counts } | null = null

export async function loadTabCounts(): Promise<Counts> {
  if (cached && Date.now() - cached.at < 20_000) return cached.counts
  const [connections, chats] = await Promise.all([myConnections().catch(() => []), myConversations().catch(() => null)])
  const requests = connections.filter((c) => c.direction === 'received' && c.status === 'pending').length
  const counts = {
    requests,
    chat: requests + (chats ?? []).reduce((n, c) => n + c.unread, 0),
  }
  cached = { at: Date.now(), counts }
  return counts
}

/** Forget the counts, after the member answers a request or reads a chat. */
export function refreshTabCounts(): void {
  cached = null
}

export function cachedTabCounts(): Counts | null {
  return cached?.counts ?? null
}
