// Members' star ratings and short reviews of places.
import { friendlyError } from './errors'
import { rules } from './rules'
import { supabase } from './supabase'

export const MAX_REVIEW = rules.reviews.textMax

export type Review = {
  author_id: string
  author: string
  rating: number
  body: string | null
  updated_at: string
  mine: boolean
  went_on_trip: boolean
  average: number
  total: number
}

export async function cityReviews(cityId: number): Promise<Review[]> {
  const { data, error } = await supabase.rpc('city_reviews', { p_city_id: cityId })
  if (error) throw friendlyError(error)
  return ((data ?? []) as Review[]).map((r) => ({ ...r, average: Number(r.average) }))
}

export async function saveReview(cityId: number, rating: number, body: string): Promise<void> {
  const { error } = await supabase.rpc('save_city_review', { p_city_id: cityId, p_rating: rating, p_body: body.trim() || null })
  if (error) throw friendlyError(error)
}

export async function deleteReview(cityId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_city_review', { p_city_id: cityId })
  if (error) throw friendlyError(error)
}

export function checkReview(rating: number | null, body: string): string | null {
  if (!rating) return 'Please choose how many stars.'
  if (body.trim().length > MAX_REVIEW) return `Please keep this to ${MAX_REVIEW} characters or fewer.`
  return null
}

/** "Oct 2026", when a review was written or last changed. */
export function reviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
