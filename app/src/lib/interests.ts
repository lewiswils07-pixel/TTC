import type { Interest } from './profile'

export type Group = { label: string; items: Interest[] }

export function groupInterests(interests: Interest[]): Group[] {
  const groups: Group[] = []
  for (const interest of interests) {
    const label = interest.category_label ?? 'Interests'
    let group = groups.find((g) => g.label === label)
    if (!group) groups.push((group = { label, items: [] }))
    group.items.push(interest)
  }
  return groups
}
