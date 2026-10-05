// Badge counts for the bottom tab bar: requests waiting for an answer and unread messages.
import { myConversations } from './chat'
import { myConnections } from './connections'

export type Tab = 'connections' | 'trips' | 'chat' | 'profile'

// Counts are shared between pages for a short while, so moving between
// tabs doesn't ask the database every time.
let cached: { at: number; counts: Partial<Record<Tab, number>> } | null = null

export async function loadTabCounts(): Promise<Partial<Record<Tab, number>>> {
  if (cached && Date.now() - cached.at < 20_000) return cached.counts
  const [connections, chats] = await Promise.all([myConnections().catch(() => []), myConversations().catch(() => null)])
  const counts = {
    connections: connections.filter((c) => c.direction === 'received' && c.status === 'pending').length,
    chat: (chats ?? []).reduce((n, c) => n + c.unread, 0),
  }
  cached = { at: Date.now(), counts }
  return counts
}

/** Forget the counts, after the member answers a request or reads a chat. */
export function refreshTabCounts(): void {
  cached = null
}

export function cachedTabCounts(): Partial<Record<Tab, number>> | null {
  return cached?.counts ?? null
}
