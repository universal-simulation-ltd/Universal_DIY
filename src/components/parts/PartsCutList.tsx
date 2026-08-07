import { UNGROUPED, type PartsCutlist, type PartsProject } from '../../lib/parts'
import { areaM2, formatLength } from '../../lib/units'
import { usePartsStore } from '../../stores/partsStore'

/**
 * The printed sheet for a free parts list.
 *
 * Self-describing for the same reason as the box's: it gets separated from the
 * app. Which means it has to carry the thing a bare list of lengths cannot say
 * — which piece laps which — so the joints are printed in words underneath the
 * facts, and each row that lost material to a joint shows what it lost.
 *
 * Grouped by project, because the whole point of this page is that one trip to
 * the merchant can cover two builds, and at the saw you want to cut and tick
 * one build at a time.
 */
export default function PartsCutList({ project, cutlist }: { project: PartsProject; cutlist: PartsCutlist }) {
  const unit = usePartsStore((s) => s.unit)
  const mmDecimals = usePartsStore((s) => s.mmDecimals)
  const notes = usePartsStore((s) => s.notes)
  const setNote = usePartsStore((s) => s.setNote)

  const fmt = (mm: number) => formatLength(mm, { unit, mmDecimals })
  const pieceOf = (letter: string) => cutlist.pieces.find((p) => p.typeLetter === letter)
  const multiProject = cutlist.groups.length > 1

  return (
    <section className="print-sheet rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">
          Cut list — {project.name || 'Untitled cut'}
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-3">
          <Fact term="Date" value={new Date().toLocaleDateString('en-GB')} />
          <Fact term="Units" value={unit} />
          <Fact
            term="Pieces"
            value={`${cutlist.pieces.reduce((n, p) => n + p.qty, 0)} from ${cutlist.types.length} sizes`}
          />
          <Fact term="Board area" value={`${areaM2(cutlist.totalArea).toFixed(2)} m²`} />
          <Fact term="Joints" value={String(project.joints.length)} />
          {multiProject && <Fact term="Projects" value={String(cutlist.groups.length)} />}
        </dl>

        {cutlist.jointSummary.length > 0 ? (
          <div className="mt-2 text-xs text-slate-700">
            <p className="font-medium">How the pieces meet:</p>
            <ul className="mt-1 space-y-0.5">
              {cutlist.jointSummary.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-700">
            <span className="font-medium">No joints.</span> Every piece is cut to exactly the length
            given — nothing has been deducted from anything.
          </p>
        )}

        <p className="mt-2 text-xs text-slate-500">
          Length is the along-the-grain dimension. Butt joints throughout — no allowance for saw
          kerf, which affects how many pieces fit on a sheet, never how big a piece is. Sizes are
          for the pieces themselves; this sheet says nothing about where they sit in the finished
          thing.
        </p>
      </header>

      {cutlist.groups.map((group) => (
        <div key={group.project} className="mb-4 last:mb-0">
          {multiProject && (
            <h3 className="mb-1 text-sm font-semibold text-slate-900">
              {group.project === UNGROUPED ? group.project : group.project}
              <span className="ml-2 tnum text-xs font-normal text-slate-500">
                {group.pieces} {group.pieces === 1 ? 'piece' : 'pieces'} · {areaM2(group.area).toFixed(2)} m²
              </span>
            </h3>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-[11px] uppercase tracking-wide text-slate-600">
                  <th scope="col" className="py-1.5 pr-2 font-medium">Cut</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Ref</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Piece</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Qty</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Length</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Width</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Thick</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Grain</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Material</th>
                  <th scope="col" className="py-1.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {group.types.map((type) => {
                  const piece = pieceOf(type.letter)
                  const lost = (piece?.lost.start ?? 0) + (piece?.lost.end ?? 0)
                  return (
                    <tr key={type.letter} className="border-b border-slate-200 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {type.labels.map((l) => (
                          <span key={l} className="tnum mr-1.5 inline-block text-slate-600">☐ {l}</span>
                        ))}
                      </td>
                      <td className="py-2 pr-2 font-semibold text-slate-900">{type.letter}</td>
                      <td className="py-2 pr-2 text-slate-800">{type.part}</td>
                      <td className="tnum py-2 pr-2 text-slate-800">{type.qty}</td>
                      <td className="py-2 pr-2">
                        <span className="tnum font-medium text-slate-900">{fmt(type.length)}</span>
                        {/* What the joints took, on the row that lost it. The
                            deduction is the only thing on this sheet that is
                            not a number somebody typed, so it says so. */}
                        {lost > 0 && (
                          <span className="tnum block text-[10px] text-slate-500">
                            {fmt(piece!.nominal)} − {fmt(lost)}
                          </span>
                        )}
                      </td>
                      <td className="tnum py-2 pr-2 font-medium text-slate-900">{fmt(type.width)}</td>
                      <td className="tnum py-2 pr-2 text-slate-700">{fmt(type.thickness)}</td>
                      <td className="py-2 pr-2 whitespace-nowrap text-slate-700">{type.grain}</td>
                      <td className="py-2 pr-2 text-slate-700">{type.material}</td>
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
        </div>
      ))}

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
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  )
}
