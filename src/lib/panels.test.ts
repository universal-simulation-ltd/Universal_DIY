import { describe, expect, it } from 'vitest'
import {
  PANEL_IDS,
  PRESETS,
  computeCutlist,
  demote,
  emptyDesign,
  isValidOrder,
  matchPreset,
  moveTo,
  promote,
  type Design,
  type PanelId,
} from './panels'

// Both worked examples use the same box: 600 × 400 × 300 outer, 18 mm stock,
// all six panels present. Only the wrap order changes.
function box(order: PanelId[], overrides: Partial<Design> = {}): Design {
  return {
    ...emptyDesign(),
    width: 600,
    depth: 400,
    height: 300,
    thickness: 18,
    order,
    ...overrides,
  }
}

/** Cut size of one panel as an ordered [length, width] pair. */
function size(design: Design, panel: PanelId): [number, number] {
  const piece = computeCutlist(design).pieces.find((p) => p.panel === panel)
  if (!piece) throw new Error(`no piece for ${panel}`)
  return [piece.length, piece.width]
}

describe('worked example A — sides capture everything', () => {
  // 1 Left · 2 Right · 3 Top · 4 Bottom · 5 Back · 6 Front
  const design = box(['left', 'right', 'top', 'bottom', 'back', 'front'])

  it('is the default preset', () => {
    expect(matchPreset(design.order)?.id).toBe('sides')
  })

  it('cuts every panel to the size in the spec table', () => {
    expect(size(design, 'left')).toEqual([400, 300])
    expect(size(design, 'right')).toEqual([400, 300])
    expect(size(design, 'top')).toEqual([564, 400])
    expect(size(design, 'bottom')).toEqual([564, 400])
    expect(size(design, 'back')).toEqual([564, 264])
    expect(size(design, 'front')).toEqual([564, 264])
  })

  it('gives an interior cavity of 564 × 364 × 264', () => {
    const { cavity } = computeCutlist(design)
    expect(cavity).toEqual({ x: 564, y: 364, z: 264 })
  })

  it("the rear opening equals the Back's cut size — the spec's hand check", () => {
    const { cavity } = computeCutlist(design)
    expect(size(design, 'back')).toEqual([cavity.x, cavity.z])
  })

  it('totals 988,992 mm² ≈ 0.99 m²', () => {
    const { totalArea } = computeCutlist(design)
    expect(totalArea).toBe(2 * (400 * 300) + 2 * (564 * 400) + 2 * (564 * 264))
    expect(totalArea).toBe(988_992)
    expect(totalArea / 1_000_000).toBeCloseTo(0.99, 2)
  })

  it('groups into three piece types: A sides, B top/bottom, C back/front', () => {
    const { types } = computeCutlist(design)
    expect(types.map((t) => [t.letter, t.qty, t.length, t.width])).toEqual([
      ['A', 2, 400, 300],
      ['B', 2, 564, 400],
      ['C', 2, 564, 264],
    ])
  })

  it('labels each physical piece letter + index', () => {
    const { pieces } = computeCutlist(design)
    expect(pieces.map((p) => p.label)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  })
})

describe('worked example B — the Back flipped to "extends to the edge"', () => {
  // Toggling the Back promotes it to priority 1:
  // 1 Back · 2 Left · 3 Right · 4 Top · 5 Bottom · 6 Front
  const design = box(promote(['left', 'right', 'top', 'bottom', 'back', 'front'], 'back'))

  it('promotes Back to priority 1 and shuffles the rest down', () => {
    expect(design.order).toEqual(['back', 'left', 'right', 'top', 'bottom', 'front'])
  })

  it('cuts every panel to the size in the spec table', () => {
    // The case the brief calls out: Left meets an outer panel on ONE side only,
    // so it loses one t, not two.
    expect(size(design, 'back')).toEqual([600, 300]) // full overlay
    expect(size(design, 'left')).toEqual([382, 300])
    expect(size(design, 'right')).toEqual([382, 300])
    expect(size(design, 'top')).toEqual([564, 382])
    expect(size(design, 'bottom')).toEqual([564, 382])
    expect(size(design, 'front')).toEqual([564, 264])
  })

  it('leaves the interior cavity unchanged — wrap order never moves it', () => {
    // A panel is always flush with the outer face on its OWN axis; priority
    // only ever changes how long it is along the other two.
    expect(computeCutlist(design).cavity).toEqual({ x: 564, y: 364, z: 264 })
  })

  it('needs four piece types once the Back is asymmetric', () => {
    const { types } = computeCutlist(design)
    expect(types.map((t) => [t.letter, t.qty, t.length, t.width])).toEqual([
      ['A', 2, 382, 300], // sides
      ['B', 2, 564, 382], // top / bottom
      ['C', 1, 600, 300], // back
      ['D', 1, 564, 264], // front
    ])
  })
})

describe('the formula', () => {
  it('subtracts one t per neighbour that wraps outside, and no more', () => {
    // Front at priority 6 is inset on both axes: −2t on each.
    const d = box(['left', 'right', 'top', 'bottom', 'back', 'front'])
    expect(size(d, 'front')).toEqual([600 - 36, 300 - 36])
    // Front at priority 1 wraps everything: full outer on both axes.
    const e = box(promote(d.order, 'front'))
    expect(size(e, 'front')).toEqual([600, 300])
  })

  it('never rounds the thickness — a 3/4 in board deducts 38.1 mm, not 38', () => {
    const d = box(['left', 'right', 'top', 'bottom', 'back', 'front'], { thickness: 19.05 })
    const [len, wid] = size(d, 'front')
    expect(len).toBeCloseTo(600 - 2 * 19.05, 10)
    expect(len).toBeCloseTo(561.9, 10)
    expect(wid).toBeCloseTo(300 - 2 * 19.05, 10)
  })

  it('states the longer cut dimension first', () => {
    const { pieces } = computeCutlist(box(['left', 'right', 'top', 'bottom', 'back', 'front']))
    for (const p of pieces) expect(p.length).toBeGreaterThanOrEqual(p.width)
  })

  it('gives opposite panels identical sizes whatever their relative order', () => {
    // Left and Right never share an edge, so swapping them cannot change a
    // single dimension. The UI must not pretend otherwise.
    const a = box(['left', 'right', 'top', 'bottom', 'back', 'front'])
    const b = box(['right', 'left', 'top', 'bottom', 'back', 'front'])
    expect(computeCutlist(a).pieces.map((p) => [p.panel, p.length, p.width]))
      .toEqual(computeCutlist(b).pieces.map((p) => [p.panel, p.length, p.width]))
  })
})

describe('omitted panels — the single most likely arithmetic bug', () => {
  it("an open-top tray's sides keep their full height", () => {
    const tray = box(['left', 'right', 'top', 'bottom', 'back', 'front'], {
      present: { left: true, right: true, top: false, bottom: true, back: true, front: true },
    })
    // Sides were 400 × 300 with a top fitted; without one they are unchanged
    // (they were already outermost) — but the FRONT gains back the 18 mm it
    // would have lost to a top that isn't there.
    expect(size(tray, 'left')).toEqual([400, 300])
    expect(size(tray, 'front')).toEqual([564, 300 - 18])
    expect(size(tray, 'back')).toEqual([564, 300 - 18])
  })

  it('an omitted OUTER panel deducts nothing from its neighbours', () => {
    const noLeft = box(['left', 'right', 'top', 'bottom', 'back', 'front'], {
      present: { left: false, right: true, top: true, bottom: true, back: true, front: true },
    })
    // Left was priority 1 and cost the Top 18 mm. Remove it and the Top gets
    // that 18 mm back at that end only — 582, not 564 and not 600.
    expect(size(noLeft, 'top')).toEqual([582, 400])
  })

  it('opens the cavity out when a panel is omitted', () => {
    const openTop = box(['left', 'right', 'top', 'bottom', 'back', 'front'], {
      present: { left: true, right: true, top: false, bottom: true, back: true, front: true },
    })
    expect(computeCutlist(openTop).cavity).toEqual({ x: 564, y: 364, z: 282 })
  })

  it('reports which panels were omitted', () => {
    const openTop = box(['left', 'right', 'top', 'bottom', 'back', 'front'], {
      present: { left: true, right: true, top: false, bottom: true, back: true, front: true },
    })
    expect(computeCutlist(openTop).warnings.join(' ')).toContain('Top')
  })

  it('handles a single lone panel', () => {
    const lone = box(['left', 'right', 'top', 'bottom', 'back', 'front'], {
      present: { left: false, right: false, top: false, bottom: true, back: false, front: false },
    })
    expect(size(lone, 'bottom')).toEqual([600, 400])
  })
})

describe('the wrap order cannot be put into an invalid state', () => {
  const start: PanelId[] = ['left', 'right', 'top', 'bottom', 'back', 'front']

  it('accepts only a strict order over exactly the six panels', () => {
    expect(isValidOrder(start)).toBe(true)
    expect(isValidOrder(['left', 'left', 'top', 'bottom', 'back', 'front'])).toBe(false)
    expect(isValidOrder(['left', 'right', 'top', 'bottom', 'back'])).toBe(false)
    expect(isValidOrder([...start, 'front'])).toBe(false)
  })

  it('keeps a strict order through every promote / demote / move', () => {
    let order = start
    for (const panel of PANEL_IDS) {
      order = promote(order, panel)
      expect(isValidOrder(order)).toBe(true)
      order = demote(order, panel)
      expect(isValidOrder(order)).toBe(true)
      for (let i = -3; i < 9; i++) {
        order = moveTo(order, panel, i)
        expect(isValidOrder(order)).toBe(true)
      }
    }
  })

  it('"extends to the edge" is priority 1 and "sits inside" is priority 6', () => {
    expect(promote(start, 'front')[0]).toBe('front')
    expect(demote(start, 'left')[5]).toBe('left')
  })

  it('refuses to compute from a broken order rather than emitting a size', () => {
    const broken = box(['left', 'left', 'top', 'bottom', 'back', 'front'])
    const result = computeCutlist(broken)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.pieces).toEqual([])
  })

  it('every preset is a valid strict order', () => {
    for (const preset of PRESETS) expect(isValidOrder(preset.order)).toBe(true)
  })

  it('the four presets are four DIFFERENT boxes', () => {
    const signatures = PRESETS.map((p) => JSON.stringify(
      computeCutlist(box(p.order)).pieces.map((piece) => [piece.panel, piece.length, piece.width]),
    ))
    expect(new Set(signatures).size).toBe(PRESETS.length)
  })
})

describe('inputs that must not produce a cut list', () => {
  const order: PanelId[] = ['left', 'right', 'top', 'bottom', 'back', 'front']

  it('rejects a non-positive outer dimension', () => {
    for (const bad of [{ width: 0 }, { depth: -5 }, { height: Number.NaN }]) {
      expect(computeCutlist(box(order, bad)).errors.length).toBeGreaterThan(0)
    }
  })

  it('rejects a non-positive thickness', () => {
    expect(computeCutlist(box(order, { thickness: 0 })).errors.length).toBeGreaterThan(0)
  })

  it('rejects material too thick for the box instead of emitting a negative cut', () => {
    // 2 × 40 mm off a 60 mm height leaves the front at −20 mm.
    const silly = box(order, { width: 600, depth: 400, height: 60, thickness: 40 })
    const result = computeCutlist(silly)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.pieces).toEqual([])
  })

  it('rejects a box with no panels at all', () => {
    const none = box(order, {
      present: { left: false, right: false, top: false, bottom: false, back: false, front: false },
    })
    expect(computeCutlist(none).errors.length).toBeGreaterThan(0)
  })
})

describe('the plain-English wrap summary', () => {
  it('says which panel laps which', () => {
    const summary = computeCutlist(box(['left', 'right', 'top', 'bottom', 'back', 'front'])).wrapSummary
    expect(summary).toContain('left side runs the full depth and height')
    expect(summary).toContain('top')
    expect(summary.length).toBeGreaterThan(40)
  })

  it('names omitted panels', () => {
    const summary = computeCutlist(box(['left', 'right', 'top', 'bottom', 'back', 'front'], {
      present: { left: true, right: true, top: false, bottom: true, back: true, front: true },
    })).wrapSummary
    expect(summary).toContain('no top')
  })
})
