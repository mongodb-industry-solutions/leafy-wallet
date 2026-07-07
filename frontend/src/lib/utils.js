import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names with clsx, then resolves Tailwind conflicts (last wins). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
