import {
  PANEL_IDS,
  PANEL_NAMES,
  PRESETS,
  matchPreset,
  priorities,
} from '../../lib/panels'
import { useDiyStore } from '../../stores/diyStore'

/**
 * How the six panels meet.
 *
 * The model is a strict WRAP ORDER, outermost first — at each of the twelve
 * edges the panel with the lower number runs through and the other butts against
 * its inner face. That is valid by construction: every edge has exactly one
 * winner, so nothing can overlap and no edge can be left hollow.
 *
 * Six independent "extends / sits inside" booleans would NOT be valid: both
 * extending puts two pieces of wood in the same corner, and both sitting inside
 * leaves a t × t groove running the full length of the edge. The toggles below
 * therefore drive the order — "extends to the edge" promotes a panel to 1,
 * "sits inside" demotes it to 6 — rather than being state of their own. There is
 * no sequence of clicks in this panel that reaches an invalid box.
 */
export default function WrapOrder() {
  const design = useDiyStore((s) => s.design)
  const advanced = useDiyStore((s) => s.advanced)
  const setAdvanced = useDiyStore((s) => s.setAdvanced)
  const applyOrder = useDiyStore((s) => s.applyOrder)
  const setOutermost = useDiyStore((s) => s.setOutermost)
  const togglePresent = useDiyStore((s) => s.togglePresent)
  const movePanel = useDiyStore((s) => s.movePanel)
  const setHover = useDiyStore((s) => s.setHover)
  const hover = useDiyStore((s) => s.hover)

  const prio = priorities(design.order)
  const active = matchPreset(design.order)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-1">How the panels meet</h2>
      <p className="text-xs text-slate-500 mb-3">
        Pick the box you are building. The panel nearer the top of the order runs through; the other
        one butts against its inner face and loses one thickness at that end.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyOrder(preset.order)}
            aria-pressed={active?.id === preset.id}
            className={`text-left rounded-md border px-3 py-2 transition-colors ${
              active?.id === preset.id
                ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-500'
                : 'border-slate-300 bg-white hover:border-amber-400 hover:bg-amber-50/50'
            }`}
          >
            <span className="block text-sm font-medium text-slate-900">{preset.label}</span>
            <span className="block text-[11px] leading-snug text-slate-600 mt-0.5">{preset.blurb}</span>
          </button>
        ))}
      </div>

      <table className="w-full mt-4 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th scope="col" className="font-medium py-1">Panel</th>
            <th scope="col" className="font-medium py-1">In the box</th>
            <th scope="col" className="font-medium py-1">At its edges</th>
          </tr>
        </thead>
        <tbody>
          {PANEL_IDS.map((panel) => {
            const present = design.present[panel]
            return (
              <tr
                key={panel}
                onMouseEnter={() => setHover(panel)}
                onMouseLeave={() => setHover(null)}
                className={hover === panel ? 'bg-amber-50' : undefined}
              >
                <th scope="row" className="py-1.5 pr-2 font-medium text-slate-800 text-left">
                  <span className="tnum text-slate-400 mr-1.5">{prio[panel]}</span>
                  {PANEL_NAMES[panel]}
                </th>
                <td className="py-1.5 pr-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={present}
                      onChange={() => togglePresent(panel)}
                      className="accent-amber-700"
                    />
                    {present ? 'Present' : 'Omitted'}
                  </label>
                </td>
                <td className="py-1.5">
                  <div className="inline-flex rounded-md border border-slate-300 overflow-hidden" role="group">
                    <button
                      type="button"
                      disabled={!present}
                      onClick={() => setOutermost(panel, true)}
                      aria-pressed={prio[panel] === 1}
                      className={`px-2.5 py-1 text-xs ${
                        prio[panel] === 1 ? 'bg-amber-700 text-white font-medium' : 'bg-white text-slate-700 hover:bg-amber-50'
                      } disabled:opacity-40 disabled:hover:bg-white`}
                    >
                      Extends to the edge
                    </button>
                    <button
                      type="button"
                      disabled={!present}
                      onClick={() => setOutermost(panel, false)}
                      aria-pressed={prio[panel] === PANEL_IDS.length}
                      className={`px-2.5 py-1 text-xs border-l border-slate-300 ${
                        prio[panel] === PANEL_IDS.length ? 'bg-amber-700 text-white font-medium' : 'bg-white text-slate-700 hover:bg-amber-50'
                      } disabled:opacity-40 disabled:hover:bg-white`}
                    >
                      Sits inside
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mt-3 text-[11px] text-slate-500">
        Opposite panels never share an edge, so their order relative to each other changes nothing.
        Omitting a panel takes its deduction away too — an open-top tray's sides keep their full
        height.
      </p>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          aria-expanded={advanced}
          className="text-xs font-medium text-amber-800 hover:text-amber-900 underline-offset-2 hover:underline"
        >
          {advanced ? 'Hide' : 'Show'} the wrap order ({design.order.map((p) => PANEL_NAMES[p].replace(' side', '')).join(' · ')})
        </button>

        {advanced && (
          <ol className="mt-3 space-y-1">
            {design.order.map((panel, index) => (
              <li
                key={panel}
                onMouseEnter={() => setHover(panel)}
                onMouseLeave={() => setHover(null)}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                  hover === panel ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span className="tnum w-5 text-slate-500">{index + 1}</span>
                <span className="flex-1 text-slate-800">
                  {PANEL_NAMES[panel]}
                  {!design.present[panel] && <span className="ml-1.5 text-xs text-slate-500">(omitted)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => movePanel(panel, index - 1)}
                  disabled={index === 0}
                  aria-label={`Move ${PANEL_NAMES[panel]} outward`}
                  className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-xs text-slate-700 hover:bg-amber-50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => movePanel(panel, index + 1)}
                  disabled={index === design.order.length - 1}
                  aria-label={`Move ${PANEL_NAMES[panel]} inward`}
                  className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-xs text-slate-700 hover:bg-amber-50 disabled:opacity-30"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
