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
