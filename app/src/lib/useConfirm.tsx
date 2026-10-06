import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog, type Ask } from '../components/Confirm'

/**
 * The app's own “Are you sure?” box, in place of the browser's pop-up.
 * `ask(...)` resolves to true when the member goes ahead; render `dialog` once in the screen.
 */
export function useConfirm(): { ask: (ask: Ask) => Promise<boolean>; dialog: ReactNode } {
  const [open, setOpen] = useState<Ask | null>(null)
  const settle = useRef<((yes: boolean) => void) | null>(null)

  const ask = useCallback(
    (a: Ask) =>
      new Promise<boolean>((resolve) => {
        settle.current = resolve
        setOpen(a)
      }),
    [],
  )
  const close = useCallback((yes: boolean) => {
    settle.current?.(yes)
    settle.current = null
    setOpen(null)
  }, [])

  return { ask, dialog: open && <ConfirmDialog ask={open} onClose={close} /> }
}
