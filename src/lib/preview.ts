// ---------------------------------------------------------------------------
// The landing-page template thumbnail.
//
// The temptation on a landing page is a hand-drawn icon per template — a little
// box glyph, a little shelf glyph. That would be a second, decorative model of
// the box sitting next to panels.ts, free to drift from it, and it would be the
// first thing a visitor sees. So the thumbnail is the REAL drawing: the same
// plan and elevation cross-sections the calculator prints, from the same
// solids, at a common scale.
//
// TWO sections rather than one, because one cannot tell the templates apart.
// An elevation cut is taken through the box front-to-back, so it contains no
// front or back panel at all — a shelf unit and a closed box have identical
// elevations. The plan cut has the mirrored blind spot for the top and bottom.
// Together they show every omitted face, which is exactly what distinguishes
// one template from the next. Plan above, elevation below, sharing the width
// axis, which is how the pair is drawn on paper anyway.
//
// The fly-in offsets are here rather than in the component for the usual
// reason: they are geometry, and geometry is checked by a test rather than by
// looking at a screenshot. Each panel enters along its OWN normal axis from
// outside the box — the left side from the left, the top from above — so the
// animation is the assembly, not a flourish. The order is the WRAP ORDER,
// outermost first, so what you watch is the one idea the app is about: the
// sides arrive at full height, then the top drops in BETWEEN them.
// ---------------------------------------------------------------------------

import { sectionLayout, type Rect, type SectionId } from './diagram'
import { PANEL_AXIS, PANEL_END, priorities, type Design, type PanelId } from './panels'

export interface PreviewRect extends Rect {
  section: SectionId
  /** Stable key — a panel appears in both sections. */
  id: string
  /** Where the piece flies in from, in mm, along its own normal axis. */
  dx: number
  dy: number
  /** Position in the wrap order, outermost first. Drives the stagger. */
  step: number
}

/** The outer envelope of one half, so the drawing can show it as a dashed rule. */
export interface PreviewSection {
  id: SectionId
  y: number
  width: number
  height: number
}

export interface Preview {
  rects: PreviewRect[]
  sections: PreviewSection[]
  width: number
  height: number
  /** Vertical offset applied to the elevation half. */
  splitY: number
}

/** How far outside the box a piece starts, mm. */
export function travelFor(design: Design): number {
  return Math.max(design.width, design.depth, design.height) * 0.5
}

/**
 * Where a piece flies in from, in any of these drawings.
 *
 * Exported so the hero animation shares it rather than restating it. Both
 * sections put x on the horizontal running the same way the box does, and both
 * FLIP the vertical (sectionLayout puts the front at the bottom in plan and the
 * top of the box at the top in elevation) — so a min-end panel enters from
 * below. Restating that flip in a second place is how one drawing ends up with
 * the top flying up out of the box.
 */
export function entryOffset(panel: PanelId, travel: number): { dx: number; dy: number } {
  if (PANEL_AXIS[panel] === 'x') {
    return { dx: PANEL_END[panel] === 'min' ? -travel : travel, dy: 0 }
  }
  return { dx: 0, dy: PANEL_END[panel] === 'min' ? travel : -travel }
}

export function previewLayout(design: Design): Preview {
  const plan = sectionLayout(design, 'plan')
  const elevation = sectionLayout(design, 'elevation')
  const gap = Math.max(design.width, design.depth + design.height) * 0.1
  const travel = travelFor(design)
  const prio = priorities(design.order)

  const take = (section: SectionId, rects: Rect[], shiftY: number): PreviewRect[] =>
    rects.map((r) => ({
      ...r,
      y: r.y + shiftY,
      section,
      id: `${section}-${r.panel}`,
      step: prio[r.panel] - 1,
      ...entryOffset(r.panel, travel),
    }))

  const splitY = plan.height + gap

  return {
    rects: [
      ...take('plan', plan.rects, 0),
      ...take('elevation', elevation.rects, splitY),
    ],
    // The envelope is drawn even where a panel is missing, which is the point:
    // an open top reads as a dashed line with nothing on it, not as a box that
    // happens to be shorter.
    sections: [
      { id: 'plan', y: 0, width: plan.width, height: plan.height },
      { id: 'elevation', y: splitY, width: elevation.width, height: elevation.height },
    ],
    width: design.width,
    height: splitY + elevation.height,
    splitY,
  }
}
