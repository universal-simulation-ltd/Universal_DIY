import { useId } from 'react'
import { useLengthText } from '../../lib/useLengthText'
import type { Unit } from '../../lib/units'

/**
 * One length, entered in the document's display unit and stored as millimetres,
 * with a label above and an optional hint below.
 *
 * The typing behaviour — keep the text while the caret is here, only commit a
 * value that parses — lives in `useLengthText`, shared with the parts table's
 * inline version so the two can never drift.
 */
interface Props {
  label: string
  mm: number
  unit: Unit
  mmDecimals: 0 | 1
  onChange: (mm: number) => void
  hint?: string
  id?: string
}

export default function LengthField({ label, mm, unit, mmDecimals, onChange, hint, id }: Props) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const { invalid, props } = useLengthText(mm, unit, mmDecimals, onChange)

  return (
    <div>
      <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type="text"
          inputMode="decimal"
          className={`tnum w-full rounded-md border px-2.5 py-1.5 pr-10 text-sm text-slate-900 bg-white outline-none focus:ring-2 ${
            invalid
              ? 'border-red-400 focus:ring-red-200'
              : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
          }`}
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          {...props}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
          {unit}
        </span>
      </div>
      {hint && (
        <p id={`${fieldId}-hint`} className="mt-1 text-[11px] leading-tight text-slate-500">
          {hint}
        </p>
      )}
      {invalid && (
        <p className="mt-1 text-[11px] leading-tight text-red-600">
          Not a length — the last good value is still in use.
        </p>
      )}
    </div>
  )
}
