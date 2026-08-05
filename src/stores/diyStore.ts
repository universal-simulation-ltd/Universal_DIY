import { create } from 'zustand'
import {
  DEFAULT_ORDER,
  computeCutlist,
  demote,
  emptyDesign,
  moveTo,
  promote,
  type Cutlist,
  type Design,
  type PanelId,
} from '../lib/panels'
import { SHEETS, STOCK, findStock, type Stock } from '../lib/materials'
import { loadLocal, saveLocal } from '../lib/storage'
import { readShareFromUrl } from '../lib/share'
import type { Unit } from '../lib/units'

/**
 * All app state. The cut list itself is NOT state — it is `computeCutlist(design)`,
 * recomputed on every render from the one source of truth. Caching it would
 * create a second place a cut size could live, and a stale cut size is the only
 * bug in this app that costs somebody a sheet of plywood.
 */
export interface DiyState {
  design: Design
  unit: Unit
  mmDecimals: 0 | 1
  /** Free text per piece-type letter, printed in the Notes column. */
  notes: Record<string, string>
  /** Selected stock id, or 'custom' when the thickness was typed by hand. */
  stockId: string
  sheetId: string
  /** Piece under the pointer — drives the two-way highlight. */
  hover: PanelId | null
  /** Is the wrap-order list revealed? The presets are the primary control. */
  advanced: boolean

  setDim: (axis: 'width' | 'depth' | 'height', mm: number) => void
  setThickness: (mm: number) => void
  setStock: (id: string) => void
  setName: (name: string) => void
  setMaterial: (material: string) => void
  setGrained: (grained: boolean) => void
  setUnit: (unit: Unit) => void
  setMmDecimals: (dp: 0 | 1) => void
  setSheet: (id: string) => void
  setNote: (letter: string, text: string) => void
  setHover: (panel: PanelId | null) => void
  setAdvanced: (advanced: boolean) => void

  togglePresent: (panel: PanelId) => void
  /** The per-panel toggle: "extends to the edge" -> priority 1, "sits inside" -> 6. */
  setOutermost: (panel: PanelId, extend: boolean) => void
  movePanel: (panel: PanelId, index: number) => void
  applyOrder: (order: PanelId[]) => void

  replace: (design: Design, unit: Unit, notes: Record<string, string>) => void
  reset: () => void
}

/** Which stock entry (if any) the current thickness + material came from. */
function stockIdFor(design: Design): string {
  const hit = STOCK.find((s) => s.mm === design.thickness && s.material === design.material)
  return hit ? hit.id : 'custom'
}

function initial(): { design: Design; unit: Unit; notes: Record<string, string> } {
  // A link beats local storage: somebody who followed a shared design wants the
  // design in the link, not whatever they were drawing last week.
  const shared = typeof window === 'undefined' ? null : readShareFromUrl()
  if (shared) return { design: shared.design, unit: shared.unit, notes: {} }
  const local = typeof window === 'undefined' ? null : loadLocal()
  if (local) return local
  return { design: emptyDesign(), unit: 'mm', notes: {} }
}

export const useDiyStore = create<DiyState>((set, get) => {
  const start = initial()
  const persist = () => {
    const { design, unit, notes } = get()
    saveLocal({ design, unit, notes })
  }
  const change = (patch: Partial<DiyState>) => {
    set(patch)
    persist()
  }
  const patchDesign = (patch: Partial<Design>) => change({ design: { ...get().design, ...patch } })

  return {
    design: start.design,
    unit: start.unit,
    notes: start.notes,
    mmDecimals: 1,
    stockId: stockIdFor(start.design),
    sheetId: SHEETS[0].id,
    hover: null,
    advanced: false,

    setDim: (axis, mm) => patchDesign({ [axis]: mm } as Partial<Design>),

    setThickness: (mm) => {
      // Typing a thickness by hand means it is no longer a stock item, and the
      // number is kept EXACTLY as given — never snapped to a stock size.
      change({ design: { ...get().design, thickness: mm }, stockId: 'custom' })
    },

    setStock: (id) => {
      const stock: Stock | undefined = findStock(id)
      if (!stock) return change({ stockId: 'custom' })
      change({
        stockId: id,
        design: {
          ...get().design,
          thickness: stock.mm,
          material: stock.material,
          grained: stock.grained,
        },
      })
    },

    setName: (name) => patchDesign({ name }),
    setMaterial: (material) => patchDesign({ material }),
    setGrained: (grained) => patchDesign({ grained }),
    setUnit: (unit) => change({ unit }),
    setMmDecimals: (mmDecimals) => change({ mmDecimals }),
    setSheet: (sheetId) => change({ sheetId }),
    setNote: (letter, text) => change({ notes: { ...get().notes, [letter]: text } }),
    setHover: (hover) => set({ hover }),
    setAdvanced: (advanced) => set({ advanced }),

    togglePresent: (panel) => {
      const present = { ...get().design.present, [panel]: !get().design.present[panel] }
      patchDesign({ present })
    },

    // The toggle is a shortcut INTO the order, never a state of its own. There
    // is no way to reach an invalid configuration from here, because every path
    // out of it is still a strict order over the six panels.
    setOutermost: (panel, extend) => {
      const order = get().design.order
      patchDesign({ order: extend ? promote(order, panel) : demote(order, panel) })
    },

    movePanel: (panel, index) => patchDesign({ order: moveTo(get().design.order, panel, index) }),
    applyOrder: (order) => patchDesign({ order: [...order] }),

    replace: (design, unit, notes) => change({ design, unit, notes, stockId: stockIdFor(design) }),

    reset: () => {
      const design = emptyDesign()
      change({ design: { ...design, order: [...DEFAULT_ORDER] }, notes: {}, stockId: stockIdFor(design) })
    },
  }
})

/** The cut list for the current design. Derived, never stored. */
export function useCutlist(): Cutlist {
  return computeCutlist(useDiyStore((s) => s.design))
}
