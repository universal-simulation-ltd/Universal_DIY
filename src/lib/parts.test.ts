import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import {
  UNGROUPED,
  addJoint,
  computePartsCutlist,
  countFreeEnds,
  cutLengthOf,
  emptyPartsProject,
  jointAt,
  letterFor,
  lostAt,
  newPart,
  removeJoint,
  removePart,
  swapJoint,
  whyNotJoinable,
  type Part,
  type PartsProject,
} from './parts'

function part(seed: Partial<Part> & { id: string }): Part {
  return {
    name: seed.id, project: '', length: 600, width: 100, qty: 1,
    thickness: 18, material: '18 mm birch ply', grained: true, ...seed,
  }
}

/**
 * A face frame: two full-height stiles, two rails butting between them.
 *
 * The top rail meets the TOP end of each stile and the bottom rail the BOTTOM
 * end — one joint per end, which is the constraint. Both rails butting into the
 * same end of one stile is not a frame, it is two rails in the same place, and
 * the model refuses it.
 */
function frame(): PartsProject {
  const stileL = part({ id: 'p1', name: 'Left stile', length: 900, width: 60 })
  const stileR = part({ id: 'p2', name: 'Right stile', length: 900, width: 60 })
  const railT = part({ id: 'p3', name: 'Top rail', length: 500, width: 60 })
  const railB = part({ id: 'p4', name: 'Bottom rail', length: 500, width: 60 })
  let project: PartsProject = { name: 'Frame', parts: [stileL, stileR, railT, railB], joints: [] }
  const join = (through: { part: string; end: 'start' | 'end' }, butt: { part: string; end: 'start' | 'end' }) => {
    project = { ...project, joints: addJoint(project, through, butt) }
  }
  join({ part: 'p1', end: 'end' }, { part: 'p3', end: 'start' })    // top rail into left stile
  join({ part: 'p2', end: 'end' }, { part: 'p3', end: 'end' })      // top rail into right stile
  join({ part: 'p1', end: 'start' }, { part: 'p4', end: 'start' })  // bottom rail into left stile
  join({ part: 'p2', end: 'start' }, { part: 'p4', end: 'end' })    // bottom rail into right stile
  return project
}

describe('the deduction is the box formula with the box taken out', () => {
  it('cuts an unjoined piece to exactly the length typed', () => {
    const project: PartsProject = { name: 'x', parts: [part({ id: 'p1', length: 742.5 })], joints: [] }
    expect(cutLengthOf(project, project.parts[0])).toBe(742.5)
    expect(computePartsCutlist(project).types[0].length).toBe(742.5)
  })

  it('takes one thickness off the butt piece at each joined end', () => {
    const project = frame()
    const rail = project.parts.find((p) => p.id === 'p3')!
    expect(cutLengthOf(project, rail)).toBe(500 - 18 - 18)
    // The stiles run through at both joints and lose nothing.
    for (const id of ['p1', 'p2']) {
      expect(cutLengthOf(project, project.parts.find((p) => p.id === id)!)).toBe(900)
    }
  })

  // The first thing a hand calculation gets wrong, and a case the box model
  // cannot even express because a box has one thickness throughout.
  it('deducts the PARTNER’s thickness, not the piece’s own', () => {
    const stile = part({ id: 'p1', name: 'Stile', thickness: 18 })
    const rail = part({ id: 'p2', name: 'Rail', length: 400, thickness: 12 })
    let project: PartsProject = { name: 'x', parts: [stile, rail], joints: [] }
    project = { ...project, joints: addJoint(project, { part: 'p1', end: 'end' }, { part: 'p2', end: 'start' }) }
    expect(cutLengthOf(project, rail)).toBe(400 - 18)
  })

  it('never deducts the width', () => {
    const project = frame()
    for (const type of computePartsCutlist(project).types) expect(type.width).toBe(60)
  })

  it('moves the deduction when the joint is swapped, and keeps the joint', () => {
    let project = frame()
    const jointId = project.joints[0].id
    project = { ...project, joints: swapJoint(project.joints, jointId) }
    expect(project.joints).toHaveLength(4)
    // The rail now runs through at that end and the stile butts into it.
    expect(cutLengthOf(project, project.parts.find((p) => p.id === 'p3')!)).toBe(500 - 18)
    expect(cutLengthOf(project, project.parts.find((p) => p.id === 'p1')!)).toBe(900 - 18)
  })

  it('gives the length back when the joint is removed', () => {
    let project = frame()
    project = { ...project, joints: removeJoint(project.joints, project.joints[0].id) }
    expect(cutLengthOf(project, project.parts.find((p) => p.id === 'p3')!)).toBe(500 - 18)
  })
})

// The reason the model is {through, butt} and not two booleans per end — the
// same argument that rejected six "extends / sits inside" switches for the box.
describe('every joint list is buildable by construction', () => {
  it('cannot express two pieces claiming the same corner, or neither claiming it', () => {
    const project = frame()
    for (const joint of project.joints) {
      // Exactly one side of each joint runs through and exactly one butts.
      expect(joint.through).not.toEqual(joint.butt)
      expect(lostAt(project, joint.through)).toBe(0)
      expect(lostAt(project, joint.butt)).toBeGreaterThan(0)
    }
  })

  it('holds under every swap of every joint', () => {
    const base = frame()
    // 2^4 combinations of which side of each joint runs through.
    for (let mask = 0; mask < 1 << base.joints.length; mask++) {
      let project = base
      base.joints.forEach((j, i) => {
        if (mask & (1 << i)) project = { ...project, joints: swapJoint(project.joints, j.id) }
      })
      for (const joint of project.joints) {
        expect(lostAt(project, joint.through)).toBe(0)
        expect(lostAt(project, joint.butt)).toBe(18)
      }
      // And the cut list is a real one in all sixteen.
      const cutlist = computePartsCutlist(project)
      expect(cutlist.errors).toEqual([])
      expect(cutlist.types).toHaveLength(4)
      for (const t of cutlist.types) expect(t.length).toBeGreaterThan(0)
    }
  })
})

describe('an end joins at most once, and never to its own piece', () => {
  it('refuses a second joint on an end that already has one, with a reason', () => {
    const project = frame()
    const reason = whyNotJoinable(project, { part: 'p1', end: 'end' }, { part: 'p3', end: 'end' })
    expect(reason).toMatch(/already joined/)
    expect(addJoint(project, { part: 'p1', end: 'end' }, { part: 'p3', end: 'end' })).toEqual(project.joints)
  })

  it('refuses a piece joined to itself', () => {
    const project = frame()
    expect(whyNotJoinable(project, { part: 'p3', end: 'start' }, { part: 'p3', end: 'end' }))
      .toMatch(/cannot be joined to itself/)
  })

  it('allows a free end and says nothing about it', () => {
    const project: PartsProject = { name: 'x', parts: [part({ id: 'p1' }), part({ id: 'p2' })], joints: [] }
    expect(whyNotJoinable(project, { part: 'p1', end: 'end' }, { part: 'p2', end: 'start' })).toBeNull()
    expect(countFreeEnds(project)).toBe(4)
  })
})

describe('deleting a piece takes its joints with it', () => {
  it('leaves no joint pointing at a piece that is gone', () => {
    const project = removePart(frame(), 'p1')
    expect(project.parts).toHaveLength(3)
    expect(project.joints).toHaveLength(2)
    for (const j of project.joints) {
      expect(project.parts.some((p) => p.id === j.through.part)).toBe(true)
      expect(project.parts.some((p) => p.id === j.butt.part)).toBe(true)
    }
    // The rails get their length back at the end that lost the stile.
    expect(cutLengthOf(project, project.parts.find((p) => p.id === 'p3')!)).toBe(500 - 18)
    expect(computePartsCutlist(project).errors).toEqual([])
  })

  it('would otherwise be a piece cut one thickness too long — so a dangling joint blocks', () => {
    const project = frame()
    const orphaned: PartsProject = { ...project, parts: project.parts.filter((p) => p.id !== 'p1') }
    const cutlist = computePartsCutlist(orphaned)
    expect(cutlist.errors.join(' ')).toMatch(/no longer in the list/)
    expect(cutlist.types).toEqual([])
  })
})

describe('bad input stops the cut list rather than annotating it', () => {
  const bad = (patch: Partial<Part>) => computePartsCutlist({
    name: 'x', parts: [part({ id: 'p1', ...patch })], joints: [],
  })

  it.each([
    ['zero length', { length: 0 }, /length must be a positive/],
    ['negative width', { width: -5 }, /width must be a positive/],
    ['NaN thickness', { thickness: Number.NaN }, /thickness must be a positive/],
    ['fractional quantity', { qty: 2.5 }, /whole number/],
    ['zero quantity', { qty: 0 }, /whole number/],
  ])('%s', (_label, patch, pattern) => {
    const cutlist = bad(patch)
    expect(cutlist.errors.join(' ')).toMatch(pattern)
    expect(cutlist.types).toEqual([])
    expect(cutlist.pieces).toEqual([])
  })

  it('blocks when the joints take off more than the length', () => {
    const thick = part({ id: 'p1', name: 'Slab', thickness: 40 })
    const short = part({ id: 'p2', name: 'Stub', length: 60, thickness: 40 })
    let project: PartsProject = { name: 'x', parts: [thick, short], joints: [] }
    project = { ...project, joints: addJoint(project, { part: 'p1', end: 'start' }, { part: 'p2', end: 'start' }) }
    project = { ...project, joints: addJoint(project, { part: 'p1', end: 'end' }, { part: 'p2', end: 'end' }) }
    const cutlist = computePartsCutlist(project)
    expect(cutlist.errors.join(' ')).toMatch(/Stub works out at -20 mm/)
    expect(cutlist.types).toEqual([])
  })

  it('treats an empty list as an empty page, not as an error', () => {
    const cutlist = computePartsCutlist({ name: 'x', parts: [], joints: [] })
    expect(cutlist.errors).toEqual([])
    expect(cutlist.types).toEqual([])
  })
})

describe('one cut, several projects', () => {
  const mixed = (): PartsProject => ({
    name: 'Saturday',
    parts: [
      part({ id: 'p1', name: 'Shelf', project: 'Bookcase', qty: 3, length: 800, width: 250 }),
      part({ id: 'p2', name: 'Side', project: 'Bookcase', qty: 2, length: 1800, width: 250 }),
      part({ id: 'p3', name: 'Lid', project: 'Toy box', qty: 1, length: 600, width: 400 }),
      part({ id: 'p4', name: 'Spare', project: '', qty: 1, length: 300, width: 300 }),
    ],
    joints: [],
  })

  it('groups by project and collects unassigned pieces under one heading', () => {
    const groups = computePartsCutlist(mixed()).groups
    expect(groups.map((g) => g.project)).toEqual(['Bookcase', 'Toy box', UNGROUPED])
    expect(groups[0].pieces).toBe(5)
    expect(groups[0].area).toBe(3 * 800 * 250 + 2 * 1800 * 250)
  })

  it('totals every project together — that is the sheet you buy', () => {
    const cutlist = computePartsCutlist(mixed())
    expect(cutlist.totalArea).toBe(cutlist.groups.reduce((s, g) => s + g.area, 0))
  })

  // Two rows the same size in two projects must stay two rows, or the tick
  // boxes stop belonging to a project.
  it('never merges rows by size', () => {
    const project: PartsProject = {
      name: 'x',
      parts: [
        part({ id: 'p1', name: 'Shelf', project: 'A', length: 800, width: 250 }),
        part({ id: 'p2', name: 'Shelf', project: 'B', length: 800, width: 250 }),
      ],
      joints: [],
    }
    const cutlist = computePartsCutlist(project)
    expect(cutlist.types).toHaveLength(2)
    expect(cutlist.types.map((t) => t.letter)).toEqual(['A', 'B'])
  })

  it('gives every physical piece its own tick-box label', () => {
    const cutlist = computePartsCutlist(mixed())
    expect(cutlist.types[0].labels).toEqual(['A1', 'A2', 'A3'])
    expect(cutlist.types.flatMap((t) => t.labels)).toHaveLength(7)
  })
})

describe('the CSV carries a mixed-stock list without a second exporter', () => {
  it('writes each row’s own material and falls back only when there is none', () => {
    const project: PartsProject = {
      name: 'x',
      parts: [
        part({ id: 'p1', name: 'Ply piece', material: '18 mm birch ply' }),
        part({ id: 'p2', name: 'MDF piece', material: '12 mm MDF', thickness: 12, grained: false }),
      ],
      joints: [],
    }
    const csv = toCsv(computePartsCutlist(project).types, 'unused fallback')
    const rows = csv.trim().split('\n')
    expect(rows[1]).toBe('600,100,1,A,18 mm birch ply,along length,')
    expect(rows[2]).toBe('600,100,1,B,12 mm MDF,none,')
    expect(csv).not.toContain('unused fallback')
  })
})

describe('labels survive a list longer than the alphabet', () => {
  it('runs A…Z then AA, AB — never a letter that collides with a piece label', () => {
    expect(letterFor(0)).toBe('A')
    expect(letterFor(25)).toBe('Z')
    expect(letterFor(26)).toBe('AA')
    expect(letterFor(27)).toBe('AB')
    expect(letterFor(51)).toBe('AZ')
    expect(letterFor(52)).toBe('BA')
    const seen = new Set(Array.from({ length: 300 }, (_, i) => letterFor(i)))
    expect(seen.size).toBe(300)
  })
})

describe('adding rows', () => {
  it('inherits the material, thickness and project of the row above', () => {
    const first = part({ id: 'p1', project: 'Bookcase', thickness: 12, material: '12 mm MDF', grained: false })
    const next = newPart([first])
    expect(next).toMatchObject({ id: 'p2', project: 'Bookcase', thickness: 12, material: '12 mm MDF', grained: false })
  })

  it('never reuses an id, even after a delete from the middle', () => {
    const parts = [part({ id: 'p1' }), part({ id: 'p2' }), part({ id: 'p3' })]
    const afterDelete = parts.filter((p) => p.id !== 'p2')
    expect(newPart(afterDelete).id).toBe('p4')
  })

  it('opens on a list that already computes', () => {
    const project = emptyPartsProject()
    const cutlist = computePartsCutlist(project)
    expect(cutlist.errors).toEqual([])
    expect(cutlist.types).toHaveLength(2)
    expect(project.joints).toEqual([])
    expect(jointAt(project.joints, { part: project.parts[0].id, end: 'start' })).toBeUndefined()
  })
})

describe('the sheet says which piece laps which', () => {
  it('writes a plain-English line per joint', () => {
    const cutlist = computePartsCutlist(frame())
    expect(cutlist.jointSummary).toHaveLength(4)
    expect(cutlist.jointSummary[0]).toBe('Top rail’s left end butts into Left stile — 18 mm off Top rail.')
  })

  it('says out loud when nothing is joined', () => {
    const cutlist = computePartsCutlist(emptyPartsProject())
    expect(cutlist.warnings.join(' ')).toMatch(/No joints/)
  })

  it('says nothing about free ends when a frame closes up and uses all eight', () => {
    expect(countFreeEnds(frame())).toBe(0)
    expect(computePartsCutlist(frame()).warnings).toEqual([])
  })

  it('counts the ends left free when only some are joined', () => {
    const project = removeJoint(frame().joints, 'j1')
    const cutlist = computePartsCutlist({ ...frame(), joints: project })
    expect(cutlist.warnings.join(' ')).toMatch(/^2 ends are not joined/)
  })
})
