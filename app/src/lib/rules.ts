// The club's rules (limits, lengths and answer lists), from app/rules.json.
// Screens, checks and wording all read them from here, so a rule is changed
// in one place. The database holds the same values and a test keeps them equal.
import data from '../../rules.json'

export const rules = data

/** "1 group", "3 groups": a count with its noun, for wording built from a rule. */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`
}

/** A number of days in the words members use: 730 is "2 years", 90 is "3 months", 30 is "30 days". */
export function roughly(days: number): string {
  if (days >= 365 && days % 365 === 0) return count(days / 365, 'year')
  if (days >= 60 && days % 30 === 0) return count(days / 30, 'month')
  return count(days, 'day')
}
