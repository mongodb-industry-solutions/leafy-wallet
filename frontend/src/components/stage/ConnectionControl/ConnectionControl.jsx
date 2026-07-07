'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Kbd, KbdGroup } from '@/components/ui/Kbd'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/Tooltip'
import { WifiPulse } from '@/components/stage/WifiPulse/WifiPulse'

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
            <Button
              variant="outline"
              size="xl"
              className="w-full"
              onClick={onToggle}
              aria-label={isOnline ? 'Go offline' : 'Go online'}
            >
              <Icon aria-hidden="true" />
              Toggle connection
              <KbdGroup className="-me-1">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </Button>
          }
        />
        <TooltipContent side="bottom" sideOffset={8} className="dark w-56 py-3">
          <div className="space-y-2.5">
            <WifiPulse />
            <p className="font-medium text-[13px]">Good moment to go offline!</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
