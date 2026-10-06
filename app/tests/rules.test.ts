// The club's rules are written once, in app/rules.json. These checks fail if
// a copy has drifted: the database files made by `npm run rules`, or the
// answer lists in options.ts.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUDGETS, DAY_RHYTHMS, GENDERS, PACES, ROOM_SHARING, SHOWN_GENDERS, TRAVEL_STYLES, WALKING } from '../src/lib/options'
import { count, roughly, rules } from '../src/lib/rules'
// @ts-expect-error a plain JavaScript script, with no types
import { rulesSql, rulesTest } from '../scripts/rules-sql.mjs'

const file = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('rules', () => {
  it('the database files are up to date (run `npm run rules` if not)', () => {
    expect(file('../../supabase/rules.sql')).toBe(rulesSql(rules))
    expect(file('../../supabase/tests/rules.test.sql')).toBe(rulesTest(rules))
  })
  it('options.ts offers exactly the answers in rules.json', () => {
    const values = (list: readonly { value: string }[]) => list.map((o) => o.value)
    expect(values(GENDERS)).toEqual(rules.choices.gender)
    expect(values(TRAVEL_STYLES)).toEqual(rules.choices.travelStyle)
    expect(values(PACES)).toEqual(rules.choices.pace)
    expect(values(BUDGETS)).toEqual(rules.choices.budget)
    expect(values(ROOM_SHARING)).toEqual(rules.choices.roomSharing)
    expect(values(DAY_RHYTHMS)).toEqual(rules.choices.dayRhythm)
    expect(values(WALKING)).toEqual(rules.choices.walking)
    expect(values(SHOWN_GENDERS)).toEqual(rules.choices.genderShown)
  })
  it('words numbers the way members say them', () => {
    expect(roughly(730)).toBe('2 years')
    expect(roughly(90)).toBe('3 months')
    expect(roughly(30)).toBe('30 days')
    expect(count(1, 'place')).toBe('1 place')
    expect(count(2000, 'character')).toBe('2,000 characters')
  })
})
