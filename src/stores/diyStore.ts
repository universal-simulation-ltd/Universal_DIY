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
import type { Template } from '../lib/templates'
import type { Unit } from '../lib/units'

/**
 * Where the design on THIS page load came from.
 *
 * Fixed at startup and never written again, because it is a fact about how the
 * visitor arrived, not a piece of app state. The landing page reads it to decide
 * what to offer:
 *
 *   'link'  — a shared design in the URL hash. Skip the landing page entirely;
 *             somebody who followed a link to a box wants the box, not a menu.
 *   'saved' — a design in localStorage from a previous session. Offer to carry
 *             on with it, but still show the templates.
 *   'new'   — nothing to resume.
 */
export type DesignOrigin = 'link' | 'saved' | 'new'

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
  /** How the visitor arrived. Set once at startup, never written again. */
  readonly origin: DesignOrigin

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
  /** Start from a landing-page template. A starting design and nothing else. */
  applyTemplate: (template: Template) => void
  reset: () => void
}

/** Which stock entry (if any) the current thickness + material came from. */
function stockIdFor(design: Design): string {
  const hit = STOCK.find((s) => s.mm === design.thickness && s.material === design.material)
  return hit ? hit.id : 'custom'
}

function initial(): { design: Design; unit: Unit; notes: Record<string, string>; origin: DesignOrigin } {
  // A link beats local storage: somebody who followed a shared design wants the
  // design in the link, not whatever they were drawing last week.
  const shared = typeof window === 'undefined' ? null : readShareFromUrl()
  if (shared) return { design: shared.design, unit: shared.unit, notes: {}, origin: 'link' }
  const local = typeof window === 'undefined' ? null : loadLocal()
  if (local) return { ...local, origin: 'saved' }
  return { design: emptyDesign(), unit: 'mm', notes: {}, origin: 'new' }
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
    origin: start.origin,

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

    // Applying a template is `replace` with the template's own design copied,
    // and it deliberately does nothing else. No template id is recorded and
    // nothing downstream branches on which card was clicked — the moment it
    // lands it is an ordinary design and every control still moves. The copy
    // matters: TEMPLATES is a module-level constant, so handing its `design`
    // object to the store un-copied would let the first edit rewrite the
    // template for the rest of the session.
    applyTemplate: (template) => {
      const design: Design = {
        ...template.design,
        present: { ...template.design.present },
        order: [...template.design.order],
      }
      change({ design, notes: {}, stockId: stockIdFor(design) })
    },

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
