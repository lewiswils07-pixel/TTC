// The back of a member's card: answers to 3 questions they pick from the
// list below. Shown when someone flips their card on For you. Each answer is
// kept short so all three fit on the card.
import { friendlyError } from './errors'
import { supabase } from './supabase'
import { rules } from './rules'

export const ANSWERS_TO_PICK = rules.card.answers
export const ANSWER_MAX_WORDS = rules.card.maxWords
export const ANSWER_MAX_CHARS = rules.card.maxChars

export type CardAnswer = { q: string; a: string }
export type Card = { card_answers: CardAnswer[] }

/** The questions members choose from, grouped as they appear in the chooser. Keys are stored, so never rename one. */
export const CARD_QUESTIONS: { group: string; questions: { key: string; text: string }[] }[] = [
  {
    group: 'How you travel',
    questions: [
      { key: 'perfect_holiday', text: 'Describe your perfect holiday' },
      { key: 'how_often', text: 'How often do you get away?' },
      { key: 'always_pack', text: 'I never travel without…' },
      { key: 'favourite_season', text: 'My favourite time of year to travel is…' },
      { key: 'window_or_aisle', text: 'Window seat or aisle, and why?' },
      { key: 'first_thing', text: 'The first thing I do in a new place is…' },
      { key: 'souvenir', text: 'The souvenir I always bring home is…' },
    ],
  },
  {
    group: 'Places',
    questions: [
      { key: 'dream_trip', text: 'The trip at the top of my list is…' },
      { key: 'best_place', text: 'The best place I’ve ever been is…' },
      { key: 'go_back', text: 'A place I’d happily go back to every year…' },
      { key: 'underrated', text: 'An underrated place everyone should visit…' },
      { key: 'city_or_country', text: 'City break or countryside, and why?' },
    ],
  },
  {
    group: 'Food and drink',
    questions: [
      { key: 'best_meal', text: 'The best meal I’ve had abroad was…' },
      { key: 'always_try', text: 'Wherever I go, I always try the local…' },
      { key: 'travel_morning', text: 'My perfect travel morning starts with…' },
      { key: 'market_or_dining', text: 'Food market or fine dining?' },
    ],
  },
  {
    group: 'Good company',
    questions: [
      { key: 'travel_buddy', text: 'The best travel companion is someone who…' },
      { key: 'talk_about', text: 'We’ll get on if you like talking about…' },
      { key: 'perfect_evening', text: 'My perfect evening away is…' },
      { key: 'show_you', text: 'Something I could show you on a trip…' },
    ],
  },
  {
    group: 'Stories',
    questions: [
      { key: 'funny_moment', text: 'My funniest travel moment was…' },
      { key: 'got_lost', text: 'The time I got wonderfully lost…' },
      { key: 'travel_taught', text: 'Travel has taught me…' },
      { key: 'once_in_life', text: 'Something I want to do at least once…' },
      { key: 'next_trip', text: 'My next trip is…' },
    ],
  },
]

const QUESTION_TEXT = new Map(CARD_QUESTIONS.flatMap((g) => g.questions.map((q) => [q.key, q.text] as const)))

/** The question's wording, or null for a key this version of the app doesn't know. */
export const questionText = (key: string) => QUESTION_TEXT.get(key) ?? null

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

export function checkAnswer(answer: CardAnswer): string | null {
  if (!answer.q) return 'Please choose a question.'
  if (!answer.a.trim()) return 'Please write your answer.'
  const words = wordCount(answer.a)
  if (words > ANSWER_MAX_WORDS) return `Please keep it to ${ANSWER_MAX_WORDS} words, so it fits on your card. You’re on ${words}.`
  if (answer.a.trim().length > ANSWER_MAX_CHARS) return `Please keep it under ${ANSWER_MAX_CHARS} characters, so it fits on your card.`
  return null
}

/** Only answers to questions we know, trimmed, at most 3. */
export const cleanAnswers = (answers: CardAnswer[]) =>
  answers
    .filter((x) => questionText(x.q) && x.a.trim())
    .map((x) => ({ q: x.q, a: x.a.trim().replace(/\s+/g, ' ') }))
    .slice(0, ANSWERS_TO_PICK)

/** True once the member has written the back of their card. */
export const hasCard = (c: Card | null) => (c?.card_answers.length ?? 0) >= ANSWERS_TO_PICK

export async function saveCard(userId: string, answers: CardAnswer[]): Promise<void> {
  const { error } = await supabase.from('profiles').update({ card_answers: cleanAnswers(answers) }).eq('id', userId)
  if (error) throw friendlyError(error)
}

/** The back of someone's card, or an empty card if they haven't written one (or it can't be shown). */
export async function loadCard(profileId: string): Promise<Card> {
  const { data, error } = await supabase.rpc('member_card', { p_profile: profileId })
  if (error) {
    // Before the database part with cards is live, there's nothing to show yet.
    if (error.code === 'PGRST202') return { card_answers: [] }
    throw friendlyError(error)
  }
  const row = (data as Card[] | null)?.[0]
  return { card_answers: cleanAnswers(row?.card_answers ?? []) }
}
