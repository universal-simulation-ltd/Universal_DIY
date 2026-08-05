// ---------------------------------------------------------------------------
// Stock material thicknesses.
//
// Thickness is a MEASURED NUMBER, never a nominal name. Every entry here
// resolves to an exact millimetre figure and the UI shows it back
// ("3/4 in = 19.05 mm"), because a 3/4" board snapped to "19 mm" is a 1 mm lie
// on a −2t deduction — a visible gap at glue-up. Round the cut dimension at the
// end; never the input that gets doubled.
// ---------------------------------------------------------------------------

import { MM_PER_INCH } from './units'
import type { Unit } from './units'

export interface Stock {
  id: string
  /** Exact thickness in mm. Never rounded. */
  mm: number
  label: string
  /** Material name written onto the cut list. */
  material: string
  /** Does it have a visible grain that must run consistently? */
  grained: boolean
  /** The unit this stock is actually sold in — drives the mixed-units banner. */
  nativeUnit: Extract<Unit, 'mm' | 'in'>
}

export const STOCK: Stock[] = [
  { id: 'ply18', mm: 18, label: '18 mm ply', material: '18 mm birch ply', grained: true, nativeUnit: 'mm' },
  { id: 'ply12', mm: 12, label: '12 mm ply', material: '12 mm birch ply', grained: true, nativeUnit: 'mm' },
  { id: 'ply9', mm: 9, label: '9 mm ply', material: '9 mm birch ply', grained: true, nativeUnit: 'mm' },
  { id: 'ply6', mm: 6, label: '6 mm ply', material: '6 mm birch ply', grained: true, nativeUnit: 'mm' },
  { id: 'ply3', mm: 3, label: '3 mm ply', material: '3 mm birch ply', grained: true, nativeUnit: 'mm' },
  { id: 'mdf18', mm: 18, label: '18 mm MDF', material: '18 mm MDF', grained: false, nativeUnit: 'mm' },
  { id: 'mdf12', mm: 12, label: '12 mm MDF', material: '12 mm MDF', grained: false, nativeUnit: 'mm' },
  { id: 'mdf9', mm: 9, label: '9 mm MDF', material: '9 mm MDF', grained: false, nativeUnit: 'mm' },
  { id: 'mdf6', mm: 6, label: '6 mm MDF', material: '6 mm MDF', grained: false, nativeUnit: 'mm' },
  { id: 'mdf3', mm: 3, label: '3 mm MDF', material: '3 mm MDF', grained: false, nativeUnit: 'mm' },
  { id: 'in34', mm: 0.75 * MM_PER_INCH, label: '3/4 in ply', material: '3/4 in ply', grained: true, nativeUnit: 'in' },
  { id: 'in12', mm: 0.5 * MM_PER_INCH, label: '1/2 in ply', material: '1/2 in ply', grained: true, nativeUnit: 'in' },
  { id: 'in14', mm: 0.25 * MM_PER_INCH, label: '1/4 in ply', material: '1/4 in ply', grained: true, nativeUnit: 'in' },
  // "1×" softwood is nominal 1 inch and actually about 19 mm dressed. Named
  // honestly so nobody assumes 25.4.
  { id: 'softwood1x', mm: 19, label: 'Nominal 1× softwood (≈19 mm actual)', material: '19 mm softwood', grained: true, nativeUnit: 'mm' },
]

export function findStock(id: string): Stock | undefined {
  return STOCK.find((s) => s.id === id)
}

/** Common sheet sizes, mm. Used only for the buy-this-much estimate. */
export interface Sheet { id: string; label: string; w: number; h: number }
export const SHEETS: Sheet[] = [
  { id: '2440x1220', label: '2440 × 1220 (8 × 4 ft)', w: 2440, h: 1220 },
  { id: '2400x1200', label: '2400 × 1200', w: 2400, h: 1200 },
  { id: '1220x610', label: '1220 × 610 (half sheet)', w: 1220, h: 610 },
  { id: '600x400', label: '600 × 400 (hobby panel)', w: 600, h: 400 },
]

/**
 * The SHOPPING question, which is not the packing question.
 *
 * "How much ply do I buy?" needs total area plus a waste allowance. "How do I
 * cut it?" needs a guillotine packer, which is Phase 2. These must never be
 * allowed to masquerade as each other — hence `caveat`, which is rendered
 * verbatim next to the number.
 */
export const WASTE_ALLOWANCE = 0.15

export interface SheetEstimate {
  areaM2: number
  sheets: number
  sheet: Sheet
  /** Pieces that will not fit on the chosen sheet at any rotation. */
  oversize: string[]
  caveat: string
}

export function estimateSheets(
  totalAreaMm2: number,
  pieces: Array<{ label: string; length: number; width: number }>,
  sheet: Sheet,
): SheetEstimate {
  const withWaste = totalAreaMm2 * (1 + WASTE_ALLOWANCE)
  const sheets = Math.max(1, Math.ceil(withWaste / (sheet.w * sheet.h)))
  const long = Math.max(sheet.w, sheet.h)
  const short = Math.min(sheet.w, sheet.h)
  const oversize = pieces
    .filter((p) => {
      const pl = Math.max(p.length, p.width)
      const pw = Math.min(p.length, p.width)
      return pl > long + 1e-9 || pw > short + 1e-9
    })
    .map((p) => p.label)
  return {
    areaM2: totalAreaMm2 / 1_000_000,
    sheets,
    sheet,
    oversize,
    caveat: `Rough estimate — total area plus a ${Math.round(WASTE_ALLOWANCE * 100)}% allowance. It ignores the cutting layout, so it is a shopping figure, not a plan.`,
  }
}
