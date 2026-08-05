// ---------------------------------------------------------------------------
// The panel model.
//
// This file is the product. Everything else in the app is presentation, and if
// a number here is wrong somebody cuts up a sheet of birch ply for nothing —
// so it is written to the formula, kept free of any React/DOM dependency, and
// covered by src/lib/panels.test.ts.
//
// THE MODEL, and why it is not six booleans
// -----------------------------------------
// The obvious way to describe a box is "each panel either extends to the outer
// edge, or sits inside". That is a bug generator. At the edge where Top meets
// Left:
//
//   * both extend  -> both claim the corner block x∈[0,t], z∈[H−t,H].
//                     Two pieces of wood in the same place.
//   * both inside  -> nobody claims it. A t × t groove running the full depth.
//
// Two of the four states at each of the 12 edges are physically impossible, so
// most of the 64 configurations are nonsense.
//
// Instead the model is a STRICT WRAP ORDER over the six panels, 1 = outermost.
// At each edge the panel with the LOWER priority number wins: it runs through
// to the outer surface, and its neighbour butts against its inner face, losing
// exactly one thickness at that end. Every edge has exactly one winner, so the
// state is valid by construction for all 720 orderings — see the exhaustive
// occupancy tests in panels.test.ts, which check that claim rather than trust
// it.
//
// THE FORMULA
// -----------
// For panel P normal to axis a, its size along each other axis b is:
//
//   len_b(P) = outer_b
//            − t · [ panel at b-min is present AND prio(b-min) < prio(P) ]
//            − t · [ panel at b-max is present AND prio(b-max) < prio(P) ]
//
// i.e. start from the full outer dimension and subtract one thickness for
// every neighbour that wraps outside you. The "is present" clause is why the
// deduction is written per-end and not as a flat −2t: an open-top tray's sides
// keep their full height, because there is no top to lose 18 mm to.
//
// A panel's position along its OWN normal axis never depends on priority — it
// is always flush with the outer face at its end. Priority only ever changes
// how long a panel is along the other two axes.
// ---------------------------------------------------------------------------

export type Axis = 'x' | 'y' | 'z'

/** The six panels, each normal to one axis. */
export type PanelId = 'left' | 'right' | 'front' | 'back' | 'bottom' | 'top'

/**
 * Canonical listing order — used for cut-list rows, piece-type letters and the
 * diagram, and deliberately INDEPENDENT of the wrap order so that re-ordering
 * the wrap does not shuffle the labels pencilled on somebody's offcuts.
 */
export const PANEL_IDS: readonly PanelId[] = ['left', 'right', 'top', 'bottom', 'back', 'front']

export const PANEL_NAMES: Record<PanelId, string> = {
  left: 'Left side',
  right: 'Right side',
  top: 'Top',
  bottom: 'Bottom',
  back: 'Back',
  front: 'Front',
}

/** Which axis each panel is normal to, and which end of that axis it sits at. */
export const PANEL_AXIS: Record<PanelId, Axis> = {
  left: 'x', right: 'x',
  front: 'y', back: 'y',
  bottom: 'z', top: 'z',
}

export const PANEL_END: Record<PanelId, 'min' | 'max'> = {
  left: 'min', right: 'max',
  front: 'min', back: 'max',
  bottom: 'min', top: 'max',
}

/** The panel at each end of each axis. */
export const AXIS_PANELS: Record<Axis, { min: PanelId; max: PanelId }> = {
  x: { min: 'left', max: 'right' },
  y: { min: 'front', max: 'back' },
  z: { min: 'bottom', max: 'top' },
}

export const AXES: readonly Axis[] = ['x', 'y', 'z']

/** Human wording for the outer dimension on each axis. */
export const AXIS_LABEL: Record<Axis, string> = { x: 'Width', y: 'Depth', z: 'Height' }

/**
 * A design. Every length is MILLIMETRES — the canonical internal unit. The
 * display unit is a presentation concern and lives in `unit`; nothing in the
 * arithmetic ever sees inches.
 */
export interface Design {
  name: string
  /** Outer width, along x. mm. */
  width: number
  /** Outer depth, along y. mm. */
  depth: number
  /** Outer height, along z. mm. */
  height: number
  /** Material thickness, mm. Never rounded — a 3/4" board is 19.05, not 19. */
  thickness: number
  /** Present/omitted per panel. An omitted panel deducts nothing from anyone. */
  present: Record<PanelId, boolean>
  /** Strict wrap order, outermost first. Must be a permutation of PANEL_IDS. */
  order: PanelId[]
  /** Free-text material name, printed on the sheet so it stands alone. */
  material: string
  /** Does the material have a visible grain? Drives the Grain column. */
  grained: boolean
}

export interface Piece {
  panel: PanelId
  /** "Left side", "Top"… */
  part: string
  /** Axis this panel is normal to. */
  normal: Axis
  /** Longer cut dimension, mm. Always the along-the-grain dimension. */
  length: number
  /** Shorter cut dimension, mm. */
  width: number
  thickness: number
  /** Which axis the `length` dimension runs along in the assembled box. */
  lengthAxis: Axis
  /** Which axis the `width` dimension runs along in the assembled box. */
  widthAxis: Axis
  /** Piece-type letter, e.g. 'A'. Same letter = same size AND same role. */
  typeLetter: string
  /** Full label written on the board, e.g. 'A2'. */
  label: string
  /** Cut area, mm². */
  area: number
}

export interface PieceType {
  letter: string
  part: string
  length: number
  width: number
  thickness: number
  qty: number
  grain: 'along length' | 'along width' | 'none'
  labels: string[]
}

export interface Cavity {
  x: number
  y: number
  z: number
}

export interface Cutlist {
  pieces: Piece[]
  types: PieceType[]
  /** Interior cavity, mm — the single best pre-cut sanity check. */
  cavity: Cavity
  /** Sum of every piece's cut area, mm². */
  totalArea: number
  /** Plain-English description of the wrap order. */
  wrapSummary: string
  /** Blocking problems. Non-empty means the cut list must not be shown. */
  errors: string[]
  /** Non-blocking things worth saying out loud. */
  warnings: string[]
}

// --- validation -------------------------------------------------------------

/** Is `order` a strict total order over exactly the six panels? */
export function isValidOrder(order: readonly PanelId[]): boolean {
  if (order.length !== PANEL_IDS.length) return false
  const seen = new Set(order)
  if (seen.size !== order.length) return false
  return PANEL_IDS.every((p) => seen.has(p))
}

/** 1-based priority lookup. 1 = outermost. */
export function priorities(order: readonly PanelId[]): Record<PanelId, number> {
  const out = {} as Record<PanelId, number>
  order.forEach((p, i) => { out[p] = i + 1 })
  return out
}

export function outerFor(design: Design): Record<Axis, number> {
  return { x: design.width, y: design.depth, z: design.height }
}

// --- the formula ------------------------------------------------------------

/**
 * The two axes a panel's face runs along, in canonical x→y→z order.
 * A panel normal to x spans y and z, and so on.
 */
export function faceAxes(normal: Axis): [Axis, Axis] {
  const rest = AXES.filter((a) => a !== normal)
  return [rest[0], rest[1]]
}

/**
 * How much of `outer[b]` this panel spans, and where along b it starts.
 *
 * `start` is one thickness in from the b-min face when the b-min neighbour
 * wraps outside this panel, and 0 otherwise — which is the same predicate that
 * shortens the panel, so start and length can never disagree. The 3-D solids
 * in geometry.ts are built from this, which is what makes the exhaustive
 * overlap/gap tests a real check on the formula rather than a restatement.
 */
export function spanAlong(
  design: Design,
  panel: PanelId,
  b: Axis,
  prio: Record<PanelId, number>,
): { start: number; length: number } {
  const outer = outerFor(design)
  const { min, max } = AXIS_PANELS[b]
  const t = design.thickness
  const minWraps = design.present[min] && prio[min] < prio[panel]
  const maxWraps = design.present[max] && prio[max] < prio[panel]
  const start = minWraps ? t : 0
  const length = outer[b] - (minWraps ? t : 0) - (maxWraps ? t : 0)
  return { start, length }
}

/** Interior cavity: outer minus one thickness for each PRESENT panel on that axis. */
export function cavityOf(design: Design): Cavity {
  const outer = outerFor(design)
  const t = design.thickness
  const along = (a: Axis) => {
    const { min, max } = AXIS_PANELS[a]
    return outer[a] - (design.present[min] ? t : 0) - (design.present[max] ? t : 0)
  }
  return { x: along('x'), y: along('y'), z: along('z') }
}

// --- plain-English wrap summary --------------------------------------------

const PAIR_WORD: Record<Axis, string> = {
  x: 'the sides',
  y: 'the front and back',
  z: 'the top and bottom',
}

/**
 * "Sides run full height and depth; the top and bottom fit between them; the
 * back and front fit inside everything." Printed on the sheet, because the
 * sheet gets separated from the app and a bare list of six sizes does not say
 * which panel laps which.
 */
export function describeWrap(order: readonly PanelId[], present: Record<PanelId, boolean>): string {
  const parts: string[] = []
  const prio = priorities(order)
  for (const panel of order) {
    if (!present[panel]) continue
    const normal = PANEL_AXIS[panel]
    const outerAxes: Axis[] = []
    const innerAxes: Axis[] = []
    for (const b of faceAxes(normal)) {
      const { min, max } = AXIS_PANELS[b]
      const wrapped = (present[min] && prio[min] < prio[panel]) || (present[max] && prio[max] < prio[panel])
      if (wrapped) innerAxes.push(b); else outerAxes.push(b)
    }
    if (innerAxes.length === 0) parts.push(`${PANEL_NAMES[panel].toLowerCase()} runs the full ${outerAxes.map((a) => AXIS_LABEL[a].toLowerCase()).join(' and ')}`)
    else if (outerAxes.length === 0) parts.push(`${PANEL_NAMES[panel].toLowerCase()} fits inside ${innerAxes.map((a) => PAIR_WORD[a]).join(' and ')}`)
    else parts.push(`${PANEL_NAMES[panel].toLowerCase()} runs the full ${outerAxes.map((a) => AXIS_LABEL[a].toLowerCase()).join(' and ')} but fits between ${innerAxes.map((a) => PAIR_WORD[a]).join(' and ')}`)
  }
  const omitted = PANEL_IDS.filter((p) => !present[p])
  if (omitted.length) parts.push(`no ${omitted.map((p) => PANEL_NAMES[p].toLowerCase()).join(', ')}`)
  return parts.join('; ')
}

// --- the whole cut list -----------------------------------------------------

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Round to 4 dp to kill float noise before comparing sizes for type grouping. */
function key(n: number): string {
  return (Math.round(n * 1e4) / 1e4).toFixed(4)
}

export function computeCutlist(design: Design): Cutlist {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isValidOrder(design.order)) {
    errors.push('The wrap order is not a strict order over the six panels.')
  }
  for (const [label, v] of [['Width', design.width], ['Depth', design.depth], ['Height', design.height]] as const) {
    if (!(v > 0) || !Number.isFinite(v)) errors.push(`${label} must be a positive number.`)
  }
  if (!(design.thickness > 0) || !Number.isFinite(design.thickness)) {
    errors.push('Material thickness must be a positive number.')
  }
  const anyPresent = PANEL_IDS.some((p) => design.present[p])
  if (!anyPresent) errors.push('At least one panel must be present.')

  if (errors.length) {
    return { pieces: [], types: [], cavity: { x: 0, y: 0, z: 0 }, totalArea: 0, wrapSummary: '', errors, warnings }
  }

  const prio = priorities(design.order)
  const cavity = cavityOf(design)

  // Checked BEFORE any piece is sized, and blocking like every other error.
  // A negative cavity is not a cosmetic problem: with only a top and a bottom
  // present and H < 2t the two slabs physically intersect, which is the exact
  // state the wrap order exists to make unreachable. It has to stop the cut
  // list, not annotate it — an earlier draft pushed this error *after* building
  // the pieces and returned both, so a caller reading `pieces` without reading
  // `errors` would have printed sizes for an impossible box.
  if (cavity.x <= 0 || cavity.y <= 0 || cavity.z <= 0) {
    errors.push('The interior cavity has no room left — the material is too thick for a box this size.')
    return { pieces: [], types: [], cavity, totalArea: 0, wrapSummary: '', errors, warnings }
  }

  const pieces: Piece[] = []
  for (const panel of PANEL_IDS) {
    if (!design.present[panel]) continue
    const normal = PANEL_AXIS[panel]
    const [b1, b2] = faceAxes(normal)
    const s1 = spanAlong(design, panel, b1, prio).length
    const s2 = spanAlong(design, panel, b2, prio).length

    if (s1 <= 0 || s2 <= 0) {
      errors.push(
        `${PANEL_NAMES[panel]} works out at ${fmtRaw(s1)} × ${fmtRaw(s2)} mm — the material is too thick for a box this size.`,
      )
      continue
    }

    // A cut list states the long side first, and the long side is the one the
    // grain runs along (see the Grain column). Which of the two face axes that
    // is falls out of the numbers, not out of a convention.
    const lengthFirst = s1 >= s2
    const length = lengthFirst ? s1 : s2
    const width = lengthFirst ? s2 : s1
    pieces.push({
      panel,
      part: PANEL_NAMES[panel],
      normal,
      length,
      width,
      thickness: design.thickness,
      lengthAxis: lengthFirst ? b1 : b2,
      widthAxis: lengthFirst ? b2 : b1,
      typeLetter: '',
      label: '',
      area: length * width,
    })
  }

  if (errors.length) {
    return { pieces: [], types: [], cavity, totalArea: 0, wrapSummary: '', errors, warnings }
  }

  // Piece types: same SIZE and same ROLE. Two same-size panels normal to
  // different axes are still different pieces — they go in different places
  // and (with a grain) at different orientations, so they get different
  // letters. Letters, not numbers, because a handwritten 1 and 7 on a dusty
  // offcut are a coin flip and an A is not.
  const typeOf = new Map<string, PieceType>()
  for (const piece of pieces) {
    const k = `${piece.normal}|${key(piece.length)}|${key(piece.width)}`
    let type = typeOf.get(k)
    if (!type) {
      const letter = LETTERS[typeOf.size] ?? `Z${typeOf.size}`
      type = {
        letter,
        part: piece.part,
        length: piece.length,
        width: piece.width,
        thickness: piece.thickness,
        qty: 0,
        grain: design.grained ? 'along length' : 'none',
        labels: [],
      }
      typeOf.set(k, type)
    }
    type.qty += 1
    piece.typeLetter = type.letter
    piece.label = `${type.letter}${type.qty}`
    type.labels.push(piece.label)
    // Two panels sharing a type usually share a name ("Left side"/"Right
    // side"); collapse to the pair wording so the printed row reads sensibly.
    if (type.qty > 1) type.part = pairName(piece.normal)
  }

  const totalArea = pieces.reduce((sum, p) => sum + p.area, 0)

  const omitted = PANEL_IDS.filter((p) => !design.present[p])
  if (omitted.length) {
    warnings.push(
      `${omitted.map((p) => PANEL_NAMES[p]).join(' and ')} omitted — neighbours keep their full size at that end.`,
    )
  }

  return {
    pieces,
    types: [...typeOf.values()],
    cavity,
    totalArea,
    wrapSummary: describeWrap(design.order, design.present),
    errors,
    warnings,
  }
}

function pairName(normal: Axis): string {
  return normal === 'x' ? 'Sides' : normal === 'y' ? 'Front / back' : 'Top / bottom'
}

function fmtRaw(n: number): string {
  return String(Math.round(n * 100) / 100)
}

// --- presets ----------------------------------------------------------------

export interface Preset {
  id: string
  label: string
  order: PanelId[]
  blurb: string
}

/**
 * Presets are the primary control; the order list underneath is the advanced
 * reveal. Almost nobody wants to think about a six-way ordering, but everybody
 * can point at the picture that looks like the box in their head.
 */
export const PRESETS: Preset[] = [
  {
    id: 'sides',
    label: 'Sides capture everything',
    order: ['left', 'right', 'top', 'bottom', 'back', 'front'],
    blurb: 'Bookcase / carcass. The side panels run the full height; the top and bottom fit between them.',
  },
  {
    id: 'topbottom',
    label: 'Top & bottom capture the sides',
    order: ['top', 'bottom', 'left', 'right', 'back', 'front'],
    blurb: 'Plinth or lid look. The top is a full width × depth slab and the sides fit under it.',
  },
  {
    id: 'overlayback',
    label: 'Overlay back',
    order: ['back', 'left', 'right', 'top', 'bottom', 'front'],
    blurb: 'A full-size back panel nailed or screwed onto the rear of the carcass.',
  },
  // The fourth preset is deliberately NOT the one the scope-out names.
  //
  // That document's fourth entry is "Everything inset (butt box)" with the order
  // `Back → Left, Right → Top, Bottom → Front, with the front inset` — which is
  // character-for-character the third entry, "Overlay back", so the two would be
  // the same box under two names. The name it wants is also unbuildable by
  // construction: "everything inset" is precisely the state with no outermost
  // panel, i.e. the t × t groove the wrap order exists to make unreachable.
  // Somebody has to be outermost.
  //
  // So the slot is spent on a construction that is genuinely different from the
  // other three and that people actually build: full-height sides with the back
  // applied over the top and bottom but let in between the sides.
  {
    id: 'appliedback',
    label: 'Sides + applied back',
    order: ['left', 'right', 'back', 'top', 'bottom', 'front'],
    blurb: 'Full-height sides, with the back covering the top and bottom but fitting between the sides.',
  },
]

export const DEFAULT_ORDER: PanelId[] = PRESETS[0].order

/** Which preset (if any) the current order matches exactly. */
export function matchPreset(order: readonly PanelId[]): Preset | undefined {
  return PRESETS.find((p) => p.order.every((id, i) => order[i] === id))
}

/**
 * "Extends to the edge" promotes a panel to priority 1; "sits inside" demotes
 * it to 6. Everything else shuffles up or down to keep a strict order — which
 * is the whole point: there is no way to reach an invalid state from the UI.
 */
export function promote(order: readonly PanelId[], panel: PanelId): PanelId[] {
  return [panel, ...order.filter((p) => p !== panel)]
}

export function demote(order: readonly PanelId[], panel: PanelId): PanelId[] {
  return [...order.filter((p) => p !== panel), panel]
}

/** Move a panel to an explicit 0-based index, keeping the order strict. */
export function moveTo(order: readonly PanelId[], panel: PanelId, index: number): PanelId[] {
  const rest = order.filter((p) => p !== panel)
  const at = Math.max(0, Math.min(rest.length, index))
  return [...rest.slice(0, at), panel, ...rest.slice(at)]
}

export function emptyDesign(): Design {
  return {
    name: 'My box',
    width: 600,
    depth: 400,
    height: 300,
    thickness: 18,
    present: { left: true, right: true, top: true, bottom: true, back: true, front: true },
    order: [...DEFAULT_ORDER],
    material: '18 mm birch ply',
    grained: true,
  }
}
