import { describe, expect, it } from 'vitest'
import { extent, netLayout, sectionLayout } from './diagram'
import { computeCutlist, emptyDesign, promote, type Design, type PanelId } from './panels'

const design: Design = emptyDesign() // 600 × 400 × 300, t 18, sides capture everything

function rect(net: ReturnType<typeof netLayout>, panel: PanelId) {
  const r = net.rects.find((x) => x.panel === panel)
  if (!r) throw new Error(`no rect for ${panel}`)
  return r
}

describe('the net is drawn to scale, from the same numbers as the cut list', () => {
  const net = netLayout(design)

  it('draws every present piece at its true cut size', () => {
    // If these two ever diverge the drawing stops being a check on the list,
    // which is the only reason the drawing exists.
    for (const piece of computeCutlist(design).pieces) {
      const r = rect(net, piece.panel)
      expect([r.w, r.h].sort((a, b) => b - a)).toEqual([piece.length, piece.width])
    }
  })

  it('lays the six pieces out as a net — Back centre, Front to one side', () => {
    const back = rect(net, 'back')
    const front = rect(net, 'front')
    const top = rect(net, 'top')
    const bottom = rect(net, 'bottom')
    const left = rect(net, 'left')
    const right = rect(net, 'right')

    expect(top.y + top.h).toBeLessThanOrEqual(back.y)
    expect(bottom.y).toBeGreaterThanOrEqual(back.y + back.h)
    expect(left.x + left.w).toBeLessThanOrEqual(back.x)
    expect(right.x).toBeGreaterThanOrEqual(back.x + back.w)
    expect(front.x).toBeGreaterThanOrEqual(right.x + right.w)
  })

  it('makes a piece that fits BETWEEN its neighbours look inset', () => {
    // 564 vs the sides' outer span: the step at each end is the visible tell.
    const back = rect(net, 'back')
    const left = rect(net, 'left')
    const right = rect(net, 'right')
    expect(back.w).toBe(564)
    expect(back.x).toBeGreaterThan(left.x + left.w - 18.001)
    expect(back.x + back.w).toBeLessThan(right.x + 18.001)
  })

  it('makes a full-overlay back look full width', () => {
    const overlay = netLayout({ ...design, order: promote(design.order, 'back') })
    expect(rect(overlay, 'back').w).toBe(600)
    expect(rect(overlay, 'front').w).toBe(564)
  })

  it('runs the grain along the longer drawn side', () => {
    for (const r of net.rects) expect(r.grainHorizontal).toBe(r.w >= r.h)
  })

  it('leaves an omitted panel out of the drawing entirely', () => {
    const openTop = netLayout({ ...design, present: { ...design.present, top: false } })
    expect(openTop.rects.map((r) => r.panel)).not.toContain('top')
    expect(openTop.rects).toHaveLength(5)
  })

  it('reports a positive overall size for the viewBox', () => {
    expect(net.width).toBeGreaterThan(0)
    expect(net.height).toBeGreaterThan(0)
  })
})

describe('the sections show which panel laps which — the net cannot', () => {
  it('draws the plan with real t-thick walls', () => {
    const plan = sectionLayout(design, 'plan')
    expect(plan.rects.map((r) => r.panel).sort()).toEqual(['back', 'front', 'left', 'right'])
    expect(plan.width).toBe(600)
    expect(plan.height).toBe(400)
    for (const r of plan.rects) expect(Math.min(r.w, r.h)).toBe(18)
  })

  it('shows the sides running through and the front butting between them', () => {
    const plan = sectionLayout(design, 'plan')
    const left = plan.rects.find((r) => r.panel === 'left')!
    const front = plan.rects.find((r) => r.panel === 'front')!
    expect(left.x).toBe(0)
    expect(left.h).toBe(400) // full depth: the side runs through
    expect(front.x).toBe(18) // the front starts inside the left panel's face
    expect(front.w).toBe(564)
  })

  it('flips the vertical axis so the picture matches the object', () => {
    // Plan: front (y = 0) at the BOTTOM of the drawing.
    const plan = sectionLayout(design, 'plan')
    const front = plan.rects.find((r) => r.panel === 'front')!
    const back = plan.rects.find((r) => r.panel === 'back')!
    expect(front.y).toBeGreaterThan(back.y)

    // Elevation: top of the box at the TOP of the drawing.
    const elev = sectionLayout(design, 'elevation')
    const top = elev.rects.find((r) => r.panel === 'top')!
    const bottom = elev.rects.find((r) => r.panel === 'bottom')!
    expect(top.y).toBe(0)
    expect(bottom.y).toBeGreaterThan(top.y)
  })

  it('draws the elevation from the panels a vertical cut crosses', () => {
    const elev = sectionLayout(design, 'elevation')
    expect(elev.rects.map((r) => r.panel).sort()).toEqual(['bottom', 'left', 'right', 'top'])
  })
})

describe('extent', () => {
  it('measures a panel along one axis of the assembled box', () => {
    expect(extent(design, 'left', 'x')).toBe(18) // its own normal: one thickness
    expect(extent(design, 'left', 'y')).toBe(400)
    expect(extent(design, 'left', 'z')).toBe(300)
    expect(extent(design, 'top', 'x')).toBe(564)
  })
})
