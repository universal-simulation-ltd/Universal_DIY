import { describe, expect, it } from 'vitest'
import { computePartsCutlist, type PartsProject } from './parts'
import { PARTS_FILE_KIND, fromPartsFile, sanitiseParts, toPartsFile } from './storage'

const good: PartsProject = {
  name: 'Frame',
  parts: [
    { id: 'p1', name: 'Stile', project: 'Door', length: 900, width: 60, qty: 2, thickness: 18, material: '18 mm birch ply', grained: true },
    { id: 'p2', name: 'Rail', project: 'Door', length: 500, width: 60, qty: 2, thickness: 18, material: '18 mm birch ply', grained: true },
  ],
  joints: [{ id: 'j1', through: { part: 'p1', end: 'end' }, butt: { part: 'p2', end: 'start' } }],
}

describe('a saved parts list survives the round trip', () => {
  it('comes back identical', () => {
    const file = toPartsFile({ project: good, unit: 'mm', notes: { A: 'good face out' } })
    expect(file.kind).toBe(PARTS_FILE_KIND)
    const back = fromPartsFile(JSON.stringify(file))
    expect(back?.project).toEqual(good)
    expect(back?.notes).toEqual({ A: 'good face out' })
  })

  it('refuses a saved BOX, which is a different model in a different file', () => {
    const boxFile = JSON.stringify({ kind: 'unisim.universal-diy.design', version: 1, design: {} })
    expect(fromPartsFile(boxFile)).toBeNull()
    expect(fromPartsFile('not json at all')).toBeNull()
  })
})

// The same job sanitiseDesign does, and the same reason: a hand-edited file
// must not be able to put NaN into a cut length.
describe('an untrusted parts list cannot reach the arithmetic', () => {
  it('drops rows with a size that is not a positive number', () => {
    const project = sanitiseParts({
      name: 'x',
      parts: [
        { ...good.parts[0], id: 'a', length: 0 },
        { ...good.parts[0], id: 'b', width: 'wide' },
        { ...good.parts[0], id: 'c', thickness: null },
        { ...good.parts[0], id: 'd', qty: 1.5 },
        { ...good.parts[0], id: 'e' },
      ],
      joints: [],
    })
    expect(project?.parts.map((p) => p.id)).toEqual(['e'])
  })

  it('drops duplicate ids rather than letting two rows share one', () => {
    const project = sanitiseParts({ name: 'x', parts: [good.parts[0], { ...good.parts[1], id: 'p1' }], joints: [] })
    expect(project?.parts).toHaveLength(1)
  })

  it('returns null when nothing usable is left', () => {
    expect(sanitiseParts({ name: 'x', parts: [{ id: 'a', length: -1 }], joints: [] })).toBeNull()
    expect(sanitiseParts({ name: 'x' })).toBeNull()
    expect(sanitiseParts(null)).toBeNull()
  })
})

/*
 * Joints get the harder treatment. A joint the model cannot honour deducts
 * NOTHING, and a piece cut one thickness too long is exactly the failure this
 * app exists to prevent — so a bad joint is dropped rather than kept and
 * hoped for. Dropping is safe: an unjoined end is visible on screen as one.
 */
describe('a joint that cannot be honoured is dropped, never kept', () => {
  const withJoints = (joints: unknown[]) =>
    sanitiseParts({ name: 'x', parts: good.parts, joints })

  it('drops a joint pointing at a piece that is not in the file', () => {
    const project = withJoints([{ id: 'j1', through: { part: 'ghost', end: 'end' }, butt: { part: 'p2', end: 'start' } }])
    expect(project?.joints).toEqual([])
    // And the rail keeps its full length, visibly unjoined.
    expect(computePartsCutlist(project!).types.find((t) => t.part === 'Rail')?.length).toBe(500)
  })

  it('drops a joint naming an end that is not an end', () => {
    expect(withJoints([{ id: 'j1', through: { part: 'p1', end: 'middle' }, butt: { part: 'p2', end: 'start' } }])?.joints).toEqual([])
  })

  it('drops a piece joined to itself', () => {
    expect(withJoints([{ id: 'j1', through: { part: 'p1', end: 'start' }, butt: { part: 'p1', end: 'end' } }])?.joints).toEqual([])
  })

  it('keeps the first joint on an end and drops the second', () => {
    const project = withJoints([
      { id: 'j1', through: { part: 'p1', end: 'end' }, butt: { part: 'p2', end: 'start' } },
      { id: 'j2', through: { part: 'p1', end: 'end' }, butt: { part: 'p2', end: 'end' } },
    ])
    expect(project?.joints.map((j) => j.id)).toEqual(['j1'])
  })

  it('leaves a file whose joints are all sound completely alone', () => {
    const project = sanitiseParts(good)
    expect(project).toEqual(good)
    expect(computePartsCutlist(project!).errors).toEqual([])
  })

  // Whatever survives sanitising must compute — that is the contract between
  // the two, and a file that loaded but could not produce a cut list would be
  // an error banner nobody could clear.
  it('always produces something the model accepts', () => {
    const mangled = sanitiseParts({
      name: 'x',
      parts: [...good.parts, { id: 'p3', length: 400, width: 50, qty: 1, thickness: 12 }],
      joints: [
        { id: 'j1', through: { part: 'p1', end: 'end' }, butt: { part: 'p2', end: 'start' } },
        { id: 'j1', through: { part: 'p3', end: 'end' }, butt: { part: 'p2', end: 'end' } },
        { id: 'j9', through: { part: 'p3', end: 'start' }, butt: { part: 'ghost', end: 'end' } },
      ],
    })
    expect(computePartsCutlist(mangled!).errors).toEqual([])
  })
})
