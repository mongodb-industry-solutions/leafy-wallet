/**
 * A centered confirmation dialog: title, message, an optional error line, and Cancel + destructive
 * action buttons. Tapping the backdrop or Cancel dismisses. Both buttons disable while `isBusy`.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.message
 * @param {string} [props.error]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.busyLabel] - Shown on the confirm button while `isBusy`.
 * @param {boolean} [props.isBusy]
 * @param {() => void} props.onCancel
 * @param {() => void} props.onConfirm
 */
export function ConfirmDialog({
  title,
  message,
  error,
  confirmLabel = 'Confirm',
  busyLabel,
  isBusy = false,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
      <button aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-xs rounded-2xl border border-border bg-card p-5 text-center shadow-xl">
        <p className="text-base font-bold text-foreground">{title}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="h-11 flex-1 rounded-full bg-foreground/[0.06] text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isBusy}
            className="h-11 flex-1 rounded-full bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {isBusy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
