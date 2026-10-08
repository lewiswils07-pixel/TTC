import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from './a11y'

const rpc = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })))
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc } }))

import { SafetyBox } from '../src/components/SafetyBox'

beforeEach(() => rpc.mockClear())

describe('block or report', () => {
  it('asks what’s wrong before sending a report, then reports and blocks', async () => {
    const onBlocked = vi.fn()
    const { container } = render(<SafetyBox profileId="p1" name="Bob" onBlocked={onBlocked} />)
    await userEvent.click(screen.getByRole('button', { name: 'Block or report Bob' }))
    await userEvent.click(screen.getByRole('button', { name: 'Report Bob' }))
    await userEvent.click(screen.getByRole('button', { name: 'Report and block Bob' }))
    expect(screen.getByText('Please choose what’s wrong.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('radio', { name: 'Asks for money' }))
    expect(screen.queryByText('Please choose what’s wrong.')).not.toBeInTheDocument()
    expect(await axeViolations(container)).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Report and block Bob' }))
    expect(rpc).toHaveBeenNthCalledWith(1, 'report_member', { p_id: 'p1', p_reason: 'asking_for_money', p_details: null })
    expect(rpc).toHaveBeenNthCalledWith(2, 'block_member', { p_id: 'p1' })
    expect(onBlocked).toHaveBeenCalledWith(expect.stringContaining('you won’t see Bob again'))
  })

  it('can report without blocking', async () => {
    const onBlocked = vi.fn()
    render(<SafetyBox profileId="p1" name="Bob" onBlocked={onBlocked} />)
    await userEvent.click(screen.getByRole('button', { name: 'Block or report Bob' }))
    await userEvent.click(screen.getByRole('button', { name: 'Report Bob' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Fake profile' }))
    await userEvent.click(screen.getByRole('button', { name: 'Report only' }))
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(onBlocked).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks for telling us')
  })

  it('blocks after a confirm', async () => {
    const onBlocked = vi.fn()
    render(<SafetyBox profileId="p1" name="Bob" onBlocked={onBlocked} />)
    await userEvent.click(screen.getByRole('button', { name: 'Block or report Bob' }))
    await userEvent.click(screen.getByRole('button', { name: 'Block Bob' }))
    expect(screen.getByText(/isn’t told/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Block Bob' }))
    expect(rpc).toHaveBeenCalledWith('block_member', { p_id: 'p1' })
    expect(onBlocked).toHaveBeenCalled()
  })
})
