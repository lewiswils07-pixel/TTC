import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InterestPicker } from '../src/components/InterestPicker'

const interests = ['Museums', 'Wine', 'Walking'].map((label, i) => ({ id: i + 1, slug: label.toLowerCase(), label, category_label: 'Things' }))

describe('picking interests', () => {
  it('says when the limit is reached, and explains a tap past it', async () => {
    const onChange = vi.fn()
    render(<InterestPicker interests={interests} selected={[1, 2]} onChange={onChange} max={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('That’s all 2 picked')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Walking' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('You’ve already picked 2')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Wine' }))
    expect(onChange).toHaveBeenCalledWith([1])
  })
  it('stays quiet below the limit', () => {
    render(<InterestPicker interests={interests} selected={[1]} onChange={() => undefined} max={2} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
