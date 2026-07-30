/**
 * One label/value line of a detail or review card. Text size comes from the parent's text class, so
 * the same row reads correctly in a full review screen and in a compact inline card.
 * @param {object} props
 * @param {string} props.label - Muted left-hand label.
 * @param {React.ReactNode} props.value - Right-hand value, rendered with tabular figures.
 */
export function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
