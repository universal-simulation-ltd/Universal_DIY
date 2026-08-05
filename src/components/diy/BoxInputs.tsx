import { STOCK, findStock } from '../../lib/materials'
import { UNIT_LABEL, formatLength, type Unit } from '../../lib/units'
import { useDiyStore } from '../../stores/diyStore'
import LengthField from './LengthField'

const UNITS: Unit[] = ['mm', 'cm', 'in']

export default function BoxInputs() {
  const design = useDiyStore((s) => s.design)
  const unit = useDiyStore((s) => s.unit)
  const mmDecimals = useDiyStore((s) => s.mmDecimals)
  const stockId = useDiyStore((s) => s.stockId)
  const setDim = useDiyStore((s) => s.setDim)
  const setThickness = useDiyStore((s) => s.setThickness)
  const setStock = useDiyStore((s) => s.setStock)
  const setName = useDiyStore((s) => s.setName)
  const setMaterial = useDiyStore((s) => s.setMaterial)
  const setGrained = useDiyStore((s) => s.setGrained)
  const setUnit = useDiyStore((s) => s.setUnit)
  const setMmDecimals = useDiyStore((s) => s.setMmDecimals)

  const stock = findStock(stockId)
  // The unavoidable thing, said out loud: design in mm, cut from an imperial
  // tape, and you will chase 0.4 mm all afternoon. Pick one unit before you
  // start. Shown only when the two actually disagree.
  const mixedUnits = stock
    ? (stock.nativeUnit === 'in' && unit !== 'in') || (stock.nativeUnit === 'mm' && unit === 'in')
    : false

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="project-name" className="block text-xs font-medium text-slate-600 mb-1">
            Project
          </label>
          <input
            id="project-name"
            type="text"
            value={design.name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-600 mb-1">Units</span>
          {/* ONE display unit for the whole document. No per-field units — a cut
              list with mixed units is how somebody cuts the wrong piece. */}
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden" role="group" aria-label="Display unit">
            {UNITS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                aria-pressed={unit === u}
                className={`px-3 py-1.5 text-sm border-l first:border-l-0 border-slate-300 ${
                  unit === u ? 'bg-amber-700 text-white font-medium' : 'bg-white text-slate-700 hover:bg-amber-50'
                }`}
              >
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        </div>

        {unit === 'mm' && (
          <label className="flex items-center gap-2 text-xs text-slate-600 pb-2">
            <input
              type="checkbox"
              checked={mmDecimals === 0}
              onChange={(e) => setMmDecimals(e.target.checked ? 0 : 1)}
              className="accent-amber-700"
            />
            Whole mm
          </label>
        )}
      </div>

      <h2 className="text-sm font-semibold text-slate-900 mb-2">Outer size</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LengthField label="Width (W)" mm={design.width} unit={unit} mmDecimals={mmDecimals} onChange={(v) => setDim('width', v)} />
        <LengthField label="Depth (D)" mm={design.depth} unit={unit} mmDecimals={mmDecimals} onChange={(v) => setDim('depth', v)} />
        <LengthField label="Height (H)" mm={design.height} unit={unit} mmDecimals={mmDecimals} onChange={(v) => setDim('height', v)} />
      </div>

      <h2 className="text-sm font-semibold text-slate-900 mt-5 mb-2">Material</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="stock" className="block text-xs font-medium text-slate-600 mb-1">Stock</label>
          <select
            id="stock"
            value={stockId}
            onChange={(e) => setStock(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            {STOCK.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
            <option value="custom">Measured myself…</option>
          </select>
        </div>

        <LengthField
          label="Thickness (t)"
          mm={design.thickness}
          unit={unit}
          mmDecimals={mmDecimals}
          onChange={setThickness}
          // The thickness is the one input that gets DOUBLED, so it is shown
          // back in millimetres to the last decimal it actually has. A 3/4"
          // board is 19.05 mm and its deduction is 38.1 mm; calling it "19"
          // is a 1 mm lie and a visible gap at glue-up.
          hint={`= ${formatLength(design.thickness, { unit: 'mm', withUnit: true })} exactly — never rounded`}
        />

        <div>
          <label htmlFor="material" className="block text-xs font-medium text-slate-600 mb-1">
            Printed on the cut list
          </label>
          <input
            id="material"
            type="text"
            value={design.material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={design.grained}
              onChange={(e) => setGrained(e.target.checked)}
              className="accent-amber-700"
            />
            Has a visible grain
          </label>
        </div>
      </div>

      {mixedUnits && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Pick one unit before you start.</strong> You are designing in{' '}
          {UNIT_LABEL[unit]} from stock sold in {UNIT_LABEL[stock!.nativeUnit]}. That is fine on
          paper, but if you then cut from a tape marked the other way you will chase 0.4 mm all
          afternoon.
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Butt joints only, one thickness for the whole box, and no saw kerf — kerf changes how many
        pieces fit on a sheet, never how big a piece is.
      </p>
    </section>
  )
}
