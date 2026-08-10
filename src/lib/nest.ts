// ---------------------------------------------------------------------------
// The sheet optimiser.
//
// WHY THIS IS GUILLOTINE-CONSTRAINED, AND WHY THAT IS NOT A LIMITATION
// --------------------------------------------------------------------
// Sheet goods get cut on a table saw or a track saw, and both can only make
// cuts that run edge to edge across whatever is in front of them. So a layout
// is only useful if every piece can be freed by a sequence of full-width cuts —
// a GUILLOTINE layout. A free-nesting packer (the kind a generic 2D nesting
// library gives you) will happily emit an arrangement that packs tighter and
// that nobody with a table saw can cut. It would look better and be worthless.
//
// This matters twice over, because the guillotine problem is also the EASIER
// one. Shelf packing — lay pieces side by side in a strip, start a new strip
// when the strip is full — is guillotine-valid by construction: one crosscut
// frees each strip, then rips free the pieces along it. There is no separate
// "is this cuttable?" check to get wrong, because nothing else can be built.
//
// WHAT IT MODELS, AND WHY EACH ONE IS NOT OPTIONAL
// ------------------------------------------------
//   * KERF — the saw blade turns 3 mm of wood into dust at every cut, and ten
//     cuts is 30 mm. A packer that ignores kerf produces layouts that fit on
//     paper and are one piece short in the workshop. Between two pieces
//     separated by a cut there must be a full kerf of space; n pieces in a
//     strip need n−1 kerfs, and the same between strips.
//   * GRAIN LOCK — a piece whose grain runs along its length cannot be turned
//     90°, so half the orientations are simply unavailable. This is the single
//     biggest reason a real layout is worse than the theoretical optimum, and
//     it is why the cut list has a Grain column at all. Sheet grain is taken to
//     run along the sheet's LONG dimension, which is how ply and MDF are sold.
//   * TRIM — factory edges are rarely square or undamaged, so the usable sheet
//     is smaller than the nominal sheet. Default 10 mm off one long and one
//     short edge; everything below is measured from the trimmed corner.
//
// HONEST LIMITS — stated in the UI, not just here
// -----------------------------------------------
// This returns a GOOD layout, not a proven optimum. 2D cutting stock is NP-hard
// and an exact solver is wildly disproportionate at the six-to-thirty pieces
// this app produces. It is DETERMINISTIC — a fixed seed, best-of-N — because a
// layout that changes on refresh destroys the one thing a cutting plan needs to
// be, which is the same plan you had five minutes ago. It assumes one sheet
// size and one material per plan (a mixed list is packed as one plan per
// material + thickness). It knows nothing about voids, warp or defects in a
// real sheet. And a piece longer than the stock is reported as impossible
// rather than quietly dropped or squeezed in rotated.
// ---------------------------------------------------------------------------

import type { Sheet } from './materials'

/** A piece to place. Sizes are mm; `length` is always the along-grain one. */
export interface NestPiece {
  /** Written on the layout. A type letter ('A') or a piece label ('A2'). */
  label: string
  length: number
  width: number
  qty: number
  /** Grain-locked: the length must run along the sheet's long axis. */
  grained: boolean
  material: string
  thickness: number
}

/**
 * A piece of stock you already own.
 *
 * ⚠️ NO TRIM IS TAKEN OFF AN OFFCUT, and that is deliberate rather than an
 * omission. The trim allowance exists because a factory edge is rarely square;
 * an offcut's edges came off your own saw, so they already are. Deducting 10 mm
 * again would quietly shrink every offcut in the rack and send somebody to buy
 * a sheet they did not need.
 */
export interface Offcut {
  id: string
  /** mm, as measured. Which way round makes no difference — it is not grained stock. */
  w: number
  h: number
  qty: number
}

export interface NestOptions {
  sheet: Sheet
  /** Saw kerf, mm. The width of wood each cut destroys. */
  kerf: number
  /** Trimmed off one long and one short edge, mm. Full sheets only. */
  trim: number
  /** Stock you already own. Used up before any sheet is bought. */
  offcuts?: readonly Offcut[]
  /**
   * Randomised restarts over the piece ordering. A few hundred is plenty at
   * this scale — the search is milliseconds — and more buys almost nothing.
   */
  iterations?: number
  /** Fixed by default. Changing it changes the layout, which is why it isn't. */
  seed?: number
}

export interface Placement {
  label: string
  /** mm from the trimmed corner. x runs along the sheet's long axis. */
  x: number
  y: number
  /** As placed. `w` is along x. */
  w: number
  h: number
  /** True when the piece was turned 90° from its cut-list orientation. */
  rotated: boolean
}

export interface SheetLayout {
  /** 1-based across every layout in the plan. A stable React key, not a label. */
  index: number
  /**
   * "Sheet 2 of 3" — 1-based among the sheets you BUY, and null for an offcut.
   *
   * Not the same as `index`, and the difference is the whole point: numbering
   * every layout in one run produces "Sheet 3 of 4" on a plan that buys two
   * sheets, which reads as two missing sheets rather than as two offcuts.
   */
  sheetNo: number | null
  /** What this is cut from: a bought sheet, or an offcut you already had. */
  stock: { w: number; h: number; label: string; isOffcut: boolean }
  placements: Placement[]
  /** Sum of placed piece areas, mm². */
  usedArea: number
  /** Top edge of the highest strip. Everything above it is one clean offcut. */
  usedHeight: number
  /** The full-width strip left over, when it is big enough to be worth keeping. */
  offcut: { w: number; h: number } | null
}

export interface NestResult {
  sheets: SheetLayout[]
  sheet: Sheet
  /** The sheet after trimming — what the packer actually had to work with. */
  usable: { w: number; h: number }
  kerf: number
  trim: number
  /** Sum of every placed piece's area, mm². */
  pieceArea: number
  /** Full sheets you have to buy. Offcuts you already own are not counted. */
  sheetsBought: number
  /** How many of your declared offcuts the plan actually consumed. */
  offcutsUsed: number
  /** `sheetsBought` × the NOMINAL sheet area — what you pay for. */
  boughtArea: number
  /** Of the sheets bought, the share that does not end up as a piece. */
  wastePct: number
  /** Pieces that do not fit an empty trimmed sheet at any allowed orientation. */
  oversize: string[]
  /** How many pieces could not be rotated. Drives the grain note. */
  grainLocked: number
  warnings: string[]
  /** Rendered verbatim next to the layout. Never paraphrase it away. */
  caveat: string
}

/** Below this a leftover strip is sawdust, not stock worth putting on a rack. */
const MIN_OFFCUT = 100

export const DEFAULT_KERF = 3
export const DEFAULT_TRIM = 10
const DEFAULT_ITERATIONS = 400
const DEFAULT_SEED = 0x5eed

export const NEST_CAVEAT =
  'A good layout, not a proven optimum — and the same design always gives the same layout, ' +
  'so a plan you printed this morning is still the plan. It assumes a flat, square, defect-free ' +
  'sheet: check yours for voids and damage before you commit a cut.'

// --- the deterministic part -------------------------------------------------
//
// A seeded PRNG rather than Math.random(), and this is not a detail. The search
// is randomised, so with Math.random() the same box would lay out differently
// on every render — a diagram that reshuffles while you are reading it, and a
// printed plan that cannot be reproduced. mulberry32 is nine lines and makes
// the whole optimiser a pure function of its inputs.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- items ------------------------------------------------------------------

interface Item {
  label: string
  length: number
  width: number
  grained: boolean
  /**
   * Stand this piece up when it opens a strip, instead of laying it flat.
   *
   * A search variable, not a property of the piece — and it has to be one.
   * Laying a piece flat is the right default (a short strip leaves more sheet
   * for everything after it) and it is sometimes catastrophically wrong: three
   * 1180 × 700 panels laid flat need TWO sheets, because a second 700 mm strip
   * will not fit under the first. Stood upright they are three 700 mm-wide
   * pieces in one 1180 mm strip, and they fit on ONE sheet with room to spare.
   * A search that only reorders the queue can never find that, however long it
   * runs, because every ordering makes the same wrong turn.
   */
  flip: boolean
}

interface Orientation {
  w: number
  h: number
  rotated: boolean
}

/**
 * The ways this piece may sit on the sheet.
 *
 * One for a grained piece: the grain runs along the sheet's long axis and that
 * is the end of it. Two for an ungrained one — and only two, because the
 * layouts are axis-aligned by construction. A square piece has one either way;
 * offering it twice would double the search for nothing.
 */
export function orientationsOf(item: Item): Orientation[] {
  const upright: Orientation = { w: item.length, h: item.width, rotated: false }
  if (item.grained || item.length === item.width) return [upright]
  return [upright, { w: item.width, h: item.length, rotated: true }]
}

/** One entry per physical piece — the packer places pieces, not rows. */
function expand(pieces: readonly NestPiece[]): Item[] {
  const out: Item[] = []
  for (const p of pieces) {
    const qty = Math.max(0, Math.floor(p.qty))
    for (let i = 0; i < qty; i += 1) {
      out.push({
        // Labelled per piece so two copies of type A read A1 and A2 on the
        // drawing. Somebody standing at a saw needs to know which one this is.
        label: qty > 1 ? `${p.label}${i + 1}` : p.label,
        length: p.length,
        width: p.width,
        grained: p.grained,
        flip: false,
      })
    }
  }
  return out
}

// --- the packer -------------------------------------------------------------
//
// Shelf / first-fit over guillotine strips. A shelf is a horizontal strip the
// full width of the sheet, as tall as the tallest piece in it; pieces are laid
// left to right along it. First fit is across ALL open sheets and all their
// shelves, not just the newest — a small piece late in the order very often
// fits a gap left on sheet 1, and only looking at the last sheet throws that
// away.

interface Shelf {
  y: number
  h: number
  /** Where the next piece starts. Already includes the kerf after the last. */
  x: number
}

/**
 * One piece of stock the packer may open — a full sheet, or an offcut you
 * already own. `w`/`h` are USABLE dimensions, trim already deducted.
 */
interface StockUnit {
  w: number
  h: number
  label: string
  isOffcut: boolean
}

interface WorkSheet {
  stock: StockUnit
  shelves: Shelf[]
  /** Top edge of the highest shelf. */
  used: number
  placements: Placement[]
  usedArea: number
}

/**
 * `offcuts` are tried, in the order given, before a new full sheet is opened —
 * which is the whole point of declaring them. `full` is unlimited.
 */
function packOrder(items: readonly Item[], offcuts: readonly StockUnit[], full: StockUnit, kerf: number): WorkSheet[] {
  const sheets: WorkSheet[] = []
  const spent = new Set<number>()

  const openShelf = (sheet: WorkSheet, item: Item): boolean => {
    const y = sheet.used === 0 && sheet.shelves.length === 0 ? 0 : sheet.used + kerf
    // Shortest orientation that fits, unless the search has asked for this one
    // to stand up: a strip costs its own height in sheet, so laid flat is the
    // right default and `flip` is how the search escapes it.
    const fits = orientationsOf(item)
      .filter((o) => o.w <= sheet.stock.w && y + o.h <= sheet.stock.h)
      .sort((a, b) => a.h - b.h || b.w - a.w)
    const o = item.flip ? fits[fits.length - 1] : fits[0]
    if (!o) return false
    sheet.shelves.push({ y, h: o.h, x: o.w + kerf })
    sheet.placements.push({ label: item.label, x: 0, y, w: o.w, h: o.h, rotated: o.rotated })
    sheet.usedArea += o.w * o.h
    sheet.used = y + o.h
    return true
  }

  for (const item of items) {
    let placed = false

    for (const sheet of sheets) {
      // Best fit within the open shelves: the orientation that wastes the least
      // shelf height. Filling a tall shelf with a short piece is how the next
      // tall piece ends up opening a shelf it did not need.
      let best: { shelf: Shelf; o: Orientation; slack: number } | null = null
      for (const shelf of sheet.shelves) {
        for (const o of orientationsOf(item)) {
          if (o.h > shelf.h || shelf.x + o.w > sheet.stock.w) continue
          const slack = shelf.h - o.h
          if (!best || slack < best.slack) best = { shelf, o, slack }
        }
      }
      if (best) {
        sheet.placements.push({
          label: item.label, x: best.shelf.x, y: best.shelf.y, w: best.o.w, h: best.o.h, rotated: best.o.rotated,
        })
        sheet.usedArea += best.o.w * best.o.h
        best.shelf.x += best.o.w + kerf
        placed = true
        break
      }
      if (openShelf(sheet, item)) {
        placed = true
        break
      }
    }

    if (placed) continue

    // Nothing open will take it, so open new stock. An offcut you already own
    // is free, so every one that fits is tried before a sheet you have to buy —
    // in ascending area, which keeps the big offcuts intact for the big pieces
    // instead of spending a 1200 × 900 on a drawer bottom.
    let opened: WorkSheet | null = null
    for (let i = 0; i < offcuts.length; i += 1) {
      if (spent.has(i)) continue
      const candidate: WorkSheet = { stock: offcuts[i], shelves: [], used: 0, placements: [], usedArea: 0 }
      if (openShelf(candidate, item)) {
        spent.add(i)
        opened = candidate
        break
      }
    }

    if (!opened) {
      opened = { stock: full, shelves: [], used: 0, placements: [], usedArea: 0 }
      // Pre-filtered by `fitsSheet`, so this cannot fail — but if it ever did,
      // silently dropping the piece is the one outcome that must not happen.
      if (!openShelf(opened, item)) {
        throw new Error(`${item.label} does not fit an empty sheet — it should have been reported as oversize.`)
      }
    }
    sheets.push(opened)
  }

  return sheets
}

/**
 * Lower is better: fewer sheets first, then less sheet height consumed.
 *
 * The second term is what turns "it fits" into a plan worth cutting — it packs
 * the strips down the sheet so the leftover is one deep offcut you can keep,
 * rather than the same area spread as four useless slivers.
 */
function score(sheets: readonly WorkSheet[]): number {
  // Counted in SHEETS BOUGHT, not sheets used. An offcut is already in the rack
  // and paid for, so a plan that consumes four offcuts and one sheet beats one
  // that consumes two sheets — which is the entire reason for declaring them.
  const bought = sheets.filter((s) => !s.stock.isOffcut).length
  return bought * 1e9 + sheets.reduce((sum, s) => sum + s.used, 0)
}

function fitsSheet(item: Item, usableW: number, usableH: number): boolean {
  return orientationsOf(item).some((o) => o.w <= usableW && o.h <= usableH)
}

/**
 * A small random change to a candidate — a couple of swaps, a piece moved
 * somewhere else in the queue, or one piece stood up instead of laid flat.
 *
 * NOT a full shuffle, and that was measured rather than assumed. Restarting
 * from a fresh random order (which is what "randomised restart" usually means)
 * turned out to improve the layout on ONE of five realistic cut lists and never
 * to save a sheet: first-fit-decreasing is already close to the best a shelf
 * packer can do, and a random permutation is so much worse that best-of-2000 of
 * them just re-elects the heuristic. Perturbing the best candidate found so far
 * searches the neighbourhood that actually contains the improvements.
 */
function perturb(items: readonly Item[], rand: () => number): Item[] {
  const out = [...items]
  if (out.length < 1) return out
  const changes = 1 + Math.floor(rand() * 3)
  for (let n = 0; n < changes; n += 1) {
    const i = Math.floor(rand() * out.length)
    const j = Math.floor(rand() * out.length)
    const roll = rand()
    if (roll < 0.35 && out.length > 1) {
      ;[out[i], out[j]] = [out[j], out[i]]
    } else if (roll < 0.7 && out.length > 1) {
      const [moved] = out.splice(i, 1)
      out.splice(j, 0, moved)
    } else {
      // Copied, never mutated: the same Item object appears in every candidate
      // ordering, so flipping it in place would silently rewrite the layouts
      // already scored and make the search's own comparisons meaningless.
      out[i] = { ...out[i], flip: !out[i].flip }
    }
  }
  return out
}

/** The same pieces with every one of them stood up. */
function allFlipped(items: readonly Item[]): Item[] {
  return items.map((i) => ({ ...i, flip: true }))
}

// --- the whole plan ---------------------------------------------------------

export function nest(pieces: readonly NestPiece[], options: NestOptions): NestResult {
  const { sheet, kerf, trim } = options
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const long = Math.max(sheet.w, sheet.h)
  const short = Math.min(sheet.w, sheet.h)
  const usableW = long - trim
  const usableH = short - trim

  const warnings: string[] = []
  const all = expand(pieces)
  const oversize: string[] = []
  const items: Item[] = []
  for (const item of all) {
    if (fitsSheet(item, usableW, usableH)) items.push(item)
    else oversize.push(item.label)
  }

  const empty = (): NestResult => ({
    sheets: [], sheet, usable: { w: usableW, h: usableH }, kerf, trim,
    pieceArea: 0, sheetsBought: 0, offcutsUsed: 0, boughtArea: 0, wastePct: 0,
    oversize, grainLocked: 0, warnings, caveat: NEST_CAVEAT,
  })

  if (usableW <= 0 || usableH <= 0) {
    warnings.push('The trim allowance is larger than the sheet — there is nothing left to cut from.')
    return empty()
  }
  if (oversize.length) {
    warnings.push(
      `${oversize.join(', ')} ${oversize.length === 1 ? 'does' : 'do'} not fit a ` +
      `${long} × ${short} sheet once ${trim} mm of trim is taken off` +
      `${pieces.some((p) => p.grained) ? ', at any orientation the grain allows' : ' at any rotation'}. ` +
      'They are left out of the layout rather than squeezed in — a plan that quietly omits a piece is worse than none.',
    )
  }
  if (!items.length) return empty()

  // Orderings worth trying on their own merits, then the randomised search.
  // Longest-dimension-descending is the textbook shelf heuristic and usually
  // wins; the others win often enough to be worth four packs out of four
  // hundred. "Everything stood up" is in the list because it is the one whole
  // strategy the hill climb would need several simultaneous flips to reach, and
  // it is the right answer whenever the pieces are nearly as wide as the sheet.
  const byLongest = [...items].sort((a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width))
  const byShortest = [...items].sort((a, b) => Math.min(b.length, b.width) - Math.min(a.length, a.width))
  const byArea = [...items].sort((a, b) => b.length * b.width - a.length * a.width)

  // The stock you already own, one unit per physical offcut, smallest first.
  // Only offcuts big enough to hold at least one piece are kept: a 60 mm strip
  // in the list would otherwise be opened, fail, and be silently marked spent.
  const fullStock: StockUnit = { w: usableW, h: usableH, label: sheet.label, isOffcut: false }
  const offcutStock: StockUnit[] = []
  for (const o of options.offcuts ?? []) {
    if (!(o.w > 0) || !(o.h > 0)) continue
    const w = Math.max(o.w, o.h)
    const h = Math.min(o.w, o.h)
    if (!items.some((i) => orientationsOf(i).some((r) => r.w <= w && r.h <= h))) continue
    for (let n = 0; n < Math.max(0, Math.floor(o.qty)); n += 1) {
      offcutStock.push({ w, h, label: `Offcut ${w} × ${h}`, isOffcut: true })
    }
  }
  offcutStock.sort((a, b) => a.w * a.h - b.w * b.h)

  const rand = mulberry32(options.seed ?? DEFAULT_SEED)
  let best = packOrder(byLongest, offcutStock, fullStock, kerf)
  let bestScore = score(best)
  let bestOrder: readonly Item[] = byLongest
  const consider = (order: readonly Item[]) => {
    const attempt = packOrder(order, offcutStock, fullStock, kerf)
    const s = score(attempt)
    if (s < bestScore) {
      best = attempt
      bestScore = s
      bestOrder = order
    }
  }
  consider(byShortest)
  consider(byArea)
  consider(allFlipped(byLongest))
  consider(allFlipped(byArea))
  // Hill climb from whichever of the three won, keeping every improvement.
  for (let i = 0; i < iterations; i += 1) consider(perturb(bestOrder, rand))

  let bought = 0
  const sheets: SheetLayout[] = best.map((s, i) => {
    const leftover = s.stock.h - s.used
    return {
      index: i + 1,
      sheetNo: s.stock.isOffcut ? null : (bought += 1),
      stock: { ...s.stock },
      placements: s.placements,
      usedArea: s.usedArea,
      usedHeight: s.used,
      offcut: leftover >= MIN_OFFCUT ? { w: s.stock.w, h: leftover } : null,
    }
  })

  const pieceArea = sheets.reduce((sum, s) => sum + s.usedArea, 0)
  const sheetsBought = sheets.filter((s) => !s.stock.isOffcut).length
  const offcutsUsed = sheets.length - sheetsBought
  const boughtArea = sheetsBought * sheet.w * sheet.h
  // Only the pieces that actually come off a BOUGHT sheet count against what
  // you bought. Using the total here would credit sheets you did not buy with
  // pieces cut from the offcut rack, and drives the waste figure NEGATIVE as
  // soon as the offcuts supply more area than the sheets do.
  const boughtPieceArea = sheets.reduce((sum, s) => (s.stock.isOffcut ? sum : sum + s.usedArea), 0)
  const grainLocked = items.filter((i) => i.grained && i.length !== i.width).length

  if (grainLocked) {
    warnings.push(
      `${grainLocked} of ${items.length} pieces cannot be turned 90° — the grain has to run the ` +
      'same way on all of them. That is the main reason a real layout wastes more than the arithmetic says it should.',
    )
  }
  if (kerf <= 0) {
    warnings.push('Kerf is zero, so this layout assumes a saw that removes no wood. Nothing cuts like that.')
  }
  if (offcutStock.length && offcutsUsed < offcutStock.length) {
    const spare = offcutStock.length - offcutsUsed
    warnings.push(
      `${spare} of your ${offcutStock.length} offcuts ${spare === 1 ? 'is' : 'are'} not used — nothing left ` +
      'in the list fits, so they stay on the rack.',
    )
  }

  return {
    sheets,
    sheet,
    usable: { w: usableW, h: usableH },
    kerf,
    trim,
    pieceArea,
    sheetsBought,
    offcutsUsed,
    boughtArea,
    // Measured against what you BUY. A plan cut entirely from offcuts buys
    // nothing, so there is no denominator and no waste figure to quote — 0 here
    // means "nothing bought", and the UI says that in words rather than
    // printing a triumphant 0%.
    wastePct: boughtArea > 0 ? ((boughtArea - boughtPieceArea) / boughtArea) * 100 : 0,
    oversize,
    grainLocked,
    warnings,
    caveat: NEST_CAVEAT,
  }
}

// --- mixed lists ------------------------------------------------------------

/**
 * One plan per material AND thickness.
 *
 * A box has one material by definition, but a free parts list very often mixes
 * 18 mm ply carcass parts with a 6 mm back — and packing those onto one sheet
 * would be a drawing of something that cannot exist. Splitting them is not a
 * refinement; it is the difference between a plan and a picture.
 */
export function nestKey(piece: Pick<NestPiece, 'material' | 'thickness'>): string {
  return `${piece.material}|${piece.thickness}`
}

export interface NestGroup {
  key: string
  material: string
  thickness: number
  pieces: NestPiece[]
}

export function groupForNesting(pieces: readonly NestPiece[]): NestGroup[] {
  const groups: NestGroup[] = []
  for (const piece of pieces) {
    const key = nestKey(piece)
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, material: piece.material, thickness: piece.thickness, pieces: [] }
      groups.push(group)
    }
    group.pieces.push(piece)
  }
  return groups
}
