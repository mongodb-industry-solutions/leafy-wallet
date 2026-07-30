import { EmptyState } from '@/components/ui/EmptyState'

const NOTHING_YET_TITLE = 'No transactions yet'
const NOTHING_YET_SUBTITLE = 'Your payments and requests will show up here.'
const LOAD_ERROR_SUBTITLE = 'Check your connection and try again.'

/**
 * The zero state for an activity list: the load failure when `hasError`, otherwise the nothing-yet
 * state. Shared by the Activity tab and Home's transactions preview, which only differ in the error
 * title and the spacing they need.
 * @param {object} props
 * @param {boolean} props.hasError - The list failed to load rather than being empty.
 * @param {string} props.errorTitle - Headline for the failure, named for the screen it sits on.
 * @param {string} [props.className] - Extra spacing classes.
 */
export function ActivityEmpty({ hasError, errorTitle, className }) {
  if (hasError) {
    return (
      <EmptyState
        glyph="Warning"
        title={errorTitle}
        subtitle={LOAD_ERROR_SUBTITLE}
        className={className}
      />
    )
  }
  return (
    <EmptyState
      glyph="CreditCard"
      title={NOTHING_YET_TITLE}
      subtitle={NOTHING_YET_SUBTITLE}
      className={className}
    />
  )
}
