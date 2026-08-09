import { AXIS_LABEL, type Cutlist, type Design } from '../../lib/panels'
import { areaM2, formatLength } from '../../lib/units'
import { useDiyStore } from '../../stores/diyStore'

/**
 * The printed sheet — the thing that actually goes to the workshop.
 *
 * It is deliberately self-describing, because the sheet gets separated from the
 * app: project, date, units, material and thickness, the outer size, the wrap
 * order in plain English, the piece count, the board area, and a check line
 * giving the interior cavity — the single best pre-cut sanity check.
 *
 * One row per piece TYPE with a tick box per physical piece. Labels are a letter
 * per type plus an index (A1, A2), because a handwritten 1 and 7 on a dusty
 * offcut are a coin flip and an A is not.
 */
export default function CutList({ design, cutlist }: { design: Design; cutlist: Cutlist }) {
  const unit = useDiyStore((s) => s.unit)
  const mmDecimals = useDiyStore((s) => s.mmDecimals)
  const notes = useDiyStore((s) => s.notes)
  const setNote = useDiyStore((s) => s.setNote)
  const hover = useDiyStore((s) => s.hover)
  const setHover = useDiyStore((s) => s.setHover)

  const fmt = (mm: number) => formatLength(mm, { unit, mmDecimals })
  const panelOf = (letter: string) => cutlist.pieces.find((p) => p.typeLetter === letter)?.panel ?? null

  return (
    <section className="print-sheet rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">
          Cut list — {design.name || 'Untitled box'}
        </h2>
        <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-700">
          <Fact term="Date" value={new Date().toLocaleDateString('en-GB')} />
          <Fact term="Units" value={unit} />
          <Fact term="Material" value={`${design.material || '—'} · ${formatLength(design.thickness, { unit: 'mm', withUnit: true })}`} />
          <Fact
            term="Outer size"
            value={`${fmt(design.width)} × ${fmt(design.depth)} × ${fmt(design.height)} ${unit} (${AXIS_LABEL.x} × ${AXIS_LABEL.y} × ${AXIS_LABEL.z})`}
          />
          <Fact term="Pieces" value={`${cutlist.pieces.length} from ${cutlist.types.length} sizes`} />
          <Fact term="Board area" value={`${areaM2(cutlist.totalArea).toFixed(2)} m²`} />
        </dl>
        <p className="mt-2 text-xs text-slate-700">
          <span className="font-medium">How the panels meet:</span> {cutlist.wrapSummary}.
        </p>
        <p className="mt-1 text-xs text-slate-700">
          <span className="font-medium">Check before you cut:</span> the interior cavity should come
          out at <span className="tnum">{fmt(cutlist.cavity.x)} × {fmt(cutlist.cavity.y)} × {fmt(cutlist.cavity.z)} {unit}</span>.
          Measure it on the assembled carcass; if it does not match, something on this sheet is wrong.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Length is always the along-the-grain dimension. Good face out on every piece unless a note
          says otherwise. Butt joints throughout. These sizes carry no allowance for saw kerf, and
          they should not: the kerf changes how many pieces fit on a sheet, never how big a piece
          is. The cutting plan is where it gets counted.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table data-testid="cutlist" className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-600 border-b border-slate-300">
              <th scope="col" className="py-1.5 pr-2 font-medium">Cut</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Label</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Part</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Qty</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Length</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Width</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Thick</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Grain</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Material</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Good face</th>
              <th scope="col" className="py-1.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {cutlist.types.map((type) => {
              const panel = panelOf(type.letter)
              return (
                <tr
                  key={type.letter}
                  onMouseEnter={() => panel && setHover(panel)}
                  onMouseLeave={() => setHover(null)}
                  className={`border-b border-slate-200 align-top ${
                    panel && hover === panel ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {/* One tick box per physical piece. Tick it as you cut. */}
                    {type.labels.map((l) => (
                      <span key={l} className="tnum inline-block mr-1.5 text-slate-600">☐ {l}</span>
                    ))}
                  </td>
                  <td className="py-2 pr-2 font-semibold text-slate-900">{type.letter}</td>
                  <td className="py-2 pr-2 text-slate-800">{type.part}</td>
                  <td className="py-2 pr-2 tnum text-slate-800">{type.qty}</td>
                  <td className="py-2 pr-2 tnum font-medium text-slate-900">{fmt(type.length)}</td>
                  <td className="py-2 pr-2 tnum font-medium text-slate-900">{fmt(type.width)}</td>
                  <td className="py-2 pr-2 tnum text-slate-700">{fmt(type.thickness)}</td>
                  <td className="py-2 pr-2 text-slate-700 whitespace-nowrap">{type.grain}</td>
                  <td className="py-2 pr-2 text-slate-700">{design.material}</td>
                  <td className="py-2 pr-2 text-slate-700">Out</td>
                  <td className="py-2">
                    <input
                      type="text"
                      value={notes[type.letter] ?? ''}
                      onChange={(e) => setNote(type.letter, e.target.value)}
                      placeholder="…"
                      aria-label={`Note for piece ${type.letter}`}
                      className="no-print w-full min-w-[6rem] rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800 outline-none focus:border-amber-500"
                    />
                    <span className="print-only text-xs">{notes[type.letter] ?? ''}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {cutlist.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {cutlist.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{term}</dt>
      <dd className="text-slate-900 font-medium">{value}</dd>
    </div>
  )
}
