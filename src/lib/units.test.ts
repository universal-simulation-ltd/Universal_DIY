import { describe, expect, it } from 'vitest'
import {
  MM_PER_INCH,
  areaM2,
  fieldText,
  formatLength,
  formatShort,
  mmToUnit,
  parseLength,
  roundHalfAway,
  toThirtySeconds,
  unitToMm,
} from './units'

describe('rounding happens at the edge, half away from zero', () => {
  it('rounds .5 away from zero in both directions — not JS Math.round', () => {
    expect(roundHalfAway(0.5, 0)).toBe(1)
    expect(roundHalfAway(-0.5, 0)).toBe(-1) // Math.round(-0.5) is -0
    expect(roundHalfAway(2.25, 1)).toBe(2.3)
    expect(roundHalfAway(-2.25, 1)).toBe(-2.3)
  })

  it('round-trips a length through a unit without drift', () => {
    for (const unit of ['mm', 'cm', 'in'] as const) {
      expect(unitToMm(mmToUnit(1234.5, unit), unit)).toBeCloseTo(1234.5, 9)
    }
  })
})

describe('display units are display only', () => {
  it('shows mm to 1 dp by default and 0 dp on request', () => {
    expect(formatLength(561.9, { unit: 'mm' })).toBe('561.9')
    expect(formatLength(561.9, { unit: 'mm', mmDecimals: 0 })).toBe('562')
    expect(formatLength(561.9, { unit: 'mm', withUnit: true })).toBe('561.9 mm')
  })

  it('shows cm at the same real precision as mm', () => {
    expect(formatLength(561.9, { unit: 'cm' })).toBe('56.19')
  })

  it('never prints a bare decimal inch — nobody has a tape marked in 0.7086"', () => {
    // 19.05 mm is exactly 3/4", so no ≈.
    expect(formatLength(19.05, { unit: 'in' })).toBe('3/4" (0.750")')
    expect(formatShort(19.05, 'in')).toBe('3/4"')
  })

  it('marks an inexact 32nd with ≈, and an exact one without', () => {
    expect(toThirtySeconds(0.75)).toEqual({ text: '3/4', exact: true })
    expect(toThirtySeconds(1.5)).toEqual({ text: '1 1/2', exact: true })
    expect(toThirtySeconds(2)).toEqual({ text: '2', exact: true })
    const rough = toThirtySeconds(mmToUnit(564, 'in'))
    expect(rough.exact).toBe(false)
    expect(formatShort(564, 'in').startsWith('≈')).toBe(true)
    expect(formatShort(19.05, 'in').startsWith('≈')).toBe(false)
  })

  it('reduces the fraction rather than printing 16/32', () => {
    expect(toThirtySeconds(0.5).text).toBe('1/2')
    expect(toThirtySeconds(1 / 32).text).toBe('1/32')
  })
})

describe('an editable field shows something you can put a caret in', () => {
  it('shows a plain decimal inch, not a ≈fraction', () => {
    // formatShort is for READING a cut size; a field has to be editable, and
    // "≈22 3/16" is not a thing you can sensibly retype.
    expect(fieldText(19.05, 'in', 1)).toBe('0.75')
    expect(fieldText(564, 'in', 1)).toBe('22.205')
    expect(fieldText(600, 'mm', 1)).toBe('600.0')
    expect(fieldText(600, 'mm', 0)).toBe('600')
    expect(fieldText(600, 'cm', 1)).toBe('60.00')
  })

  it('round-trips back through the parser', () => {
    for (const unit of ['mm', 'cm', 'in'] as const) {
      expect(parseLength(fieldText(564, unit, 1), unit)).toBeCloseTo(564, 1)
    }
  })
})

describe('entry accepts what a woodworker types', () => {
  it('takes plain decimals in every unit', () => {
    expect(parseLength('600', 'mm')).toBe(600)
    expect(parseLength('60', 'cm')).toBe(600)
    expect(parseLength('24', 'in')).toBeCloseTo(24 * MM_PER_INCH, 9)
  })

  it('takes fractions and a trailing inch mark, in inch mode only', () => {
    expect(parseLength('3/4', 'in')).toBeCloseTo(19.05, 9)
    expect(parseLength('1 1/2"', 'in')).toBeCloseTo(38.1, 9)
    expect(parseLength('-1 1/2', 'in')).toBeCloseTo(-38.1, 9)
    // A fraction in mm mode is not a length — it must not silently become 0.75.
    expect(parseLength('3/4', 'mm')).toBeNull()
  })

  it('rejects anything that is not a number rather than returning NaN', () => {
    for (const bad of ['', '   ', 'wide', '1/0', '2 1/0']) {
      expect(parseLength(bad, 'in')).toBeNull()
    }
  })
})

describe('the shopping figure', () => {
  it('reports board area in m² to 2 dp', () => {
    // Worked example A: 988,992 mm².
    expect(areaM2(988_992)).toBe(0.99)
  })
})
