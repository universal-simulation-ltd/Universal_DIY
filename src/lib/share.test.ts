import { describe, expect, it } from 'vitest'
import { buildShareUrl, decodeShare, encodeShare } from './share'
import { emptyDesign, promote, type Design } from './panels'
import { fromProjectFile, sanitiseDesign, toProjectFile } from './storage'

const design: Design = {
  ...emptyDesign(),
  name: 'Tool box',
  thickness: 19.05,
  order: promote(emptyDesign().order, 'back'),
  present: { left: true, right: true, top: false, bottom: true, back: true, front: true },
}

describe('the design fits in a link, with no backend', () => {
  it('round-trips every field', () => {
    const back = decodeShare(encodeShare({ design, unit: 'in' }))
    expect(back).not.toBeNull()
    expect(back!.unit).toBe('in')
    expect(back!.design).toEqual(design)
  })

  it('keeps the thickness exact — a 3/4 in board must not come back as 19', () => {
    const back = decodeShare(encodeShare({ design, unit: 'mm' }))
    expect(back!.design.thickness).toBe(19.05)
  })

  it('puts the design in the HASH, so it is never sent to a server', () => {
    const url = buildShareUrl({ design, unit: 'mm' }, 'https://opensource.unisim.co.uk/diy/')
    expect(url).toContain('#d=')
    expect(new URL(url).search).toBe('')
  })

  it('refuses a mangled link rather than decoding half a box', () => {
    for (const bad of ['', 'nonsense', '1_600_400', '1_600_400_300_18_LLTBKF_111111_mm_1~x~y']) {
      expect(decodeShare(bad)).toBeNull()
    }
  })

  it('refuses a link whose order is not a strict order over the six panels', () => {
    const ok = encodeShare({ design, unit: 'mm' })
    expect(decodeShare(ok)).not.toBeNull()
    expect(decodeShare(ok.replace('_KLRT', '_LLRT'))).toBeNull()
  })

  it('refuses a link with a non-positive dimension', () => {
    expect(decodeShare('1_0_400_300_18_LRTBKF_111111_mm_1~x~y')).toBeNull()
    expect(decodeShare('1_600_400_300_-18_LRTBKF_111111_mm_1~x~y')).toBeNull()
  })

  it('keeps a decimal thickness in ONE field — the bug the `.` separator had', () => {
    const encoded = encodeShare({ design, unit: 'mm' })
    expect(encoded).toContain('19.05')
    expect(encoded.split('~')[0].split('_')).toHaveLength(9)
  })
})

describe('an untrusted design never reaches the arithmetic', () => {
  it('round-trips a project file', () => {
    const state = { design, unit: 'mm' as const, notes: { A: 'good face out' } }
    const back = fromProjectFile(JSON.stringify(toProjectFile(state)))
    expect(back).toEqual(state)
  })

  it('rejects a file that is not ours', () => {
    expect(fromProjectFile('{}')).toBeNull()
    expect(fromProjectFile('not json')).toBeNull()
    expect(fromProjectFile(JSON.stringify({ kind: 'something.else', design }))).toBeNull()
  })

  it('rejects NaN, strings and negatives where a length belongs', () => {
    // A hand-edited file must not be able to put NaN into a cut size — a cut
    // list is the worst possible place to discover a bad input.
    for (const bad of [{ width: Number.NaN }, { depth: '400' }, { height: -1 }, { thickness: 0 }]) {
      expect(sanitiseDesign({ ...design, ...bad })).toBeNull()
    }
  })

  it('rejects a design with a broken order or no panels at all', () => {
    expect(sanitiseDesign({ ...design, order: ['left', 'left', 'top', 'bottom', 'back', 'front'] })).toBeNull()
    expect(sanitiseDesign({
      ...design,
      present: { left: false, right: false, top: false, bottom: false, back: false, front: false },
    })).toBeNull()
    expect(sanitiseDesign(null)).toBeNull()
    expect(sanitiseDesign('a design')).toBeNull()
  })
})
