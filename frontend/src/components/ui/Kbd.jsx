import { cn } from "@/lib/utils";

/** A single keycap, e.g. inside a {@link KbdGroup} like ⌘K. */
export function Kbd(
  {
    className,
    ...props
  }
) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-[.25rem] bg-muted px-1 font-medium font-sans text-muted-foreground text-xs [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      data-slot="kbd"
      {...props} />
  );
}

/** Groups a sequence of {@link Kbd} keycaps, e.g. "⌘" + "K". */
export function KbdGroup(
  {
    className,
    ...props
  }
) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props} />
  );
}
