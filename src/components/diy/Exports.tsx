import { useRef, useState } from 'react'
import { downloadCsv, safeFilename, toCsv } from '../../lib/csv'
import { estimateSheets } from '../../lib/materials'
import { buildShareUrl } from '../../lib/share'
import { downloadJson, fromProjectFile, toProjectFile } from '../../lib/storage'
import type { Cutlist, Design } from '../../lib/panels'
import { useDiyStore } from '../../stores/diyStore'
import { useSheet } from '../../stores/sheetStore'

export default function Exports({ design, cutlist }: { design: Design; cutlist: Cutlist }) {
  const unit = useDiyStore((s) => s.unit)
  const notes = useDiyStore((s) => s.notes)
  const replace = useDiyStore((s) => s.replace)
  const fileInput = useRef<HTMLInputElement>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [loadError, setLoadError] = useState('')

  const stem = safeFilename(design.name)
  // The same sheet the cutting plan is laid out on — one picker, up there with
  // the drawing it changes, rather than two that have to be kept in step.
  const sheet = useSheet()
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
        millimetres — the column order that pastes straight into cutlistoptimizer or OptiCutter. The
        cutting plan above does the same job here, but if you already have a tool you trust, the
        sizes go into it in one paste.
      </p>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">The rough area check</h3>
        <p className="text-sm text-slate-800">
          <span className="tnum font-semibold">{estimate.areaM2.toFixed(2)} m²</span> of panel —
          about <span className="tnum font-semibold">{estimate.sheets}</span>{' '}
          {estimate.sheets === 1 ? 'sheet' : 'sheets'} of {sheet.label}.
        </p>
        {/* The shopping question and the packing question are still different
            questions, and this one must never be allowed to masquerade as a
            layout — least of all now there is a real one on the same page. Both
            are shown, labelled, and the plan is the one to buy against.
            Rendered verbatim. */}
        <p className="mt-2 text-xs text-slate-500">
          {estimate.caveat} The cutting plan above is the number to buy against — it is a real
          layout, so it knows about the blade, the trim and the grain. Expect this figure to be the
          optimistic one.
        </p>
        {estimate.oversize.length > 0 && (
          <p className="mt-1 text-xs text-red-700">
            {estimate.oversize.join(', ')} will not fit on a {sheet.label} sheet at any rotation.
          </p>
        )}
      </div>
    </section>
  )
}
