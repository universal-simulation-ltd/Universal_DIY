// ---------------------------------------------------------------------------
// The free parts list — the box model with the box taken out.
//
// panels.ts answers "how big do I cut it" for six pieces whose arrangement is
// fixed. Most of what people actually cut is not that: a face frame, a set of
// shelves, two different projects going onto one sheet at the timber merchant.
// So this file keeps the ONE idea that made the box model worth having and
// throws away the shape.
//
// THE IDEA
// --------
// Where two pieces meet in a butt joint, exactly one of them runs THROUGH to
// the outer surface and the other BUTTS into its face, losing exactly one
// thickness at that end. In a box that question is settled globally by the wrap
// order, because a box has a fixed set of twelve edges. Here the pieces and the
// joints are both free, so the guarantee has to be re-earned — and it is earned
// the same way, by the shape of the data:
//
//     interface Joint { through: PartEnd; butt: PartEnd }
//
// A joint NAMES its through piece and its butt piece. There is no state in
// which both run through (two pieces of wood in the same place) or neither does
// (a t-wide gap), for exactly the reason six "extends / sits inside" booleans
// were rejected for the box: those two states are physically impossible and a
// model that can express them is a bug generator. Every joint list is buildable
// by construction, and parts.test.ts checks that claim rather than trusting it.
//
// THE FORMULA
// -----------
//     cut(P) = length(P)
//            − thickness(through partner at P's start, if P butts there)
//            − thickness(through partner at P's end,   if P butts there)
//
// Which is `spanAlong` in panels.ts with the wrap-order predicate replaced by a
// direct lookup. Note the thickness deducted is the PARTNER's, not the piece's
// own — pieces here may be different thicknesses, and a 12 mm rail butting into
// an 18 mm stile loses 18, not 12. In a box that distinction cannot arise
// because there is one thickness for the whole box; here it is the first thing
// a hand calculation gets wrong.
//
// WHAT IS DELIBERATELY NOT MODELLED
// ---------------------------------
// Positions. A joint says "this end butts into that piece", not where either
// piece is in space. So this file cannot tell you a frame closes up, and it
// must not pretend to: there is no assembled drawing here and no cavity check,
// because both would be invented. Widths are never deducted either — a joint is
// at an END, and the end is on the length. If you need a deduction across the
// width, that piece's length is the other way round; swap the two numbers.
// ---------------------------------------------------------------------------

import type { PieceType } from './panels'

/** The two ends of a piece, as drawn: `start` is the left-hand end. */
export type EndId = 'start' | 'end'

export const END_IDS: readonly EndId[] = ['start', 'end']

export const END_NAME: Record<EndId, string> = { start: 'left end', end: 'right end' }

export interface Part {
  id: string
  /** What the piece is. Printed on the sheet; falls back to its letter. */
  name: string
  /** Grouping, so one cut can cover more than one project. May be blank. */
  project: string
  /** Length as typed, BEFORE any joint deduction. Along the grain. mm. */
  length: number
  /** Width. mm. Never deducted — see the note at the top of the file. */
  width: number
  qty: number
  /** mm. Per piece, not per list: a parts list may mix stock. */
  thickness: number
  material: string
  grained: boolean
}

export interface PartEnd {
  part: string
  end: EndId
}

export interface Joint {
  id: string
  /** Runs through to the outer surface. Keeps its full length at this end. */
  through: PartEnd
  /** Butts into the through piece's face. Loses one of ITS thicknesses. */
  butt: PartEnd
}

export interface PartsProject {
  name: string
  parts: Part[]
  joints: Joint[]
}

export interface PartPiece {
  id: string
  name: string
  project: string
  /** Length as typed. */
  nominal: number
  /** Length after joint deductions — the number you cut to. */
  length: number
  width: number
  thickness: number
  qty: number
  material: string
  grained: boolean
  /** mm lost at each end. 0 where the end is free or runs through. */
  lost: Record<EndId, number>
  typeLetter: string
  labels: string[]
  area: number
}

export interface ProjectGroup {
  /** The group heading. Blank project names collect under one label. */
  project: string
  types: PieceType[]
  pieces: number
  area: number
}

export interface PartsCutlist {
  pieces: PartPiece[]
  types: PieceType[]
  groups: ProjectGroup[]
  totalArea: number
  /** One plain-English line per joint, printed on the sheet. */
  jointSummary: string[]
  errors: string[]
  warnings: string[]
}

export const UNGROUPED = 'Not assigned to a project'

// --- ends and joints --------------------------------------------------------

export function sameEnd(a: PartEnd, b: PartEnd): boolean {
  return a.part === b.part && a.end === b.end
}

export function endKey(e: PartEnd): string {
  return `${e.part}:${e.end}`
}

/** The joint using this end, whichever side of it the end is on. */
export function jointAt(joints: readonly Joint[], end: PartEnd): Joint | undefined {
  return joints.find((j) => sameEnd(j.through, end) || sameEnd(j.butt, end))
}

export function roleAt(joint: Joint, end: PartEnd): 'through' | 'butt' | null {
  if (sameEnd(joint.through, end)) return 'through'
  if (sameEnd(joint.butt, end)) return 'butt'
  return null
}

/**
 * Why these two ends cannot be joined, or null if they can.
 *
 * Returned as a sentence rather than a boolean because the UI shows it: a
 * disabled control that will not say why is worse than no control.
 */
export function whyNotJoinable(project: PartsProject, a: PartEnd, b: PartEnd): string | null {
  if (a.part === b.part) return 'A piece cannot be joined to itself.'
  if (!project.parts.some((p) => p.id === a.part)) return 'That piece is no longer in the list.'
  if (!project.parts.some((p) => p.id === b.part)) return 'That piece is no longer in the list.'
  if (jointAt(project.joints, a)) return 'That end is already joined — unjoin it first.'
  if (jointAt(project.joints, b)) return 'That end is already joined — unjoin it first.'
  return null
}

/** Next joint id. Derived from the existing ids, so it never needs a clock. */
export function nextJointId(joints: readonly Joint[]): string {
  return `j${nextIndex(joints.map((j) => j.id), 'j')}`
}

export function nextPartId(parts: readonly Part[]): string {
  return `p${nextIndex(parts.map((p) => p.id), 'p')}`
}

function nextIndex(ids: readonly string[], prefix: string): number {
  let max = 0
  for (const id of ids) {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

/** Add a joint. `through` runs through; `butt` loses a thickness. */
export function addJoint(project: PartsProject, through: PartEnd, butt: PartEnd): Joint[] {
  if (whyNotJoinable(project, through, butt)) return project.joints
  return [...project.joints, { id: nextJointId(project.joints), through, butt }]
}

/** Flip which piece runs through. The joint stays; the deduction moves. */
export function swapJoint(joints: readonly Joint[], id: string): Joint[] {
  return joints.map((j) => (j.id === id ? { ...j, through: j.butt, butt: j.through } : j))
}

export function removeJoint(joints: readonly Joint[], id: string): Joint[] {
  return joints.filter((j) => j.id !== id)
}

/** Drop a part and every joint that referred to it. */
export function removePart(project: PartsProject, partId: string): PartsProject {
  return {
    ...project,
    parts: project.parts.filter((p) => p.id !== partId),
    joints: project.joints.filter((j) => j.through.part !== partId && j.butt.part !== partId),
  }
}

// --- the formula ------------------------------------------------------------

/** What this end loses, mm. The PARTNER's thickness, never the piece's own. */
export function lostAt(project: PartsProject, end: PartEnd): number {
  const joint = jointAt(project.joints, end)
  if (!joint || !sameEnd(joint.butt, end)) return 0
  const through = project.parts.find((p) => p.id === joint.through.part)
  return through && Number.isFinite(through.thickness) && through.thickness > 0 ? through.thickness : 0
}

export function cutLengthOf(project: PartsProject, part: Part): number {
  return part.length - lostAt(project, { part: part.id, end: 'start' }) - lostAt(project, { part: part.id, end: 'end' })
}

/**
 * "Top rail's right end butts into Left stile — 18 mm off Top rail."
 *
 * Printed on the sheet, because the sheet gets separated from the app and a
 * bare list of lengths does not say which piece laps which. Same reason
 * `describeWrap` exists for the box.
 */
export function describeJoint(project: PartsProject, joint: Joint): string {
  const through = project.parts.find((p) => p.id === joint.through.part)
  const butt = project.parts.find((p) => p.id === joint.butt.part)
  if (!through || !butt) return ''
  const t = through.thickness
  return (
    `${nameOf(butt)}’s ${END_NAME[joint.butt.end]} butts into ${nameOf(through)}` +
    ` — ${trim(t)} mm off ${nameOf(butt)}.`
  )
}

function nameOf(part: Part): string {
  return part.name.trim() || 'Unnamed piece'
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100)
}

// --- letters ----------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * A, B … Z, AA, AB … — spreadsheet columns.
 *
 * The box could get away with `LETTERS[i]` because it has at most six pieces.
 * A parts list carrying two projects runs past Z easily, and "Z7" for the
 * twenty-seventh type would collide with the piece label Z7 of type Z.
 */
export function letterFor(index: number): string {
  let n = index
  let out = ''
  do {
    out = ALPHABET[n % 26] + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

// --- the whole cut list -----------------------------------------------------

export function computePartsCutlist(project: PartsProject): PartsCutlist {
  const errors: string[] = []
  const warnings: string[] = []
  const empty = (): PartsCutlist => ({
    pieces: [], types: [], groups: [], totalArea: 0, jointSummary: [], errors, warnings,
  })

  // An empty list is not an error, it is a page nobody has typed into yet.
  if (project.parts.length === 0) return empty()

  const byId = new Map(project.parts.map((p) => [p.id, p]))
  if (byId.size !== project.parts.length) {
    errors.push('Two pieces share an id — the list is damaged.')
    return empty()
  }

  for (const part of project.parts) {
    const where = nameOf(part)
    for (const [label, v] of [['Length', part.length], ['Width', part.width], ['Thickness', part.thickness]] as const) {
      if (!Number.isFinite(v) || v <= 0) errors.push(`${where}: ${label.toLowerCase()} must be a positive number.`)
    }
    if (!Number.isInteger(part.qty) || part.qty < 1) errors.push(`${where}: quantity must be a whole number, 1 or more.`)
  }

  // Joints are validated before anything is sized. A joint pointing at a piece
  // that has been deleted would silently deduct nothing, and "silently deducts
  // nothing" is a piece cut one thickness too long.
  const seen = new Set<string>()
  for (const joint of project.joints) {
    const through = byId.get(joint.through.part)
    const butt = byId.get(joint.butt.part)
    if (!through || !butt) {
      errors.push('A joint refers to a piece that is no longer in the list.')
      continue
    }
    if (through.id === butt.id) {
      errors.push(`${nameOf(through)} is joined to itself.`)
      continue
    }
    for (const end of [joint.through, joint.butt]) {
      const key = endKey(end)
      if (seen.has(key)) {
        const part = byId.get(end.part)!
        errors.push(`${nameOf(part)}’s ${END_NAME[end.end]} is in more than one joint.`)
      }
      seen.add(key)
    }
  }

  if (errors.length) return empty()

  const pieces: PartPiece[] = []
  for (const part of project.parts) {
    const lost: Record<EndId, number> = {
      start: lostAt(project, { part: part.id, end: 'start' }),
      end: lostAt(project, { part: part.id, end: 'end' }),
    }
    const length = part.length - lost.start - lost.end
    if (length <= 0) {
      errors.push(
        `${nameOf(part)} works out at ${trim(length)} mm — its joints take off more than its length.`,
      )
      continue
    }
    pieces.push({
      id: part.id,
      name: nameOf(part),
      project: part.project.trim(),
      nominal: part.length,
      length,
      width: part.width,
      thickness: part.thickness,
      qty: part.qty,
      material: part.material,
      grained: part.grained,
      lost,
      typeLetter: '',
      labels: [],
      area: length * part.width * part.qty,
    })
  }

  if (errors.length) return empty()

  // One type per ROW, never merged by size. Two rows that happen to come out
  // the same size are still two entries the user typed and named — very likely
  // for two different projects — and merging them would take away the thing a
  // multi-project list is for: ticking off one project's pieces.
  const types: PieceType[] = pieces.map((piece, i) => {
    const letter = letterFor(i)
    piece.typeLetter = letter
    piece.labels = Array.from({ length: piece.qty }, (_, n) => `${letter}${n + 1}`)
    return {
      letter,
      part: piece.name,
      length: piece.length,
      width: piece.width,
      thickness: piece.thickness,
      qty: piece.qty,
      grain: piece.grained ? 'along length' : 'none',
      labels: piece.labels,
      material: piece.material,
    }
  })

  const groups: ProjectGroup[] = []
  for (const piece of pieces) {
    const name = piece.project || UNGROUPED
    let group = groups.find((g) => g.project === name)
    if (!group) {
      group = { project: name, types: [], pieces: 0, area: 0 }
      groups.push(group)
    }
    group.types.push(types.find((t) => t.letter === piece.typeLetter)!)
    group.pieces += piece.qty
    group.area += piece.area
  }

  const jointSummary = project.joints.map((j) => describeJoint(project, j)).filter(Boolean)

  const free = countFreeEnds(project)
  if (project.joints.length === 0) {
    warnings.push('No joints — every piece is cut to the length you typed.')
  } else if (free > 0) {
    warnings.push(
      `${free} ${free === 1 ? 'end is' : 'ends are'} not joined to anything, and lose nothing. ` +
      'That is right for a free end and wrong for one you meant to join.',
    )
  }

  return {
    pieces,
    types,
    groups,
    totalArea: pieces.reduce((sum, p) => sum + p.area, 0),
    jointSummary,
    errors,
    warnings,
  }
}

export function countFreeEnds(project: PartsProject): number {
  let free = 0
  for (const part of project.parts) {
    for (const end of END_IDS) {
      if (!jointAt(project.joints, { part: part.id, end })) free += 1
    }
  }
  return free
}

// --- starting points --------------------------------------------------------

export function newPart(parts: readonly Part[], seed: Partial<Part> = {}): Part {
  const last = parts[parts.length - 1]
  return {
    id: nextPartId(parts),
    name: '',
    // A new row inherits the last row's material, project and thickness. In a
    // list of twenty pieces those three are the same twenty times, and retyping
    // them is how a wrong thickness gets into one row out of twenty.
    project: last?.project ?? '',
    length: 600,
    width: 100,
    qty: 1,
    thickness: last?.thickness ?? 18,
    material: last?.material ?? '18 mm birch ply',
    grained: last?.grained ?? true,
    ...seed,
  }
}

/**
 * The starting list. Two pieces and no joints — enough that the page shows a
 * working cut list and the join control the moment it opens, and few enough
 * that nobody has to delete a worked example before typing their own.
 */
export function emptyPartsProject(): PartsProject {
  const a = newPart([], { name: 'Piece A', length: 600, width: 100 })
  const b = newPart([a], { name: 'Piece B', length: 400, width: 100 })
  return { name: 'My cut', parts: [a, b], joints: [] }
}
