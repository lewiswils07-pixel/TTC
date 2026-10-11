import { CARD_QUESTIONS } from '../lib/card'
import { Dropdown } from './Dropdown'

type Props = {
  id: string
  value: string
  /** Questions already used on the other slots. */
  taken: Set<string>
  onChange: (key: string) => void
  describedBy?: string
  invalid?: boolean
}

/** The card question chooser: the questions, grouped, with used ones greyed out. */
export function QuestionPicker({ id, value, taken, onChange, describedBy, invalid }: Props) {
  return (
    <Dropdown
      id={id}
      value={value}
      placeholder="Choose a question"
      groups={[
        // The questions are optional (Lewis, 11 Oct), so a chosen one can be cleared.
        ...(value ? [{ options: [{ value: '', label: 'No question' }] }] : []),
        ...CARD_QUESTIONS.map((g) => ({
          label: g.group,
          options: g.questions.map((q) => ({ value: q.key, label: q.text, disabled: taken.has(q.key), note: taken.has(q.key) ? 'already used' : undefined })),
        })),
      ]}
      onChange={onChange}
      describedBy={describedBy}
      invalid={invalid}
    />
  )
}
