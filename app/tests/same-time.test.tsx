import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { axeViolations } from './a11y'
import { SameTimeStrip } from '../src/components/SameTimeStrip'
import { mergeFeed, sameTime } from '../src/lib/feed'
import type { TripSuggestion } from '../src/lib/matching'

const trip = (id: string, extra: Partial<TripSuggestion> = {}): TripSuggestion => ({
  birth_year: 1962,
  home_city: 'Leeds',
  home_country: 'GB',
  photo_path: null,
  travelling_with: null,
  profile_id: id,
  display_name: id,
  trip_city: 'Lisbon',
  trip_start: '2026-11-10',
  trip_end: '2026-11-20',
  overlap_start: '2026-11-12',
  overlap_end: '2026-11-18',
  shared_interests: [],
  score: 50,
  ...extra,
})

describe('Going when you are', () => {
  const feed = mergeFeed([{ tripId: 7, people: [trip('Ann'), trip('Bob', { overlap_start: null, overlap_end: null })] }], [])

  it('only counts people there at the same time, not nearby dates', () => {
    expect(sameTime(feed.find((p) => p.profile_id === 'Ann')!)).toMatchObject({ city: 'Lisbon', overlap: true })
    expect(sameTime(feed.find((p) => p.profile_id === 'Bob')!)).toBeUndefined()
  })

  it('shows their faces in one quiet row that opens the Sodalis+ page', async () => {
    const { container } = render(
      <MemoryRouter>
        <SameTimeStrip people={feed} />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Going when you are.*1 member/ })).toHaveAttribute('href', '/connections/same-time')
    expect(screen.queryByText('Lisbon', { exact: false })).not.toBeInTheDocument()
    expect(await axeViolations(container)).toEqual([])
  })

  it('is hidden when no one is there at the same time', () => {
    const { container } = render(
      <MemoryRouter>
        <SameTimeStrip people={feed.filter((p) => p.profile_id === 'Bob')} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
