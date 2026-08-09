import { describe, expect, it } from 'vitest'
import { DEFAULT_KERF, DEFAULT_TRIM, groupForNesting, nest, type NestPiece, type Placement, type SheetLayout } from './nest'
import { SHEETS } from './materials'
import { computeCutlist, emptyDesign } from './panels'

const SHEET = SHEETS[0] // 2440 × 1220
const SMALL = SHEETS.find((s) => s.id === '600x400')!

const OPTS = { sheet: SHEET, kerf: DEFAULT_KERF, trim: DEFAULT_TRIM }

function piece(over: Partial<NestPiece> = {}): NestPiece {
  return { label: 'A', length: 600, width: 400, qty: 1, grained: false, material: 'ply', thickness: 18, ...over }
}

// ---------------------------------------------------------------------------
// The verifier.
//
// Written from the DEFINITION of a guillotine layout rather than from the
// packer's own idea of one, so it is a real check and not a restatement: a
// layout is guillotine-cuttable if it can be reduced to single pieces by
// repeatedly splitting a region with a straight cut that runs edge to edge and
// passes through no piece. A cut also DESTROYS a kerf of wood, so the band it
// occupies must be empty — which is what makes this an honest kerf check too,
// and not just a spacing convention the packer agreed with itself.
// ---------------------------------------------------------------------------

interface Region { x: number; y: number; w: number; h: number }

const EPS = 1e-6

function isGuillotine(rects: readonly Placement[], region: Region, kerf: number): boolean {
  if (rects.length <= 1) return true

  const tryCuts = (
    lo: (r: Placement) => number,
    hi: (r: Placement) => number,
    split: (at: number) => [Region, Region],
  ): boolean => {
    // Every candidate cut sits at the far edge of some piece: a cut anywhere
    // else can be slid to one without changing which side anything lands on.
    const candidates = [...new Set(rects.map(hi))]
    for (const at of candidates) {
      const before = rects.filter((r) => hi(r) <= at + EPS)
      const after = rects.filter((r) => lo(r) >= at + kerf - EPS)
      if (before.length === 0 || after.length === 0) continue
      if (before.length + after.length !== rects.length) continue // the cut crosses a piece
      const [a, b] = split(at)
      if (isGuillotine(before, a, kerf) && isGuillotine(after, b, kerf)) return true
    }
    return false
  }

  const vertical = tryCuts(
    (r) => r.x,
    (r) => r.x + r.w,
    (at) => [
      { ...region, w: at - region.x },
      { ...region, x: at + kerf, w: region.x + region.w - at - kerf },
    ],
  )
  if (vertical) return true

  return tryCuts(
    (r) => r.y,
    (r) => r.y + r.h,
    (at) => [
      { ...region, h: at - region.y },
      { ...region, y: at + kerf, h: region.y + region.h - at - kerf },
    ],
  )
}

function overlaps(a: Placement, b: Placement): boolean {
  return a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS
}

function checkSheet(layout: SheetLayout, usable: { w: number; h: number }, kerf: number): void {
  for (const p of layout.placements) {
    expect(p.x).toBeGreaterThanOrEqual(-EPS)
    expect(p.y).toBeGreaterThanOrEqual(-EPS)
    expect(p.x + p.w).toBeLessThanOrEqual(usable.w + EPS)
    expect(p.y + p.h).toBeLessThanOrEqual(usable.h + EPS)
  }
  for (let i = 0; i < layout.placements.length; i += 1) {
    for (let j = i + 1; j < layout.placements.length; j += 1) {
      expect(overlaps(layout.placements[i], layout.placements[j])).toBe(false)
    }
  }
  expect(isGuillotine(layout.placements, { x: 0, y: 0, w: usable.w, h: usable.h }, kerf)).toBe(true)
}

// ---------------------------------------------------------------------------

describe('the verifier can fail', () => {
  // A test harness that cannot fail is measuring itself. This is the pinwheel —
  // four rectangles round a centre, the textbook layout that packs tightly and
  // that no table saw can cut, because every full-width line through it crosses
  // a piece. If the checker below ever calls this cuttable, every PASS above is
  // worthless.
  const pinwheel: Placement[] = [
    { label: 'a', x: 0, y: 0, w: 60, h: 40, rotated: false },
    { label: 'b', x: 60, y: 0, w: 40, h: 60, rotated: false },
    { label: 'c', x: 40, y: 60, w: 60, h: 40, rotated: false },
    { label: 'd', x: 0, y: 40, w: 40, h: 60, rotated: false },
  ]

  it('rejects a pinwheel', () => {
    expect(isGuillotine(pinwheel, { x: 0, y: 0, w: 100, h: 100 }, 0)).toBe(false)
  })

  it('accepts two strips of two', () => {
    const shelves: Placement[] = [
      { label: 'a', x: 0, y: 0, w: 40, h: 40, rotated: false },
      { label: 'b', x: 43, y: 0, w: 40, h: 40, rotated: false },
      { label: 'c', x: 0, y: 43, w: 40, h: 40, rotated: false },
      { label: 'd', x: 43, y: 43, w: 40, h: 40, rotated: false },
    ]
    expect(isGuillotine(shelves, { x: 0, y: 0, w: 100, h: 100 }, 3)).toBe(true)
  })

  it('rejects that same layout when the gaps are too narrow for the blade', () => {
    // Identical rectangles, 3 mm apart, checked against a 5 mm blade. Nothing
    // overlaps and it still cannot be cut: the second cut would eat the first
    // piece. This is the failure a packer that ignores kerf produces.
    const tight: Placement[] = [
      { label: 'a', x: 0, y: 0, w: 40, h: 40, rotated: false },
      { label: 'b', x: 43, y: 0, w: 40, h: 40, rotated: false },
      { label: 'c', x: 0, y: 43, w: 40, h: 40, rotated: false },
      { label: 'd', x: 43, y: 43, w: 40, h: 40, rotated: false },
    ]
    expect(isGuillotine(tight, { x: 0, y: 0, w: 100, h: 100 }, 5)).toBe(false)
  })
})

describe('every layout it emits can actually be cut', () => {
  const cases: Array<{ name: string; pieces: NestPiece[] }> = [
    {
      name: 'the default box',
      pieces: computeCutlist(emptyDesign()).types.map((t) => ({
        label: t.letter, length: t.length, width: t.width, qty: t.qty,
        grained: t.grain !== 'none', material: '18 mm birch ply', thickness: 18,
      })),
    },
    {
      name: 'many identical pieces',
      pieces: [piece({ label: 'A', length: 800, width: 300, qty: 14, grained: true })],
    },
    {
      name: 'a mix of long and short, no grain',
      pieces: [
        piece({ label: 'A', length: 2000, width: 500, qty: 2 }),
        piece({ label: 'B', length: 900, width: 210, qty: 5 }),
        piece({ label: 'C', length: 300, width: 300, qty: 9 }),
        piece({ label: 'D', length: 1200, width: 95, qty: 3 }),
      ],
    },
    {
      name: 'awkward slivers on a small sheet',
      pieces: [
        piece({ label: 'A', length: 587, width: 33, qty: 6, grained: true }),
        piece({ label: 'B', length: 120, width: 118, qty: 11 }),
      ],
    },
  ]

  for (const { name, pieces } of cases) {
    it(`${name} — no overlaps, inside the trimmed sheet, guillotine-cuttable`, () => {
      const sheet = name.includes('small sheet') ? SMALL : SHEET
      const result = nest(pieces, { ...OPTS, sheet })
      expect(result.sheets.length).toBeGreaterThan(0)
      expect(result.oversize).toEqual([])
      for (const layout of result.sheets) checkSheet(layout, result.usable, result.kerf)
    })
  }

  it('places every piece exactly once', () => {
    const pieces = [piece({ label: 'A', qty: 3 }), piece({ label: 'B', length: 900, width: 210, qty: 4 })]
    const result = nest(pieces, OPTS)
    const labels = result.sheets.flatMap((s) => s.placements.map((p) => p.label))
    expect(labels).toHaveLength(7)
    expect(new Set(labels).size).toBe(7)
    expect(labels.filter((l) => l.startsWith('A'))).toHaveLength(3)
  })
})

describe('kerf is wood, not a rounding allowance', () => {
  it('will not fit two pieces in a strip that only holds them if the blade is free', () => {
    // Usable width is 2430. Two 1215 mm pieces are exactly 2430 — they fit with
    // no blade at all, and cannot fit once 3 mm of the sheet becomes dust.
    const pieces = [piece({ label: 'A', length: 1215, width: 300, qty: 2, grained: true })]
    const withBlade = nest(pieces, OPTS)
    const withNone = nest(pieces, { ...OPTS, kerf: 0 })

    const sameStrip = (r: typeof withBlade) =>
      r.sheets[0].placements[0].y === r.sheets[0].placements[1].y
    expect(sameStrip(withNone)).toBe(true)
    expect(sameStrip(withBlade)).toBe(false)
    expect(withBlade.sheets[0].usedHeight).toBeGreaterThan(withNone.sheets[0].usedHeight)
  })

  it('says so when the kerf is zero rather than quietly obliging', () => {
    expect(nest([piece()], { ...OPTS, kerf: 0 }).warnings.join(' ')).toMatch(/removes no wood/i)
  })

  it('keeps a full kerf between neighbours in a strip', () => {
    const result = nest([piece({ label: 'A', length: 400, width: 200, qty: 4 })], OPTS)
    const [first] = result.sheets
    const strip = first.placements.filter((p) => p.y === first.placements[0].y).sort((a, b) => a.x - b.x)
    expect(strip.length).toBeGreaterThan(1)
    for (let i = 1; i < strip.length; i += 1) {
      expect(strip[i].x - (strip[i - 1].x + strip[i - 1].w)).toBeGreaterThanOrEqual(DEFAULT_KERF - EPS)
    }
  })
})

describe('the trim allowance comes off before anything is placed', () => {
  it('shrinks the usable sheet by the trim on both axes', () => {
    const result = nest([piece()], OPTS)
    expect(result.usable).toEqual({ w: 2440 - DEFAULT_TRIM, h: 1220 - DEFAULT_TRIM })
  })

  it('refuses a piece that only fits the untrimmed sheet', () => {
    // 1215 wide fits a nominal 1220 sheet and does not fit a trimmed one. This
    // is exactly the piece that gets cut and then does not fit.
    const tall = piece({ label: 'A', length: 2000, width: 1215, grained: true })
    expect(nest([tall], { ...OPTS, trim: 0 }).oversize).toEqual([])
    expect(nest([tall], OPTS).oversize).toEqual(['A'])
  })

  it('says there is nothing to cut from rather than dividing by a negative sheet', () => {
    const result = nest([piece()], { ...OPTS, sheet: SMALL, trim: 500 })
    expect(result.sheets).toEqual([])
    expect(result.warnings.join(' ')).toMatch(/larger than the sheet/i)
  })
})

describe('grain lock', () => {
  const across = { label: 'A', length: 350, width: 500, qty: 1, material: 'ply', thickness: 18 }

  it('costs a piece its rotation, and that changes what fits', () => {
    // On a 600 × 400 sheet trimmed to 590 × 390, a 350 × 500 piece fits only
    // turned 90° — which grain forbids. Same numbers, opposite answers.
    expect(nest([{ ...across, grained: false }], { ...OPTS, sheet: SMALL }).oversize).toEqual([])
    expect(nest([{ ...across, grained: true }], { ...OPTS, sheet: SMALL }).oversize).toEqual(['A'])
  })

  it('never turns a grained piece, even when turning it would pack better', () => {
    const pieces = [piece({ label: 'A', length: 300, width: 1100, qty: 4, grained: true })]
    const result = nest(pieces, OPTS)
    for (const layout of result.sheets) {
      for (const p of layout.placements) {
        expect(p.rotated).toBe(false)
        expect(p.w).toBe(300)
      }
    }
  })

  it('counts the locked pieces and says why the layout is worse than it looks', () => {
    const result = nest([piece({ label: 'A', qty: 3, grained: true })], OPTS)
    expect(result.grainLocked).toBe(3)
    expect(result.warnings.join(' ')).toMatch(/cannot be turned 90°/)
  })

  it('does not count a square piece as locked — it has nothing to lose', () => {
    expect(nest([piece({ length: 400, width: 400, grained: true })], OPTS).grainLocked).toBe(0)
  })
})

describe('a piece longer than the stock is said out loud', () => {
  it('reports it and leaves it out rather than emitting an impossible layout', () => {
    const result = nest([piece({ label: 'A' }), piece({ label: 'B', length: 3000, width: 200 })], OPTS)
    expect(result.oversize).toEqual(['B'])
    expect(result.sheets.flatMap((s) => s.placements).map((p) => p.label)).toEqual(['A'])
    expect(result.warnings.join(' ')).toMatch(/does not fit/i)
    expect(result.warnings.join(' ')).toMatch(/worse than none/i)
  })

  it('names every copy of an oversize piece, not just the type', () => {
    expect(nest([piece({ label: 'B', length: 3000, width: 200, qty: 2 })], OPTS).oversize).toEqual(['B1', 'B2'])
  })
})

describe('the same design always gives the same layout', () => {
  const pieces = [
    piece({ label: 'A', length: 1100, width: 480, qty: 3 }),
    piece({ label: 'B', length: 700, width: 260, qty: 5, grained: true }),
    piece({ label: 'C', length: 240, width: 190, qty: 8 }),
  ]

  it('is byte-identical across runs', () => {
    // A cutting plan that reshuffles on refresh is not a plan. The search is
    // randomised; the seed is not.
    const a = JSON.stringify(nest(pieces, OPTS))
    const b = JSON.stringify(nest(pieces, OPTS))
    expect(a).toBe(b)
  })

  it('is not deterministic by accident — the seed really does steer the search', () => {
    // Guards against the determinism test above passing for the wrong reason.
    // It has to run on a list the RANDOM half of the search can improve: on
    // `pieces` above, one of the fixed starting orders already wins and every
    // seed converges to it, so a seed-sensitivity check there would pass while
    // measuring nothing. This list has twelve sizes and a long tail, which is
    // where the hill climb earns its keep.
    const longTail = Array.from({ length: 12 }, (_, i) =>
      piece({ label: `P${i}`, length: 300 + i * 90, width: 120 + i * 20, qty: 3 }))
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(nest(longTail, { ...OPTS, seed })))
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })
})

describe('how good the layout actually is', () => {
  // Measured, not asserted by hope. The strongest check available without an
  // exact solver is the AREA LOWER BOUND: no layout of any kind, guillotine or
  // not, can use fewer sheets than the pieces' total area needs. Where the
  // packer hits that bound it is provably using the minimum number of sheets.
  const bound = (pieces: NestPiece[], sheet = SHEET) => {
    const area = pieces.reduce((sum, p) => sum + p.length * p.width * p.qty, 0)
    return Math.ceil(area / (sheet.w * sheet.h))
  }

  const realistic: Array<[string, NestPiece[]]> = [
    ['a bookcase', [
      piece({ label: 'A', length: 1800, width: 300, qty: 2, grained: true }),
      piece({ label: 'B', length: 764, width: 300, qty: 5, grained: true }),
      piece({ label: 'C', length: 1800, width: 800, qty: 1, grained: true }),
    ]],
    ['big panels plus offcut-sized ones', [
      piece({ label: 'A', length: 1210, width: 605, qty: 4 }),
      piece({ label: 'B', length: 800, width: 400, qty: 6 }),
      piece({ label: 'C', length: 605, width: 300, qty: 8 }),
    ]],
    ['a long tail of sizes', Array.from({ length: 12 }, (_, i) =>
      piece({ label: `P${i}`, length: 300 + i * 90, width: 120 + i * 20, qty: 3 }))],
  ]

  for (const [name, pieces] of realistic) {
    it(`uses the theoretical minimum number of sheets — ${name}`, () => {
      expect(nest(pieces, OPTS).sheets).toHaveLength(bound(pieces))
    })
  }

  it('stands pieces up when laying them flat would cost a whole sheet', () => {
    // Found by looking at a rendered plan, not by a failing assertion. Three
    // 1180 × 700 panels laid flat make one 700 mm strip and no room for a
    // second, so they take two sheets; stood upright they are three 700 mm
    // pieces in one 1180 mm strip and they fit on one, with 320 mm to spare.
    // No amount of REORDERING finds that — every ordering makes the same wrong
    // turn — which is why orientation is a search variable and not a rule.
    const panels = [piece({ label: 'D', length: 1180, width: 700, qty: 3, grained: false })]
    const result = nest(panels, OPTS)
    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].placements.every((p) => p.rotated)).toBe(true)
    for (const layout of result.sheets) checkSheet(layout, result.usable, result.kerf)
  })

  it('leaves them flat when the grain forbids standing them up', () => {
    // The same three panels, grained. Two sheets is now the honest answer, and
    // reporting one would be a layout that cannot be cut from grained stock.
    const panels = [piece({ label: 'D', length: 1180, width: 700, qty: 3, grained: true })]
    expect(nest(panels, OPTS).sheets).toHaveLength(2)
  })

  it('spends the search on the offcut, because the sheet count is already at the bound', () => {
    // What the randomised search buys is NOT a sheet — on every realistic list
    // tried, first-fit-decreasing already hits the area bound above and nothing
    // can beat it. What it buys is packing the strips down so the leftover is
    // one deep offcut instead of the same waste spread thin. On this list that
    // is 123 mm of extra usable depth, and it costs about 3 ms.
    const pieces = realistic[2][1]
    const height = (r: ReturnType<typeof nest>) => r.sheets.reduce((sum, s) => sum + s.usedHeight, 0)
    const searched = height(nest(pieces, OPTS))
    const once = height(nest(pieces, { ...OPTS, iterations: 0 }))
    expect(searched).toBeLessThan(once)
  })

  it('runs fast enough to sit in a render', () => {
    const pieces = Array.from({ length: 12 }, (_, i) =>
      piece({ label: `P${i}`, length: 300 + i * 90, width: 120 + i * 20, qty: 3 }))
    const started = performance.now()
    nest(pieces, OPTS)
    expect(performance.now() - started).toBeLessThan(2000)
  })
})

describe('the numbers on the summary line', () => {
  it('measures waste against the sheets you buy, not the sheets you use', () => {
    // Half a sheet left over is half a sheet paid for. Waste measured against
    // the used area would report 0% for every layout ever produced.
    const result = nest([piece({ label: 'A', length: 1200, width: 600 })], OPTS)
    expect(result.sheets).toHaveLength(1)
    expect(result.boughtArea).toBe(2440 * 1220)
    expect(result.pieceArea).toBe(1200 * 600)
    expect(result.wastePct).toBeCloseTo(75.8, 1)
  })

  it('offers the leftover as one offcut, and only when it is worth keeping', () => {
    const roomy = nest([piece({ label: 'A', length: 1200, width: 300 })], OPTS)
    expect(roomy.sheets[0].offcut).toEqual({ w: 2430, h: 1210 - 300 })

    const full = nest([piece({ label: 'A', length: 2400, width: 1180, grained: true })], OPTS)
    expect(full.sheets[0].offcut).toBeNull() // 30 mm of sawdust is not stock
  })

  it('packs the default box onto a single sheet', () => {
    const { types } = computeCutlist(emptyDesign())
    const result = nest(types.map((t) => ({
      label: t.letter, length: t.length, width: t.width, qty: t.qty,
      grained: true, material: '18 mm birch ply', thickness: 18,
    })), OPTS)
    expect(result.sheets).toHaveLength(1)
  })
})

describe('a mixed list is one plan per material and thickness', () => {
  it('never packs 18 mm carcass parts onto the same sheet as a 6 mm back', () => {
    const groups = groupForNesting([
      piece({ label: 'A', material: '18 mm birch ply', thickness: 18 }),
      piece({ label: 'B', material: '18 mm birch ply', thickness: 18 }),
      piece({ label: 'C', material: '6 mm birch ply', thickness: 6 }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].pieces.map((p) => p.label)).toEqual(['A', 'B'])
    expect(groups[1].thickness).toBe(6)
  })

  it('keeps two materials apart even at the same thickness', () => {
    const groups = groupForNesting([
      piece({ material: '18 mm birch ply', thickness: 18 }),
      piece({ material: '18 mm MDF', thickness: 18 }),
    ])
    expect(groups).toHaveLength(2)
  })
})
