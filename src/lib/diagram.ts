// ---------------------------------------------------------------------------
// Diagram geometry — everything in MILLIMETRES, in the drawing's own plane.
//
// The diagram's job is not to look nice. It is the only way a user catches a
// wrong number before cutting, and it earns that trust in exactly one way:
// EVERYTHING IS DRAWN TO A COMMON SCALE. A schematic not-to-scale drawing would
// be worse than none, because a top that overhangs the sides has to *look*
// wrong without anybody reading a digit.
//
// Two drawings, doing different jobs:
//
//   * the NET shows each piece flat, as it will be cut — the same shape the cut
//     list describes; and
//   * the two SECTIONS show which panel laps which, which a net physically
//     cannot. That is the whole subject of the wrap order, so the sections are
//     the trust-critical drawing.
//
// No layout numbers live in the components. They live here, where they can be
// checked by a test rather than by looking at a screenshot.
// ---------------------------------------------------------------------------

import { elevationSection, planSection, solidFor, span } from './geometry'
import {
  PANEL_NAMES,
  type Axis,
  type Design,
  type PanelId,
} from './panels'

export interface Rect {
  panel: PanelId
  part: string
  x: number
  y: number
  w: number
  h: number
  /** True when the piece's LENGTH runs horizontally in this drawing. */
  grainHorizontal: boolean
}

export interface Net {
  rects: Rect[]
  width: number
  height: number
}

/** How far a panel's material runs along one axis, mm. */
export function extent(design: Design, panel: PanelId, axis: Axis): number {
  return span(solidFor(design, panel)[axis])
}

/**
 * The unfolded net: Back in the centre, Left / Right / Top / Bottom folded out
 * around it, Front to one side.
 *
 * Each piece is drawn at its true size and CENTRED in its cell, rather than
 * stretched to fill one. That is deliberate — the whole point of a scale net is
 * that a top which is meant to fit between the sides shows a visible step at
 * each end, and a top which wrongly runs the full width does not.
 */
export function netLayout(design: Design): Net {
  const ext = (p: PanelId, a: Axis) => (design.present[p] ? extent(design, p, a) : 0)
  const gap = Math.max(design.width, design.depth, design.height) * 0.05

  const colL = ext('left', 'y')
  const colC = Math.max(ext('back', 'x'), ext('top', 'x'), ext('bottom', 'x'), design.width * 0.2)
  const colR = ext('right', 'y')
  const colF = ext('front', 'x')

  const rowT = ext('top', 'y')
  const rowC = Math.max(ext('back', 'z'), ext('left', 'z'), ext('right', 'z'), design.height * 0.2)
  const rowB = ext('bottom', 'y')

  const xL = 0
  const xC = xL + (colL ? colL + gap : 0)
  const xR = xC + colC + (colR ? gap : 0)
  // The Front sits apart from the cross, with a wider gutter — it is not folded
  // out of the net, it is the lid you lift off.
  const xF = xR + colR + (colF ? gap * 2 : 0)

  const yT = 0
  const yC = yT + (rowT ? rowT + gap : 0)
  const yB = yC + rowC + (rowB ? gap : 0)

  const cells: Array<{ panel: PanelId; cx: number; cy: number; cw: number; ch: number; w: number; h: number }> = [
    { panel: 'left', cx: xL, cy: yC, cw: colL, ch: rowC, w: ext('left', 'y'), h: ext('left', 'z') },
    { panel: 'back', cx: xC, cy: yC, cw: colC, ch: rowC, w: ext('back', 'x'), h: ext('back', 'z') },
    { panel: 'right', cx: xR, cy: yC, cw: colR, ch: rowC, w: ext('right', 'y'), h: ext('right', 'z') },
    { panel: 'front', cx: xF, cy: yC, cw: colF, ch: rowC, w: ext('front', 'x'), h: ext('front', 'z') },
    { panel: 'top', cx: xC, cy: yT, cw: colC, ch: rowT, w: ext('top', 'x'), h: ext('top', 'y') },
    { panel: 'bottom', cx: xC, cy: yB, cw: colC, ch: rowB, w: ext('bottom', 'x'), h: ext('bottom', 'y') },
  ]

  const rects: Rect[] = cells
    .filter((c) => design.present[c.panel] && c.w > 0 && c.h > 0)
    .map((c) => ({
      panel: c.panel,
      part: PANEL_NAMES[c.panel],
      x: c.cx + (c.cw - c.w) / 2,
      y: c.cy + (c.ch - c.h) / 2,
      w: c.w,
      h: c.h,
      // The grain runs along the piece's LENGTH, and the length is the longer
      // side — so in the drawing it runs along whichever side is drawn longer.
      grainHorizontal: c.w >= c.h,
    }))

  return {
    rects,
    width: xF + colF || xR + colR,
    height: yB + rowB,
  }
}

export type SectionId = 'plan' | 'elevation'

export interface Section {
  id: SectionId
  title: string
  caption: string
  rects: Rect[]
  width: number
  height: number
}

/**
 * A cut through the box, drawn with real t-thick walls so the laps show up as
 * overlapping rectangles: "ah — the top does sit between the sides."
 *
 * The vertical axis is flipped in both drawings so the picture matches the
 * object: in plan the front is at the bottom (you are looking down at it), and
 * in elevation the top of the box is at the top of the page.
 */
export function sectionLayout(design: Design, id: SectionId): Section {
  const horizontal: Axis = 'x'
  const vertical: Axis = id === 'plan' ? 'y' : 'z'
  const height = id === 'plan' ? design.depth : design.height

  const rects: Rect[] = (id === 'plan' ? planSection(design) : elevationSection(design))
    .map((s) => {
      const h = span(s[vertical])
      return {
        panel: s.panel,
        part: PANEL_NAMES[s.panel],
        x: s[horizontal].min,
        // Flip: the drawing's origin is top-left, the box's is bottom-front.
        y: height - s[vertical].max,
        w: span(s[horizontal]),
        h,
        grainHorizontal: span(s[horizontal]) >= h,
      }
    })

  return {
    id,
    title: id === 'plan' ? 'Plan section' : 'Elevation section',
    caption: id === 'plan'
      ? 'Cut horizontally through the box, looking down. Front at the bottom.'
      : 'Cut vertically through the box, looking at the front. Top at the top.',
    rects,
    width: design.width,
    height,
  }
}
