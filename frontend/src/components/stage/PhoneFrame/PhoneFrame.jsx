'use client'

// DesktopShell's py-8 plus this bezel's p-2.5.
const STAGE_CHROME_PX = 84
const MIN_SCREEN_PX = 560
const MAX_SCREEN_PX = 752

/**
 * Generic dark phone bezel that holds the mobile wallet app. The screen shrinks to fit short
 * viewports so the stage never scrolls.
 * @param {object} props
 * @param {React.ReactNode} props.children - The screen content.
 * @param {React.ReactNode} [props.overlay] - Rendered inside the clipped screen, above the content
 *   (e.g. the tour's simulated cursor), sharing the screen's coordinate space.
 */
export function PhoneFrame({ children, overlay }) {
  return (
    <div className="relative flex-none rounded-[3rem] bg-[#0a0a0a] p-2.5 shadow-[0_50px_90px_-30px_rgba(0,30,43,0.45),0_18px_40px_-24px_rgba(0,30,43,0.3)]">
      <div
        className="relative w-[348px] overflow-hidden rounded-[2.375rem] bg-[#0a0a0a]"
        style={{
          height: `clamp(${MIN_SCREEN_PX}px, calc(100dvh - ${STAGE_CHROME_PX}px), ${MAX_SCREEN_PX}px)`,
        }}
      >
        {children}
        {overlay}
      </div>
    </div>
  )
}
