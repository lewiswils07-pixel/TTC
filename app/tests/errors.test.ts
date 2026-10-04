import { describe, expect, it } from 'vitest'
import { FALLBACK, friendlyError, friendlyMessage, messageOf } from '../src/lib/errors'

describe('friendlyMessage', () => {
  it('explains an expired code', () => {
    expect(friendlyMessage({ message: 'Token has expired or is invalid' })).toMatch(/expired/)
  })
  it('explains rate limits', () => {
    expect(friendlyMessage({ message: 'For security purposes, you can only request this after 42 seconds.' })).toMatch(/wait a minute/)
  })
  it('explains being offline', () => {
    expect(friendlyMessage({ message: 'Failed to fetch' })).toMatch(/internet connection/)
  })
  it('passes on the database age rule', () => {
    expect(friendlyMessage({ message: 'Members must be 18 or over' })).toBe('You need to be 18 or over to join.')
  })
  it('never shows raw database text', () => {
    expect(friendlyMessage({ message: 'duplicate key value violates unique constraint "x"' })).toBe(FALLBACK)
    expect(friendlyMessage(null)).toBe(FALLBACK)
  })
  it('keeps friendly errors as they are', () => {
    expect(messageOf(friendlyError({ message: 'Failed to fetch' }))).toMatch(/internet/)
    expect(messageOf(new Error('boom'))).toBe(FALLBACK)
  })
})
