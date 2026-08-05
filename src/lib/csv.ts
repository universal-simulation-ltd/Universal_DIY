// ---------------------------------------------------------------------------
// CSV export.
//
// The column ORDER is not a style choice — it is chosen so the file pastes
// straight into cutlistoptimizer / OptiCutter, which is the deliberate escape
// hatch while this app has no optimiser of its own:
//
//     Length,Width,Qty,Label,Material,Grain,Notes
//
// Always millimetres, always a `.` decimal separator, no thousands separators,
// header row. The display unit does NOT apply here — an importer expects mm and
// a localised decimal comma would silently corrupt every number.
//
// One row per piece TYPE with a Qty column, not one row per piece: a CSV goes
// to a spreadsheet or another tool, where per-piece rows are noise.
// ---------------------------------------------------------------------------

import type { PieceType } from './panels'

export const CSV_COLUMNS = ['Length', 'Width', 'Qty', 'Label', 'Material', 'Grain', 'Notes'] as const

function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** mm, `.` decimal, at most 2 dp, no trailing zeros, no thousands separator. */
export function csvNumber(mm: number): string {
  const rounded = Math.round(mm * 100) / 100
  return String(rounded)
}

export function toCsv(
  types: PieceType[],
  material: string,
  notes: Record<string, string> = {},
): string {
  const rows = [CSV_COLUMNS.join(',')]
  for (const t of types) {
    rows.push([
      csvNumber(t.length),
      csvNumber(t.width),
      String(t.qty),
      cell(t.letter),
      cell(material),
      cell(t.grain),
      cell(notes[t.letter] ?? ''),
    ].join(','))
  }
  // Trailing newline: spreadsheets and `wc -l` both expect one, and importers
  // that split on '\n' otherwise drop or keep a phantom last row inconsistently.
  return rows.join('\n') + '\n'
}

export function downloadCsv(csv: string, filename: string): void {
  // A BOM would break cutlistoptimizer's header match, so this is plain UTF-8.
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** A filesystem-safe stem from the project name. */
export function safeFilename(name: string, fallback = 'cutlist'): string {
  const stem = name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-').toLowerCase()
  return stem || fallback
}
