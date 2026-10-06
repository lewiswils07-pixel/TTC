import type { Session, User } from '@supabase/supabase-js'
import { friendlyError } from './errors'
import { supabase } from './supabase'

export const CODE_LENGTH = 6
export const MIN_PASSWORD = 8
export const MAX_PASSWORD = 72

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normaliseEmail(email))
}

/** Emails a 6-digit sign-in code. New members get an account at the same time. */
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

/** Sets or changes the signed-in member's password. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } })
  if (error) throw friendlyError(error)
}

/** Whether the member has chosen a password (members who joined before passwords haven't). */
export function hasPassword(user: User | null | undefined): boolean {
  return user?.user_metadata?.has_password === true
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
