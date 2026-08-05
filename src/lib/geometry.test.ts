import { describe, expect, it } from 'vitest'
import {
  checkValidity,
  cornerPrism,
  edgePairs,
  intersectionVolume,
  solidFor,
  solids,
  span,
  type Box,
} from './geometry'
import {
  PANEL_IDS,
  computeCutlist,
  emptyDesign,
  type Design,
  type PanelId,
} from './panels'

// The box every case below uses: comfortably bigger than 2t on every axis, so
// the only thing that can make it invalid is the wrap order — which is the
// thing under test.
function box(order: PanelId[], present?: Partial<Record<PanelId, boolean>>): Design {
  return {
    ...emptyDesign(),
    width: 600,
    depth: 400,
    height: 300,
    thickness: 18,
    order,
    present: { ...emptyDesign().present, ...present },
  }
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const tail of permutations(rest)) out.push([items[i], ...tail])
  }
  return out
}

const ALL_ORDERS = permutations(PANEL_IDS) as PanelId[][]

describe('the wrap order is valid by construction', () => {
  it('enumerates all 720 orderings', () => {
    expect(ALL_ORDERS).toHaveLength(720)
    expect(new Set(ALL_ORDERS.map((o) => o.join(''))).size).toBe(720)
  })

  it('never overlaps two panels and never leaves an edge hollow — all 720', () => {
    const bad: string[] = []
    for (const order of ALL_ORDERS) {
      const { overlaps, gaps } = checkValidity(box(order))
      if (overlaps.length || gaps.length) {
        bad.push(`${order.join('>')}: ${overlaps.length} overlaps, ${gaps.length} gaps`)
      }
    }
    expect(bad).toEqual([])
  })

  it('stays valid for all 720 orderings × all 64 present/omitted combinations', () => {
    const bad: string[] = []
    for (const order of ALL_ORDERS) {
      for (let mask = 0; mask < 64; mask++) {
        const present = {} as Record<PanelId, boolean>
        PANEL_IDS.forEach((p, i) => { present[p] = Boolean(mask & (1 << i)) })
        const { overlaps, gaps } = checkValidity(box(order, present))
        if (overlaps.length || gaps.length) bad.push(`${order.join('>')} mask ${mask}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('agrees with the cut list — the solid is the piece', () => {
    // The diagram is drawn from solids and the list is printed from pieces. If
    // those ever disagree the drawing stops being a check on the numbers, which
    // is the whole reason the drawing exists.
    for (const order of ALL_ORDERS.slice(0, 60)) {
      const design = box(order)
      const { pieces } = computeCutlist(design)
      for (const piece of pieces) {
        const s = solidFor(design, piece.panel)
        const sides = [span(s.x), span(s.y), span(s.z)]
          .filter((v) => Math.abs(v - design.thickness) > 1e-9)
          .sort((a, b) => b - a)
        expect(sides).toEqual([piece.length, piece.width])
      }
    }
  })
})

describe('the detector can actually fail — the naive six-boolean model', () => {
  // §14's argument, made executable. If these did not fail, the exhaustive pass
  // above would be proving nothing: a validator that has never rejected a
  // known-bad input has only been run, not tested.
  const W = 600, D = 400, H = 300, t = 18
  const prism: Box = { x: { min: 0, max: t }, y: { min: 0, max: D }, z: { min: H - t, max: H } }

  const topExtends: Box = { x: { min: 0, max: W }, y: { min: 0, max: D }, z: { min: H - t, max: H } }
  const topInside: Box = { x: { min: t, max: W - t }, y: { min: 0, max: D }, z: { min: H - t, max: H } }
  const leftExtends: Box = { x: { min: 0, max: t }, y: { min: 0, max: D }, z: { min: 0, max: H } }
  const leftInside: Box = { x: { min: 0, max: t }, y: { min: 0, max: D }, z: { min: 0, max: H - t } }

  it('both extending puts two pieces of wood in the same place', () => {
    expect(intersectionVolume(topExtends, leftExtends)).toBe(t * D * t)
  })

  it('both sitting inside leaves a t × t groove the full depth of the box', () => {
    const filled = intersectionVolume(prism, topInside) + intersectionVolume(prism, leftInside)
    expect(span(prism.x) * span(prism.y) * span(prism.z) - filled).toBe(t * D * t)
  })

  it('exactly one of them wins under a wrap order, and the corner is filled once', () => {
    for (const [winner, loser] of [[topExtends, leftInside], [leftExtends, topInside]] as const) {
      expect(intersectionVolume(winner, loser)).toBe(0)
      expect(intersectionVolume(prism, winner) + intersectionVolume(prism, loser))
        .toBe(span(prism.x) * span(prism.y) * span(prism.z))
    }
  })

  it('counts boxes that merely touch as not overlapping', () => {
    const a: Box = { x: { min: 0, max: 10 }, y: { min: 0, max: 10 }, z: { min: 0, max: 10 } }
    const b: Box = { x: { min: 10, max: 20 }, y: { min: 0, max: 10 }, z: { min: 0, max: 10 } }
    expect(intersectionVolume(a, b)).toBe(0)
  })
})

describe('the twelve edges', () => {
  it('is exactly twelve, and never pairs opposite panels', () => {
    const pairs = edgePairs()
    expect(pairs).toHaveLength(12)
    for (const [a, b] of pairs) {
      expect(new Set([a, b]).size).toBe(2)
      // Opposite panels share no edge, so their relative wrap order is a no-op.
      expect([a, b].sort().join('-')).not.toMatch(/^(back-front|bottom-top|left-right)$/)
    }
  })

  it('gives each edge prism a t × t cross-section', () => {
    const design = box(['left', 'right', 'top', 'bottom', 'back', 'front'])
    for (const [a, b] of edgePairs()) {
      const p = cornerPrism(design, a, b)
      const sides = [span(p.x), span(p.y), span(p.z)].sort((x, y) => x - y)
      expect(sides.slice(0, 2)).toEqual([design.thickness, design.thickness])
    }
  })
})

describe('the two cross-sections', () => {
  const design = box(['left', 'right', 'top', 'bottom', 'back', 'front'])

  it('draws walls of real thickness, so the laps are visible', () => {
    for (const s of solids(design)) {
      const thin = [span(s.x), span(s.y), span(s.z)].filter((v) => Math.abs(v - 18) < 1e-9)
      expect(thin.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('omits a panel from the drawing when it is omitted from the box', () => {
    const openTop = box(['left', 'right', 'top', 'bottom', 'back', 'front'], { top: false })
    expect(solids(openTop).map((s) => s.panel)).not.toContain('top')
    expect(solids(openTop)).toHaveLength(5)
  })

  it('puts a panel flush with the outer face on its own axis whatever its priority', () => {
    for (const order of [
      ['left', 'right', 'top', 'bottom', 'back', 'front'],
      ['front', 'back', 'bottom', 'top', 'right', 'left'],
    ] as PanelId[][]) {
      const s = solidFor(box(order), 'top')
      expect(s.z).toEqual({ min: 300 - 18, max: 300 })
    }
  })
})
