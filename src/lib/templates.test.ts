import { describe, expect, it } from 'vitest'
import { checkValidity } from './geometry'
import { PANEL_IDS, computeCutlist, isValidOrder } from './panels'
import { sanitiseDesign } from './storage'
import { decodeShare, encodeShare } from './share'
import { TEMPLATES, blankDesign, findTemplate, openFaces } from './templates'

// A template is the first thing a visitor touches, and every one of them lands
// straight in the arithmetic. "It looked fine on the card" is not a check — a
// template that produces an error banner instead of a cut list is a broken front
// door, so each one is run all the way through the real model here.

describe('every template is a buildable box', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s', (_id, template) => {
    const cutlist = computeCutlist(template.design)
    expect(cutlist.errors).toEqual([])
    expect(cutlist.pieces.length).toBeGreaterThan(0)
    // Every present panel gets exactly one piece, and nothing else does.
    const expected = PANEL_IDS.filter((p) => template.design.present[p])
    expect(cutlist.pieces.map((p) => p.panel).sort()).toEqual([...expected].sort())
    // Positive cavity, or the box has no inside to put anything in.
    expect(Math.min(cutlist.cavity.x, cutlist.cavity.y, cutlist.cavity.z)).toBeGreaterThan(0)
  })

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s assembles with no overlap or gap', (_id, template) => {
    const report = checkValidity(template.design)
    expect(report.overlaps).toEqual([])
    expect(report.gaps).toEqual([])
  })

  it('uses a strict wrap order over the six panels', () => {
    for (const t of TEMPLATES) expect(isValidOrder(t.design.order)).toBe(true)
  })

  it('has unique ids and a findable one for each', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(findTemplate(id)?.id).toBe(id)
    expect(findTemplate('no-such-template')).toBeUndefined()
  })

  // The landing page hands a template straight to the store, which persists it
  // and can encode it into a link. A template that could not survive its own
  // save/share round trip would be a design the app cannot keep.
  it('survives sanitising and a share round trip unchanged', () => {
    for (const t of TEMPLATES) {
      expect(sanitiseDesign(t.design)).toEqual(t.design)
      expect(decodeShare(encodeShare({ design: t.design, unit: 'mm' }))?.design).toEqual(t.design)
    }
  })
})

describe('the card copy is derived from the design, not typed next to it', () => {
  it('names exactly the omitted panels', () => {
    expect(openFaces(TEMPLATES.find((t) => t.id === 'box')!.design)).toBe('Fully enclosed')
    expect(openFaces(TEMPLATES.find((t) => t.id === 'tray')!.design)).toBe('Open top')
    expect(openFaces(TEMPLATES.find((t) => t.id === 'shelf')!.design)).toBe('Open front')
    expect(openFaces(TEMPLATES.find((t) => t.id === 'cabinet')!.design)).toBe('Open back and front')
  })

  it('agrees with the present flags for every template', () => {
    for (const t of TEMPLATES) {
      const missing = PANEL_IDS.filter((p) => !t.design.present[p])
      const words = openFaces(t.design)
      expect(words.startsWith('Open')).toBe(missing.length > 0)
      // Every omitted panel is actually named, so a card can never quietly drop one.
      for (const p of missing) expect(words.toLowerCase()).toContain(p)
    }
  })
})

describe('the blank start is the calculator default, not a seventh template', () => {
  it('is a valid design with every panel present', () => {
    const design = blankDesign()
    expect(computeCutlist(design).errors).toEqual([])
    expect(PANEL_IDS.every((p) => design.present[p])).toBe(true)
    expect(TEMPLATES.some((t) => t.id === 'blank')).toBe(false)
  })

  it('is a fresh object each time, so the landing page cannot leak edits into it', () => {
    const a = blankDesign()
    a.width = 1
    a.order.reverse()
    expect(blankDesign().width).not.toBe(1)
    expect(blankDesign().order).toEqual(TEMPLATES.find((t) => t.id === 'box')!.design.order)
  })
})
