/**
 * A shimmering placeholder block for loading states. Compose several to mirror the shape of the
 * content being loaded (a row, a card) so the layout doesn't shift when the real data arrives.
 * @param {object} props
 * @param {string} [props.className] - Tailwind sizing/shape classes.
 */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-foreground/10 ${className}`} />
}
