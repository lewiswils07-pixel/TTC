import { questionText, type CardAnswer } from '../lib/card'

/** The back of a member's card: their 3 chosen questions and answers. */
export function CardBack({ name, answers, mine = false }: { name: string; answers: CardAnswer[]; mine?: boolean }) {
  if (answers.length === 0) {
    return <p className="card-back-empty">{mine ? 'You haven’t filled in the back of your card yet.' : `${name} hasn’t filled in the back of their card yet.`}</p>
  }
  return (
    <dl className="card-back-list">
      {answers.map((x) => (
        <div key={x.q}>
          <dt>{questionText(x.q)}</dt>
          <dd>{x.a}</dd>
        </div>
      ))}
    </dl>
  )
}
