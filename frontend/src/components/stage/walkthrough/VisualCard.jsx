'use client'

import { cn } from '@/lib/utils'

/** Shared frame for the walkthrough mini-renders: a card centered on the illustration tile. */
export function VisualCard({ className, children }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={cn('rounded-2xl border border-border bg-card shadow-md', className)}>{children}</div>
    </div>
  )
}
