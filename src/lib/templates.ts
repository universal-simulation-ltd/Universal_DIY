// ---------------------------------------------------------------------------
// Templates — the first question the app asks.
//
// Universal DIY used to open on an empty form. That form is honest but it is
// the wrong first question: somebody arrives knowing "I want a shelf unit", not
// "I want the back panel ranked first in a strict order over six panels". The
// landing page asks the question they can answer, and a template turns it into
// the one the calculator needs.
//
// A template is NOTHING BUT A STARTING `Design`. It is not a mode, it is not a
// stored kind, and nothing downstream branches on which one was picked — the
// moment it is applied it is an ordinary design and every control still moves.
// That matters: a template that locked anything would be a second model of the
// box sitting alongside panels.ts, and the whole point of the wrap order is
// that there is exactly one.
//
// So the only real decisions here are which panels are PRESENT and what the
// WRAP ORDER is. Both are already expressible, both are already validated, and
// the exhaustive tests in panels.test.ts already cover every value they can
// take. templates.test.ts only has to check that each starting point is one a
// person would actually recognise, and that the words on the card are derived
// from the design rather than typed next to it — see `openFaces`.
//
// The sizes are realistic defaults, not constraints. They are also deliberately
// drawable: the landing card renders each template's real plan and elevation to
// a common scale, so a 1800 mm bookcase would come out as a sliver next to a
// 200 mm tray. A 900 mm two-shelf unit is both a thing people build and a thing
// that fits on a card, and picking it costs nothing because every dimension is
// a text field on the next screen.
// ---------------------------------------------------------------------------

import {
  PANEL_IDS,
  PANEL_NAMES,
  PRESETS,
  emptyDesign,
  type Design,
  type PanelId,
} from './panels'

export interface Template {
  id: string
  /** What the thing is called in a workshop, not in the model. */
  label: string
  /** One line under the title: the shape, in the fewest words that identify it. */
  tagline: string
  /** Why this template's wrap order is the one this shape wants. */
  blurb: string
  design: Design
}

function order(presetId: string): PanelId[] {
  const preset = PRESETS.find((p) => p.id === presetId)
  if (!preset) throw new Error(`unknown preset ${presetId}`)
  return [...preset.order]
}

const ALL: Record<PanelId, boolean> = {
  left: true, right: true, top: true, bottom: true, back: true, front: true,
}

/**
 * "Open top", "Open front and back", "Fully enclosed" — DERIVED from the design,
 * never typed alongside it.
 *
 * The card has to say which faces are missing, because an omitted panel is the
 * one thing about a template that changes the cut list without changing a
 * number. Writing that sentence by hand next to the `present` flags would work
 * exactly until somebody edits one and not the other, and the failure mode is a
 * card that promises a lid the cut list does not contain.
 */
export function openFaces(design: Design): string {
  const missing = PANEL_IDS.filter((p) => !design.present[p])
  if (missing.length === 0) return 'Fully enclosed'
  const words = missing.map((p) => PANEL_NAMES[p].replace(/ side$/, '').toLowerCase())
  const last = words.pop()!
  return `Open ${words.length ? `${words.join(', ')} and ${last}` : last}`
}

export const TEMPLATES: Template[] = [
  {
    id: 'box',
    label: 'Box',
    tagline: 'Six panels, closed on every face',
    blurb:
      'The plain case: a crate, a storage box, a sealed speaker cabinet. The sides run the full height and the top and bottom fit between them, so the end grain of the top never shows on the outside.',
    design: {
      name: 'Box',
      width: 600, depth: 400, height: 300, thickness: 18,
      present: { ...ALL },
      order: order('sides'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'shelf',
    label: 'Shelf unit',
    tagline: 'Open front, back panel over the whole carcass',
    blurb:
      'A bookcase or shelf carcass. The back is the outermost panel — a full width × height sheet nailed on over everything, which is what squares the carcass up. Universal DIY sizes the six outer panels; internal shelves are not part of the cut list.',
    design: {
      name: 'Shelf unit',
      width: 900, depth: 300, height: 900, thickness: 18,
      present: { ...ALL, front: false },
      order: order('overlayback'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'tray',
    label: 'Tray',
    tagline: 'No lid — open all the way along the top',
    blurb:
      'A tote, a drawer insert, a seed tray. With no top there is nothing for the sides to lose a thickness to at the upper end, so they keep their full height — which is exactly the deduction people get wrong by hand.',
    design: {
      name: 'Tray',
      width: 400, depth: 250, height: 200, thickness: 18,
      present: { ...ALL, top: false },
      order: order('sides'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'cabinet',
    label: 'Cabinet carcass',
    tagline: 'Open front and back, ready to be hung or faced',
    blurb:
      'The carcass you screw to a wall and then add a door or a face frame to. Nothing at the front or the back, so both the sides and the top and bottom keep their full depth.',
    design: {
      name: 'Cabinet carcass',
      width: 600, depth: 300, height: 700, thickness: 18,
      present: { ...ALL, front: false, back: false },
      order: order('sides'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'drawer',
    label: 'Drawer box',
    tagline: 'Open top, thinner stock',
    blurb:
      'A drawer body to run on side-mounted runners. Built in 12 mm because the depth of the box is set by the runner clearance and every extra millimetre of wall is a millimetre out of the drawer.',
    design: {
      name: 'Drawer box',
      width: 400, depth: 300, height: 120, thickness: 12,
      present: { ...ALL, top: false },
      order: order('sides'),
      material: '12 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'plinth',
    label: 'Plinth or lidded box',
    tagline: 'Top and bottom capture the sides',
    blurb:
      'The wrap order turned inside out: the top is a full width × depth slab and the sides tuck under it. That is the look of a plinth, a lidded box, or anything where the top surface has to be one unbroken face.',
    design: {
      name: 'Plinth',
      width: 600, depth: 400, height: 150, thickness: 18,
      present: { ...ALL },
      order: order('topbottom'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
]

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

/**
 * The escape hatch, and it is not a template.
 *
 * Six cards can only ever be six starting points, and the app is not a
 * catalogue — anything the wrap order can express is buildable here. This is
 * the same `emptyDesign()` the calculator has always opened on, offered as a
 * link rather than a card so nobody reads it as a seventh shape.
 */
export function blankDesign(): Design {
  return emptyDesign()
}
