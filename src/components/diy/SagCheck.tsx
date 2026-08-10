import { useState } from 'react'
import { LOADS, SAG_LIMIT_RATIO, adviseShelves, type ShelfAdvice } from '../../lib/span'
import type { Cutlist, Design } from '../../lib/panels'
import { formatShort } from '../../lib/units'
import { useDiyStore } from '../../stores/diyStore'

/**
 * Will it sag?
 *
 * The one question this app could answer and did not. Cut sizes and a cutting
 * plan tell you how to build the box; they say nothing about whether the top
 * will bow under a row of books — and the arithmetic behind that is exactly the
 * kind nobody does in their head, because deflection goes with the CUBE of both
 * the thickness and the span.
 *
 * The reasoning is shown, not just the verdict. "Use 25 mm" is advice you
 * either take or ignore; "your 964 mm span in MDF puts 4 mm of bend in it on
 * day one and 10 mm after a few years, against a 4.8 mm limit" is something you
 * can argue with — and argue with it people should, because the inputs are
 * typical published stiffnesses and a real board is whatever the mill sent.
 */
export default function SagCheck({ design, cutlist }: { design: Design; cutlist: Cutlist }) {
  const unit = useDiyStore((s) => s.unit)
  const mmDecimals = useDiyStore((s) => s.mmDecimals)
  const [loadId, setLoadId] = useState('books')

  const load = LOADS.find((l) => l.id === loadId) ?? LOADS[1]
  const advice = adviseShelves(design, cutlist, load.kgPerM)
  if (!advice.length) return null

  const worst = advice.reduce((a, b) => (a.sag.longTerm >= b.sag.longTerm ? a : b))
  const fmt = (mm: number) => formatShort(mm, unit, mmDecimals)

  return (
    <section className="print-sheet rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">Will it sag?</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          A panel held up only at its two ends bends under weight. How much goes with the{' '}
          <span className="font-medium">cube</span> of the thickness and the cube of the span, which is
          why an inch of extra span matters more than it looks and why going one size thicker helps
          more than it looks.
        </p>
      </header>

      <div className="no-print mb-4">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">What will be on it?</span>
        <div className="flex flex-wrap gap-2">
          {LOADS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLoadId(l.id)}
              aria-pressed={l.id === loadId}
              className={`rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${
                l.id === loadId
                  ? 'border-amber-600 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-amber-50'
              }`}
            >
              <span className="block font-semibold">{l.label} · {l.kgPerM} kg/m</span>
              <span className="block text-[11px] text-slate-500">{l.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {advice.map((a) => <Verdict key={a.panel} a={a} fmt={fmt} unit={unit} />)}
      </div>

      {!worst.materialRecognised && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          <span className="font-semibold">“{design.material || 'Your material'}” is not one this
          recognises</span>, so the figures above assume ordinary plywood. If it is actually chipboard
          or MDF the real sag is roughly three times worse — put the word “MDF”, “chipboard”, “ply”,
          “pine” or “oak” in the material name and it will use the right numbers.
        </p>
      )}

      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">How this is worked out, and what it ignores</summary>
        <div className="mt-2 space-y-2">
          <p>
            Standard beam deflection for a panel resting on a support at each end with the weight
            spread evenly along it: <span className="tnum">δ = 5WL³ / 384EI</span>, where{' '}
            <span className="tnum">I = bd³/12</span>. The pass mark is span ÷ {SAG_LIMIT_RATIO} — about{' '}
            {fmt(worst.span / SAG_LIMIT_RATIO)} {unit} on your {fmt(worst.span)} {unit} span — which is
            roughly where a bend stops being invisible.
          </p>
          <p>
            <span className="font-medium">The long-term figure is the one to look at.</span> Wood and
            board creep: under a load that never comes off they keep bending for years. Plywood ends up
            about 1.8× its day-one bend, MDF about 2.5×, chipboard about 3.25×. That is why the cheap
            bookshelf looks fine when you build it and bowed two winters later.
          </p>
          <p>
            <span className="font-medium">Four things make a real shelf stiffer than this says</span>,
            and none are counted: a back panel glued or pinned on, a lip or batten along the front
            edge, a centre support, and screws into the ends rather than a loose rest. Any of them can
            transform a marginal shelf — a 20 mm front lip is usually the cheapest fix on this page.
          </p>
          <p className="text-slate-500">
            Stiffness figures are typical published values for the material class. Real boards vary a
            lot; two sheets of “18 mm MDF” from different mills are not the same board. Treat this as a
            sanity check for domestic shelving — <span className="font-medium">never</span> for
            anything that would hurt somebody if it let go.
          </p>
        </div>
      </details>
    </section>
  )
}

function Verdict({ a, fmt, unit }: { a: ShelfAdvice; fmt: (mm: number) => string; unit: string }) {
  const good = a.sag.ok
  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${
        good ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <p className={`text-sm font-semibold ${good ? 'text-emerald-900' : 'text-amber-900'}`}>
        {a.part} — {good ? 'stiff enough' : 'will sag more than it should'}
      </p>
      <p className="mt-1 text-xs text-slate-700">
        It spans <span className="tnum font-medium">{fmt(a.span)} {unit}</span> between the sides,{' '}
        <span className="tnum">{fmt(a.width)} {unit}</span> wide, carrying about{' '}
        <span className="tnum font-medium">{a.sag.loadKg.toFixed(0)} kg</span>. In {a.stiffness.label}{' '}
        at <span className="tnum">{a.thicknessMm} mm</span> that bends{' '}
        <span className="tnum font-medium">{a.sag.initial.toFixed(1)} mm</span> straight away and{' '}
        <span className="tnum font-medium">{a.sag.longTerm.toFixed(1)} mm</span> once it has crept,
        against a limit of <span className="tnum font-medium">{a.sag.limit.toFixed(1)} mm</span>.
      </p>

      {!good && (
        <ul className="mt-2 space-y-1 text-xs text-amber-900">
          {a.thicker ? (
            <li>
              • <span className="font-semibold">Go to {a.thicker} mm</span> in the same material — the
              thinnest stock size that gets under the limit.
            </li>
          ) : (
            // Said even when a stiffer material would work, because otherwise
            // the obvious first thought — "I'll just buy a thicker board" — is
            // left standing and it does not work here.
            <li>
              • <span className="font-semibold">Going thicker will not save it.</span> Nothing up to
              25 mm in {a.stiffness.label} gets this span under the limit.
            </li>
          )}
          {a.stiffer && (
            <li>
              • <span className="font-semibold">Keep {a.thicknessMm} mm and use {a.stiffer.label}</span>,
              which is {(a.stiffer.e / a.stiffness.e).toFixed(1)}× stiffer.
            </li>
          )}
          <li>
            • <span className="font-semibold">Or shorten the span.</span> It is the strongest lever
            here — halving the gap takes the bend to a sixteenth — and a batten along the front edge
            is the cheapest version of the same idea.
          </li>
        </ul>
      )}

      {a.panel === 'bottom' && (
        // A base sitting flat on the floor is held up along its whole length
        // and cannot sag at all. Reporting a number for it without saying this
        // would send somebody to buy a thicker board for no reason.
        <p className="mt-1.5 text-[11px] text-slate-500">
          Only applies if the box stands on legs or a plinth. A base resting flat on the floor is
          supported all the way along and will not bend.
        </p>
      )}
    </div>
  )
}
