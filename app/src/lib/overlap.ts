// Working out when people's trips overlap with yours.
import { addDays, daysBetween } from './dates'

export type Stay = { start: string; end: string }

/** The first run of days in your trip when the most other people are there too. Null if no one overlaps. */
export function bestDays(mine: Stay, others: Stay[]): (Stay & { count: number }) | null {
  let best: (Stay & { count: number }) | null = null
  let run: (Stay & { count: number }) | null = null
  for (let i = 0; i <= daysBetween(mine.start, mine.end); i++) {
    const day = addDays(mine.start, i)
    const count = others.filter((o) => o.start <= day && day <= o.end).length
    if (run && run.count === count) run.end = day
    else run = { start: day, end: day, count }
    if (run.count > 0 && (!best || run.count > best.count)) best = run
  }
  return best
}
