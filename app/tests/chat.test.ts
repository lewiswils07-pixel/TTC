import { describe, expect, it } from 'vitest'
import { dayLabel, listTime, messageTime } from '../src/lib/chat'
import { friendlyMessage } from '../src/lib/errors'

describe('messageTime', () => {
  const now = new Date('2026-10-08T18:00:00')
  it('shows only the time today', () => {
    expect(messageTime('2026-10-08T09:05:00', now)).toBe('09:05')
  })
  it('shows the day and time this week', () => {
    expect(messageTime('2026-10-06T14:30:00', now)).toBe('Tue 14:30')
  })
  it('shows the date for older messages', () => {
    expect(messageTime('2026-09-20T14:30:00', now)).toBe('20 Sept')
  })
})

describe('chat errors', () => {
  it('explains an ended conversation', () => {
    expect(friendlyMessage({ message: 'This conversation has ended' })).toMatch(/ended/)
  })
  it('explains an empty or long message', () => {
    expect(friendlyMessage({ message: 'Write a message first' })).toBe('Write a message first.')
    expect(friendlyMessage({ message: 'new row violates check constraint "messages_body_check"' })).toMatch(/2,000/)
  })
})

describe('listTime and dayLabel', () => {
  const now = new Date('2026-10-08T18:00:00')
  it('shows the time today, then Yesterday, a weekday, then a date', () => {
    expect(listTime('2026-10-08T10:42:00', now)).toBe('10:42')
    expect(listTime('2026-10-07T10:42:00', now)).toBe('Yesterday')
    expect(listTime('2026-10-05T10:42:00', now)).toBe('Mon')
    expect(listTime('2026-08-03T10:42:00', now)).toBe('3 Aug')
  })
  it('names the day between messages', () => {
    expect(dayLabel('2026-10-08T09:00:00', now)).toBe('Today')
    expect(dayLabel('2026-10-07T09:00:00', now)).toBe('Yesterday')
    expect(dayLabel('2026-10-05T09:00:00', now)).toBe('Mon 5 Oct')
  })
})
