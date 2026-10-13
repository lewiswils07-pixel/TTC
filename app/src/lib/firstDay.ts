// "Your first day" on Who's going: three things to try, each ticked off as it
// happens (testers, 13 Oct: a guide that does, not tells). Kept on this phone.
const key = (me: string) => `sodalis.firstDay.${me}`

export type FirstDay = { read?: boolean; sent?: boolean; hidden?: boolean }

/** Shown for a member's first fortnight, unless they hide it. */
export const FIRST_DAY_DAYS = 14

export function loadFirstDay(me: string): FirstDay {
  try {
    return JSON.parse(localStorage.getItem(key(me)) ?? '{}') as FirstDay
  } catch {
    return {}
  }
}

export function saveFirstDay(me: string, change: FirstDay): FirstDay {
  const next = { ...loadFirstDay(me), ...change }
  try {
    localStorage.setItem(key(me), JSON.stringify(next))
  } catch {
    // Private windows can refuse storage; the list just starts again.
  }
  return next
}

/** Still new enough to see the guide. */
export function isNewMember(onboardedAt: string | null, now = Date.now()): boolean {
  return !!onboardedAt && now - Date.parse(onboardedAt) < FIRST_DAY_DAYS * 86_400_000
}
