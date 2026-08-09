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

import { SHEETS } from './materials'
import { DEFAULT_KERF, DEFAULT_TRIM } from './nest'
import { PANEL_IDS, isValidOrder, type Design, type PanelId } from './panels'
import { END_IDS, type Joint, type Part, type PartsProject } from './parts'
import type { Unit } from './units'

const KEY = 'unisim.diy.design.v1'
const PARTS_KEY = 'unisim.diy.parts.v1'
const SAW_KEY = 'unisim.diy.saw.v1'
export const FILE_KIND = 'unisim.universal-diy.design'
export const PARTS_FILE_KIND = 'unisim.universal-diy.parts'
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

// --- the free parts list ----------------------------------------------------
//
// A separate key, a separate file kind and a separate sanitiser, because it is
// a separate model — not a Design with extra fields. Sharing storage between
// the two would mean one of them loading the other's data and having to guess.

export interface PartsFile {
  kind: typeof PARTS_FILE_KIND
  version: number
  savedAt: string
  unit: Unit
  project: PartsProject
  notes: Record<string, string>
}

export interface PersistedParts {
  project: PartsProject
  unit: Unit
  notes: Record<string, string>
}

/**
 * Validate an untrusted parts list.
 *
 * Same job as `sanitiseDesign` and the same reason: a hand-edited file must not
 * be able to put NaN into a cut length. Joints get the harder treatment —
 * anything referring to a piece that is not here, or naming an end twice, is
 * DROPPED rather than kept, because a joint the model cannot honour silently
 * deducts nothing, and a piece cut one thickness too long is exactly the
 * failure this app exists to prevent. Dropping is safe: an unjoined end is
 * visible on screen as an unjoined end.
 */
export function sanitiseParts(input: unknown): PartsProject | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<PartsProject>
  if (!Array.isArray(raw.parts)) return null

  const parts: Part[] = []
  const ids = new Set<string>()
  for (const item of raw.parts) {
    const p = item as Partial<Part>
    if (typeof p.id !== 'string' || !p.id || ids.has(p.id)) continue
    const nums = [p.length, p.width, p.thickness]
    if (nums.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) continue
    if (typeof p.qty !== 'number' || !Number.isInteger(p.qty) || p.qty < 1) continue
    ids.add(p.id)
    parts.push({
      id: p.id,
      name: typeof p.name === 'string' ? p.name.slice(0, 120) : '',
      project: typeof p.project === 'string' ? p.project.slice(0, 120) : '',
      length: p.length as number,
      width: p.width as number,
      qty: p.qty,
      thickness: p.thickness as number,
      material: typeof p.material === 'string' ? p.material.slice(0, 120) : '',
      grained: Boolean(p.grained),
    })
  }
  if (parts.length === 0) return null

  const joints: Joint[] = []
  const usedEnds = new Set<string>()
  const jointIds = new Set<string>()
  for (const item of Array.isArray(raw.joints) ? raw.joints : []) {
    const j = item as Partial<Joint>
    if (typeof j.id !== 'string' || !j.id || jointIds.has(j.id)) continue
    const ends = [j.through, j.butt]
    if (!ends.every((e) => e && ids.has(e.part) && (END_IDS as readonly string[]).includes(e.end))) continue
    if (j.through!.part === j.butt!.part) continue
    const keys = ends.map((e) => `${e!.part}:${e!.end}`)
    if (keys.some((k) => usedEnds.has(k))) continue
    keys.forEach((k) => usedEnds.add(k))
    jointIds.add(j.id)
    joints.push({ id: j.id, through: { ...j.through! }, butt: { ...j.butt! } })
  }

  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : 'My cut',
    parts,
    joints,
  }
}

export function loadLocalParts(): PersistedParts | null {
  try {
    const raw = localStorage.getItem(PARTS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedParts>
    const project = sanitiseParts(parsed.project)
    if (!project) return null
    return {
      project,
      unit: (['mm', 'cm', 'in'] as const).includes(parsed.unit as Unit) ? (parsed.unit as Unit) : 'mm',
      notes: isNotes(parsed.notes) ? parsed.notes : {},
    }
  } catch {
    return null
  }
}

export function saveLocalParts(state: PersistedParts): void {
  try {
    localStorage.setItem(PARTS_KEY, JSON.stringify(state))
  } catch {
    // Same as the box: a private-browsing quota failure is not worth
    // interrupting a cut list for.
  }
}

export function toPartsFile(state: PersistedParts): PartsFile {
  return {
    kind: PARTS_FILE_KIND,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    unit: state.unit,
    project: state.project,
    notes: state.notes,
  }
}

export function fromPartsFile(json: string): PersistedParts | null {
  try {
    const parsed = JSON.parse(json) as Partial<PartsFile>
    if (parsed.kind !== PARTS_FILE_KIND) return null
    const project = sanitiseParts(parsed.project)
    if (!project) return null
    return {
      project,
      unit: (['mm', 'cm', 'in'] as const).includes(parsed.unit as Unit) ? (parsed.unit as Unit) : 'mm',
      notes: isNotes(parsed.notes) ? parsed.notes : {},
    }
  } catch {
    return null
  }
}

// --- the saw ----------------------------------------------------------------
//
// Kerf, trim and sheet size are facts about somebody's SAW and somebody's
// TIMBER MERCHANT, not about the thing they are building. They belong to the
// person, so they are stored once and shared by both pages and every project —
// setting your blade width again for each new box would be the same answer
// typed over and over. This is also why they are not in the project file or the
// share link: a design sent to somebody else must not silently re-specify their
// saw.

export interface SawSettings {
  sheetId: string
  /** mm. */
  kerf: number
  /** mm. */
  trim: number
}

export const DEFAULT_SAW: SawSettings = {
  sheetId: SHEETS[0].id,
  kerf: DEFAULT_KERF,
  trim: DEFAULT_TRIM,
}

/** Clamp rather than reject: a silly kerf should not lose the other two fields. */
export function sanitiseSaw(input: unknown): SawSettings {
  const raw = (input ?? {}) as Partial<SawSettings>
  const number = (v: unknown, fallback: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback
  return {
    sheetId: SHEETS.some((s) => s.id === raw.sheetId) ? (raw.sheetId as string) : DEFAULT_SAW.sheetId,
    kerf: number(raw.kerf, DEFAULT_SAW.kerf, 50),
    trim: number(raw.trim, DEFAULT_SAW.trim, 200),
  }
}

export function loadSaw(): SawSettings {
  try {
    const raw = localStorage.getItem(SAW_KEY)
    return raw ? sanitiseSaw(JSON.parse(raw)) : { ...DEFAULT_SAW }
  } catch {
    return { ...DEFAULT_SAW }
  }
}

export function saveSaw(settings: SawSettings): void {
  try {
    localStorage.setItem(SAW_KEY, JSON.stringify(settings))
  } catch {
    // As above — a quota failure is not worth interrupting a cut list for.
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
