// ---------------------------------------------------------------------------
// Save / load. Kept in its own module on purpose.
//
// If a second DIY tool ever lands under /diy, the project format and the
// save/load chrome are the parts that want sharing — factoring them out now is
// cheap and retrofitting them later is not.
//
// Three routes, none of which touch the network:
//   * localStorage, so a refresh doesn't lose the design;
//   * a .unidiy.json file, for keeping a project alongside the build; and
//   * the URL hash (share.ts), for sending one to somebody.
// ---------------------------------------------------------------------------

import { PANEL_IDS, isValidOrder, type Design, type PanelId } from './panels'
import type { Unit } from './units'

const KEY = 'unisim.diy.design.v1'
export const FILE_KIND = 'unisim.universal-diy.design'
export const FILE_VERSION = 1

export interface ProjectFile {
  kind: typeof FILE_KIND
  version: number
  savedAt: string
  unit: Unit
  design: Design
  notes: Record<string, string>
}

export interface Persisted {
  design: Design
  unit: Unit
  notes: Record<string, string>
}

/**
 * Validate an untrusted design. A hand-edited file or a truncated link must not
 * be able to put NaN into the arithmetic — the failure would show up as a cut
 * size, which is exactly the wrong place to find out.
 */
export function sanitiseDesign(input: unknown): Design | null {
  if (!input || typeof input !== 'object') return null
  const d = input as Partial<Design>
  const nums: Array<[keyof Design, unknown]> = [
    ['width', d.width], ['depth', d.depth], ['height', d.height], ['thickness', d.thickness],
  ]
  for (const [, v] of nums) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null
  }
  if (!Array.isArray(d.order) || !isValidOrder(d.order as PanelId[])) return null
  const present = {} as Record<PanelId, boolean>
  for (const id of PANEL_IDS) present[id] = Boolean(d.present?.[id])
  if (!PANEL_IDS.some((id) => present[id])) return null
  return {
    name: typeof d.name === 'string' ? d.name.slice(0, 120) : 'My box',
    width: d.width as number,
    depth: d.depth as number,
    height: d.height as number,
    thickness: d.thickness as number,
    present,
    order: [...(d.order as PanelId[])],
    material: typeof d.material === 'string' ? d.material.slice(0, 120) : '',
    grained: Boolean(d.grained),
  }
}

export function loadLocal(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Persisted>
    const design = sanitiseDesign(parsed.design)
    if (!design) return null
    return {
      design,
      unit: (['mm', 'cm', 'in'] as const).includes(parsed.unit as Unit) ? (parsed.unit as Unit) : 'mm',
      notes: isNotes(parsed.notes) ? parsed.notes : {},
    }
  } catch {
    return null
  }
}

export function saveLocal(state: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private-browsing quota failures are not worth interrupting a cut list for.
  }
}

function isNotes(v: unknown): v is Record<string, string> {
  return Boolean(v) && typeof v === 'object' && Object.values(v as object).every((s) => typeof s === 'string')
}

export function toProjectFile(state: Persisted): ProjectFile {
  return {
    kind: FILE_KIND,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    unit: state.unit,
    design: state.design,
    notes: state.notes,
  }
}

export function fromProjectFile(json: string): Persisted | null {
  try {
    const parsed = JSON.parse(json) as Partial<ProjectFile>
    if (parsed.kind !== FILE_KIND) return null
    const design = sanitiseDesign(parsed.design)
    if (!design) return null
    return {
      design,
      unit: (['mm', 'cm', 'in'] as const).includes(parsed.unit as Unit) ? (parsed.unit as Unit) : 'mm',
      notes: isNotes(parsed.notes) ? parsed.notes : {},
    }
  } catch {
    return null
  }
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
