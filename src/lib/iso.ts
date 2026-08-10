// ---------------------------------------------------------------------------
// The assembled box, in three dimensions.
//
// WHY THIS IS ORTHOGRAPHIC, AND WHY THERE IS NO 3D LIBRARY HERE
// -------------------------------------------------------------
// The app's own README used to say a 3D preview would never be built, for a
// reason that is still right: "you cannot read dimensions off a perspective
// view, and it cannot be printed". That objection is to PERSPECTIVE, not to
// three dimensions. An ORTHOGRAPHIC projection has neither problem — parallel
// edges stay parallel, a 400 mm edge is the same length wherever it sits in the
// picture, and the whole thing is SVG, so it prints with everything else.
//
// So this is ~150 lines of matrix arithmetic rather than a WebGL dependency.
// That is not asceticism: pulling in a 3D engine would triple the bundle of an
// app whose entire promise is that it is arithmetic in your browser, it would
// not print, and it would put a second, richer model of the box next to
// panels.ts — which is exactly the "two versions that disagree" failure the
// wrap order was designed out of.
//
// IT IS BUILT FROM geometry.ts, NOT FROM A NEW MODEL
// ---------------------------------------------------
// `solids()` already places all six panels in space, and the exhaustive tests
// walk all 720 wrap orders asserting that no two of those solids intersect and
// no edge is left hollow. Projecting them is therefore a VIEW of the checked
// model. Any 3D view that built its own boxes would be a second model free to
// drift, and the first thing anyone would trust.
// ---------------------------------------------------------------------------

import { solids, type Solid } from './geometry'
import { PANEL_AXIS, PANEL_END, type Axis, type Design, type PanelId } from './panels'

export interface Vec3 { x: number; y: number; z: number }
export interface Pt { x: number; y: number }

/** Where the camera is, in radians. Orthographic, so there is no distance. */
export interface View {
  /** Rotation about the vertical (z) axis. */
  yaw: number
  /** Height of the camera above the horizon. */
  pitch: number
}

/**
 * A three-quarter view, which is the one that shows three faces at once and so
 * shows the joint at every visible corner. Not true isometric (35.264°) —
 * slightly lower, because a box is usually wider than it is tall and a true
 * isometric squashes the front face of one.
 */
export const DEFAULT_VIEW: View = { yaw: (-35 * Math.PI) / 180, pitch: (24 * Math.PI) / 180 }

/** The six faces of a cuboid, named by the axis and end they sit on. */
export type Facing = 'top' | 'bottom' | 'xmin' | 'xmax' | 'ymin' | 'ymax'

export interface Face {
  panel: PanelId
  facing: Facing
  points: Pt[]
  /** Distance towards the camera. Larger is nearer; draw in ascending order. */
  depth: number
}

// --- the projection ---------------------------------------------------------
//
// Three unit vectors: where the camera is (`dir`), and the two axes of the
// picture plane (`right`, `up`). Screen y is negated because SVG's y grows
// downwards and the model's z grows upwards, and forgetting that is how a box
// ends up standing on its lid.

function basis(view: View): { dir: Vec3; right: Vec3; up: Vec3 } {
  const { yaw, pitch } = view
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  return {
    dir: { x: cp * cy, y: cp * sy, z: sp },
    right: { x: -sy, y: cy, z: 0 },
    up: { x: -sp * cy, y: -sp * sy, z: cp },
  }
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

export function projectPoint(p: Vec3, view: View): Pt {
  const { right, up } = basis(view)
  return { x: dot(p, right), y: -dot(p, up) }
}

export function depthOf(p: Vec3, view: View): number {
  return dot(p, basis(view).dir)
}

// --- faces ------------------------------------------------------------------

const FACE_NORMAL: Record<Facing, Vec3> = {
  xmin: { x: -1, y: 0, z: 0 },
  xmax: { x: 1, y: 0, z: 0 },
  ymin: { x: 0, y: -1, z: 0 },
  ymax: { x: 0, y: 1, z: 0 },
  bottom: { x: 0, y: 0, z: -1 },
  top: { x: 0, y: 0, z: 1 },
}

const FACINGS = Object.keys(FACE_NORMAL) as Facing[]

/** The four corners of one face of a box, wound consistently. */
function corners(box: Solid, facing: Facing, shift: Vec3): Vec3[] {
  const { x, y, z } = box
  const at = (px: number, py: number, pz: number): Vec3 => ({ x: px + shift.x, y: py + shift.y, z: pz + shift.z })
  switch (facing) {
    case 'xmin': return [at(x.min, y.min, z.min), at(x.min, y.max, z.min), at(x.min, y.max, z.max), at(x.min, y.min, z.max)]
    case 'xmax': return [at(x.max, y.min, z.min), at(x.max, y.max, z.min), at(x.max, y.max, z.max), at(x.max, y.min, z.max)]
    case 'ymin': return [at(x.min, y.min, z.min), at(x.max, y.min, z.min), at(x.max, y.min, z.max), at(x.min, y.min, z.max)]
    case 'ymax': return [at(x.min, y.max, z.min), at(x.max, y.max, z.min), at(x.max, y.max, z.max), at(x.min, y.max, z.max)]
    case 'bottom': return [at(x.min, y.min, z.min), at(x.max, y.min, z.min), at(x.max, y.max, z.min), at(x.min, y.max, z.min)]
    default: return [at(x.min, y.min, z.max), at(x.max, y.min, z.max), at(x.max, y.max, z.max), at(x.min, y.max, z.max)]
  }
}

/**
 * The faces of one solid that point at the camera.
 *
 * Back-face culling, which for a convex box means exactly the three faces you
 * can see — and it is what makes a painter's-algorithm draw look solid without
 * a depth buffer. A face exactly edge-on (normal perpendicular to the view) is
 * dropped: it projects to a zero-width sliver and only ever renders as a stray
 * black line across the drawing.
 */
export function facesOf(solid: Solid, view: View, shift: Vec3 = { x: 0, y: 0, z: 0 }): Face[] {
  const { dir } = basis(view)
  const out: Face[] = []
  for (const facing of FACINGS) {
    if (dot(FACE_NORMAL[facing], dir) <= 1e-9) continue
    const pts = corners(solid, facing, shift)
    const centre: Vec3 = {
      x: pts.reduce((s, p) => s + p.x, 0) / 4,
      y: pts.reduce((s, p) => s + p.y, 0) / 4,
      z: pts.reduce((s, p) => s + p.z, 0) / 4,
    }
    out.push({
      panel: solid.panel,
      facing,
      points: pts.map((p) => projectPoint(p, view)),
      depth: dot(centre, dir),
    })
  }
  return out
}

// --- the whole scene --------------------------------------------------------

export interface Scene {
  faces: Face[]
  /** Bounding box of the projection, in millimetre units. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

/**
 * How far each panel is pushed out along its own normal, as a multiple of the
 * material thickness.
 *
 * An exploded view is not decoration here: pulling the panels apart is the only
 * way to SEE the wrap order — which panel runs through to the outside and which
 * butts into it — on a box that is otherwise closed. The cross-sections say the
 * same thing in two dimensions; this says it in one picture.
 */
export function scene(design: Design, view: View, explode = 0): Scene {
  const all = solids(design)
  const faces: Face[] = []

  for (const solid of all) {
    const normal: Axis = PANEL_AXIS[solid.panel]
    const away = PANEL_END[solid.panel] === 'min' ? -1 : 1
    // Scaled by the box's own size, not by a fixed number of millimetres: a
    // 3 × thickness gap is invisible on a 2 m carcass and enormous on a
    // jewellery box.
    const reach = Math.max(design.width, design.depth, design.height) * 0.35 * explode
    const shift: Vec3 = { x: 0, y: 0, z: 0 }
    shift[normal] = away * reach
    faces.push(...facesOf(solid, view, shift))
  }

  // Painter's algorithm: farthest first. Exact for the disjoint, axis-aligned,
  // back-face-culled slabs this app produces — `checkValidity` is what
  // guarantees they are disjoint, so the sort has nothing pathological to sort.
  faces.sort((a, b) => a.depth - b.depth)

  const xs = faces.flatMap((f) => f.points.map((p) => p.x))
  const ys = faces.flatMap((f) => f.points.map((p) => p.y))
  return {
    faces,
    bounds: {
      minX: xs.length ? Math.min(...xs) : 0,
      minY: ys.length ? Math.min(...ys) : 0,
      maxX: xs.length ? Math.max(...xs) : 0,
      maxY: ys.length ? Math.max(...ys) : 0,
    },
  }
}

/**
 * How lit a face is, 0–1. Top brightest, then the two sides.
 *
 * ⚠️ NOT the only thing that separates the panels — print drops every fill to
 * white, and a workshop printer would turn these into four indistinguishable
 * greys anyway. Every face is also outlined, which is what carries the form on
 * paper. The shading is there so the screen version reads as a solid at a
 * glance, never as the only way to tell two panels apart.
 */
export function shadeOf(facing: Facing): number {
  if (facing === 'top') return 1
  if (facing === 'bottom') return 0.55
  if (facing === 'xmin' || facing === 'xmax') return 0.78
  return 0.88
}

/** Clamp the camera so the box can never be tipped past its own poles. */
export function clampPitch(pitch: number): number {
  const limit = (89 * Math.PI) / 180
  return Math.max(-limit, Math.min(limit, pitch))
}
