'use client'

import Icon from '@leafygreen-ui/icon'
import { AnimatePresence, motion } from 'motion/react'

/**
 * AI chat top bar: back to history (left), the current chat title (center,
 * cross-fading when it auto-renames), and a new-chat "+" (right).
 * @param {object} props
 * @param {string} props.title
 * @param {() => void} props.onBack - Opens the chat history.
 * @param {() => void} props.onNew - Starts a new chat.
 */
export function ChatHeader({ title, onBack, onNew }) {
  return (
    <header className="relative z-20 flex items-center gap-2 px-3 pt-5 pb-2">
      <button
        onClick={onBack}
        aria-label="Chat history"
        className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10 text-foreground"
      >
        <Icon glyph="ArrowLeft" size={18} />
      </button>

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

      <button
        onClick={onNew}
        aria-label="New chat"
        className="grid size-9 flex-none place-items-center rounded-full bg-foreground/10 text-foreground"
      >
        <Icon glyph="Plus" size={18} />
      </button>
    </header>
  )
}
