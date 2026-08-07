import { describe, expect, it } from 'vitest'
import { previewLayout, travelFor } from './preview'
import { PANEL_IDS, type Design, type PanelId } from './panels'
import { TEMPLATES } from './templates'

const box = TEMPLATES.find((t) => t.id === 'box')!.design
const tray = TEMPLATES.find((t) => t.id === 'tray')!.design
const shelf = TEMPLATES.find((t) => t.id === 'shelf')!.design

function panelsIn(design: Design, section: 'plan' | 'elevation'): PanelId[] {
  return previewLayout(design).rects.filter((r) => r.section === section).map((r) => r.panel).sort()
}

describe('the thumbnail shows every omitted face', () => {
  // This is the whole reason there are two sections rather than one. If either
  // half were dropped, two templates below would draw identically.
  it('needs the plan to tell a shelf unit from a box', () => {
    expect(panelsIn(box, 'elevation')).toEqual(panelsIn(shelf, 'elevation'))
    expect(panelsIn(box, 'plan')).not.toEqual(panelsIn(shelf, 'plan'))
  })

  it('needs the elevation to tell a tray from a box', () => {
    expect(panelsIn(box, 'plan')).toEqual(panelsIn(tray, 'plan'))
    expect(panelsIn(box, 'elevation')).not.toEqual(panelsIn(tray, 'elevation'))
  })

  it('draws each present panel exactly once per section it is cut by', () => {
    // A plan cut misses the top and bottom; an elevation cut misses front and back.
    expect(panelsIn(box, 'plan')).toEqual(['back', 'front', 'left', 'right'])
    expect(panelsIn(box, 'elevation')).toEqual(['bottom', 'left', 'right', 'top'])
  })

  it('never draws an omitted panel', () => {
    for (const t of TEMPLATES) {
      const drawn = new Set(previewLayout(t.design).rects.map((r) => r.panel))
      for (const p of PANEL_IDS) {
        if (!t.design.present[p]) expect(drawn.has(p)).toBe(false)
      }
    }
  })
})

describe('pieces fly in along their own normal axis, from outside', () => {
  const rects = previewLayout(box).rects
  const at = (id: string) => rects.find((r) => r.id === id)!
  const travel = travelFor(box)

  it('sends the sides in sideways and everything else vertically', () => {
    expect(at('plan-left')).toMatchObject({ dx: -travel, dy: 0 })
    expect(at('plan-right')).toMatchObject({ dx: travel, dy: 0 })
    expect(at('elevation-left')).toMatchObject({ dx: -travel, dy: 0 })
    expect(at('elevation-right')).toMatchObject({ dx: travel, dy: 0 })
  })

  it('respects the flipped vertical axis of both drawings', () => {
    // Plan puts the front at the bottom of the page, so the front enters from
    // below; elevation puts the top of the box at the top, so the top enters
    // from above. Getting either backwards is a piece flying out through the box.
    expect(at('plan-front').dy).toBe(travel)
    expect(at('plan-back').dy).toBe(-travel)
    expect(at('elevation-bottom').dy).toBe(travel)
    expect(at('elevation-top').dy).toBe(-travel)
  })

  it('starts every piece clear of the drawn box', () => {
    for (const r of rects) {
      const escapes = Math.abs(r.dx) >= r.w || Math.abs(r.dy) >= r.h
      expect(escapes).toBe(true)
    }
  })
})

describe('the stagger is the wrap order, outermost first', () => {
  it('gives the outermost panel step 0 and matches both halves', () => {
    const preview = previewLayout(shelf)
    const outermost = shelf.order[0]
    for (const r of preview.rects) {
      expect(r.step).toBe(shelf.order.indexOf(r.panel))
      if (r.panel === outermost) expect(r.step).toBe(0)
    }
    // The same panel animates in step in both sections, or the two halves of
    // one drawing would show the box assembling in two different orders.
    const left = preview.rects.filter((r) => r.panel === 'left')
    expect(new Set(left.map((r) => r.step)).size).toBe(1)
  })
})

describe('the two halves are laid out to a common scale', () => {
  it('shares the width axis and stacks plan over elevation with a gap', () => {
    const preview = previewLayout(box)
    expect(preview.width).toBe(box.width)
    expect(preview.splitY).toBeGreaterThan(box.depth)
    expect(preview.height).toBe(preview.splitY + box.height)
    for (const r of preview.rects) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(box.width + 1e-9)
      if (r.section === 'plan') expect(r.y + r.h).toBeLessThanOrEqual(box.depth + 1e-9)
      else expect(r.y).toBeGreaterThanOrEqual(preview.splitY - 1e-9)
    }
  })

  it('draws every wall exactly one thickness thick', () => {
    for (const t of TEMPLATES) {
      for (const r of previewLayout(t.design).rects) {
        expect(Math.min(r.w, r.h)).toBeCloseTo(t.design.thickness, 9)
      }
    }
  })
})
