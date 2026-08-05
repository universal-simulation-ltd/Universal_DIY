// ---------------------------------------------------------------------------
// The whole design in the URL hash.
//
// A design is a dozen numbers, so it fits in a link with no backend at all —
// which is the point: shareable links without giving up the "runs entirely in
// your browser" claim. The hash (not the query string) so it is never sent to
// the server even in the request line.
//
// Encoding is a compact positional record rather than JSON-in-base64: it keeps
// the link short and, more usefully, keeps it human-readable enough that a
// mangled link can be diagnosed by eye.
//
//   #d=1_600_400_300_18_LRTBKF_111111_mm_1~My%20box~18%20mm%20birch%20ply
//    │ │  │   │   │  │      │      │  │  │  │        └ material
//    │ │  │   │   │  │      │      │  │  │  └ project name
//    │ │  │   │   │  │      │      │  │  └ grained (1/0)
//    │ │  │   │   │  │      │      │  └ display unit
//    │ │  │   │   │  │      │      └ present flags, in wrap-order sequence
//    │ │  │   │   │  │      └ wrap order, outermost first
//    │ │  └───┴───┴──┴ W, D, H, thickness (mm)
//    │ └ format version
//    └ param
//
// ⚠️ The field separator is `_`, NOT `.`. An earlier draft used `.` and every
// link carrying an imperial thickness decoded as null: 19.05 split into two
// fields, so the wrap order landed where the flags should be and validation
// (correctly) refused the lot. The one case the format has to carry — "never
// round the thickness" — was the one case it could not encode. `_` is
// URL-hash-safe and cannot appear in any field this format writes.
// ---------------------------------------------------------------------------

import { PANEL_IDS, isValidOrder, type Design, type PanelId } from './panels'
import type { Unit } from './units'

const PARAM = 'd'
const VERSION = '1'
/** Field separator. Must not be `.` — see the warning at the top of the file. */
const SEP = '_'

const CODE: Record<PanelId, string> = {
  left: 'L', right: 'R', top: 'T', bottom: 'B', back: 'K', front: 'F',
}
const FROM_CODE: Record<string, PanelId> = Object.fromEntries(
  Object.entries(CODE).map(([k, v]) => [v, k as PanelId]),
) as Record<string, PanelId>

export interface SharePayload {
  design: Design
  unit: Unit
}

const UNITS: Unit[] = ['mm', 'cm', 'in']

/** Trim float noise without ever rounding a real value away (6 dp is ~1 nm). */
function num(n: number): string {
  return String(Math.round(n * 1e6) / 1e6)
}

export function encodeShare({ design, unit }: SharePayload): string {
  const order = design.order.map((p) => CODE[p]).join('')
  const present = design.order.map((p) => (design.present[p] ? '1' : '0')).join('')
  const head = [
    VERSION,
    num(design.width),
    num(design.depth),
    num(design.height),
    num(design.thickness),
    order,
    present,
    unit,
    design.grained ? '1' : '0',
  ].join(SEP)
  return [head, encodeURIComponent(design.name), encodeURIComponent(design.material)].join('~')
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    const [head, name = '', material = ''] = encoded.split('~')
    const f = head.split(SEP)
    if (f[0] !== VERSION || f.length !== 9) return null

    const order = [...f[5]].map((c) => FROM_CODE[c]).filter(Boolean) as PanelId[]
    if (!isValidOrder(order)) return null

    const flags = f[6]
    if (flags.length !== order.length) return null
    const present = {} as Record<PanelId, boolean>
    for (const id of PANEL_IDS) present[id] = false
    order.forEach((p, i) => { present[p] = flags[i] === '1' })

    const nums = [f[1], f[2], f[3], f[4]].map(Number)
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null

    const unit = (UNITS as string[]).includes(f[7]) ? (f[7] as Unit) : 'mm'

    return {
      unit,
      design: {
        name: decodeURIComponent(name) || 'My box',
        width: nums[0],
        depth: nums[1],
        height: nums[2],
        thickness: nums[3],
        present,
        order,
        material: decodeURIComponent(material),
        grained: f[8] === '1',
      },
    }
  } catch {
    return null
  }
}

export function readShareFromUrl(search = window.location.hash): SharePayload | null {
  const raw = search.startsWith('#') ? search.slice(1) : search
  const value = new URLSearchParams(raw).get(PARAM)
  return value ? decodeShare(value) : null
}

export function buildShareUrl(payload: SharePayload, href = window.location.href): string {
  const url = new URL(href)
  url.hash = `${PARAM}=${encodeShare(payload)}`
  return url.toString()
}
