'use client'

import Icon from '@leafygreen-ui/icon'
import { AnimatePresence, motion } from 'motion/react'
import { IconButton } from '@/components/ui/IconButton'

/**
 * AI chat top bar: back to history (left), the current chat title (center,
 * cross-fading when it auto-renames), and a new-chat "+" (right).
 * @param {object} props
 * @param {string} props.title
 * @param {boolean} props.canCreate - False while already on an empty new chat, where "+" would do nothing.
 * @param {() => void} props.onBack - Opens the chat history.
 * @param {() => void} props.onNew - Starts a new chat.
 */
export function ChatHeader({ title, canCreate, onBack, onNew }) {
  return (
    <header className="relative z-20 flex items-center gap-2 px-3 pt-5 pb-2">
      <IconButton onClick={onBack} aria-label="Chat history">
        <Icon glyph="ArrowLeft" size={18} />
      </IconButton>

      <div className="relative min-w-0 flex-1 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="block truncate text-base font-bold text-foreground"
          >
            {title}
          </motion.span>
        </AnimatePresence>
      </div>

      {canCreate ? (
        <IconButton onClick={onNew} aria-label="New chat">
          <Icon glyph="Plus" size={18} />
        </IconButton>
      ) : (
        <span aria-hidden className="size-9 flex-none" />
      )}
    </header>
  )
}
