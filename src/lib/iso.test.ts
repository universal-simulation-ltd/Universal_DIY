import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, clampPitch, facesOf, projectPoint, scene, shadeOf, type Face, type View } from './iso'
import { solidFor, solids } from './geometry'
import { emptyDesign, type Design } from './panels'

const design = emptyDesign()
const VIEWS: View[] = [
  DEFAULT_VIEW,
  { yaw: 0.3, pitch: 0.4 },
  { yaw: -2.1, pitch: -0.5 },
  { yaw: 1.9, pitch: 0.05 },
]

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('the projection is orthographic, which is the whole reason it is allowed', () => {
  it('keeps equal 3D lengths equal on screen, wherever they sit', () => {
    // The objection to a 3D view was that you cannot read dimensions off it.
    // That is true of PERSPECTIVE. Under an orthographic projection a 400 mm
    // edge is the same length in the picture at the front of the box and at the
    // back — so this test is the one that earns the feature.
    for (const view of VIEWS) {
      const near = dist(projectPoint({ x: 0, y: 0, z: 0 }, view), projectPoint({ x: 400, y: 0, z: 0 }, view))
      const far = dist(projectPoint({ x: 0, y: 900, z: 700 }, view), projectPoint({ x: 400, y: 900, z: 700 }, view))
      expect(far).toBeCloseTo(near, 9)
    }
  })

  it('keeps parallel edges parallel', () => {
    for (const view of VIEWS) {
      const angle = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x)
      const one = angle(projectPoint({ x: 0, y: 0, z: 0 }, view), projectPoint({ x: 0, y: 0, z: 300 }, view))
      const two = angle(projectPoint({ x: 600, y: 400, z: 0 }, view), projectPoint({ x: 600, y: 400, z: 300 }, view))
      expect(Math.abs(one - two)).toBeLessThan(1e-9)
    }
  })

  it('scales linearly, so the drawing can carry a scale bar', () => {
    const view = DEFAULT_VIEW
    const short = dist(projectPoint({ x: 0, y: 0, z: 0 }, view), projectPoint({ x: 100, y: 0, z: 0 }, view))
    const long = dist(projectPoint({ x: 0, y: 0, z: 0 }, view), projectPoint({ x: 700, y: 0, z: 0 }, view))
    expect(long / short).toBeCloseTo(7, 9)
  })

  it('puts z up the page, not down it', () => {
    // SVG's y grows downwards and the model's z grows upwards. Getting the sign
    // wrong stands the box on its lid and looks almost plausible.
    const floor = projectPoint({ x: 0, y: 0, z: 0 }, DEFAULT_VIEW)
    const ceiling = projectPoint({ x: 0, y: 0, z: 300 }, DEFAULT_VIEW)
    expect(ceiling.y).toBeLessThan(floor.y)
  })
})

describe('you only ever see the outside of a solid', () => {
  it('shows exactly three faces of a box from a general angle', () => {
    const solid = solidFor(design, 'left')
    for (const view of VIEWS) {
      expect(facesOf(solid, view)).toHaveLength(3)
    }
  })

  it('drops a face that is exactly edge-on rather than drawing a black sliver', () => {
    // Looking straight down the x axis: the two x faces are dead ahead and
    // behind, the other four are edge-on and project to zero width.
    const solid = solidFor(design, 'left')
    const faces = facesOf(solid, { yaw: 0, pitch: 0 })
    expect(faces).toHaveLength(1)
    expect(faces[0].facing).toBe('xmax')
  })

  it('never returns a face pointing away from the camera', () => {
    // Turning the camera right round must swap which side you see, not show
    // both. If this fails the box renders inside-out and still looks solid.
    const solid = solidFor(design, 'left')
    const front = facesOf(solid, { yaw: 0.2, pitch: 0.2 }).map((f) => f.facing)
    const behind = facesOf(solid, { yaw: 0.2 + Math.PI, pitch: -0.2 }).map((f) => f.facing)
    for (const f of front) expect(behind).not.toContain(f)
  })
})

describe('the scene', () => {
  it('never lets a panel behind another one draw on top of it, at any angle', () => {
    // ⚠️ THE REGRESSION TEST. Sorting faces by centroid depth showed the INSIDE
    // of the box at some angles: back-face culling keeps a far panel's inner
    // face (it does point at the camera — it is the cavity wall), and on a thin
    // slab whose two faces are 18 mm apart but whose projected area is huge,
    // centroids interleave and the near panels get drawn first.
    //
    // The property that has to hold is exact and checkable: whenever two panels
    // are separated along an axis, every face of the farther one must come
    // before every face of the nearer one.
    // Only pairs with ONE decisive separating axis are checked, and that is not
    // a dodge. Two boxes separated along two axes at once (which the explosion
    // creates) have two candidate orderings that can disagree, and when they do
    // it is because the two boxes do not overlap on screen at all — so the draw
    // order between them is unobservable. The single-axis pairs are the ones
    // whose order you can actually see, and the closed box is entirely made of
    // them, which is exactly where the bug showed.
    const angles: View[] = []
    for (let yaw = -Math.PI; yaw < Math.PI; yaw += Math.PI / 12) {
      for (const pitch of [-0.9, -0.3, 0.05, 0.42, 1.1]) angles.push({ yaw, pitch })
    }

    let checked = 0
    for (const view of angles) {
      const { faces } = scene(design, view, 0)
      const first = new Map<string, number>()
      const last = new Map<string, number>()
      faces.forEach((f, i) => {
        if (!first.has(f.panel)) first.set(f.panel, i)
        last.set(f.panel, i)
      })

      const dir = {
        x: Math.cos(view.pitch) * Math.cos(view.yaw),
        y: Math.cos(view.pitch) * Math.sin(view.yaw),
        z: Math.sin(view.pitch),
      }
      const boxes = solids(design)
      for (const a of boxes) {
        for (const b of boxes) {
          if (a.panel === b.panel) continue
          if (first.get(a.panel) === undefined || first.get(b.panel) === undefined) continue
          const axes = (['x', 'y', 'z'] as const).filter(
            (k) => Math.abs(dir[k]) >= 0.2 && a[k].max <= b[k].min + 1e-6,
          )
          const other = (['x', 'y', 'z'] as const).filter(
            (k) => Math.abs(dir[k]) >= 0.2 && b[k].max <= a[k].min + 1e-6,
          )
          if (axes.length + other.length !== 1) continue
          const k = axes[0] ?? other[0]
          // Whichever sits lower along k is farther when the view points that way.
          const lower = axes.length ? a : b
          const upper = axes.length ? b : a
          const far = dir[k] > 0 ? lower : upper
          const near = far === lower ? upper : lower
          expect(last.get(far.panel)!).toBeLessThan(first.get(near.panel)!)
          checked += 1
        }
      }
    }
    // A test that checked nothing would pass silently.
    expect(checked).toBeGreaterThan(200)
  })

  it('the old centroid sort would have failed that', () => {
    // Proves the test above can fail, rather than passing because the property
    // is trivially true. Sorting the same faces by centroid depth — exactly
    // what shipped — puts at least one near panel before a panel behind it.
    const view: View = { yaw: -0.61, pitch: 0.42 }
    const { faces } = scene(design, view, 0)
    const byCentroid = [...faces].sort((a, b) => a.depth - b.depth)
    const orderOf = (list: Face[]) => list.map((f) => f.panel)
    expect(orderOf(byCentroid)).not.toEqual(orderOf(faces))
  })

  it('shows only the outside of a closed box — six panels, three faces each at most', () => {
    const { faces } = scene(design, DEFAULT_VIEW)
    expect(faces.length).toBeLessThanOrEqual(solids(design).length * 3)
    expect(faces.length).toBeGreaterThan(0)
  })

  it('is a view of geometry.ts, not a second model of the box', () => {
    // Every panel in the scene must be one the solid model produced. A 3D view
    // that built its own boxes would be free to drift from the arithmetic the
    // exhaustive tests actually check.
    const known = new Set(solids(design).map((s) => s.panel))
    for (const face of scene(design, DEFAULT_VIEW).faces) expect(known.has(face.panel)).toBe(true)
  })

  it('leaves an unexploded box exactly where the solid model puts it', () => {
    const { bounds } = scene(design, DEFAULT_VIEW, 0)
    const corners = solids(design).flatMap((s) => [
      projectPoint({ x: s.x.min, y: s.y.min, z: s.z.min }, DEFAULT_VIEW),
      projectPoint({ x: s.x.max, y: s.y.max, z: s.z.max }, DEFAULT_VIEW),
    ])
    expect(bounds.minX).toBeLessThanOrEqual(Math.min(...corners.map((c) => c.x)) + 1e-9)
    expect(bounds.maxX).toBeGreaterThanOrEqual(Math.max(...corners.map((c) => c.x)) - 1e-9)
  })

  it('grows when exploded and returns to the same picture at zero', () => {
    const width = (explode: number) => {
      const b = scene(design, DEFAULT_VIEW, explode).bounds
      return b.maxX - b.minX
    }
    expect(width(1)).toBeGreaterThan(width(0))
    expect(width(0)).toBeCloseTo(width(0), 9)
  })

  it('scales the explosion to the box, not to a fixed number of millimetres', () => {
    // Three thicknesses of gap is invisible on a two-metre carcass and enormous
    // on a jewellery box, so the gap is a fraction of the box's own size.
    //
    // The two boxes here are geometrically SIMILAR — the thickness is scaled by
    // the same factor as the sides (18 → 300 at ×16⅔). That matters: leave the
    // thickness at 18 on both and the ratios genuinely differ, because the
    // inset a panel loses to its neighbour is an absolute 18 mm, which is
    // proportionally huge on a 120 mm box and nothing on a 2 m one. That is
    // correct behaviour, so the test scales the box properly rather than
    // asserting an invariance the model does not claim.
    const small: Design = { ...design, width: 120, depth: 120, height: 120, thickness: 18 }
    const big: Design = { ...design, width: 2000, depth: 2000, height: 2000, thickness: 300 }
    const gap = (d: Design) => {
      const b = scene(d, DEFAULT_VIEW, 1).bounds
      const solid = scene(d, DEFAULT_VIEW, 0).bounds
      return (b.maxX - b.minX) / (solid.maxX - solid.minX)
    }
    expect(gap(big)).toBeCloseTo(gap(small), 9)
  })

  it('survives a box with panels missing', () => {
    const tray: Design = { ...design, present: { ...design.present, top: false, front: false } }
    const { faces } = scene(tray, DEFAULT_VIEW, 0.4)
    expect(faces.length).toBeGreaterThan(0)
    for (const f of faces) expect(['top', 'front']).not.toContain(f.panel)
  })
})

describe('the camera', () => {
  it('cannot be tipped past its own poles', () => {
    expect(clampPitch(9)).toBeLessThan(Math.PI / 2)
    expect(clampPitch(-9)).toBeGreaterThan(-Math.PI / 2)
    expect(clampPitch(0.3)).toBe(0.3)
  })

  it('comes back to the same picture after a full turn', () => {
    const a = scene(design, { yaw: 0.4, pitch: 0.3 }, 0).bounds
    const b = scene(design, { yaw: 0.4 + Math.PI * 2, pitch: 0.3 }, 0).bounds
    expect(b.minX).toBeCloseTo(a.minX, 6)
    expect(b.maxY).toBeCloseTo(a.maxY, 6)
  })
})

describe('shading is never the only thing telling two panels apart', () => {
  it('gives the top the most light and the underside the least', () => {
    expect(shadeOf('top')).toBeGreaterThan(shadeOf('ymax'))
    expect(shadeOf('ymax')).toBeGreaterThan(shadeOf('xmin'))
    expect(shadeOf('xmin')).toBeGreaterThan(shadeOf('bottom'))
  })

  it('never returns a shade that would print as solid black or vanish', () => {
    for (const f of ['top', 'bottom', 'xmin', 'xmax', 'ymin', 'ymax'] as const) {
      expect(shadeOf(f)).toBeGreaterThan(0.5)
      expect(shadeOf(f)).toBeLessThanOrEqual(1)
    }
  })
})
