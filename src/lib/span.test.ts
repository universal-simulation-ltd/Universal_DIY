import { describe, expect, it } from 'vitest'
import {
  COMMON_THICKNESSES, LOADS, SAG_LIMIT_RATIO, adviseShelves, sagOf, stiffnessFor, thinnestThatWorks,
} from './span'
import { computeCutlist, emptyDesign, type Design } from './panels'

const ply = { e: 9000, creep: 0.8 }

describe('the beam formula, against figures that can be checked by hand', () => {
  it('matches a worked example', () => {
    // 800 mm span, 300 mm deep, 18 mm birch ply (E = 9000), 25 kg/m of books.
    //   W = 25 × 0.8 × 9.81           = 196.2 N
    //   I = 300 × 18³ / 12            = 145,800 mm⁴
    //   δ = 5 × 196.2 × 800³ / (384 × 9000 × 145,800) = 0.9967 mm
    const sag = sagOf({ span: 800, width: 300, thickness: 18, kgPerM: 25, ...ply })
    expect(sag.loadKg).toBeCloseTo(20, 6)
    expect(sag.initial).toBeCloseTo(0.9967, 3)
    expect(sag.longTerm).toBeCloseTo(0.9967 * 1.8, 3)
    expect(sag.ok).toBe(true) // limit is 800/200 = 4 mm
  })

  it('goes with the CUBE of the thickness, which is the whole point of the feature', () => {
    const base = { span: 900, width: 300, kgPerM: 25, ...ply }
    const at18 = sagOf({ ...base, thickness: 18 }).initial
    const at25 = sagOf({ ...base, thickness: 25 }).initial
    // (25/18)³ = 2.68 — nobody estimates that by eye, and that is the argument
    // for the app doing it.
    expect(at18 / at25).toBeCloseTo((25 / 18) ** 3, 6)
  })

  it('goes with the CUBE of the span too', () => {
    const base = { width: 300, thickness: 18, kgPerM: 25, ...ply }
    // The load is per metre of run, so a longer span carries proportionally
    // more weight — total load rises with L and deflection with L⁴/L = L⁴.
    const short = sagOf({ ...base, span: 600 }).initial
    const long = sagOf({ ...base, span: 900 }).initial
    expect(long / short).toBeCloseTo((900 / 600) ** 4, 6)
  })

  it('is linear in the load and in the width', () => {
    const base = { span: 800, width: 300, thickness: 18, ...ply }
    expect(sagOf({ ...base, kgPerM: 50 }).initial).toBeCloseTo(sagOf({ ...base, kgPerM: 25 }).initial * 2, 9)
    const wide = sagOf({ span: 800, width: 600, thickness: 18, kgPerM: 25, ...ply }).initial
    const narrow = sagOf({ span: 800, width: 300, thickness: 18, kgPerM: 25, ...ply }).initial
    expect(wide).toBeCloseTo(narrow / 2, 9)
  })

  it('reports the long-term figure, not just the day-one one', () => {
    const sag = sagOf({ span: 800, width: 300, thickness: 18, kgPerM: 25, e: 2200, creep: 2.25 })
    expect(sag.longTerm).toBeCloseTo(sag.initial * 3.25, 9)
    expect(sag.longTerm).toBeGreaterThan(sag.initial)
  })

  it('survives nonsense input instead of returning NaN', () => {
    for (const bad of [{ span: 0 }, { width: 0 }, { thickness: 0 }, { e: 0 }]) {
      const sag = sagOf({ span: 800, width: 300, thickness: 18, kgPerM: 25, ...ply, ...bad })
      expect(Number.isFinite(sag.initial)).toBe(true)
      expect(Number.isFinite(sag.longTerm)).toBe(true)
    }
  })
})

describe('it agrees with what actually happens in real rooms', () => {
  it('condemns a metre of 18 mm MDF loaded with books', () => {
    // The classic. Everybody has built this shelf and everybody has watched it
    // bow. If the model said this was fine it would be worthless.
    const sag = sagOf({ span: 1000, width: 250, thickness: 18, kgPerM: 25, e: 2800, creep: 1.5 })
    expect(sag.ok).toBe(false)
    expect(sag.longTerm).toBeGreaterThan(10) // against a 5 mm limit
  })

  it('passes 18 mm birch ply over 600 mm, which is the shelf everybody builds and nobody complains about', () => {
    expect(sagOf({ span: 600, width: 300, thickness: 18, kgPerM: 25, ...ply }).ok).toBe(true)
  })

  it('condemns chipboard hardest, which is why the flat-pack bookshelf always bows', () => {
    const at = (e: number, creep: number) => sagOf({ span: 800, width: 300, thickness: 18, kgPerM: 25, e, creep }).longTerm
    expect(at(2200, 2.25)).toBeGreaterThan(at(2800, 1.5))
    expect(at(2800, 1.5)).toBeGreaterThan(at(9000, 0.8))
  })

  it('holds a light load over a span that fails under a heavy one', () => {
    const base = { span: 700, width: 250, thickness: 18, e: 2800, creep: 1.5 }
    expect(sagOf({ ...base, kgPerM: 10 }).ok).toBe(true)
    expect(sagOf({ ...base, kgPerM: 50 }).ok).toBe(false)
  })

  it('will not pass 18 mm MDF at 900 mm even with almost nothing on it', () => {
    // Worth pinning, because it is harsher than intuition and it is not a bug.
    // Ten kilos spread over a 900 mm MDF shelf still ends up ~6 mm down once
    // creep has had its way, against a 4.5 mm limit. MDF really is that floppy,
    // and softening the model to match what people expect would be the one
    // change that makes this feature worse than useless.
    expect(sagOf({ span: 900, width: 250, thickness: 18, kgPerM: 10, e: 2800, creep: 1.5 }).ok).toBe(false)
  })
})

describe('the material lookup', () => {
  it('picks the specific match over the general one', () => {
    expect(stiffnessFor('18 mm birch ply').stiffness.label).toBe('birch plywood')
    expect(stiffnessFor('18 mm MDF').stiffness.label).toBe('MDF')
    expect(stiffnessFor('12 mm ply').stiffness.label).toBe('plywood')
    expect(stiffnessFor('melamine-faced chipboard').stiffness.label).toBe('chipboard')
    expect(stiffnessFor('19 mm softwood').stiffness.label).toBe('solid softwood')
    expect(stiffnessFor('solid oak').stiffness.label).toBe('solid hardwood')
  })

  it('says when it did not recognise the material rather than guessing quietly', () => {
    // Quietly treating somebody's oak-veneered chipboard as plywood hands them
    // a number four times better than the truth.
    const unknown = stiffnessFor('reclaimed scaffold board')
    expect(unknown.recognised).toBe(false)
    expect(stiffnessFor('18 mm birch ply').recognised).toBe(true)
  })
})

describe('the recommendation', () => {
  const failing = { span: 800, width: 250, kgPerM: 25, e: 2800, creep: 1.5 }

  it('offers the thinnest stock thickness that actually passes', () => {
    const need = thinnestThatWorks(failing, COMMON_THICKNESSES)
    expect(need).not.toBeNull()
    expect(sagOf({ ...failing, thickness: need! }).ok).toBe(true)
    // And nothing thinner would have done.
    const thinner = COMMON_THICKNESSES.filter((t) => t < need!)
    for (const t of thinner) expect(sagOf({ ...failing, thickness: t }).ok).toBe(false)
  })

  it('returns null rather than inventing a board nobody sells', () => {
    // 2 m of chipboard under records cannot be fixed by thickness alone — and
    // saying "you need 40 mm chipboard" would be worse than saying nothing.
    expect(thinnestThatWorks({ span: 2000, width: 300, kgPerM: 50, e: 2200, creep: 2.25 }, COMMON_THICKNESSES)).toBeNull()
  })

  it('cannot save 1 m of MDF under books with thickness alone', () => {
    // Even 25 mm is not enough. That is the honest answer, and it is why the
    // advice also offers a different MATERIAL rather than only a thicker board.
    expect(thinnestThatWorks({ span: 1000, width: 250, kgPerM: 25, e: 2800, creep: 1.5 }, COMMON_THICKNESSES)).toBeNull()
  })
})

describe('advice for a whole design', () => {
  const design: Design = { ...emptyDesign(), width: 1000, depth: 300, height: 400, material: '18 mm MDF' }

  it('measures the span between the SIDES, not the panel\'s own length', () => {
    // A top that laps over its sides is still only unsupported across the gap
    // between them. Using the cut length would flatter every overlay design.
    const advice = adviseShelves(design, computeCutlist(design), 25)
    expect(advice.length).toBeGreaterThan(0)
    expect(advice[0].span).toBe(computeCutlist(design).cavity.x)
    expect(advice[0].span).toBeLessThan(design.width)
  })

  it('flags the top of a wide MDF box and suggests a way out', () => {
    const advice = adviseShelves(design, computeCutlist(design), 25)
    const top = advice.find((a) => a.panel === 'top')!
    expect(top.sag.ok).toBe(false)
    // Either a thicker board or a stiffer material — at least one real answer.
    expect(top.thicker !== null || top.stiffer !== null).toBe(true)
    if (top.stiffer) expect(top.stiffer.e).toBeGreaterThan(top.stiffness.e)
  })

  it('says nothing alarming about a small box in birch ply', () => {
    const small: Design = { ...emptyDesign(), width: 500, depth: 300, height: 300, material: '18 mm birch ply' }
    for (const a of adviseShelves(small, computeCutlist(small), 25)) expect(a.sag.ok).toBe(true)
  })

  it('skips a panel that is not there', () => {
    const tray: Design = { ...design, present: { ...design.present, top: false } }
    const advice = adviseShelves(tray, computeCutlist(tray), 25)
    expect(advice.some((a) => a.panel === 'top')).toBe(false)
    expect(advice.some((a) => a.panel === 'bottom')).toBe(true)
  })

  it('uses the full width when there are no sides to span between', () => {
    const noSides: Design = { ...design, present: { ...design.present, left: false, right: false } }
    const advice = adviseShelves(noSides, computeCutlist(noSides), 25)
    expect(advice[0].span).toBe(noSides.width)
  })
})

describe('the presets', () => {
  it('are ordered lightest first and cover the ordinary cases', () => {
    expect(LOADS.map((l) => l.kgPerM)).toEqual([...LOADS.map((l) => l.kgPerM)].sort((a, b) => a - b))
    expect(LOADS.find((l) => l.id === 'books')!.kgPerM).toBe(25)
  })

  it('uses span ÷ 200 as the limit, and says so in one place', () => {
    expect(sagOf({ span: 1000, width: 300, thickness: 18, kgPerM: 25, ...ply }).limit).toBe(1000 / SAG_LIMIT_RATIO)
  })
})
