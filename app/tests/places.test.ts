import { describe, expect, it } from 'vitest'
import { cityLabel, pickerLabel } from '../src/lib/cities'
import { sized, type CityPhoto } from '../src/lib/cityPhotos'

describe('more places (24 Oct)', () => {
  it('shows the region in the town search, but not on cards', () => {
    const positano = { name: 'Positano', country_code: 'IT', region: 'Campania' }
    expect(pickerLabel(positano)).toBe('Positano, Campania, Italy')
    expect(cityLabel(positano)).toBe('Positano, Italy')
    expect(pickerLabel({ name: 'St Ives', country_code: 'GB', region: 'Cornwall' })).toBe('St Ives, Cornwall')
    expect(pickerLabel({ name: 'Lisbon', country_code: 'PT' })).toBe('Lisbon, Portugal')
  })

  it('sizes Unsplash photos by width, and picks a standard Wikipedia width', () => {
    const unsplash: CityPhoto = { url: 'https://images.unsplash.com/photo-1?ixid=x', author: 'A', authorUrl: '', link: '', color: null, source: 'unsplash' }
    expect(sized(unsplash, 120)).toContain('&w=120&')
    const wiki: CityPhoto = {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Hallstatt.jpg/1280px-Hallstatt.jpg',
      author: 'Wikipedia',
      authorUrl: '',
      link: '',
      color: null,
      source: 'wikipedia',
    }
    expect(sized(wiki, 120)).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Hallstatt.jpg/250px-Hallstatt.jpg')
    expect(sized(wiki, 720)).toContain('/1280px-')
  })
})
