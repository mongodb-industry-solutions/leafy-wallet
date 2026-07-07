'use client'

import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'home', label: 'Home', glyph: 'Home' },
  { id: 'activity', label: 'Activity', glyph: 'ActivityFeed' },
  { id: 'people', label: 'People', glyph: 'PersonGroup' },
  { id: 'ai', label: 'Chat', glyph: 'Sparkle' },
]

export function BottomNav({ tab, setTab }) {
  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-foreground/10 bg-card/60 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {TABS.map(({ id, label, glyph }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 transition-colors',
                active ? 'bg-secondary/12 text-secondary' : 'text-muted-foreground',
              )}
            >
              <Icon glyph={glyph} size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
