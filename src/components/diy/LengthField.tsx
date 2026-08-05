import { useEffect, useId, useState } from 'react'
import { fieldText, parseLength, type Unit } from '../../lib/units'

/**
 * One length, entered in the document's display unit and stored as millimetres.
 *
 * The field keeps its own text while it is being typed — committing on every
 * keystroke would reformat "6" into "6.0" under the caret — and only pushes a
 * value up when the text parses to a positive length. A half-typed or nonsense
 * entry leaves the last good value in the model and says so, rather than
 * putting NaN into a cut size.
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
  const [text, setText] = useState(() => fieldText(mm, unit, mmDecimals))
  const [editing, setEditing] = useState(false)

  // Re-sync from the model whenever it changes underneath us (a preset, an
  // example, a shared link) — but never while the field has the caret.
  useEffect(() => {
    if (!editing) setText(fieldText(mm, unit, mmDecimals))
  }, [mm, unit, mmDecimals, editing])

  const parsed = parseLength(text, unit)
  const invalid = parsed === null || parsed <= 0

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
          value={text}
          aria-invalid={invalid}
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false)
            setText(fieldText(mm, unit, mmDecimals))
          }}
          onChange={(e) => {
            setText(e.target.value)
            const next = parseLength(e.target.value, unit)
            if (next !== null && next > 0) onChange(next)
          }}
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
