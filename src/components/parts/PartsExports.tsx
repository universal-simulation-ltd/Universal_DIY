import { useRef, useState } from 'react'
import { downloadCsv, safeFilename, toCsv } from '../../lib/csv'
import { SHEETS, estimateSheets } from '../../lib/materials'
import { type PartsCutlist, type PartsProject } from '../../lib/parts'
import { downloadJson, fromPartsFile, toPartsFile } from '../../lib/storage'
import { areaM2 } from '../../lib/units'
import { usePartsStore } from '../../stores/partsStore'

/**
 * Take-it-to-the-workshop, for a free parts list.
 *
 * The CSV is the same exporter and the same column order as the box page —
 * an importer cannot tell which page a file came from and should not have to —
 * with each row carrying its own material, since this list may mix stock.
 *
 * There is no "copy link to this design" here, and that is a real gap rather
 * than an oversight: a box is a dozen numbers and fits in a URL, while a parts
 * list is unbounded. Save the project file instead. Said out loud below rather
 * than left as a button somebody hunts for.
 */
export default function PartsExports({ project, cutlist }: { project: PartsProject; cutlist: PartsCutlist }) {
  const unit = usePartsStore((s) => s.unit)
  const notes = usePartsStore((s) => s.notes)
  const sheetId = usePartsStore((s) => s.sheetId)
  const setSheet = usePartsStore((s) => s.setSheet)
  const replace = usePartsStore((s) => s.replace)
  const fileInput = useRef<HTMLInputElement>(null)
  const [loadError, setLoadError] = useState('')

  const stem = safeFilename(project.name, 'cut')
  const sheet = SHEETS.find((s) => s.id === sheetId) ?? SHEETS[0]
  const estimate = estimateSheets(
    cutlist.totalArea,
    cutlist.types.map((t) => ({ label: t.letter, length: t.length, width: t.width })),
    sheet,
  )

  // The estimate is area-based, so a list mixing 18 mm ply and 12 mm MDF would
  // otherwise quietly quote it as one pile of sheets. Two thicknesses is two
  // shopping lists, and the number below cannot tell them apart.
  const stocks = [...new Set(cutlist.types.map((t) => `${t.material} · ${t.thickness}`))]

  return (
    <section className="no-print rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Take it to the workshop</h2>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Print / Save as PDF
        </button>

        <button
          type="button"
          data-testid="download-parts-csv"
          onClick={() => downloadCsv(toCsv(cutlist.types, '', notes), `${stem}-cutlist.csv`)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-amber-50"
        >
          Download CSV
        </button>

        <button
          type="button"
          onClick={() => downloadJson(toPartsFile({ project, unit, notes }), `${stem}.unidiy-parts.json`)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-amber-50"
        >
          Save project
        </button>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-amber-50"
        >
          Open project
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            const loaded = fromPartsFile(await file.text())
            if (!loaded) {
              return setLoadError('That is not a Universal DIY parts list, or it has been damaged. A saved box is a different file — open that on the box page.')
            }
            setLoadError('')
            replace(loaded.project, loaded.unit, loaded.notes)
          }}
        />
      </div>

      {loadError && <p className="mt-2 text-xs text-red-600">{loadError}</p>}

      <p className="mt-3 text-xs text-slate-600">
        The CSV is <code className="text-[11px]">Length,Width,Qty,Label,Material,Grain,Notes</code> in
        millimetres — the column order that pastes straight into cutlistoptimizer or OptiCutter.
        There is no share link on this page: a parts list has no length limit, so it goes in a file
        rather than a URL.
      </p>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">How much do I buy?</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="parts-sheet" className="mb-1 block text-xs font-medium text-slate-600">Sheet size</label>
            <select
              id="parts-sheet"
              value={sheetId}
              onChange={(e) => setSheet(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500"
            >
              {SHEETS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-800">
            <span className="tnum font-semibold">{areaM2(cutlist.totalArea).toFixed(2)} m²</span> of panel —
            about <span className="tnum font-semibold">{estimate.sheets}</span>{' '}
            {estimate.sheets === 1 ? 'sheet' : 'sheets'} of {sheet.label}.
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-500">{estimate.caveat}</p>

        {stocks.length > 1 && (
          <p className="mt-1 text-xs text-amber-800">
            This list mixes {stocks.length} stocks ({stocks.join(', ')}). The figure above adds all
            of their areas together, which is not a thing you can buy — work out one stock at a
            time.
          </p>
        )}

        {estimate.oversize.length > 0 && (
          <p className="mt-1 text-xs text-red-700">
            {estimate.oversize.join(', ')} will not fit on a {sheet.label} sheet at any rotation.
          </p>
        )}

        {cutlist.groups.length > 1 && (
          <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
            {cutlist.groups.map((g) => (
              <li key={g.project}>
                <span className="text-slate-800">{g.project}</span>:{' '}
                <span className="tnum">{areaM2(g.area).toFixed(2)} m²</span> over {g.pieces}{' '}
                {g.pieces === 1 ? 'piece' : 'pieces'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
