import { cn } from "@/lib/utils";

/** Rounded outer container that groups one or more {@link FramePanel}s. */
export function Frame(
  {
    className,
    ...props
  }
) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-muted/45 p-1",
        "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
        className
      )}
      data-slot="frame"
      {...props} />
  );
}

/** A single card-like panel inside a {@link Frame}. */
export function FramePanel(
  {
    className,
    ...props
  }
) {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-background bg-clip-padding p-5 shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className
      )}
      data-slot="frame-panel"
      {...props} />
  );
}

/** Header region at the top of a {@link FramePanel}. */
export function FrameHeader(
  {
    className,
    ...props
  }
) {
  return (
    <header
      className={cn("flex flex-col px-5 py-4", className)}
      data-slot="frame-panel-header"
      {...props} />
  );
}

/** Title text inside a {@link FrameHeader}. */
export function FrameTitle(
  {
    className,
    ...props
  }
) {
  return (
    <div
      className={cn("font-semibold text-sm", className)}
      data-slot="frame-panel-title"
      {...props} />
  );
}

/** Supporting text inside a {@link FrameHeader}. */
export function FrameDescription(
  {
    className,
    ...props
  }
) {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="frame-panel-description"
      {...props} />
  );
}

/** Footer region at the bottom of a {@link FramePanel}. */
export function FrameFooter(
  {
    className,
    ...props
  }
) {
  return (
    <footer
      className={cn("px-5 py-4", className)}
      data-slot="frame-panel-footer"
      {...props} />
  );
}
