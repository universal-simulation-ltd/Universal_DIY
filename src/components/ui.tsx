import type { ReactNode } from 'react'
import { buttonClass } from '@unisim/sdk'

// The suite's key buttons (SDK 0.216, BRANDING.md → Buttons): main.tsx
// installs their CSS. Primary is once per view. The look sits in a cascade
// layer, so add only layout classes beside these, never colour or padding.
export const btnPrimary = buttonClass('primary')
export const btnSecondary = buttonClass()
export const btnSecondarySm = buttonClass(undefined, 'sm')
export const btnQuietSm = buttonClass('quiet', 'sm')

/** A key button's icon block, its first child. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <span className="u-btn__key" aria-hidden>
      {children}
    </span>
  )
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
export const PlusIcon = () => icon('M12 5v14M5 12h14')
export const SaveIcon = () => icon('M12 4v12M7 11l5 5 5-5M5 20h14')
export const OpenIcon = () => icon('M12 16V4M7 9l5-5 5 5M5 20h14')
export const PrintIcon = () => icon('M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z')
