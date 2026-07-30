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
              data-tour-target="connection-toggle"
              onClick={onToggle}
              role="switch"
              aria-checked={isOnline}
              aria-label="Simulated connection"
              className="flex h-14 w-full items-center gap-2.5 rounded-full bg-foreground pl-[18px] pr-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-foreground/90"
            >
              <Icon
                className={cn('size-4', isOnline ? 'text-primary' : 'text-white/50')}
                aria-hidden="true"
              />
              <span className={isOnline ? undefined : 'text-white/75'}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>

              <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-medium text-white/60">
                ⌘K
              </span>

              {/* Without this it reads as a status chip, not a control. */}
              <span
                aria-hidden="true"
                className={cn(
                  'relative h-[23px] w-10 flex-none rounded-full transition-colors',
                  isOnline ? 'bg-primary' : 'bg-white/20',
                )}
              >
                <span
                  className={cn(
                    'absolute left-[3px] top-[3px] size-[17px] rounded-full transition-transform',
                    isOnline ? 'translate-x-[17px] bg-foreground' : 'bg-white',
                  )}
                />
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
