import { describe, expect, it } from 'vitest'
import { SHEETS, STOCK, estimateSheets, findStock } from './materials'
import { MM_PER_INCH } from './units'
import { computeCutlist, emptyDesign } from './panels'

describe('stock thickness is a measured number, never a nominal name', () => {
  it('resolves 3/4 in to 19.05 mm exactly, not 19', () => {
    // Snapping it to 19 is a 1 mm lie on a −2t deduction — a visible gap at
    // glue-up. Round the cut dimension at the end, never the input that gets
    // doubled.
    expect(findStock('in34')!.mm).toBe(0.75 * MM_PER_INCH)
    expect(findStock('in34')!.mm).toBeCloseTo(19.05, 9)
    expect(findStock('in12')!.mm).toBeCloseTo(12.7, 9)
    expect(findStock('in14')!.mm).toBeCloseTo(6.35, 9)
  })

  it('names nominal softwood honestly so nobody assumes 25.4', () => {
    const softwood = findStock('softwood1x')!
    expect(softwood.mm).toBe(19)
    expect(softwood.label).toContain('19 mm actual')
  })

  it('gives every entry a positive thickness and a unique id', () => {
    expect(new Set(STOCK.map((s) => s.id)).size).toBe(STOCK.length)
    for (const s of STOCK) expect(s.mm).toBeGreaterThan(0)
    expect(findStock('nope')).toBeUndefined()
  })

  it('records the unit each stock is actually sold in', () => {
    // Drives the "pick one unit before you start" banner: designing in mm off
    // an imperial board is how you chase 0.4 mm all afternoon.
    expect(findStock('ply18')!.nativeUnit).toBe('mm')
    expect(findStock('in34')!.nativeUnit).toBe('in')
  })
})

describe('the shopping question is not the packing question', () => {
  const { totalArea, types } = computeCutlist(emptyDesign())
  const pieces = types.map((t) => ({ label: t.letter, length: t.length, width: t.width }))
  const sheet = SHEETS[0]

  it('answers "how much ply do I buy" from area plus an allowance', () => {
    const est = estimateSheets(totalArea, pieces, sheet)
    expect(est.areaM2).toBeCloseTo(0.99, 2)
    expect(est.sheets).toBe(1) // 0.99 m² + 15% against a 2.98 m² sheet
  })

  it('rounds up to whole sheets and never returns zero', () => {
    expect(estimateSheets(1, [], sheet).sheets).toBe(1)
    expect(estimateSheets(sheet.w * sheet.h, [], sheet).sheets).toBe(2)
  })

  it('never lets the estimate masquerade as a cutting layout', () => {
    const est = estimateSheets(totalArea, pieces, sheet)
    expect(est.caveat).toMatch(/ignores the cutting layout/i)
  })

  it('says plainly when a piece is longer than the stock', () => {
    const small = SHEETS.find((s) => s.id === '600x400')!
    const est = estimateSheets(totalArea, pieces, small)
    // 564 × 400 fits; 400 × 300 fits; nothing here is over 600 × 400.
    expect(est.oversize).toEqual([])
    const huge = estimateSheets(9e6, [{ label: 'A', length: 3000, width: 200 }], small)
    expect(huge.oversize).toEqual(['A'])
  })
})
