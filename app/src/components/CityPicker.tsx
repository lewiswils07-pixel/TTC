import { useEffect, useId, useRef, useState } from 'react'
import { cityLabel, searchCities, type City } from '../lib/cities'
import { messageOf } from '../lib/errors'
import { FieldError } from './Field'

type Props = {
  label: string
  hint?: string
  value: City | null
  onChange: (city: City | null) => void
  search?: (query: string) => Promise<City[]>
  onBlur?: () => void
  /** A validation message from the form, shown under the box. */
  error?: string | null
}

/** Type a few letters, then pick the city from the list (ARIA combobox). */
export function CityPicker({ label, hint, value, onChange, search = searchCities, onBlur, error: formError }: Props) {
  const id = useId()
  const [text, setText] = useState(value ? cityLabel(value) : '')
  const [results, setResults] = useState<City[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loadError, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState('')
  // When the city is set from outside (“Use my location”), show it in the box (Lewis, 11 Oct).
  const [shownId, setShownId] = useState(value?.id ?? null)
  if ((value?.id ?? null) !== shownId) {
    setShownId(value?.id ?? null)
    if (value) {
      setText(cityLabel(value))
      setOpen(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const query = text.trim()
    if (query.length < 2) return
    let stale = false
    const timer = setTimeout(() => {
      search(query).then(
        (cities) => {
          if (stale) return
          setResults(cities)
          setSearched(query)
          setActive(cities.length ? 0 : -1)
          setError(null)
        },
        (e) => !stale && setError(messageOf(e)),
      )
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [text, open, search])

  function choose(city: City) {
    onChange(city)
    setText(cityLabel(city))
    setOpen(false)
  }

  const listId = `${id}-list`
  const typedEnough = text.trim().length >= 2
  const showList = open && typedEnough && results.length > 0
  // Keep the list clear of the sticky Continue bar.
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (showList) list.current?.scrollIntoView?.({ block: 'nearest' })
  }, [showList])
  const noMatch = open && typedEnough && searched === text.trim() && results.length === 0

  return (
    <div className="field" data-invalid={formError ? 'true' : undefined}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <input
        id={id}
        className="input"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-describedby={[hint ? `${id}-hint` : '', formError || loadError ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        aria-invalid={formError ? true : undefined}
        onBlur={() => {
          setOpen(false)
          onBlur?.()
        }}
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          if (value) onChange(null)
        }}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            choose(results[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      <ul ref={list} className="options" id={listId} role="listbox" aria-label={label} hidden={!showList}>
        {results.map((city, i) => (
          <li key={city.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(city)}>
            {cityLabel(city)}
          </li>
        ))}
      </ul>
      <p className="hint" role="status" aria-live="polite">
        {noMatch ? 'No towns or cities found. Try the nearest bigger town.' : ''}
      </p>
      <FieldError id={`${id}-error`} error={formError ?? loadError} />
    </div>
  )
}
