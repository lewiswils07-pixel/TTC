// A member's rights over their own data (task T19): download everything we
// hold about them, and delete their account.
import { friendlyError } from './errors'
import { PHOTO_BUCKET } from './photo'
import { supabase } from './supabase'

/** Everything we hold about the signed-in member, saved as a JSON file on their device. */
export async function downloadMyData(): Promise<void> {
  const { data, error } = await supabase.rpc('my_data')
  if (error) throw friendlyError(error)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sodalis-my-data-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Removes their photos, then their account and everything linked to it. Call signOutHere() afterwards. */
export async function deleteMyAccount(userId: string): Promise<void> {
  const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(userId)
  if (files?.length) await supabase.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${userId}/${f.name}`))
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw friendlyError(error)
}

/** The sign-in no longer exists after deletion, so this only clears it from the phone. */
export async function signOutHere(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
}
