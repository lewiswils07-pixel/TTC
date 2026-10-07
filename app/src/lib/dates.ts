// Calendar dates as YYYY-MM-DD strings, the format date inputs and Postgres share.

/** A local date as YYYY-MM-DD (what date inputs and Postgres use). */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + days))
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "12–19 Oct 2026" or "28 Oct – 3 Nov 2026" style ranges. */
export function tripDates(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T00:00:00Z`)
  return dateFormat.formatRange(s, e)
}

const shortFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "14–20 May" without the year when it's this year, else as tripDates. */
export function shortDates(start: string, end: string, today = isoDate(new Date())): string {
  if (start.slice(0, 4) !== today.slice(0, 4) || end.slice(0, 4) !== today.slice(0, 4)) return tripDates(start, end)
  return shortFormat.formatRange(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`))
}

const longFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "5 January 2027". */
export function longDate(iso: string): string {
  return longFormat.format(new Date(`${iso}T00:00:00Z`))
}

/** "Sat 14 Nov": how a chosen date reads back under a date box, whatever
 *  order the phone's own date box uses. */
export function shortDay(iso: string): string {
  return dayFormat.format(new Date(`${iso}T00:00:00Z`))
}

/** "Sat 14 Nov to Sun 22 Nov, 9 days" under a pair of date boxes. */
export function dateReadback(start: string, end: string): string | null {
  if (!start || !end || end < start) return null
  const days = daysBetween(start, end) + 1
  return start === end ? `${shortDay(start)}, 1 day` : `${shortDay(start)} to ${shortDay(end)}, ${days} days`
}
