import { STOCK, findStock } from '../../lib/materials'
import { type Part, type PartsCutlist, type PartsProject } from '../../lib/parts'
import { UNIT_LABEL, type Unit } from '../../lib/units'
import { useLengthText } from '../../lib/useLengthText'
import { usePartsStore } from '../../stores/partsStore'

const UNITS: Unit[] = ['mm', 'cm', 'in']

/**
 * The list itself: one row per piece, length and width and how many.
 *
 * Everything else on the row — material, thickness, project — is optional and
 * inherited from the row above when a new one is added, because in a list of
 * twenty pieces those three are the same twenty times and retyping them is how
 * a wrong thickness gets into one row out of twenty.
 */
export default function PartsTable({ project, cutlist }: { project: PartsProject; cutlist: PartsCutlist }) {
  const unit = usePartsStore((s) => s.unit)
  const mmDecimals = usePartsStore((s) => s.mmDecimals)
  const setUnit = usePartsStore((s) => s.setUnit)
  const setMmDecimals = usePartsStore((s) => s.setMmDecimals)
  const setName = usePartsStore((s) => s.setName)
  const patchPart = usePartsStore((s) => s.patchPart)
  const addPart = usePartsStore((s) => s.addPart)
  const duplicatePart = usePartsStore((s) => s.duplicatePart)
  const deletePart = usePartsStore((s) => s.deletePart)

  const letterOf = (id: string) => cutlist.pieces.find((p) => p.id === id)?.typeLetter ?? '—'

  return (
    <section className="no-print rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="cut-name" className="mb-1 block text-xs font-medium text-slate-600">
            This cut
          </label>
          <input
            id="cut-name"
            type="text"
            value={project.name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">Units</span>
          {/* One display unit for the whole sheet, as on the box page. A cut
              list with mixed units is how somebody cuts the wrong piece. */}
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Display unit">
            {UNITS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                aria-pressed={unit === u}
                className={`border-l border-slate-300 px-3 py-1.5 text-sm first:border-l-0 ${
                  unit === u ? 'bg-amber-700 font-medium text-white' : 'bg-white text-slate-700 hover:bg-amber-50'
                }`}
              >
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        </div>

        {unit === 'mm' && (
          <label className="flex items-center gap-2 pb-2 text-xs text-slate-600">
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[11px] uppercase tracking-wide text-slate-600">
              <th scope="col" className="py-1.5 pr-2 font-medium">Ref</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Piece</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Project</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Length</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Width</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Qty</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Stock</th>
              <th scope="col" className="py-1.5 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {project.parts.map((part) => (
              <tr key={part.id} className="border-b border-slate-200 align-top">
                <td className="py-2 pr-2 tnum text-xs font-semibold text-slate-500">{letterOf(part.id)}</td>
                <td className="py-2 pr-2">
                  <Text
                    value={part.name}
                    placeholder="Shelf, rail, stile…"
                    aria-label="Piece name"
                    onChange={(name) => patchPart(part.id, { name })}
                    className="min-w-[8rem]"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Text
                    value={part.project}
                    placeholder="optional"
                    aria-label="Project"
                    list="diy-projects"
                    onChange={(value) => patchPart(part.id, { project: value })}
                    className="min-w-[7rem]"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Num
                    mm={part.length}
                    unit={unit}
                    mmDecimals={mmDecimals}
                    label={`Length of ${part.name || 'piece'}`}
                    onChange={(length) => patchPart(part.id, { length })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Num
                    mm={part.width}
                    unit={unit}
                    mmDecimals={mmDecimals}
                    label={`Width of ${part.name || 'piece'}`}
                    onChange={(width) => patchPart(part.id, { width })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={part.qty}
                    aria-label={`Quantity of ${part.name || 'piece'}`}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      // Guarded here as well as in the model: a spinner can
                      // reach 0, and 0 pieces of something is a row that should
                      // have been deleted, not a cut list that refuses to draw.
                      if (Number.isInteger(n) && n >= 1) patchPart(part.id, { qty: n })
                    }}
                    className="tnum w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={stockIdFor(part)}
                    aria-label={`Stock for ${part.name || 'piece'}`}
                    onChange={(e) => {
                      const stock = findStock(e.target.value)
                      if (stock) {
                        patchPart(part.id, {
                          thickness: stock.mm,
                          material: stock.material,
                          grained: stock.grained,
                        })
                      }
                    }}
                    className="min-w-[9rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500"
                  >
                    {STOCK.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                    {stockIdFor(part) === 'custom' && (
                      <option value="custom">{part.material || 'Measured myself'}</option>
                    )}
                  </select>
                </td>
                <td className="py-2">
                  <div className="flex gap-1">
                    <IconButton label={`Duplicate ${part.name || 'piece'}`} onClick={() => duplicatePart(part.id)}>
                      ⧉
                    </IconButton>
                    <IconButton
                      label={`Delete ${part.name || 'piece'}${joinCount(project, part) ? ` and its ${joinCount(project, part)} joint(s)` : ''}`}
                      onClick={() => deletePart(part.id)}
                      disabled={project.parts.length === 1}
                    >
                      ✕
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Typed once, offered on every row. Two pieces in "Bookcase" and one in
          "Bookcaes" are two projects, and nothing downstream can tell. */}
      <datalist id="diy-projects">
        {[...new Set(project.parts.map((p) => p.project.trim()).filter(Boolean))].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addPart}
          className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          + Add a piece
        </button>
        <p className="text-xs text-slate-500">
          Length runs along the grain. Joints are set on the board below — a piece with no joints is
          cut to exactly the length here.
        </p>
      </div>
    </section>
  )
}

function joinCount(project: PartsProject, part: Part): number {
  return project.joints.filter((j) => j.through.part === part.id || j.butt.part === part.id).length
}

/** Which stock entry this row's thickness + material came from, if any. */
function stockIdFor(part: Part): string {
  return STOCK.find((s) => s.mm === part.thickness && s.material === part.material)?.id ?? 'custom'
}

function Text({
  value, onChange, placeholder, className = '', ...rest
}: {
  value: string
  /** The string, not the event — `onChange` is deliberately narrowed here. */
  onChange: (value: string) => void
  placeholder?: string
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'placeholder'>) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 ${className}`}
      {...rest}
    />
  )
}

/** A length in the display unit, stored as mm. Inline: no label, no hint. */
function Num({
  mm, unit, mmDecimals, label, onChange,
}: {
  mm: number; unit: Unit; mmDecimals: 0 | 1; label: string; onChange: (mm: number) => void
}) {
  const { invalid, props } = useLengthText(mm, unit, mmDecimals, onChange)
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      {...props}
      className={`tnum w-24 rounded-md border bg-white px-2 py-1.5 text-sm text-slate-900 outline-none ${
        invalid ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-amber-500'
      }`}
    />
  )
}

function IconButton({
  children, label, onClick, disabled,
}: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600"
    >
      <span aria-hidden>{children}</span>
    </button>
  )
}
