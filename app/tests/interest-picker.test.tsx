import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InterestPicker } from '../src/components/InterestPicker'
import { shuffled } from '../src/lib/shuffle'

const interests = ['Museums', 'Wine', 'Walking'].map((label, i) => ({ id: i + 1, slug: label.toLowerCase(), label, category_label: 'Things' }))

describe('picking interests', () => {
  it('counts picks, and explains a tap past the limit', async () => {
    const onChange = vi.fn()
    render(<InterestPicker interests={interests} selected={[1, 2]} onChange={onChange} max={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('Pick up to 2 · 2 picked')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Walking' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('You’ve already picked 2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Wine' }))
    expect(onChange).toHaveBeenCalledWith([1])
  })
  it('counts picks below the limit', () => {
    render(<InterestPicker interests={interests} selected={[1]} onChange={() => undefined} max={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('Pick up to 2 · 1 picked')
  })
  it('shows a short list first, then every interest by group', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, slug: `i${i}`, label: `Interest ${i + 1}`, category_label: 'Outdoors' }))
    render(<InterestPicker interests={many} selected={[30]} onChange={() => undefined} max={8} />)
    expect(screen.queryByRole('checkbox', { name: 'Interest 25' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Interest 30' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'See all 30 interests' }))
    expect(screen.getByRole('checkbox', { name: 'Interest 25' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument()
  })
  it('mixes the list, keeping every interest once', () => {
    const list = Array.from({ length: 20 }, (_, i) => i)
    const mixed = shuffled(list)
    expect([...mixed].sort((a, b) => a - b)).toEqual(list)
    let n = 0
    expect(shuffled([1, 2, 3], () => [0, 0][n++] ?? 0)).toEqual([2, 3, 1])
  })
  it('ticks a chip once it is picked', () => {
    const { container } = render(<InterestPicker interests={interests} selected={[1]} onChange={() => undefined} max={2} />)
    expect(container.querySelectorAll('.pick-chip svg')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: 'Museums' })).toBeChecked()
  })
})
