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
    expect(screen.getByRole('status')).toHaveTextContent('You’ve selected 2 of 2 interests')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Walking' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('You’ve already picked 2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Wine' }))
    expect(onChange).toHaveBeenCalledWith([1])
  })
  it('counts picks below the limit', () => {
    render(<InterestPicker interests={interests} selected={[1]} onChange={() => undefined} max={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('You’ve selected 1 of 2 interests')
  })
  it('shows a few per category, with Show more', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, slug: `i${i}`, label: `Interest ${i + 1}`, category_label: 'Outdoors' }))
    render(<InterestPicker interests={many} selected={[10]} onChange={() => undefined} max={8} />)
    expect(screen.queryByRole('checkbox', { name: 'Interest 9' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Interest 10' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Show 1 more' }))
    expect(screen.getByRole('checkbox', { name: 'Interest 9' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()
  })
  it('mixes the list, keeping every interest once', () => {
    const list = Array.from({ length: 20 }, (_, i) => i)
    const mixed = shuffled(list)
    expect([...mixed].sort((a, b) => a - b)).toEqual(list)
    let n = 0
    expect(shuffled([1, 2, 3], () => [0, 0][n++] ?? 0)).toEqual([2, 3, 1])
  })
  it('shows + until a chip is picked, then ✓', () => {
    render(<InterestPicker interests={interests} selected={[1]} onChange={() => undefined} max={2} />)
    expect(screen.getByRole('checkbox', { name: 'Museums' }).nextElementSibling).toHaveTextContent('✓Museums')
    expect(screen.getByRole('checkbox', { name: 'Wine' }).nextElementSibling).toHaveTextContent('+Wine')
  })
})
