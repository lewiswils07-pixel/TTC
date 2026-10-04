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
    expect(await screen.findByRole('heading', { level: 1, name: `Welcome to ${brand.name}` })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Join or sign in' })).toHaveAttribute('href', '/sign-in')
    expect(await axeViolations(container)).toEqual([])
  })
})

describe('sign in with an email code', () => {
  it('asks for a valid email first', async () => {
    renderAt('/sign-in')
    await userEvent.click(await screen.findByRole('button', { name: 'Send my code' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/enter your email/)
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('sends a code, then checks it', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null })
    auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } })
    const { container } = renderAt('/sign-in')
    expect(await axeViolations(container)).toEqual([])

    await userEvent.type(await screen.findByLabelText('Email address'), ' Jane@Example.com ')
    await userEvent.click(screen.getByRole('button', { name: 'Send my code' }))
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'jane@example.com', options: { shouldCreateUser: true } })

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toHaveFocus()
    expect(await axeViolations(container)).toEqual([])
    await userEvent.type(screen.getByLabelText('Your code'), '123 456')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'jane@example.com', token: '123456', type: 'email' })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/didn't work/))
  })
})

describe('protected screens', () => {
  it('send signed-out visitors to sign in', async () => {
    renderAt('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Join or sign in' })).toBeInTheDocument()
  })
})
