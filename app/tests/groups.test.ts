import { describe, expect, it } from 'vitest'
import { friendlyMessage } from '../src/lib/errors'
import { checkGroupName } from '../src/lib/groups'

describe('checkGroupName', () => {
  it('needs a name', () => {
    expect(checkGroupName('   ')).toMatch(/name/)
  })
  it('keeps names short', () => {
    expect(checkGroupName('x'.repeat(61))).toMatch(/60/)
    expect(checkGroupName('Lisbon in May')).toBeNull()
  })
})

describe('group errors', () => {
  it('explains the size and invite rules', () => {
    expect(friendlyMessage({ message: 'Groups can have up to 6 people' })).toMatch(/including you/)
    expect(friendlyMessage({ message: "You can only invite people you're connected with" })).toMatch(/connected/)
    expect(friendlyMessage({ message: 'Group limit reached' })).toMatch(/Sodalis\+/)
  })
})
