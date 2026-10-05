import { describe, expect, it } from 'vitest'
import { groupInterests } from '../src/lib/interests'
import { birthDate, checkAgeRange, checkBirthDate, checkBirthYear, checkCode, checkEmail, checkInterests, checkName } from '../src/lib/validation'

const now = new Date('2026-10-05')

describe('instant field checks', () => {
  it('email', () => {
    expect(checkEmail('')).toMatch(/enter your email/)
    expect(checkEmail('jane@example')).toMatch(/doesn’t look like/)
    expect(checkEmail(' Jane@Example.com ')).toBeNull()
  })
  it('code', () => {
    expect(checkCode('12ab')).toMatch(/only has numbers/)
    expect(checkCode('1234')).toMatch(/You’ve typed 4/)
    expect(checkCode('123 456')).toBeNull()
  })
  it('name', () => {
    expect(checkName('  ')).toMatch(/first name/)
    expect(checkName('Jo3')).toMatch(/numbers/)
    expect(checkName('Jo')).toBeNull()
  })
  it('birth year', () => {
    expect(checkBirthYear('', now)).toMatch(/year you were born/)
    expect(checkBirthYear('196', now)).toMatch(/four digits/)
    expect(checkBirthYear('1850', now)).toMatch(/too early/)
    expect(checkBirthYear('2009', now)).toMatch(/18 or over/)
    expect(checkBirthYear('2008', now)).toBeNull()
  })
  it('interests and ages', () => {
    expect(checkInterests([1, 2])).toMatch(/at least 3.*picked 2/)
    expect(checkInterests([1, 2, 3])).toBeNull()
    expect(checkAgeRange([18, 99])).toBeNull()
    expect(checkAgeRange([60, 40])).not.toBeNull()
  })
})

describe('groupInterests', () => {
  it('keeps the list order and groups by category', () => {
    const groups = groupInterests([
      { id: 1, slug: 'museums', label: 'Museums', category_label: 'Arts and culture' },
      { id: 2, slug: 'theatre', label: 'Theatre', category_label: 'Arts and culture' },
      { id: 3, slug: 'wine', label: 'Wine', category_label: 'Food and drink' },
    ])
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['Arts and culture', 2], ['Food and drink', 1]])
  })
  it('copes with the old list that has no categories', () => {
    expect(groupInterests([{ id: 1, slug: 'museums', label: 'Museums' }])[0].label).toBe('Interests')
  })
})

describe('date of birth', () => {
  const now = new Date(2026, 9, 5)
  it('builds a date only when it exists', () => {
    expect(birthDate('29', '2', '1960')).toBe('1960-02-29')
    expect(birthDate('29', '2', '1961')).toBeNull()
    expect(birthDate('', '2', '1961')).toBeNull()
  })
  it('checks age by the full date', () => {
    expect(checkBirthDate('5', '10', '2008', now)).toBeNull()
    expect(checkBirthDate('6', '10', '2008', now)).toMatch(/18 or over/)
    expect(checkBirthDate('31', '4', '1970', now)).toMatch(/doesn’t exist/)
    expect(checkBirthDate('', '', '', now)).toMatch(/date of birth/)
    expect(checkBirthDate('1', '1', '1870', now)).toMatch(/too early/)
  })
})
