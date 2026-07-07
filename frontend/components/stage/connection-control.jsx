'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { WifiPulse } from '@/components/stage/wifi-pulse'

// Presenter toggle for the simulated connection. `nudge` opens a hint tooltip
// below it on offline-relevant screens.
export function ConnectionControl({ online, onToggle, nudge = false }) {
  const Icon = online ? Wifi : WifiOff

  return (
    <TooltipProvider>
      <Tooltip open={nudge} onOpenChange={() => {}}>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="xl"
              className="w-full"
              onClick={onToggle}
              aria-label={online ? 'Go offline' : 'Go online'}
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
