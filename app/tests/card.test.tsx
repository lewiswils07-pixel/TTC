import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axeViolations } from './a11y'
import { CardBack } from '../src/components/CardBack'
import { Tour } from '../src/components/Tour'
import { ANSWER_MAX_WORDS, CARD_QUESTIONS, checkAnswer, cleanAnswers, hasCard, questionText } from '../src/lib/card'

describe('the back of the card', () => {
  it('offers 25 questions, each with its own key', () => {
    const keys = CARD_QUESTIONS.flatMap((g) => g.questions.map((q) => q.key))
    expect(keys).toHaveLength(25)
    expect(new Set(keys).size).toBe(25)
    for (const k of keys) expect(k).toMatch(/^[a-z_]{2,40}$/)
    expect(questionText('perfect_holiday')).toBe('Describe your perfect holiday')
  })
  it('keeps each answer short enough to fit on the card', () => {
    expect(checkAnswer({ q: '', a: 'x' })).toMatch(/choose a question/)
    expect(checkAnswer({ q: 'how_often', a: '  ' })).toMatch(/write your answer/)
    expect(checkAnswer({ q: 'how_often', a: 'word '.repeat(ANSWER_MAX_WORDS + 1) })).toMatch(/30 words/)
    expect(checkAnswer({ q: 'how_often', a: 'Twice a year' })).toBeNull()
  })
  it('only keeps known questions, tidied, at most 3', () => {
    expect(
      cleanAnswers([
        { q: 'how_often', a: '  Twice   a year ' },
        { q: 'not_a_question', a: 'x' },
        { q: 'dream_trip', a: 'Japan' },
        { q: 'always_pack', a: 'A book' },
        { q: 'souvenir', a: 'Tea' },
      ]),
    ).toEqual([
      { q: 'how_often', a: 'Twice a year' },
      { q: 'dream_trip', a: 'Japan' },
      { q: 'always_pack', a: 'A book' },
    ])
    expect(hasCard(null)).toBe(false)
    expect(hasCard({ card_answers: [{ q: 'how_often', a: 'x' }] })).toBe(false)
  })
  it('shows the questions and answers', async () => {
    const { container } = render(<CardBack name="Ann" answers={[{ q: 'perfect_holiday', a: 'Lisbon in May' }]} />)
    expect(screen.getByText('Describe your perfect holiday')).toBeInTheDocument()
    expect(screen.getByText('Lisbon in May')).toBeInTheDocument()
    expect(await axeViolations(container)).toEqual([])
    render(<CardBack name="Bob" answers={[]} />)
    expect(screen.getByText('Bob hasn’t filled in the back of their card yet.')).toBeInTheDocument()
  })
})

describe('the tour', () => {
  it('steps through and closes', async () => {
    const onClose = vi.fn()
    render(<Tour onClose={onClose} />)
    expect(screen.getByRole('heading', { name: 'Meet people one at a time' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Flip the card' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Meet people one at a time' })).toBeInTheDocument()
    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onClose).toHaveBeenCalled()
  })
})
