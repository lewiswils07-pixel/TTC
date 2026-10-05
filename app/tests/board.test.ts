import { describe, expect, it } from 'vitest'
import { checkIdea, checkLink, dayLabel, normalizeLink } from '../src/lib/board'

describe('plan board checks', () => {
  it('needs an idea', () => {
    expect(checkIdea('  ')).toMatch(/idea/)
    expect(checkIdea('x'.repeat(121))).toMatch(/120/)
    expect(checkIdea('Tram 28')).toBeNull()
  })
  it('only takes full https links', () => {
    expect(checkLink('')).toBeNull()
    expect(checkLink('https://www.example.com/tickets')).toBeNull()
    expect(checkLink('http://example.com')).toMatch(/https/)
    expect(checkLink('javascript:alert(1)')).toMatch(/https/)
    expect(checkLink('https://nodot')).toMatch(/https/)
  })
  it('labels days with dates when the trip is known', () => {
    expect(dayLabel(2)).toBe('Day 2')
    expect(dayLabel(2, '2026-05-11')).toBe('Day 2 · Tue 12 May')
  })
})

describe('normalizeLink', () => {
  it('adds https:// to a bare address', () => {
    expect(normalizeLink(' www.example.com/tickets ')).toBe('https://www.example.com/tickets')
    expect(normalizeLink('https://example.com')).toBe('https://example.com')
    expect(normalizeLink('http://example.com')).toBe('http://example.com')
    expect(normalizeLink('not a link')).toBe('not a link')
  })
})
