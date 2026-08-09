import { create } from 'zustand'
import { SHEETS, type Sheet } from '../lib/materials'
import { DEFAULT_SAW, loadSaw, saveSaw } from '../lib/storage'

/**
 * The saw and the sheet — shared by both pages, on purpose.
 *
 * `diyStore` and `partsStore` are deliberately separate because they hold two
 * different models of a project. These three settings are not part of either
 * model: a blade is 3 mm wide whichever page you are on, and the sheet you can
 * buy does not change because you switched to the parts list. Keeping them in a
 * third small store is what stops the same three numbers being typed twice and
 * then disagreeing.
 */
export interface SheetState {
  sheetId: string
  /** Saw kerf, mm. */
  kerf: number
  /** Trimmed off one long and one short edge, mm. */
  trim: number

  setSheet: (id: string) => void
  setKerf: (mm: number) => void
  setTrim: (mm: number) => void
  reset: () => void
}

export const useSheetStore = create<SheetState>((set, get) => {
  const start = typeof window === 'undefined' ? { ...DEFAULT_SAW } : loadSaw()
  const change = (patch: Partial<SheetState>) => {
    set(patch)
    const { sheetId, kerf, trim } = get()
    saveSaw({ sheetId, kerf, trim })
  }

  return {
    ...start,
    setSheet: (sheetId) => change({ sheetId }),
    // Negative would mean a saw that adds wood. Clamped rather than refused, so
    // a stray minus sign does not wipe the field you were editing.
    setKerf: (mm) => change({ kerf: Math.max(0, Math.min(50, mm)) }),
    setTrim: (mm) => change({ trim: Math.max(0, Math.min(200, mm)) }),
    reset: () => change({ ...DEFAULT_SAW }),
  }
})

/** The chosen sheet, falling back to the first rather than to undefined. */
export function useSheet(): Sheet {
  const sheetId = useSheetStore((s) => s.sheetId)
  return SHEETS.find((s) => s.id === sheetId) ?? SHEETS[0]
}
