'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { WifiPulse } from '@/components/stage/WifiPulse/WifiPulse'
import { cn } from '@/lib/utils'

/**
 * Presenter toggle for the simulated connection. `shouldNudge` opens a hint
 * tooltip below it on offline-relevant screens.
 * @param {object} props
 * @param {boolean} props.isOnline - Whether the simulated connection is up.
 * @param {() => void} props.onToggle - Called when the control is clicked.
 * @param {boolean} [props.shouldNudge] - Show the "good moment to go offline" hint.
 */
export function ConnectionControl({ isOnline, onToggle, shouldNudge = false }) {
  const Icon = isOnline ? Wifi : WifiOff

  return (
    <TooltipProvider>
      <Tooltip open={shouldNudge} onOpenChange={() => {}}>
        <TooltipTrigger
          render={
            <button
              onClick={onToggle}
              aria-label={isOnline ? 'Go offline' : 'Go online'}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <Icon
                className={cn('size-4', isOnline ? 'text-secondary' : 'text-muted-foreground')}
                aria-hidden="true"
              />
              {isOnline ? 'Connected' : 'Offline'}
              <span className="ml-1 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                ⌘K
              </span>
            </button>
          }
        />
        <TooltipContent side="bottom" sideOffset={8} className="w-56 py-3">
          <div className="space-y-2.5">
            <WifiPulse />
            <p className="font-medium text-[13px]">Good moment to go offline!</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
