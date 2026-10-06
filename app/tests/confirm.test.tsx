import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useConfirm } from '../src/lib/useConfirm'

function Demo() {
  const { ask, dialog } = useConfirm()
  const [answer, setAnswer] = useState('none')
  return (
    <>
      <button onClick={async () => setAnswer(String(await ask({ title: 'Delete your trip to Paris?', confirmLabel: 'Delete trip', danger: true })))}>Delete</button>
      <p>Answer: {answer}</p>
      {dialog}
    </>
  )
}

describe('the app’s own confirm box', () => {
  it('goes ahead only when the member confirms', async () => {
    render(<Demo />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('heading', { name: 'Delete your trip to Paris?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Answer: false')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Delete your trip to Paris?' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete trip' }))
    expect(screen.getByText('Answer: true')).toBeInTheDocument()
  })
})
