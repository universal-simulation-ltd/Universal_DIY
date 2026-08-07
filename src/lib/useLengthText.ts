import { useEffect, useState } from 'react'
import { fieldText, parseLength, type Unit } from './units'

/**
 * The typing contract shared by every length input in the app.
 *
 * Committing on each keystroke would reformat "6" into "6.0" under the caret,
 * so the field keeps its own text while it has focus and only pushes a value up
 * when that text parses to a positive length. A half-typed or nonsense entry
 * leaves the last good value in the model rather than putting NaN into a cut
 * size — the same rule the whole app runs on.
 *
 * A hook rather than a component because the two callers need different
 * chrome: the box page stacks a label and a hint above the field, the parts
 * table has neither (the column heading is the label, and a stacked one per
 * cell would triple the row height). Giving one component both layouts and a
 * flag would be worse than sharing the four lines that actually matter.
 */
export function useLengthText(
  mm: number,
  unit: Unit,
  mmDecimals: 0 | 1,
  onChange: (mm: number) => void,
) {
  const [text, setText] = useState(() => fieldText(mm, unit, mmDecimals))
  const [editing, setEditing] = useState(false)

  // Re-sync from the model whenever it changes underneath us (a preset, an
  // example, a shared link, a stock change) — but never while the field has the
  // caret, or the value would jump mid-word.
  useEffect(() => {
    if (!editing) setText(fieldText(mm, unit, mmDecimals))
  }, [mm, unit, mmDecimals, editing])

  const parsed = parseLength(text, unit)
  const invalid = parsed === null || parsed <= 0

  return {
    invalid,
    /** Spread onto an <input>. */
    props: {
      value: text,
      'aria-invalid': invalid,
      onFocus: () => setEditing(true),
      onBlur: () => {
        setEditing(false)
        setText(fieldText(mm, unit, mmDecimals))
      },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value)
        const next = parseLength(e.target.value, unit)
        if (next !== null && next > 0) onChange(next)
      },
    },
  }
}
