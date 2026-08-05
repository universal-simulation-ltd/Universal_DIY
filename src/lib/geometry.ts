// ---------------------------------------------------------------------------
// The assembled box as six axis-aligned solids.
//
// This is the same arithmetic as panels.ts seen from the other side: instead of
// "how big do I cut it", it answers "where does it sit in the finished box".
// Two things depend on it, and it is worth having both leaning on one source:
//
//   * the plan and elevation CROSS-SECTIONS in the diagram, which are the only
//     drawing that can show which panel laps which; and
//   * the exhaustive validity tests, which walk all 720 wrap orders and assert
//     that no two solids ever intersect and no edge is ever left hollow.
//
// The second is the reason the model exists. A test that only re-ran the cut
// formula would be a restatement; building the solids from the same `start` and
// `length` the formula produces and then checking them against a physical
// invariant is a real check.
// ---------------------------------------------------------------------------

import {
  AXES,
  AXIS_PANELS,
  PANEL_AXIS,
  PANEL_END,
  PANEL_IDS,
  outerFor,
  priorities,
  spanAlong,
  type Axis,
  type Design,
  type PanelId,
} from './panels'

export interface Interval { min: number; max: number }
export interface Box {
  x: Interval
  y: Interval
  z: Interval
}
export interface Solid extends Box {
  panel: PanelId
}

/** Where a single panel's material sits in the finished box. mm. */
export function solidFor(design: Design, panel: PanelId, prio = priorities(design.order)): Solid {
  const outer = outerFor(design)
  const t = design.thickness
  const normal = PANEL_AXIS[panel]
  const iv = {} as Record<Axis, Interval>

  // Along its own normal axis a panel is ALWAYS flush with the outer face at
  // its end — priority never moves it, only ever shortens it sideways.
  iv[normal] = PANEL_END[panel] === 'min'
    ? { min: 0, max: t }
    : { min: outer[normal] - t, max: outer[normal] }

  for (const b of AXES) {
    if (b === normal) continue
    const { start, length } = spanAlong(design, panel, b, prio)
    iv[b] = { min: start, max: start + length }
  }

  return { panel, x: iv.x, y: iv.y, z: iv.z }
}

export function solids(design: Design): Solid[] {
  const prio = priorities(design.order)
  return PANEL_IDS.filter((p) => design.present[p]).map((p) => solidFor(design, p, prio))
}

const EPS = 1e-9

function overlapLen(a: Interval, b: Interval): number {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min)
}

/** Volume shared by two boxes, mm³. Zero for boxes that merely touch. */
export function intersectionVolume(a: Box, b: Box): number {
  const dx = overlapLen(a.x, b.x)
  const dy = overlapLen(a.y, b.y)
  const dz = overlapLen(a.z, b.z)
  if (dx <= EPS || dy <= EPS || dz <= EPS) return 0
  return dx * dy * dz
}

/**
 * The twelve edges of the box, as pairs of panels normal to different axes.
 * Opposite panels (left/right, front/back, top/bottom) never share an edge, so
 * their relative wrap order has no effect on any dimension — the UI must not
 * pretend otherwise.
 */
export function edgePairs(): Array<[PanelId, PanelId]> {
  const pairs: Array<[PanelId, PanelId]> = []
  for (let i = 0; i < AXES.length; i++) {
    for (let j = i + 1; j < AXES.length; j++) {
      for (const endA of ['min', 'max'] as const) {
        for (const endB of ['min', 'max'] as const) {
          pairs.push([AXIS_PANELS[AXES[i]][endA], AXIS_PANELS[AXES[j]][endB]])
        }
      }
    }
  }
  return pairs
}

/**
 * The t × t prism running along an edge — the block the naive per-panel boolean
 * either double-books or leaves empty. Exactly one of the two adjoining panels
 * must fill it.
 */
export function cornerPrism(design: Design, a: PanelId, b: PanelId): Box {
  const outer = outerFor(design)
  const t = design.thickness
  const iv = {} as Record<Axis, Interval>
  for (const panel of [a, b]) {
    const axis = PANEL_AXIS[panel]
    iv[axis] = PANEL_END[panel] === 'min' ? { min: 0, max: t } : { min: outer[axis] - t, max: outer[axis] }
  }
  const free = AXES.find((ax) => !iv[ax])!
  // Along the third axis the prism runs the whole outer span — deliberately,
  // so a groove anywhere along the edge shows up, not just at its middle.
  iv[free] = { min: 0, max: outer[free] }
  return { x: iv.x, y: iv.y, z: iv.z }
}

export interface ValidityReport {
  overlaps: Array<{ a: PanelId; b: PanelId; volume: number }>
  gaps: Array<{ a: PanelId; b: PanelId; volume: number }>
}

/**
 * Check the assembled box against the two physical invariants.
 *
 * `overlaps` — two panels claiming the same wood. `gaps` — an edge where both
 * adjoining panels are present but neither fills the corner (the "t × t groove
 * running the full depth" failure). Under the wrap order both lists are always
 * empty; the tests prove that exhaustively, and also feed this function
 * deliberately-broken input so it is known to be capable of failing.
 */
export function checkValidity(design: Design): ValidityReport {
  const present = solids(design)
  const overlaps: ValidityReport['overlaps'] = []
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const v = intersectionVolume(present[i], present[j])
      if (v > EPS) overlaps.push({ a: present[i].panel, b: present[j].panel, volume: v })
    }
  }

  const gaps: ValidityReport['gaps'] = []
  for (const [a, b] of edgePairs()) {
    if (!design.present[a] || !design.present[b]) continue
    const prism = cornerPrism(design, a, b)
    const prismVol = span(prism.x) * span(prism.y) * span(prism.z)
    // Sum over EVERY panel, not just the two that name the edge. With an
    // asymmetric wrap (an overlay back, say) the far end of an edge prism is
    // legitimately filled by a third panel; checking only the two would report
    // a gap that isn't there.
    const filled = present.reduce((sum, s) => sum + intersectionVolume(prism, s), 0)
    if (prismVol - filled > EPS) gaps.push({ a, b, volume: prismVol - filled })
  }

  return { overlaps, gaps }
}

export function span(iv: Interval): number {
  return iv.max - iv.min
}

/**
 * Solids crossing a horizontal cut — the plan section. Everything normal to x
 * or y, drawn with real t-thick walls so the laps are visible as overlapping
 * rectangles.
 */
export function planSection(design: Design): Solid[] {
  return solids(design).filter((s) => PANEL_AXIS[s.panel] !== 'z')
}

/** Solids crossing a vertical cut through the box — the elevation section. */
export function elevationSection(design: Design): Solid[] {
  return solids(design).filter((s) => PANEL_AXIS[s.panel] !== 'y')
}
