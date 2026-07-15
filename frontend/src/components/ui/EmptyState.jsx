import Icon from '@leafygreen-ui/icon'

/**
 * A centered zero/empty state: a soft icon badge, a title, and an optional line of help text. Shared
 * across the app so every "nothing here yet" (and load error) reads consistently.
 * @param {object} props
 * @param {string} props.glyph - LeafyGreen icon glyph name.
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string} [props.className]
 */
export function EmptyState({ glyph, title, subtitle, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-10 text-center ${className}`}>
      <span className="grid size-12 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground">
        <Icon glyph={glyph} size={22} />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}
