// ---------------------------------------------------------------------------
// Will it sag?
//
// A panel supported only at its two ends bends under load, and the amount is
// not intuitive: it goes with the CUBE of the thickness and the CUBE of the
// span. That is the whole reason this file exists. Going from 18 mm to 25 mm
// makes a shelf 2.7× stiffer; going from a 600 mm span to a 900 mm span makes
// it 3.4× floppier. Nobody estimates either of those correctly by eye, which is
// why the classic mistake — a metre of 18 mm MDF loaded with books — keeps
// getting made.
//
// THE FORMULA
// -----------
// A simply-supported beam under a uniformly distributed load:
//
//     δ = 5 W L³ / (384 E I)        I = b d³ / 12
//
//   δ  deflection at mid-span, mm      W  total load on the span, N
//   L  clear span between supports, mm E  modulus of elasticity, N/mm²
//   b  width of the panel, mm          d  thickness, mm
//
// ⚠️ AND THEN IT KEEPS BENDING. Wood and wood products CREEP: under a load
// that never comes off, the deflection grows for years after the initial
// bend. That is not a rounding error — for chipboard the long-term deflection
// is roughly 3× the day-one figure, and it is the single most common reason a
// shelf that "looked fine when I built it" is visibly bowed two winters later.
// Every number this file reports is the LONG-TERM one, with the day-one figure
// alongside, because the long-term one is what the shelf will actually look
// like for most of its life.
//
// WHAT IT IS NOT
// --------------
// This is a sanity check for domestic shelving, not a structural calculation.
// It must never be used for anything anybody stands on, sits on, climbs, or
// would be hurt by if it let go. It assumes a uniformly distributed load on a
// panel simply supported at both ends, with no fixings, no back panel, no front
// lip and no centre support — all four of which stiffen a real shelf, usually
// by a lot. The stiffness figures are typical published values for the material
// class, and real boards vary widely; two sheets of "18 mm MDF" from different
// mills are not the same board.
// ---------------------------------------------------------------------------

import type { Cutlist, Design } from './panels'

/** Acceleration due to gravity, m/s². Turns a kilogram into a newton. */
const G = 9.81

/**
 * How far a shelf may bend before it looks wrong.
 *
 * Span ÷ 200 is the usual domestic-shelving figure and it matches the eye
 * well: at L/200 a 900 mm shelf is 4.5 mm down in the middle, which you notice
 * if you look for it and not otherwise. Twice that is unmistakable.
 */
export const SAG_LIMIT_RATIO = 200

export interface Stiffness {
  /** Matches against the design's free-text material name. */
  test: RegExp
  label: string
  /** Modulus of elasticity in bending, N/mm². Typical published value. */
  e: number
  /**
   * Long-term creep multiplier for a permanently applied load.
   *
   * Broadly the Eurocode 5 `kdef` idea: final deflection ≈ initial × (1 + kdef).
   * Chipboard is the outlier and it is why the cheap flat-pack bookshelf always
   * ends up bowed.
   */
  creep: number
}

/**
 * Stiffness by material, most specific first — "birch ply" must be tested
 * before "ply", and MDF before the plywood fallback.
 */
export const STIFFNESS: Stiffness[] = [
  { test: /chip\s*board|particle\s*board|melamine/i, label: 'chipboard', e: 2200, creep: 2.25 },
  { test: /\bmdf\b/i, label: 'MDF', e: 2800, creep: 1.5 },
  { test: /oak|beech|ash|maple|hardwood/i, label: 'solid hardwood', e: 11000, creep: 0.6 },
  { test: /pine|spruce|softwood|deal/i, label: 'solid softwood', e: 8000, creep: 0.6 },
  { test: /birch/i, label: 'birch plywood', e: 9000, creep: 0.8 },
  { test: /ply/i, label: 'plywood', e: 7000, creep: 0.8 },
]

export const FALLBACK: Stiffness = { test: /.^/, label: 'plywood', e: 7000, creep: 0.8 }

export function stiffnessFor(material: string): { stiffness: Stiffness; recognised: boolean } {
  const hit = STIFFNESS.find((s) => s.test.test(material))
  // An unrecognised material is REPORTED, not silently assumed. Quietly
  // treating somebody's oak-veneered chipboard as plywood would hand them a
  // number four times better than the truth.
  return { stiffness: hit ?? FALLBACK, recognised: Boolean(hit) }
}

/** What a shelf is carrying. Figures are per metre of shelf run. */
export interface LoadPreset {
  id: string
  label: string
  /** kg per metre of run. */
  kgPerM: number
  hint: string
}

export const LOADS: LoadPreset[] = [
  { id: 'light', label: 'Light', kgPerM: 10, hint: 'Ornaments, folded clothes, a few boxes' },
  { id: 'books', label: 'Books', kgPerM: 25, hint: 'A solid run of hardbacks — the usual bookshelf case' },
  { id: 'heavy', label: 'Heavy', kgPerM: 50, hint: 'Records, tools, tinned food, paint' },
]

export interface SagInput {
  /** Clear distance between the supports, mm. */
  span: number
  /** Width of the panel across the span, mm — the shelf's depth. */
  width: number
  thickness: number
  /** N/mm². */
  e: number
  kgPerM: number
  creep: number
}

export interface Sag {
  /** Deflection the day it is loaded, mm. */
  initial: number
  /** Deflection after years under the same load, mm. This is the honest one. */
  longTerm: number
  /** span ÷ SAG_LIMIT_RATIO, mm. */
  limit: number
  ok: boolean
  /** Total load on this span, kg — so the number can be sanity-checked by hand. */
  loadKg: number
}

export function sagOf({ span, width, thickness, e, kgPerM, creep }: SagInput): Sag {
  const limit = span / SAG_LIMIT_RATIO
  if (!(span > 0) || !(width > 0) || !(thickness > 0) || !(e > 0)) {
    return { initial: 0, longTerm: 0, limit, ok: true, loadKg: 0 }
  }
  const loadKg = kgPerM * (span / 1000)
  const w = loadKg * G // newtons, total, spread evenly along the span
  const i = (width * thickness ** 3) / 12
  const initial = (5 * w * span ** 3) / (384 * e * i)
  return {
    initial,
    longTerm: initial * (1 + creep),
    limit,
    ok: initial * (1 + creep) <= limit,
    loadKg,
  }
}

/**
 * The thinnest thickness from `options` that passes, or null if none does.
 *
 * Deliberately searches the thicknesses somebody can actually buy rather than
 * solving for the exact figure: "you need 21.4 mm" is not an answer you can act
 * on in a timber merchant.
 */
export function thinnestThatWorks(input: Omit<SagInput, 'thickness'>, options: readonly number[]): number | null {
  for (const thickness of [...options].sort((a, b) => a - b)) {
    if (sagOf({ ...input, thickness }).ok) return thickness
  }
  return null
}

/** Stock thicknesses worth suggesting, mm. */
export const COMMON_THICKNESSES = [6, 9, 12, 15, 18, 22, 25]

export interface ShelfAdvice {
  /** Which panel this is about. */
  panel: 'top' | 'bottom'
  part: string
  span: number
  width: number
  sag: Sag
  material: string
  /** The thickness assessed, mm — echoed so the UI never re-reads the design. */
  thicknessMm: number
  stiffness: Stiffness
  materialRecognised: boolean
  /** Set when the panel sags too far and a thicker board of the SAME stuff fixes it. */
  thicker: number | null
  /** Set when a stiffer material at the SAME thickness fixes it. */
  stiffer: Stiffness | null
}

/**
 * Assess the horizontal panels — the ones carrying weight across a gap.
 *
 * Only the top and bottom are considered, because they are the only panels in
 * this model that span between supports with a load on them. The sides carry
 * their load in compression, along the grain, where wood is enormously stiffer
 * and sag is not the failure mode.
 */
export function adviseShelves(design: Design, cutlist: Cutlist, kgPerM: number): ShelfAdvice[] {
  const { stiffness, recognised } = stiffnessFor(design.material)
  const out: ShelfAdvice[] = []

  for (const panel of ['top', 'bottom'] as const) {
    if (!design.present[panel]) continue
    const piece = cutlist.pieces.find((p) => p.panel === panel)
    if (!piece) continue

    // The clear span is the gap between the two sides — the cavity width — and
    // NOT the panel's own cut length. A top that laps over its sides is still
    // only unsupported across the gap between them.
    const span = design.present.left && design.present.right ? cutlist.cavity.x : design.width
    // The panel's other dimension resists the bend along its whole width.
    const width = Math.abs(piece.length - span) < Math.abs(piece.width - span) ? piece.width : piece.length

    const base = { span, width, e: stiffness.e, kgPerM, creep: stiffness.creep }
    const sag = sagOf({ ...base, thickness: design.thickness })

    let thicker: number | null = null
    let stiffer: Stiffness | null = null
    if (!sag.ok) {
      thicker = thinnestThatWorks(base, COMMON_THICKNESSES.filter((t) => t > design.thickness))
      stiffer = STIFFNESS.find(
        (s) => s.e > stiffness.e && sagOf({ ...base, e: s.e, creep: s.creep, thickness: design.thickness }).ok,
      ) ?? null
    }

    out.push({
      panel,
      part: piece.part,
      span,
      width,
      sag,
      material: design.material,
      thicknessMm: Math.round(design.thickness * 10) / 10,
      stiffness,
      materialRecognised: recognised,
      thicker,
      stiffer,
    })
  }

  return out
}
