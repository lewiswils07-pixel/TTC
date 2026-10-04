import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CityPicker } from '../src/components/CityPicker'
import { axeViolations } from './a11y'

describe('CityPicker', () => {
  it('searches as you type and picks with the keyboard', async () => {
    const search = vi.fn(async () => [
      { id: 2267057, name: 'Lisbon', country_code: 'PT' },
      { id: 2268339, name: 'Lisburn', country_code: 'GB' },
    ])
    const onChange = vi.fn()
    const { container } = render(<CityPicker label="Home town" value={null} onChange={onChange} search={search} />)
    const box = screen.getByRole('combobox', { name: 'Home town' })
    await userEvent.type(box, 'Lis')
    expect(await screen.findByRole('option', { name: 'Lisbon, Portugal' })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith('Lis')
    expect(await axeViolations(container)).toEqual([])
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith({ id: 2268339, name: 'Lisburn', country_code: 'GB' })
    expect(box).toHaveValue('Lisburn, United Kingdom')
  })
})
