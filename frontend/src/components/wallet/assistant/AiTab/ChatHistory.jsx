'use client'

import { useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import { cn } from '@/lib/utils'

// The unsaved draft chat isn't in any store yet, so there's nothing to delete.
const DRAFT_CHAT_ID = 'draft'

/** Last message text of a chat, for the history row subtitle. */
function snippetOf(chat) {
  const last = chat.messages[chat.messages.length - 1]
  if (!last) return 'No messages yet'
  if (last.type === 'text') return last.text
  if (last.type === 'chart') return 'Spending breakdown'
  return 'Draft payment'
}

/**
 * Full-screen chat history: the list of conversations, with a "+" to start a new one (right).
 * This is where the assistant opens, so there is nothing to go back to - a chat is reached by
 * tapping its row. Swiping one left reveals delete (one row at a time).
 * @param {object} props
 * @param {{id: string, title: string, messages: object[]}[]} props.chats
 * @param {string} props.activeId
 * @param {(id: string) => void} props.onOpen
 * @param {(id: string) => void} props.onDelete
 */
export function ChatHistory({ chats, activeId, onOpen, onDelete }) {
  const [openId, setOpenId] = useState(null)

  return (
    <div className="flex h-full flex-col bg-muted text-foreground">
      <header className="px-3 pt-5 pb-2 text-center text-base font-bold">Chat history</header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pt-2 pb-6">
        {/* No horizontal padding here: rows and the delete layer run edge to edge, and the
            card's rounded corners clip them - that's what makes the reveal look native. */}
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {chats.map((c) => (
            <SwipeableRow
              key={c.id}
              canSwipe={c.id !== DRAFT_CHAT_ID}
              isOpen={openId === c.id}
              onOpenChange={(isOpen) => setOpenId(isOpen ? c.id : null)}
              onTap={() => onOpen(c.id)}
              actionLabel="Delete"
              onAction={() => onDelete(c.id)}
              rowClassName="gap-3 bg-card px-3 py-3.5"
            >
              <span
                data-tour-target={c.id === DRAFT_CHAT_ID ? 'ai-new-chat' : undefined}
                className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10 text-foreground"
              >
                <Icon glyph="Sparkle" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm', c.id === activeId ? 'font-bold' : 'font-semibold')}>
                  {c.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{snippetOf(c)}</p>
              </div>
              {c.id === activeId && <span className="size-1.5 flex-none rounded-full bg-secondary" />}
            </SwipeableRow>
          ))}
        </div>
      </div>
    </div>
  )
}
