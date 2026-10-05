import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from './a11y'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => undefined } } })),
  signOut: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth } }))

import { AppRoutes } from '../src/App'
import { brand } from '../src/lib/brand'
import { SessionProvider } from '../src/lib/session'

function renderAt(path: string) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  )
}

beforeEach(() => {
  auth.signInWithOtp.mockReset()
  auth.verifyOtp.mockReset()
})

describe('home screen', () => {
  it('welcomes signed-out visitors by the brand name', async () => {
    const { container } = renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: brand.tagline })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: brand.name })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Join or sign in' })).toHaveAttribute('href', '/sign-in')
    expect(await axeViolations(container)).toEqual([])
  })
})

describe('sign in with an email code', () => {
  it('asks for a valid email first', async () => {
    renderAt('/sign-in')
    await userEvent.click(await screen.findByRole('button', { name: 'Send my code' }))
    const box = screen.getByLabelText('Email address')
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveAccessibleDescription(/enter your email/)
    await waitFor(() => expect(box).toHaveFocus())
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('flags a mistyped email as soon as you leave the box', async () => {
    renderAt('/sign-in')
    const box = await screen.findByLabelText('Email address')
    await userEvent.type(box, 'jane@example')
    expect(box).not.toHaveAttribute('aria-invalid')
    await userEvent.tab()
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveAccessibleDescription(/doesn’t look like an email/)
    await userEvent.type(box, '.com')
    expect(box).not.toHaveAttribute('aria-invalid')
  })

  it('sends a code, then checks it as soon as all the digits are in', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null })
    auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } })
    const { container } = renderAt('/sign-in')
    expect(await axeViolations(container)).toEqual([])

    await userEvent.type(await screen.findByLabelText('Email address'), ' Jane@Example.com ')
    await userEvent.click(screen.getByRole('button', { name: 'Send my code' }))
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'jane@example.com', options: { shouldCreateUser: true } })

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toHaveFocus()
    expect(await axeViolations(container)).toEqual([])
    const codeBox = screen.getByLabelText('Your code')
    await userEvent.type(codeBox, '12a')
    expect(codeBox).toHaveAccessibleDescription(/only has numbers/)
    await userEvent.clear(codeBox)
    await userEvent.type(codeBox, '123 45')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    await userEvent.type(codeBox, '6')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'jane@example.com', token: '123456', type: 'email' })
    await waitFor(() => expect(codeBox).toHaveAccessibleDescription(/didn't work/))
  })
})

describe('protected screens', () => {
  it('send signed-out visitors to sign in', async () => {
    renderAt('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Join or sign in' })).toBeInTheDocument()
  })
})
