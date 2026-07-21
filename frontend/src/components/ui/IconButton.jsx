import { cn } from '@/lib/utils'

/** Circular icon button (back, close, nav) used across the wallet screens. */
export function IconButton({ className, ...props }) {
  return (
    <button
      className={cn(
        'grid size-9 flex-none place-items-center rounded-full bg-foreground/10 text-foreground',
        className,
      )}
      {...props}
    />
  )
}
