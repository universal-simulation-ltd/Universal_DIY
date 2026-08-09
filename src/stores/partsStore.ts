import { create } from 'zustand'
import {
  addJoint,
  computePartsCutlist,
  emptyPartsProject,
  jointAt,
  newPart,
  nextPartId,
  removeJoint,
  removePart,
  sameEnd,
  swapJoint,
  whyNotJoinable,
  type Part,
  type PartEnd,
  type PartsCutlist,
  type PartsProject,
} from '../lib/parts'
import { loadLocalParts, saveLocalParts } from '../lib/storage'
import type { Unit } from '../lib/units'

/**
 * State for the free parts list.
 *
 * A separate store from `diyStore`, not a branch inside it: the two pages hold
 * different models, and a single store would have to carry both and let every
 * selector ask which one is live. The one thing they genuinely share — the
 * display unit — is duplicated rather than lifted, which costs a line and keeps
 * the two pages from being able to break each other.
 *
 * As in the box store, the cut list is NOT state. It is
 * `computePartsCutlist(project)`, recomputed on every render, because a cached
 * cut size is the only bug in this app that costs somebody a sheet of plywood.
 */
export interface PartsState {
  project: PartsProject
  unit: Unit
  mmDecimals: 0 | 1
  /** Free text per piece letter, printed in the Notes column. */
  notes: Record<string, string>
  /**
   * The end waiting for a partner, or null. The whole join interaction is this
   * one field: click an end to arm it, click a second to make the joint.
   */
  arming: PartEnd | null
  /** Why the last click could not join, shown next to the drawing. */
  refusal: string | null

  setName: (name: string) => void
  setUnit: (unit: Unit) => void
  setMmDecimals: (dp: 0 | 1) => void
  setNote: (letter: string, text: string) => void

  patchPart: (id: string, patch: Partial<Part>) => void
  addPart: () => void
  duplicatePart: (id: string) => void
  deletePart: (id: string) => void

  /** Click an end. Arms it, completes a joint, or unjoins it. */
  clickEnd: (end: PartEnd) => void
  cancelArming: () => void
  flipJoint: (id: string) => void
  unjoin: (id: string) => void

  replace: (project: PartsProject, unit: Unit, notes: Record<string, string>) => void
  reset: () => void
}

function initial(): { project: PartsProject; unit: Unit; notes: Record<string, string> } {
  const local = typeof window === 'undefined' ? null : loadLocalParts()
  if (local) return local
  return { project: emptyPartsProject(), unit: 'mm', notes: {} }
}

export const usePartsStore = create<PartsState>((set, get) => {
  const start = initial()
  const persist = () => {
    const { project, unit, notes } = get()
    saveLocalParts({ project, unit, notes })
  }
  const change = (patch: Partial<PartsState>) => {
    set(patch)
    persist()
  }
  const patchProject = (patch: Partial<PartsProject>) =>
    change({ project: { ...get().project, ...patch } })

  return {
    project: start.project,
    unit: start.unit,
    notes: start.notes,
    mmDecimals: 1,
    arming: null,
    refusal: null,

    setName: (name) => patchProject({ name }),
    setUnit: (unit) => change({ unit }),
    setMmDecimals: (mmDecimals) => change({ mmDecimals }),
    setNote: (letter, text) => change({ notes: { ...get().notes, [letter]: text } }),

    patchPart: (id, patch) =>
      patchProject({ parts: get().project.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),

    addPart: () => patchProject({ parts: [...get().project.parts, newPart(get().project.parts)] }),

    duplicatePart: (id) => {
      const { parts } = get().project
      const source = parts.find((p) => p.id === id)
      if (!source) return
      // A copy, deliberately WITHOUT the original's joints. Two pieces cannot
      // butt into the same end, so cloning the joints would either be refused
      // or silently claim a joint the original already owns.
      const copy: Part = { ...source, id: nextPartId(parts) }
      const at = parts.findIndex((p) => p.id === id)
      patchProject({ parts: [...parts.slice(0, at + 1), copy, ...parts.slice(at + 1)] })
    },

    deletePart: (id) => {
      const next = removePart(get().project, id)
      const arming = get().arming
      change({
        project: next,
        // Arming an end and then deleting its piece would leave a click waiting
        // for a partner that no longer exists.
        arming: arming?.part === id ? null : arming,
        refusal: null,
      })
    },

    clickEnd: (end) => {
      const { project, arming } = get()
      const existing = jointAt(project.joints, end)

      if (!arming) {
        // Nothing selected yet. A joined end separates — that is the whole "or
        // leave them separate" half of the interaction, and it is the same
        // click because an end has one thing to be. A free end arms.
        if (existing) {
          return change({ project: { ...project, joints: removeJoint(project.joints, existing.id) }, refusal: null })
        }
        return set({ arming: end, refusal: null })
      }

      // Clicking the armed end again disarms it, rather than doing nothing —
      // otherwise the only way out of an accidental click is a Cancel button
      // nobody looks for.
      if (sameEnd(arming, end)) return set({ arming: null, refusal: null })

      // Mid-join, an already-joined end is a REFUSAL and never an unjoin.
      // Letting the separate-on-click rule win here would mean somebody who
      // armed one end and clicked a second got neither a joint nor an
      // explanation — they got a different, existing joint silently destroyed.
      // Nothing on this page should quietly undo work as a side effect of an
      // action that was asking for something else.
      const reason = whyNotJoinable(project, arming, end)
      if (reason) return set({ refusal: reason })

      // The FIRST end clicked runs through; the second butts into it and loses
      // a thickness. Stated in the UI, and reversible with one click on the
      // joint, so the choice is never buried.
      change({
        project: { ...project, joints: addJoint(project, arming, end) },
        arming: null,
        refusal: null,
      })
    },

    cancelArming: () => set({ arming: null, refusal: null }),

    flipJoint: (id) => patchProject({ joints: swapJoint(get().project.joints, id) }),

    unjoin: (id) => patchProject({ joints: removeJoint(get().project.joints, id) }),

    replace: (project, unit, notes) => change({ project, unit, notes, arming: null, refusal: null }),

    reset: () => change({ project: emptyPartsProject(), notes: {}, arming: null, refusal: null }),
  }
})

/** The cut list for the current parts list. Derived, never stored. */
export function usePartsCutlist(): PartsCutlist {
  return computePartsCutlist(usePartsStore((s) => s.project))
}
