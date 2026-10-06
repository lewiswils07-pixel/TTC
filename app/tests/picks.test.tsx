import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axeViolations } from './a11y'
import { CityPicks } from '../src/components/CityPicks'
import { checkIdea, checkLink } from '../src/lib/board'
import { mapLink, PICKS, picksFor } from '../src/data/picks'

describe('hand-picked things to do', () => {
  it('covers 15 cities with 8 picks each', () => {
    expect(PICKS).toHaveLength(15)
    expect(new Set(PICKS.map((c) => c.cityId)).size).toBe(15)
    for (const city of PICKS) expect(city.picks).toHaveLength(8)
  })
  it('every pick can go straight onto a plan board', () => {
    for (const city of PICKS)
      for (const pick of city.picks) {
        expect(checkIdea(pick.title), pick.title).toBeNull()
        expect(checkLink(pick.url), pick.url).toBeNull()
      }
  })
  it('finds a city by id or name', () => {
    expect(picksFor(2267057)?.city).toBe('Lisbon')
    expect(picksFor(' lisbon ')?.cityId).toBe(2267057)
    expect(picksFor(2644688)).toBeUndefined()
    expect(picksFor(null)).toBeUndefined()
  })
  it('links to a map search', () => {
    expect(mapLink({ title: 'Tram 28', kind: 'experience', text: '', url: '' }, 'Lisbon')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Tram%2028%2C%20Lisbon',
    )
  })
})

describe('CityPicks', () => {
  it('adds a pick to the plan and marks ones already there', async () => {
    const lisbon = picksFor('Lisbon')!
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<CityPicks picks={lisbon} onAdd={onAdd} added={[lisbon.picks[0].title]} />)
    expect(screen.getByRole('heading', { name: 'Things to do in Lisbon' })).toBeInTheDocument()
    expect(screen.getByText('✓ On the plan')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: `Add to the plan: ${lisbon.picks[1].title}` }))
    expect(onAdd).toHaveBeenCalledWith(lisbon.picks[1].title, lisbon.picks[1].url)
    expect(await axeViolations(container)).toEqual([])
  })
  it('can start folded away', async () => {
    render(<CityPicks picks={picksFor('Paris')!} folded />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show 8 ideas' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
  })
})
