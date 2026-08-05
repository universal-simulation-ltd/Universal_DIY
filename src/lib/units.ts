// ---------------------------------------------------------------------------
// Units — a DISPLAY and ENTRY concern only.
//
// Millimetres are the canonical internal unit: every stored value and every
// calculation is mm as a JS number, and nothing in the model is ever stored in
// inches. There is also exactly ONE display unit for the whole document — no
// per-field units, because a cut list with mixed units is how somebody cuts the
// wrong piece.
//
// No rounding happens anywhere in the arithmetic. It happens here, at the edge,
// half away from zero.
// ---------------------------------------------------------------------------

export type Unit = 'mm' | 'cm' | 'in'

export const MM_PER_INCH = 25.4

export const UNIT_LABEL: Record<Unit, string> = { mm: 'mm', cm: 'cm', in: 'in' }

/** Round half AWAY FROM ZERO — not JS's Math.round, which rounds half up. */
export function roundHalfAway(value: number, decimals: number): number {
  const f = 10 ** decimals
  const scaled = value * f
  const r = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)
  return r / f
}

export function mmToUnit(mm: number, unit: Unit): number {
  if (unit === 'cm') return mm / 10
  if (unit === 'in') return mm / MM_PER_INCH
  return mm
}

export function unitToMm(value: number, unit: Unit): number {
  if (unit === 'cm') return value * 10
  if (unit === 'in') return value * MM_PER_INCH
  return value
}

const GCD = (a: number, b: number): number => (b === 0 ? a : GCD(b, a % b))

/**
 * Nearest 1/32", as a whole-plus-fraction string. `exact` is false when the
 * true value isn't on a 32nd, which is what earns the `≈` in the display.
 */
export function toThirtySeconds(inches: number): { text: string; exact: boolean } {
  const sign = inches < 0 ? '-' : ''
  const abs = Math.abs(inches)
  const thirtyseconds = roundHalfAway(abs * 32, 0)
  const exact = Math.abs(abs * 32 - thirtyseconds) < 1e-9
  const whole = Math.floor(thirtyseconds / 32)
  let num = thirtyseconds - whole * 32
  let den = 32
  if (num > 0) {
    const g = GCD(num, den)
    num /= g
    den /= g
  }
  if (num === 0) return { text: `${sign}${whole}`, exact }
  if (whole === 0) return { text: `${sign}${num}/${den}`, exact }
  return { text: `${sign}${whole} ${num}/${den}`, exact }
}

export interface FormatOptions {
  unit: Unit
  /** mm only: 1 dp by default, 0 dp selectable. */
  mmDecimals?: 0 | 1
  /** Append the unit symbol. */
  withUnit?: boolean
}

/**
 * The one place a millimetre becomes a string a human reads.
 *
 * mm  -> 1 decimal place (0 selectable)
 * cm  -> 2 decimal places (same real precision as mm at 1 dp)
 * in  -> nearest 1/32", with the exact decimal inch alongside and a leading ≈
 *        when the fraction isn't exact. Never a bare decimal inch: nobody has
 *        a tape marked in 0.7086".
 */
export function formatLength(mm: number, opts: FormatOptions): string {
  const { unit, mmDecimals = 1, withUnit = false } = opts
  if (unit === 'in') {
    const inches = mmToUnit(mm, 'in')
    const { text, exact } = toThirtySeconds(inches)
    const decimal = roundHalfAway(inches, 3).toFixed(3)
    return `${exact ? '' : '≈'}${text}" (${decimal}")`
  }
  const decimals = unit === 'cm' ? 2 : mmDecimals
  const value = roundHalfAway(mmToUnit(mm, unit), decimals)
  const text = value.toFixed(decimals)
  return withUnit ? `${text} ${UNIT_LABEL[unit]}` : text
}

/** Compact form for drawing labels — no unit suffix, no decimal-inch tail. */
export function formatShort(mm: number, unit: Unit, mmDecimals: 0 | 1 = 1): string {
  if (unit === 'in') {
    const { text, exact } = toThirtySeconds(mmToUnit(mm, 'in'))
    return `${exact ? '' : '≈'}${text}"`
  }
  const decimals = unit === 'cm' ? 2 : mmDecimals
  return roundHalfAway(mmToUnit(mm, unit), decimals).toFixed(decimals)
}

/** Area in m², to 2 dp — the number you take to the timber merchant. */
export function areaM2(mm2: number): number {
  return roundHalfAway(mm2 / 1_000_000, 2)
}

/**
 * The text an EDITABLE field shows for a stored millimetre value.
 *
 * Deliberately not `formatShort`: in inch mode the readouts print a fraction
 * (`≈3/4"` — nobody has a tape marked in 0.7086"), but a fraction with a `≈` in
 * front of it is not something you can sensibly put a caret in and edit. So a
 * field shows a plain decimal inch and `parseLength` accepts `3/4` and `1 1/2`
 * on the way back in.
 */
export function fieldText(mm: number, unit: Unit, mmDecimals: 0 | 1): string {
  if (unit === 'in') return String(roundHalfAway(mmToUnit(mm, 'in'), 3))
  return formatShort(mm, unit, mmDecimals)
}

/**
 * Parse a length typed by a human in the current display unit. Accepts plain
 * decimals everywhere, and in inch mode also `3/4`, `1 1/2` and a trailing `"`.
 * Returns mm, or null when it isn't a number.
 */
export function parseLength(input: string, unit: Unit): number | null {
  const raw = input.trim().replace(/["″]/g, '').replace(/\s+/g, ' ')
  if (!raw) return null
  if (unit === 'in') {
    const mixed = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(raw)
    if (mixed) {
      const whole = Number(mixed[1])
      const frac = Number(mixed[2]) / Number(mixed[3])
      if (!Number.isFinite(frac) || Number(mixed[3]) === 0) return null
      return unitToMm(whole < 0 ? whole - frac : whole + frac, 'in')
    }
    const simple = /^(-?\d+)\/(\d+)$/.exec(raw)
    if (simple) {
      if (Number(simple[2]) === 0) return null
      return unitToMm(Number(simple[1]) / Number(simple[2]), 'in')
    }
  }
  const n = Number(raw)
  return Number.isFinite(n) ? unitToMm(n, unit) : null
}
