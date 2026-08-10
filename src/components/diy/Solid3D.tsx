import { useCallback, useRef, useState } from 'react'
import { DEFAULT_VIEW, clampPitch, scene, shadeOf, type Face, type View } from '../../lib/iso'
import { PANEL_NAMES, type Cutlist, type Design, type PanelId } from '../../lib/panels'
import { useDiyStore } from '../../stores/diyStore'

/**
 * The assembled box, in three dimensions — drag to turn it, slide to pull it
 * apart.
 *
 * It is SVG and it is ORTHOGRAPHIC, which is what makes it allowed. The
 * long-standing objection to a 3D view here was that you cannot read dimensions
 * off a perspective picture and it cannot be printed; both are objections to
 * perspective and to WebGL, not to three dimensions. Parallel edges stay
 * parallel, a 400 mm edge is 400 mm wherever it sits, and it prints with the
 * rest of the sheet. See the note at the top of `lib/iso.ts`.
 *
 * The EXPLODE slider is the reason it earns its place rather than being a toy:
 * a closed box hides every joint it has, and pulling the panels apart is the
 * one picture that shows the wrap order — which panel runs through to the
 * outside and which butts into it — without having to read a cross-section.
 */
/**
 * One face per panel — the biggest one facing us, which is the only one with
 * room for a letter. Area is the shoelace formula on the projected polygon, so
 * it is the area you can actually SEE, not the area of the face in the model:
 * a panel turned nearly edge-on has a large real face and no room at all.
 */
function largestFacePerPanel(faces: readonly Face[]): Face[] {
  const best = new Map<PanelId, { face: Face; area: number }>()
  for (const face of faces) {
    let area = 0
    for (let i = 0; i < face.points.length; i += 1) {
      const a = face.points[i]
      const b = face.points[(i + 1) % face.points.length]
      area += a.x * b.y - b.x * a.y
    }
    area = Math.abs(area) / 2
    const held = best.get(face.panel)
    if (!held || area > held.area) best.set(face.panel, { face, area })
  }
  return [...best.values()].map((v) => v.face)
}

export default function Solid3D({ design, cutlist }: { design: Design; cutlist: Cutlist }) {
  const [view, setView] = useState<View>(DEFAULT_VIEW)
  const [explode, setExplode] = useState(0)
  const hover = useDiyStore((s) => s.hover)
  const setHover = useDiyStore((s) => s.setHover)
  const drag = useRef<{ x: number; y: number; view: View } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const { faces, bounds } = scene(design, view, explode)
  const labels = Object.fromEntries(cutlist.pieces.map((p) => [p.panel, p.label])) as Record<PanelId, string>

  const w = Math.max(1, bounds.maxX - bounds.minX)
  const h = Math.max(1, bounds.maxY - bounds.minY)
  const pad = Math.max(w, h) * 0.06
  const stroke = Math.max(w, h) / 500

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, view }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [view])

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const start = drag.current
    if (!start) return
    // Scaled to the element, not to raw pixels, so the same gesture turns the
    // box the same amount on a phone and on a 4K monitor.
    const box = svgRef.current?.getBoundingClientRect()
    const across = (e.clientX - start.x) / (box?.width || 600)
    const down = (e.clientY - start.y) / (box?.height || 400)
    setView({
      yaw: start.view.yaw + across * Math.PI * 1.6,
      pitch: clampPitch(start.view.pitch + down * Math.PI * 0.9),
    })
  }, [])

  const endDrag = useCallback(() => { drag.current = null }, [])

  const turn = (dYaw: number, dPitch = 0) =>
    setView((v) => ({ yaw: v.yaw + dYaw, pitch: clampPitch(v.pitch + dPitch) }))

  return (
    <figure data-drawing="solid" className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 break-inside-avoid">
      <figcaption className="mb-2">
        <h3 className="text-sm font-semibold text-slate-900">The assembled box</h3>
        <p className="text-[11px] leading-snug text-slate-500">
          Drag to turn it. Pull it apart to see which panel runs through and which butts into it —
          the same thing the cross-sections show, in one picture. Drawn without perspective, so
          every edge stays true to scale.
        </p>
      </figcaption>

      <svg
        ref={svgRef}
        viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${w + pad * 2} ${h + pad * 2}`}
        className="w-full h-auto touch-none select-none cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={
          `The assembled ${design.name || 'box'}, ${Math.round(design.width)} by ${Math.round(design.depth)} by ` +
          `${Math.round(design.height)} millimetres, shown as a solid. ${cutlist.wrapSummary}.`
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {faces.map((face, i) => {
          const on = hover === face.panel
          const shade = shadeOf(face.facing)
          // Lightness from the face's orientation, hue from nothing at all —
          // these are greys, plus the app's amber for the highlighted panel.
          // Print drops every fill to white (see index.css), which is why the
          // outline is what actually carries the form on paper.
          const level = Math.round(255 - (1 - shade) * 120)
          return (
            <polygon
              // Faces are re-sorted by depth on every turn, so the array index
              // is not a stable identity — but nothing here holds state per
              // face, so a positional key is exactly right and a "stable" id
              // would be the lie.
              key={i}
              data-ink
              data-panel={face.panel}
              className="panel-fill"
              points={face.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={on ? '#fde68a' : `rgb(${level},${level},${level})`}
              stroke={on ? '#b45309' : '#334155'}
              strokeWidth={on ? stroke * 2 : stroke}
              strokeLinejoin="round"
              onMouseEnter={() => setHover(face.panel)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}

        {/* Labels only once the box is open enough for them to sit on a face
            somebody can actually see. On a closed box they would stack up on
            the three outer panels and name the wrong pieces.
            ONE label per panel, on its biggest visible face: every panel shows
            three faces from any general angle, so labelling faces rather than
            panels wrote each letter three times — twice of them squeezed onto
            an 18 mm edge. */}
        {explode > 0.35 && largestFacePerPanel(faces).map((face) => {
          const cx = face.points.reduce((s, p) => s + p.x, 0) / face.points.length
          const cy = face.points.reduce((s, p) => s + p.y, 0) / face.points.length
          return (
            <text
              key={face.panel}
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.max(w, h) / 28}
              fontWeight="700"
              fill="#0f172a"
              pointerEvents="none"
            >
              {labels[face.panel] ?? ''}
            </text>
          )
        })}
      </svg>

      <div className="no-print mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="explode" className="text-xs font-medium text-slate-600">Pull apart</label>
          <input
            id="explode"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={explode}
            onChange={(e) => setExplode(Number(e.target.value))}
            className="w-32 accent-amber-700"
          />
        </div>

        {/* Buttons as well as the drag, because a drag is not reachable from a
            keyboard and this is the only control on the page that has one. */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-600">Turn</span>
          {([['←', -0.35, 0], ['→', 0.35, 0], ['↑', 0, -0.2], ['↓', 0, 0.2]] as const).map(([glyph, dy, dp]) => (
            <button
              key={glyph}
              type="button"
              onClick={() => turn(dy, dp)}
              aria-label={`Turn the box ${{ '←': 'left', '→': 'right', '↑': 'up', '↓': 'down' }[glyph]}`}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-amber-50"
            >
              {glyph}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setView(DEFAULT_VIEW); setExplode(0) }}
            className="ml-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-amber-50"
          >
            Reset
          </button>
        </div>

        {hover && (
          <span className="text-xs text-amber-800">{PANEL_NAMES[hover]}</span>
        )}
      </div>
    </figure>
  )
}
