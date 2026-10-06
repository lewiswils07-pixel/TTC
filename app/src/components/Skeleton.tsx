/** Grey placeholders shaped like the content on its way, so the page doesn't jump when it arrives. */
export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="skeleton-rows" role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card skeleton-row" aria-hidden="true">
          <span className="skeleton skeleton-circle" />
          <span className="skeleton-lines">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line skeleton-line-short" />
          </span>
        </div>
      ))}
    </div>
  )
}

/** A placeholder the size of a suggestion card on Connections. */
export function SkeletonFeedCard({ label }: { label: string }) {
  return (
    <div className="card person-feed-card skeleton-feed" role="status">
      <span className="visually-hidden">{label}</span>
      <span className="skeleton skeleton-photo" aria-hidden="true" />
      <span className="skeleton skeleton-line" aria-hidden="true" />
      <span className="skeleton skeleton-line skeleton-line-short" aria-hidden="true" />
    </div>
  )
}
