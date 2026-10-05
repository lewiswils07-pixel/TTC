// Turns database and network errors into sentences a member can act on.
// Raw error text never reaches the screen.

type ErrorLike = { message?: string; code?: string; status?: number } | null | undefined

const RULES: Array<[RegExp, string]> = [
  [/token has expired|otp.*expired|invalid.*(otp|token)/i, "That code didn't work. It may have expired, so ask for a new one."],
  [/rate limit|too many|security purposes/i, 'Too many tries in a short time. Please wait a minute, then try again.'],
  [/invalid email|unable to validate email|email address .* invalid/i, 'Please check your email address.'],
  [/failed to fetch|network|load failed/i, "We couldn't reach the server. Check your internet connection and try again."],
  [/must be 18/i, 'You need to be 18 or over to join.'],
  [/pick 3 to 10 interests/i, 'Please pick between 3 and 10 interests.'],
  [/profile is not finished/i, 'A few details are still missing. Please go back and fill them in.'],
  [/already ended/i, 'This trip has already ended. Please check the dates.'],
  [/up to 2 years ahead/i, 'Trips can be up to 2 years ahead.'],
  [/up to 20 upcoming trips/i, 'You can have up to 20 upcoming trips. Delete one to add another.'],
  [/up to 10 places/i, 'You can save up to 10 places. Remove one to add another.'],
  [/wishlist_pkey/i, 'That place is already on your list.'],
  [/weekly request limit/i, 'You’ve used your 5 requests this week. You get 5 more on Monday.'],
  [/already in touch|connections_open_pair/i, 'You can’t send this member a request right now. You may already be connected or waiting for a reply.'],
  [/isn't available|isn’t available/i, 'This member isn’t available right now.'],
  [/finish your profile/i, 'Please finish your profile before sending requests.'],
  [/request not found/i, 'That request has already been answered or withdrawn.'],
  [/payload too large|exceeded the maximum allowed size/i, 'That photo is too big. Please choose a smaller one.'],
]

export const FALLBACK = 'Something went wrong on our side. Please try again.'

export function friendlyMessage(error: ErrorLike): string {
  const text = error?.message ?? ''
  for (const [pattern, message] of RULES) if (pattern.test(text)) return message
  return FALLBACK
}

export class FriendlyError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'FriendlyError'
  }
}

export function friendlyError(error: ErrorLike): FriendlyError {
  return new FriendlyError(friendlyMessage(error), error)
}

export function messageOf(error: unknown): string {
  return error instanceof FriendlyError ? error.message : friendlyMessage(error as ErrorLike)
}
