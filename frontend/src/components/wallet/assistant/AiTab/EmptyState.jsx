'use client'

// Generic-sounding starters that still resolve to the assistant's real intents.
const SUGGESTIONS = [
  { label: 'Summarize my week', query: 'How much did I spend this week?' },
  { label: 'Break down my spending', query: 'Show my spending this week' },
  { label: 'Send money to Maria', query: 'Send €20 to Maria for lunch' },
  { label: 'Request from Jordan', query: 'Request €50 from Jordan' },
]

/** Returns a time-of-day greeting for the given hour (0 to 23). */
function greetingFor(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The AI tab's first view: a time-based greeting over the aurora, with tappable
 * suggestion cards. Sending a suggestion flips into the chat thread.
 * @param {object} props
 * @param {{name: string}} props.user
 * @param {(query: string) => void} props.onSuggestion
 */
export function EmptyState({ user, onSuggestion }) {
  const firstName = user.name.split(' ')[0]
  const greeting = greetingFor(new Date().getHours())

  return (
    <div className="relative z-10 flex flex-1 flex-col justify-between px-4 pt-12 pb-40">
      <h1
        suppressHydrationWarning
        className="text-[1.9rem] font-bold leading-tight tracking-tight text-foreground"
      >
        {greeting},
        <br />
        {firstName}
      </h1>

      <div className="grid grid-cols-2 gap-2.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.query)}
            className="min-h-20 rounded-2xl border border-border bg-card/80 p-3.5 text-left text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
