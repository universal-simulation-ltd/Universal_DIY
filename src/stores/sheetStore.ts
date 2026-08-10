import { create } from 'zustand'
import { SHEETS, type Sheet } from '../lib/materials'
import type { Offcut } from '../lib/nest'
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
  /** Stock already on your rack, used up before any sheet is bought. */
  offcuts: Offcut[]

  setSheet: (id: string) => void
  setKerf: (mm: number) => void
  setTrim: (mm: number) => void
  addOffcut: () => void
  patchOffcut: (id: string, patch: Partial<Offcut>) => void
  removeOffcut: (id: string) => void
  reset: () => void
}

/** Derived from the existing ids, so it never needs a clock — as in parts.ts. */
function nextOffcutId(offcuts: readonly Offcut[]): string {
  let max = 0
  for (const o of offcuts) {
    const n = o.id.startsWith('o') ? Number(o.id.slice(1)) : NaN
    if (Number.isFinite(n) && n > max) max = n
  }
  return `o${max + 1}`
}

export const useSheetStore = create<SheetState>((set, get) => {
  const start = typeof window === 'undefined' ? { ...DEFAULT_SAW } : loadSaw()
  const change = (patch: Partial<SheetState>) => {
    set(patch)
    const { sheetId, kerf, trim, offcuts } = get()
    saveSaw({ sheetId, kerf, trim, offcuts })
  }

  return {
    ...start,
    setSheet: (sheetId) => change({ sheetId }),
    // Negative would mean a saw that adds wood. Clamped rather than refused, so
    // a stray minus sign does not wipe the field you were editing.
    setKerf: (mm) => change({ kerf: Math.max(0, Math.min(50, mm)) }),
    setTrim: (mm) => change({ trim: Math.max(0, Math.min(200, mm)) }),

    // A new row starts at half a sheet, which is the offcut people actually
    // have — and it means the row does something the moment it appears rather
    // than sitting at zero waiting to be filled in.
    addOffcut: () => change({ offcuts: [...get().offcuts, { id: nextOffcutId(get().offcuts), w: 1200, h: 600, qty: 1 }] }),

    patchOffcut: (id, patch) =>
      change({ offcuts: get().offcuts.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),

    removeOffcut: (id) => change({ offcuts: get().offcuts.filter((o) => o.id !== id) }),

    reset: () => change({ ...DEFAULT_SAW, offcuts: [] }),
  }
})

/** The chosen sheet, falling back to the first rather than to undefined. */
export function useSheet(): Sheet {
  const sheetId = useSheetStore((s) => s.sheetId)
  return SHEETS.find((s) => s.id === sheetId) ?? SHEETS[0]
}
