import type { Session, User } from '@supabase/supabase-js'
import { clearCache } from './cache'
import { friendlyError } from './errors'
import { rules } from './rules'
import { supabase } from './supabase'

// The sign-in settings in Supabase (code length, shortest password) must match these.
export const CODE_LENGTH = rules.signIn.codeLength
export const MIN_PASSWORD = rules.signIn.passwordMin
export const MAX_PASSWORD = rules.signIn.passwordMax

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normaliseEmail(email))
}

/** Emails a sign-in code. New members get an account at the same time. */
export async function sendCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: normaliseEmail(email),
    options: { shouldCreateUser: true },
  })
  if (error) throw friendlyError(error)
}

export async function verifyCode(email: string, code: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: normaliseEmail(email),
    token: code.replace(/\D/g, ''),
    type: 'email',
  })
  if (error || !data.session) throw friendlyError(error)
  return data.session
}

/** Signs in with email and password. The sign-in is kept on this device until they sign out. */
export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: normaliseEmail(email), password })
  if (error || !data.session) throw friendlyError(error)
  return data.session
}

/** Thrown when changing a password needs the emailed code first (it's been a while since they signed in). */
export class ReauthNeeded extends Error {}

/**
 * Sets or changes the signed-in member's password. Someone who signed in more
 * than a day ago must confirm with an emailed code first (pass it as `code`),
 * so a borrowed phone can't be used to lock the real member out.
 */
export async function setPassword(password: string, code?: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password, nonce: code?.replace(/\D/g, '') || undefined, data: { has_password: true } })
  if (error && !code && /reauthenticat/i.test(`${error.code ?? ''} ${error.message}`)) {
    const sent = await supabase.auth.reauthenticate()
    if (sent.error) throw friendlyError(sent.error)
    throw new ReauthNeeded()
  }
  if (error) throw friendlyError(error)
}

/** Whether the member has chosen a password (members who joined before passwords haven't). */
export function hasPassword(user: User | null | undefined): boolean {
  return user?.user_metadata?.has_password === true
}

/** Still to choose a password or say "Not now": asked again until they do (testers lost theirs on a refresh). */
export function needsPasswordChoice(user: User | null | undefined): boolean {
  return !!user && !hasPassword(user) && user.user_metadata?.password_skipped !== true
}

/** "Not now, I'll use emailed codes": remembered with the account so we don't ask again. */
export async function skipPassword(): Promise<void> {
  await supabase.auth.updateUser({ data: { password_skipped: true } })
}

/** Signs out everywhere, and clears this member's saved choices from this device. */
export async function signOut(): Promise<void> {
  clearDevice()
  await supabase.auth.signOut()
}

/** Removes everything the app saved on this device except "has signed in before". */
export function clearDevice(): void {
  clearCache()
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sodalis.') && key !== 'sodalis.signedInBefore') localStorage.removeItem(key)
    }
  } catch {
    // Storage can be blocked; nothing to clear then.
  }
}
