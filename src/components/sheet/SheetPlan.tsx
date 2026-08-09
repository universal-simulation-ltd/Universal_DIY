import { useMemo } from 'react'
import { SHEETS } from '../../lib/materials'
import { groupForNesting, nest, type NestGroup, type NestPiece, type NestResult, type SheetLayout } from '../../lib/nest'
import { areaM2, formatShort, type Unit } from '../../lib/units'
import { useSheet, useSheetStore } from '../../stores/sheetStore'
import LengthField from '../diy/LengthField'

/**
 * The cutting plan — where every piece goes on the sheet.
 *
 * Shared by the box page and the parts page, because "how do I get these
 * rectangles out of that sheet" is the same question either way and there is no
 * version of it that should differ between the two.
 *
 * It draws the NOMINAL sheet and the trimmed area separately. That is not
 * decoration: the gap between the two outlines is the thing people forget, and
 * a drawing that showed only the usable area would quietly imply the piece in
 * the corner sits on the factory edge.
 */
interface Props {
  pieces: NestPiece[]
  unit: Unit
  mmDecimals: 0 | 1
}

export default function SheetPlan({ pieces, unit, mmDecimals }: Props) {
  const sheet = useSheet()
  const kerf = useSheetStore((s) => s.kerf)
  const trim = useSheetStore((s) => s.trim)
  const setSheet = useSheetStore((s) => s.setSheet)
  const setKerf = useSheetStore((s) => s.setKerf)
  const setTrim = useSheetStore((s) => s.setTrim)

  // Memoised on the inputs, not on the render. The packer runs a few hundred
  // packs and is a pure function of exactly these arguments, so re-running it
  // because a tooltip opened would be pure waste — and it is the only thing in
  // this app expensive enough for that to be worth a line.
  const key = JSON.stringify([pieces, sheet.id, kerf, trim])
  const plans = useMemo(
    () => groupForNesting(pieces).map((group) => ({ group, result: nest(group.pieces, { sheet, kerf, trim }) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  if (!pieces.length) return null

  return (
    <section className="print-sheet rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">Cutting plan — where it all goes on the sheet</h2>
        <p className="mt-1 text-xs text-slate-600 max-w-2xl">
          Every cut runs edge to edge, so this is a plan a table saw or a track saw can actually
          follow. Cut the strips off first, then cut the pieces out of each strip.
        </p>
      </header>

      <div className="no-print mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
        <div className="col-span-2 sm:col-span-2">
          <label htmlFor="plan-sheet" className="block text-xs font-medium text-slate-600 mb-1">Sheet size</label>
          <select
            id="plan-sheet"
            value={sheet.id}
            onChange={(e) => setSheet(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500"
          >
            {SHEETS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <LengthField
          label="Saw kerf"
          mm={kerf}
          unit={unit}
          mmDecimals={mmDecimals}
          onChange={setKerf}
          hint="The wood the blade turns to dust at every cut. 3 mm is a typical table-saw blade."
        />
        <LengthField
          label="Trim off the edges"
          mm={trim}
          unit={unit}
          mmDecimals={mmDecimals}
          onChange={setTrim}
          hint="Factory edges are rarely square. Taken off one long and one short edge."
        />
      </div>

      <div className="space-y-6">
        {plans.map(({ group, result }) => (
          <Plan
            key={group.key}
            group={group}
            result={result}
            showMaterial={plans.length > 1}
            unit={unit}
            mmDecimals={mmDecimals}
          />
        ))}
      </div>

      {/* Rendered verbatim. The optimiser is the feature people came for, which
          is exactly why its limits go next to it and not in a help page. */}
      <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">{plans[0].result.caveat}</p>
    </section>
  )
}

function Plan({ group, result, showMaterial, unit, mmDecimals }: {
  group: NestGroup
  result: NestResult
  showMaterial: boolean
  unit: Unit
  mmDecimals: 0 | 1
}) {
  const { sheets, sheet, wastePct, pieceArea, boughtArea } = result
  const offcuts = sheets.filter((s) => s.offcut)

  return (
    <div className="break-inside-avoid">
      {showMaterial && (
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          {group.material || 'Unnamed material'} · {formatShort(group.thickness, 'mm', mmDecimals)} mm
        </h3>
      )}

      {sheets.length > 0 && (
        <p className="text-sm text-slate-800">
          <span className="tnum font-semibold">{sheets.length}</span>{' '}
          {sheets.length === 1 ? 'sheet' : 'sheets'} of {sheet.label} —{' '}
          <span className="tnum font-semibold">{wastePct.toFixed(0)}%</span> of what you buy ends up as
          offcut and sawdust{' '}
          <span className="text-slate-500">
            ({areaM2(pieceArea).toFixed(2)} m² of pieces from {areaM2(boughtArea).toFixed(2)} m² of sheet)
          </span>
          .
        </p>
      )}

      {offcuts.length > 0 && (
        <p className="mt-1 text-xs text-slate-600">
          Worth keeping:{' '}
          {offcuts.map((s, i) => (
            <span key={s.index}>
              {i > 0 && '; '}
              <span className="tnum">
                {formatShort(s.offcut!.w, unit, mmDecimals)} × {formatShort(s.offcut!.h, unit, mmDecimals)} {unit}
              </span>{' '}
              off sheet {s.index}
            </span>
          ))}
          . One clean strip, not a pile of slivers — that is what the layout is packed down for.
        </p>
      )}

      {result.warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          {w}
        </p>
      ))}

      <div className="mt-3 space-y-4">
        {sheets.map((layout) => (
          <SheetDrawing
            key={layout.index}
            layout={layout}
            result={result}
            total={sheets.length}
            unit={unit}
            mmDecimals={mmDecimals}
          />
        ))}
      </div>
    </div>
  )
}

function SheetDrawing({ layout, result, total, unit, mmDecimals }: {
  layout: SheetLayout
  result: NestResult
  total: number
  unit: Unit
  mmDecimals: 0 | 1
}) {
  const long = Math.max(result.sheet.w, result.sheet.h)
  const short = Math.min(result.sheet.w, result.sheet.h)
  const { trim } = result
  const pad = long * 0.05
  const fs = long / 55
  const stroke = long / 900

  return (
    <figure data-sheet={layout.index} className="break-inside-avoid">
      <figcaption className="mb-1 flex flex-wrap items-baseline gap-x-2">
        <h4 className="text-sm font-semibold text-slate-900">
          Sheet {layout.index}{total > 1 ? ` of ${total}` : ''}
        </h4>
        <span className="text-[11px] text-slate-500">
          {layout.placements.length} {layout.placements.length === 1 ? 'piece' : 'pieces'} · grain runs left to right
        </span>
      </figcaption>

      <svg
        viewBox={`${-pad} ${-pad} ${long + pad * 2} ${short + pad * 2.4}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Sheet ${layout.index}: ${layout.placements
          .map((p) => `${p.label} ${Math.round(p.w)} by ${Math.round(p.h)} millimetres at ${Math.round(p.x)}, ${Math.round(p.y)}`)
          .join('. ')}`}
      >
        <defs>
          {/* A hatch, not a tint. Workshop printers are black and white, and a
              grey fill is exactly what they turn into nothing. */}
          <pattern id={`waste-${layout.index}`} width={long / 60} height={long / 60} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={long / 60} stroke="#cbd5e1" strokeWidth={stroke} />
          </pattern>
        </defs>

        {/* The nominal sheet, and inside it the trimmed area actually used. The
            band between them is the factory edge nobody should be cutting to. */}
        <rect x={0} y={0} width={long} height={short} fill="#f8fafc" stroke="#94a3b8" strokeWidth={stroke} />
        <rect
          data-ink
          x={trim}
          y={trim}
          width={result.usable.w}
          height={result.usable.h}
          className="panel-fill"
          fill={`url(#waste-${layout.index})`}
          stroke="#475569"
          strokeWidth={stroke * 1.5}
          strokeDasharray={`${stroke * 8} ${stroke * 5}`}
        />

        {layout.placements.map((p) => {
          const upright = p.h > p.w
          const long_ = upright ? p.h : p.w
          const short_ = upright ? p.w : p.h
          const letter = Math.min(long_ * 0.28, short_ * 0.45, fs * 1.6)
          // The size caption is a FIXED size, not a fraction of the piece.
          // Scaling it with the piece is what made a 100 mm rail's dimensions
          // render at six pixels — present, unreadable, and worse than absent,
          // because the eye reads it as a smudge on the drawing. A piece that
          // cannot hold a readable caption keeps its letter and sends you to
          // the cut list, which is where the authoritative sizes live anyway.
          const sizeFs = fs * 0.6
          const roomy = short_ > letter + sizeFs * 2.6 && long_ > sizeFs * 9
          return (
            <g key={p.label}>
              <rect
                data-ink
                x={trim + p.x}
                y={trim + p.y}
                width={p.w}
                height={p.h}
                className="panel-fill"
                fill="#ffffff"
                stroke="#334155"
                strokeWidth={stroke * 1.6}
              />
              <text
                x={trim + p.x + p.w / 2}
                y={trim + p.y + p.h / 2 + (roomy ? -sizeFs * 0.5 : letter * 0.35)}
                textAnchor="middle"
                fontSize={letter}
                fontWeight="700"
                fill="#0f172a"
                transform={upright ? `rotate(-90 ${trim + p.x + p.w / 2} ${trim + p.y + p.h / 2})` : undefined}
              >
                {p.label}
              </text>
              {roomy && (
                <text
                  x={trim + p.x + p.w / 2}
                  y={trim + p.y + p.h / 2 + letter * 0.55}
                  textAnchor="middle"
                  fontSize={sizeFs}
                  fill="#334155"
                  transform={upright ? `rotate(-90 ${trim + p.x + p.w / 2} ${trim + p.y + p.h / 2})` : undefined}
                >
                  {formatShort(p.w, unit, mmDecimals)} × {formatShort(p.h, unit, mmDecimals)}
                  {p.rotated ? ' ↻' : ''}
                </text>
              )}
            </g>
          )
        })}

        {/* The offcut named on the drawing, not just in the prose above it —
            this is the piece that goes on the rack, and it wants a size on it. */}
        {layout.offcut && (
          <text
            x={trim + result.usable.w / 2}
            y={trim + layout.usedHeight + layout.offcut.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fs * 0.9}
            fill="#475569"
          >
            Offcut {formatShort(layout.offcut.w, unit, mmDecimals)} × {formatShort(layout.offcut.h, unit, mmDecimals)} {unit}
          </text>
        )}

        <text x={long / 2} y={short + fs * 1.6} textAnchor="middle" fontSize={fs} fill="#475569">
          {formatShort(long, unit, mmDecimals)} {unit} — {formatShort(trim, unit, mmDecimals)} trim
        </text>
      </svg>
    </figure>
  )
}
