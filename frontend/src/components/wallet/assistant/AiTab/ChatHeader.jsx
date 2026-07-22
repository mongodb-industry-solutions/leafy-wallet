'use client'

import Icon from '@leafygreen-ui/icon'
import { AnimatePresence, motion } from 'motion/react'
import { IconButton } from '@/components/ui/IconButton'

/**
 * AI chat top bar: back to history (left) and the current chat title (center, cross-fading when it
 * auto-renames). Starting a chat lives on the history screen, so there is no "+" here.
 * @param {object} props
 * @param {string} props.title
 * @param {() => void} props.onBack - Opens the chat history.
 */
export function ChatHeader({ title, onBack }) {
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

      {/* Balances the back button so the title stays optically centered. */}
      <span aria-hidden className="size-9 flex-none" />
    </header>
  )
}
