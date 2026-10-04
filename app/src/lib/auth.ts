import type { Session } from '@supabase/supabase-js'
import { friendlyError } from './errors'
import { supabase } from './supabase'

export const CODE_LENGTH = 6

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

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
