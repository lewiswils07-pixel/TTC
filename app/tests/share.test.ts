import { describe, expect, it } from 'vitest'
import { describePerson, localInputValue, viewShare } from '../src/lib/share'

describe('trusted-contact link', () => {
  it('describes who the member is meeting', () => {
    expect(describePerson({ name: 'John', age: 55, home: 'Leeds', member_number: 12 })).toBe('John, 55, from Leeds (member no. 12)')
    expect(describePerson({ name: 'Mary', age: null, home: null, member_number: null })).toBe('Mary')
  })

  it('turns a date into a value for the date-and-time box', () => {
    expect(localInputValue(new Date(2026, 9, 6, 9, 5))).toBe('2026-10-06T09:05')
  })

  it('does not ask the server about a link that is the wrong shape', async () => {
    await expect(viewShare('short')).resolves.toBeNull()
    await expect(viewShare('../../etc/passwd/aaaaaaaaaaaaaaaaaaa')).resolves.toBeNull()
  })
})
