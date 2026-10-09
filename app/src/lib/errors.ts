// Turns database and network errors into sentences a member can act on.
// Raw error text never reaches the screen.

import { brand } from './brand'
import { count, roughly, rules } from './rules'

type ErrorLike = { message?: string; code?: string; status?: number } | null | undefined

const RULES: Array<[RegExp, string]> = [
  [/nonce|reauthenticat/i, 'That code didn’t work. Check the latest email from us, or ask for a new code.'],
  [/invalid login credentials/i, 'That email and password don’t match. Check them, or sign in with an emailed code instead.'],
  [/password should be at least|weak.?password/i, `Please choose a longer password, at least ${rules.signIn.passwordMin} characters.`],
  [/should be different from the old password/i, 'That’s already your password.'],
  [/token has expired|otp.*expired|invalid.*(otp|token)/i, 'That code didn’t work. It may have expired, so ask for a new one.'],
  [/rate limit|too many|security purposes/i, 'Too many tries in a short time. Please wait a minute, then try again.'],
  [/invalid email|unable to validate email|email address .* invalid/i, 'Please check your email address.'],
  [/failed to fetch|network|load failed/i, 'We couldn’t connect. Check your internet connection and try again.'],
  [/must be \d+/i, `You need to be ${rules.age.min} or over to join.`],
  [/pick \d+( to \d+)? interests/i, `Please pick ${rules.interests.pick} interests.`],
  [/profile is not finished/i, 'A few details are still missing. Please go back and fill them in.'],
  [/already ended/i, 'This trip has already ended. Please check the dates.'],
  [/trips can be up to .* ahead/i, `Trips can be up to ${roughly(rules.trips.maxDaysAhead)} ahead.`],
  [/upcoming trips/i, `You can have up to ${count(rules.trips.maxUpcoming, 'upcoming trip')}. Delete one to add another.`],
  [/up to \d+ places/i, `You can save up to ${count(rules.wishlist.max, 'place')}. Remove one to add another.`],
  [/wishlist_pkey/i, 'That place is already on your list.'],
  [/weekly request limit/i, 'You’ve used all your requests for this week. You get more on Monday.'],
  [/already in touch|connections_open_pair/i, 'You’re already connected with this member, or waiting for their reply. You’ll find them on the Chat tab.'],
  [/isn't available|isn’t available/i, 'This member isn’t available right now.'],
  [/add a profile photo before asking to connect/i, 'Please add a profile photo before asking to connect. It helps members feel safe saying yes.'],
  [/finish your profile/i, 'Please finish your profile before sending requests.'],
  [/requests are paused/i, 'Your requests are paused while we look into something about your account. We’ll be in touch by email.'],
  [/message not found/i, 'We couldn’t find that message.'],
  [/groups can have up to/i, `Groups can have up to ${rules.groups.maxPeople} people, including you.`],
  [/only invite people you're connected with|only invite people you’re connected with/i, 'You can only invite people you’re connected with.'],
  [/group limit reached/i, `You’ve reached your limit of groups for now. You can start another when your current group’s trip is over, or with ${brand.plusName}.`],
  [/group isn't available|group isn’t available/i, 'This group isn’t available any more.'],
  [/group not found|invite not found/i, 'We couldn’t find that group. The invite may have been withdrawn.'],
  [/idea not found/i, 'That idea has been removed.'],
  [/review a place once your trip/i, 'You can review a place once your trip there has started.'],
  [/pick a place and dates/i, 'Please pick a place and dates for the trip.'],
  [/only the person who added this idea can change/i, 'Only the person who added this idea can change its words.'],
  [/plan board is full/i, 'Your plan board is full. Remove a few ideas to add more.'],
  [/only the person who added this/i, 'Only the person who added this idea can remove it.'],
  [/account is paused/i, 'Your account is paused, so you can’t do this right now. There’s a note about it on your profile page.'],
  [/admins only/i, `This page is only for the ${brand.shortName} team.`],
  [/item not found/i, 'That has already been dealt with. Refresh the page to see what’s left.'],
  [/isn't possible here|isn’t possible here/i, 'That action isn’t possible here.'],
  [/member not found/i, 'We couldn’t find that member. They may have left.'],
  [/request not found/i, 'That request has already been answered or withdrawn.'],
  [/conversation has ended/i, 'This conversation has ended, so new messages can’t be sent.'],
  [/conversation not found/i, 'We couldn’t find that conversation. It may have ended.'],
  [/write a message first/i, 'Write a message first.'],
  [/messages_body_check/i, `Messages can be up to ${count(rules.chat.messageMax, 'character')}.`],
  [/pick when you/i, `Please pick when you’re meeting, from today up to ${roughly(rules.meetups.maxDaysAhead)} ahead.`],
  [/say where you/i, 'Please say where you’re meeting.'],
  [/sending messages very quickly/i, 'You’re sending messages very quickly. Please wait a few minutes.'],
  [/links open/i, `You’re already sharing ${count(rules.meetups.maxOpen, 'meet-up link')}. Stop sharing one you no longer need first.`],
  [/share a meet-up from one of your chats/i, 'You can only share a meet-up from one of your chats.'],
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
