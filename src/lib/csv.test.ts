import { describe, expect, it } from 'vitest'
import { CSV_COLUMNS, csvNumber, safeFilename, toCsv } from './csv'
import { computeCutlist, emptyDesign, promote } from './panels'

describe('the CSV is shaped for cutlistoptimizer', () => {
  it('uses the exact column order the importer expects', () => {
    // Not a style choice: this order is what pastes straight in. Changing it
    // breaks the one escape hatch v1 offers in place of an optimiser.
    expect(CSV_COLUMNS.join(',')).toBe('Length,Width,Qty,Label,Material,Grain,Notes')
  })

  it('emits one row per piece TYPE with a Qty, not one row per piece', () => {
    const { types, pieces } = computeCutlist(emptyDesign())
    const lines = toCsv(types, '18 mm birch ply').trim().split('\n')
    expect(pieces).toHaveLength(6)
    expect(lines).toHaveLength(1 + 3) // header + A, B, C
    expect(lines[0]).toBe('Length,Width,Qty,Label,Material,Grain,Notes')
    expect(lines[1]).toBe('400,300,2,A,18 mm birch ply,along length,')
    expect(lines[2]).toBe('564,400,2,B,18 mm birch ply,along length,')
    expect(lines[3]).toBe('564,264,2,C,18 mm birch ply,along length,')
  })

  it('carries the asymmetric back through as its own qty-1 row', () => {
    const design = { ...emptyDesign(), order: promote(emptyDesign().order, 'back') }
    const { types } = computeCutlist(design)
    const rows = toCsv(types, 'MDF').trim().split('\n').slice(1)
    expect(rows).toContain('600,300,1,C,MDF,along length,')
    expect(rows).toContain('564,264,1,D,MDF,along length,')
  })

  it('is always millimetres with a . separator, whatever the display unit', () => {
    // A localised decimal comma would silently corrupt every number on import,
    // and it would corrupt it into a *valid-looking* one.
    const design = { ...emptyDesign(), thickness: 19.05 }
    const { types } = computeCutlist(design)
    const rows = toCsv(types, '3/4 in ply').trim().split('\n').slice(1)
    expect(rows.join('\n')).toContain('561.9')
    for (const row of rows) {
      const cells = row.split(',')
      expect(cells).toHaveLength(7) // no number split itself in two
      expect(Number(cells[0])).toBeGreaterThan(0)
      expect(Number(cells[1])).toBeGreaterThan(0)
    }
  })

  it('rounds to at most 2 dp with no trailing zeros or thousands separators', () => {
    expect(csvNumber(561.9)).toBe('561.9')
    expect(csvNumber(1234)).toBe('1234')
    expect(csvNumber(12.3456)).toBe('12.35')
  })

  it('quotes a field containing a comma or a quote rather than splitting the row', () => {
    const { types } = computeCutlist(emptyDesign())
    const csv = toCsv(types, 'ply, birch', { A: 'front edge "visible"' })
    expect(csv).toContain('"ply, birch"')
    expect(csv).toContain('"front edge ""visible"""')
  })

  it('ends with a newline', () => {
    expect(toCsv(computeCutlist(emptyDesign()).types, 'ply').endsWith('\n')).toBe(true)
  })

  it('says "none" for grain when the material has none', () => {
    const { types } = computeCutlist({ ...emptyDesign(), grained: false })
    expect(toCsv(types, '18 mm MDF')).toContain(',none,')
  })
})

describe('the download filename', () => {
  it('strips anything a filesystem would object to', () => {
    expect(safeFilename('Tool box / v2')).toBe('tool-box-v2')
    expect(safeFilename('  ')).toBe('cutlist')
    expect(safeFilename('***')).toBe('cutlist')
  })
})
