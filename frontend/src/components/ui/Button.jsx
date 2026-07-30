import { cn } from '@/lib/utils'

// `primary` is the app's action pill; `neutral` is the muted surface for cancel/secondary roles.
const VARIANT_CLASSES = {
  primary: 'bg-secondary text-secondary-foreground',
  neutral: 'bg-foreground/[0.06] text-foreground',
}

const SIZE_CLASSES = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-11 text-sm',
  lg: 'h-14 text-base',
}

/**
 * The wallet's pill button, so every action reads the same and disables the same way. Width and any
 * one-off tint stay with the caller via `className` (merged, so a color there wins).
 * @param {object} props
 * @param {'primary'|'neutral'} [props.variant] - Action pill or muted surface.
 * @param {'sm'|'md'|'lg'} [props.size] - Row height and text size.
 * @param {string} [props.className] - Extra classes (layout, one-off text color).
 */
export function Button({ variant = 'primary', size = 'lg', className, ...props }) {
  return (
    <button
      className={cn(
        'rounded-full font-semibold disabled:opacity-40',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  )
}
