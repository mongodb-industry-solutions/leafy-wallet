import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Spinning loading indicator. */
export function Spinner(
  {
    className,
    ...props
  }
) {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props} />
  );
}
