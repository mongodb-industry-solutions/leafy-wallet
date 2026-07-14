'use client'

import Icon from '@leafygreen-ui/icon'
import { cn } from '@/lib/utils'

/** Last message text of a chat, for the history row subtitle. */
function snippetOf(chat) {
  const last = chat.messages[chat.messages.length - 1]
  if (!last) return 'No messages yet'
  if (last.type === 'text') return last.text
  if (last.type === 'chart') return 'Spending breakdown'
  return 'Draft payment'
}

/**
 * Full-screen chat history: back to the active chat (left), a "+" to start a
 * new one (right), and the list of conversations. Tapping a row opens it.
 * @param {object} props
 * @param {{id: string, title: string, messages: object[]}[]} props.chats
 * @param {string} props.activeId
 * @param {(id: string) => void} props.onOpen
 * @param {() => void} props.onNew
 * @param {() => void} props.onClose - Returns to the active chat.
 */
export function ChatHistory({ chats, activeId, onOpen, onNew, onClose }) {
  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <header className="flex items-center gap-2 px-3 pt-5 pb-2">
        <button
          onClick={onClose}
          aria-label="Back"
          className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10"
        >
          <Icon glyph="ArrowLeft" size={18} />
        </button>
        <span className="min-w-0 flex-1 text-center text-base font-bold">Chat history</span>
        <button
          onClick={onNew}
          aria-label="New chat"
          className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10"
        >
          <Icon glyph="Plus" size={18} />
        </button>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pt-2 pb-6">
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-3 shadow-sm">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="flex w-full items-center gap-3 py-3.5 text-left"
            >
              <span className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10 text-foreground">
                <Icon glyph="Sparkle" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm', c.id === activeId ? 'font-bold' : 'font-semibold')}>
                  {c.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{snippetOf(c)}</p>
              </div>
              {c.id === activeId && <span className="size-1.5 flex-none rounded-full bg-secondary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
