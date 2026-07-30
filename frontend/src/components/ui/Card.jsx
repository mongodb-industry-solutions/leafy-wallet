import { cn } from '@/lib/utils'

/**
 * A padded, rounded surface for a block of content (account card, review block, profile section).
 * @param {object} props
 * @param {string} [props.className] - Layout classes; merged, so a color here wins over the base.
 */
export function Card({ className, ...props }) {
  return <div className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm', className)} {...props} />
}

/**
 * A rounded surface hosting a divided list of rows (activity, contacts, recipients).
 * @param {object} props
 * @param {string} [props.className]
 */
export function CardList({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm',
        className,
      )}
      {...props}
    />
  )
}
