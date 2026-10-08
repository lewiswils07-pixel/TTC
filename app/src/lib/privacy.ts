// "We value your privacy": the member's choices about optional tools.
// Tools the app needs to work (signing in, chat) are always on.
import { friendlyError } from './errors'
import { supabase } from './supabase'

export type PrivacyChoices = { measuring: boolean; marketing: boolean }

export const PRIVACY_TOOLS: { key: keyof PrivacyChoices; title: string; text: string }[] = [
  {
    key: 'measuring',
    title: 'Measuring how the app is used',
    text: 'Helps us see how many people use the Collective and which parts they use, so we can make it better for you.',
  },
  {
    key: 'marketing',
    title: 'News and offers from us',
    text: 'Lets us send you our own news and offers that suit you, and see how well they work. We never show you adverts.',
  },
]

const missing = (code?: string) => code === 'PGRST202' || code === 'PGRST205' || code === '42P01'

/** The saved choices; null if the member hasn't chosen yet, undefined if the database can't say. */
export async function myPrivacyChoices(): Promise<PrivacyChoices | null | undefined> {
  const { data, error } = await supabase.from('privacy_choices').select('measuring, marketing').maybeSingle()
  if (error) {
    if (missing(error.code)) return undefined
    throw friendlyError(error)
  }
  return data
}

export async function savePrivacyChoices(userId: string, choices: PrivacyChoices): Promise<void> {
  const { error } = await supabase.rpc('set_privacy_choices', { p_measuring: choices.measuring, p_marketing: choices.marketing })
  if (error) throw friendlyError(error)
  markChosen(userId)
}

// Kept on this phone so the question isn't checked on every visit.
const chosenKey = (userId: string) => `sodalis.privacyChosen.${userId}`
export function chosenHere(userId: string): boolean {
  try {
    return localStorage.getItem(chosenKey(userId)) === '1'
  } catch {
    return false
  }
}
export function markChosen(userId: string) {
  try {
    localStorage.setItem(chosenKey(userId), '1')
  } catch {
    // Private browsing: we'll check with the server next time.
  }
}
