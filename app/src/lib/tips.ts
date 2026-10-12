// Nice to know: members' tips from their trips (a place to eat, a museum,
// how to get about), sorted by kind. Sodalis+ members can search them.
import { friendlyError } from './errors'
import type { Option } from './options'
import { rules } from './rules'
import { supabase } from './supabase'

export type TipCategory = (typeof rules.choices.tipCategory)[number]

const LABELS: Record<string, string> = {
  food: 'Food',
  drink: 'Drink',
  museums: 'Museums',
  sights: 'Sights',
  walks: 'Walks',
  shopping: 'Shopping',
  getting_around: 'Getting around',
  stays: 'Stays',
}

/** The kinds of tip, in the order of rules.json. */
export const TIP_CATEGORIES: Option<TipCategory>[] = rules.choices.tipCategory.map((value) => ({ value, label: LABELS[value] ?? value }))

export const tipLabel = (c: string) => LABELS[c] ?? c

export type Tip = {
  id: number
  author_id: string
  author: string
  category: TipCategory
  place: string
  body: string | null
  rating: number | null
  created_at: string
  mine: boolean
  went_on_trip: boolean
}

/** Tips about a place. The kind and search words only filter for Sodalis+ members. */
export async function cityTips(cityId: number, category?: string | null, query?: string): Promise<Tip[]> {
  const { data, error } = await supabase.rpc('city_tips', { p_city_id: cityId, p_category: category || null, p_query: query?.trim() || null })
  if (error) throw friendlyError(error)
  return (data ?? []) as Tip[]
}

export type NewTip = { category: TipCategory | null; place: string; body: string; rating: number | null }

export function checkTip(t: NewTip): string | null {
  if (!t.category) return 'Please choose what kind of tip this is.'
  if (!t.place.trim()) return 'Please name the place.'
  if (t.place.trim().length > rules.tips.placeMax) return `Please keep the place name to ${rules.tips.placeMax} characters or fewer.`
  if (t.body.trim().length > rules.tips.textMax) return `Please keep your tip to ${rules.tips.textMax} characters or fewer.`
  return null
}

export async function addTip(cityId: number, t: NewTip): Promise<void> {
  const { error } = await supabase.rpc('add_city_tip', { p_city_id: cityId, p_category: t.category, p_place: t.place.trim(), p_body: t.body.trim() || null, p_rating: t.rating })
  if (error) throw friendlyError(error)
}

export async function deleteTip(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_city_tip', { p_id: id })
  if (error) throw friendlyError(error)
}
