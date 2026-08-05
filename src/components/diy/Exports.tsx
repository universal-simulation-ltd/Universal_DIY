import { useRef, useState } from 'react'
import { downloadCsv, safeFilename, toCsv } from '../../lib/csv'
import { SHEETS, estimateSheets } from '../../lib/materials'
import { buildShareUrl } from '../../lib/share'
import { downloadJson, fromProjectFile, toProjectFile } from '../../lib/storage'
import type { Cutlist, Design } from '../../lib/panels'
import { useDiyStore } from '../../stores/diyStore'

export default function Exports({ design, cutlist }: { design: Design; cutlist: Cutlist }) {
  const unit = useDiyStore((s) => s.unit)
  const notes = useDiyStore((s) => s.notes)
  const sheetId = useDiyStore((s) => s.sheetId)
  const setSheet = useDiyStore((s) => s.setSheet)
  const replace = useDiyStore((s) => s.replace)
  const fileInput = useRef<HTMLInputElement>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [loadError, setLoadError] = useState('')

  const stem = safeFilename(design.name)
  const sheet = SHEETS.find((s) => s.id === sheetId) ?? SHEETS[0]
  const estimate = estimateSheets(cutlist.totalArea, cutlist.types.map((t) => ({
    label: t.letter,
    length: t.length,
    width: t.width,
  })), sheet)

  return (
    <section className="no-print rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Take it to the workshop</h2>

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
          data-testid="download-csv"
          onClick={() => downloadCsv(toCsv(cutlist.types, design.material, notes), `${stem}-cutlist.csv`)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-amber-50"
        >
          Download CSV
        </button>

        <button
          type="button"
          onClick={() => downloadJson(toProjectFile({ design, unit, notes }), `${stem}.unidiy.json`)}
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
            const loaded = fromProjectFile(await file.text())
            if (!loaded) return setLoadError('That is not a Universal DIY project file, or it has been damaged.')
            setLoadError('')
            replace(loaded.design, loaded.unit, loaded.notes)
          }}
        />

        <button
          type="button"
          onClick={() => {
            const url = buildShareUrl({ design, unit })
            setShareUrl(url)
            window.history.replaceState(null, '', url)
            void navigator.clipboard?.writeText(url).catch(() => undefined)
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-amber-50"
        >
          Copy link to this design
        </button>
      </div>

      {loadError && <p className="mt-2 text-xs text-red-600">{loadError}</p>}

      {shareUrl && (
        <div className="mt-3">
          <label htmlFor="share-url" className="block text-xs text-slate-600 mb-1">
            The whole design is in the link — nothing is stored on a server.
          </label>
          <input
            id="share-url"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
          />
        </div>
      )}

      <p className="mt-3 text-xs text-slate-600">
        The CSV is <code className="text-[11px]">Length,Width,Qty,Label,Material,Grain,Notes</code> in
        millimetres — the column order that pastes straight into cutlistoptimizer or OptiCutter.
        Universal DIY has no sheet optimiser of its own yet, so that is the honest route to one.
      </p>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">How much do I buy?</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="sheet" className="block text-xs font-medium text-slate-600 mb-1">Sheet size</label>
            <select
              id="sheet"
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
            <span className="tnum font-semibold">{estimate.areaM2.toFixed(2)} m²</span> of panel —
            about <span className="tnum font-semibold">{estimate.sheets}</span>{' '}
            {estimate.sheets === 1 ? 'sheet' : 'sheets'} of {sheet.label}.
          </p>
        </div>
        {/* The shopping question and the packing question are different
            questions, and the estimate must never be allowed to masquerade as a
            layout. Rendered verbatim. */}
        <p className="mt-2 text-xs text-slate-500">{estimate.caveat}</p>
        {estimate.oversize.length > 0 && (
          <p className="mt-1 text-xs text-red-700">
            {estimate.oversize.join(', ')} will not fit on a {sheet.label} sheet at any rotation.
          </p>
        )}
      </div>
    </section>
  )
}
