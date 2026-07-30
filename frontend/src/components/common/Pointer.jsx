/**
 * macOS-style pointer, drawn inline so a simulated cursor needs no image asset. The tip sits near the
 * top-left of the viewBox (~5,3 of 24), so callers offset by roughly (-4, -2) to land the tip on a point.
 * @param {object} props
 * @param {string} [props.className]
 */
export function Pointer({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M5 3l14 9.3-6.2 1.1 3.4 6.4-2.7 1.4-3.4-6.4L5 19.4V3z"
        fill="white"
        stroke="black"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
