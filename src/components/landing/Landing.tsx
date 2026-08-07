import { useState } from 'react'
import { CONTAINER } from '../../lib/layout'
import { hrefFor, navigate } from '../../lib/route'
import { encodeShare } from '../../lib/share'
import { TEMPLATES, blankDesign, openFaces, type Template } from '../../lib/templates'
import { formatShort, type Unit } from '../../lib/units'
import type { Design } from '../../lib/panels'
import { useDiyStore } from '../../stores/diyStore'
import HeroAssembly from './HeroAssembly'
import TemplatePreview from './TemplatePreview'

/**
 * The landing page: "what are you building?" before "type three numbers".
 *
 * The calculator's first question used to be the outer width of a box, which is
 * the right question only if you already knew you wanted the box calculator.
 * Everything here exists to turn a shape somebody can name into a starting
 * `Design` — and then get out of the way. Nothing on this page is a setting.
 * Every template is an ordinary design the moment it lands, and the link at the
 * bottom skips the page entirely.
 */
export default function Landing() {
  const origin = useDiyStore((s) => s.origin)
  const design = useDiyStore((s) => s.design)
  const unit = useDiyStore((s) => s.unit)
  const mmDecimals = useDiyStore((s) => s.mmDecimals)
  const replace = useDiyStore((s) => s.replace)

  // Not `no-print`. There is nothing here worth taking to a workshop, but
  // hiding the whole page would make Ctrl+P on the front door produce a blank
  // sheet, which reads as a broken app rather than as "nothing to print". It
  // prints as an ordinary web page; index.css freezes the animation so no piece
  // is caught mid-flight.
  return (
    <div>
      {/* --- hero ---------------------------------------------------------- */}
      <section className="border-b border-slate-200 bg-white">
        <div className={`${CONTAINER} py-8 sm:py-12`}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] gap-8 lg:gap-12 items-center">
            <div>
              <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900">
                What are you building?
              </h1>
              <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-xl">
                Pick the shape, type three numbers, and get every piece&apos;s cut size, a scale
                drawing and a printable cut list — in about sixty seconds.
              </p>
              <p className="mt-3 text-sm text-slate-500 max-w-xl">
                Butt-joint boxes in sheet material. The whole calculation is arithmetic in your
                browser: nothing is uploaded, nothing needs an account, and it works with the
                Wi-Fi off.
              </p>

              {origin === 'saved' && (
                <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4">
                  <p className="text-sm text-amber-900">
                    You were last drawing{' '}
                    <strong className="font-semibold">{design.name || 'a box'}</strong>,{' '}
                    {sizeText(design, unit, mmDecimals)}.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('cutlist')}
                    className="mt-2 rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
                  >
                    Carry on with it →
                  </button>
                </div>
              )}

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                {['No sign-up', 'Nothing uploaded', 'Works offline', 'Prints on one page', 'Open source'].map((claim) => (
                  <li key={claim} className="flex items-center gap-1.5">
                    <span aria-hidden className="text-amber-700">✓</span>
                    {claim}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <HeroAssembly />
              <figcaption className="mt-3 text-[11px] leading-snug text-slate-500">
                A real cross-section of a 600 × 400 × 300 box in 18 mm ply, drawn to scale. Watch
                the two sides land at full height and the top drop in <em>between</em> them, one
                thickness short at each end. Getting that lap right is the whole job.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* --- templates ----------------------------------------------------- */}
      <section className={`${CONTAINER} py-8 sm:py-10`}>
        <header className="mb-5">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Start with a template</h2>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Each one is a starting point, not a mode — every size, panel and joint is still yours to
            change on the next screen. The drawings below are the real plan and elevation sections
            of each template, to scale, with walls one true thickness thick.
          </p>
        </header>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((template) => (
            <li key={template.id}>
              <TemplateCard template={template} />
            </li>
          ))}
        </ul>

        <p className="mt-5 text-sm text-slate-600">
          Building something else?{' '}
          <a
            href={hrefFor('cutlist')}
            onClick={(e) => {
              if (isPlainClick(e)) {
                e.preventDefault()
                replace(blankDesign(), unit, {})
                navigate('cutlist')
              }
            }}
            className="font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            Start from an empty box
          </a>{' '}
          — anything six flat panels can make is in range, and the panel order is fully
          reorderable.
        </p>
      </section>

      {/* --- what happens next --------------------------------------------- */}
      <section className="border-t border-slate-200 bg-white">
        <div className={`${CONTAINER} py-8 sm:py-10`}>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Then what</h2>
          <ol className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: 'Type the outer size',
                body: 'Width, depth, height and your material thickness — in millimetres, centimetres or inches. The thickness is never rounded: a ¾″ board is 19.05 mm and deducts 38.1 mm.',
              },
              {
                title: 'Say how the panels meet',
                body: 'Four presets, or drag the six panels into any order you like. Every one of the 720 orders is a buildable box — there is no way to reach an overlap or a gap from the UI.',
              },
              {
                title: 'Print it and go cut',
                body: 'A scale exploded diagram, a tick box per piece, the grain direction, and the interior cavity as a check line. CSV exports straight into cutlistoptimizer.',
              },
            ].map((step, i) => (
              <li key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <span className="tnum inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>

          {/* Said on the way in, not discovered on the way out. */}
          <p className="mt-5 text-xs text-slate-500 max-w-3xl">
            Butt joints only, one thickness per box, no saw kerf. No mitres, rabbets, dados, finger
            joints, hardware, internal shelves or drawers — those turn a cut size into a machining
            operation, and they are done better by Fusion 360, SketchUp with OpenCutList, or
            Boxes.py. What you get here is a number you can check by hand, at the saw, with a tape
            measure.
          </p>
        </div>
      </section>
    </div>
  )
}

function TemplateCard({ template }: { template: Template }) {
  const unit = useDiyStore((s) => s.unit)
  const applyTemplate = useDiyStore((s) => s.applyTemplate)
  // Bumped on hover to remount the drawing, which is what restarts its CSS
  // animation — see TemplatePreview.
  const [replay, setReplay] = useState(0)

  const { design } = template

  // A real href, so middle-click and "open in new tab" work — and it is not a
  // decorative one: the hash carries the whole design, so the new tab opens on
  // this exact template. A plain click takes the SPA path instead and leaves the
  // address bar clean.
  const href = `${hrefFor('cutlist')}#d=${encodeShare({ design, unit })}`

  return (
    <a
      href={href}
      onClick={(e) => {
        if (!isPlainClick(e)) return
        e.preventDefault()
        applyTemplate(template)
        navigate('cutlist')
      }}
      onMouseEnter={() => setReplay((n) => n + 1)}
      onFocus={() => setReplay((n) => n + 1)}
      className="diy-card group block h-full rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-amber-400 hover:bg-amber-50/40 focus:outline-none focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-200"
    >
      <div className="h-28 sm:h-32">
        <TemplatePreview design={design} replay={replay} />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{template.label}</h3>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          {openFaces(design)}
        </span>
      </div>

      <p className="mt-0.5 text-xs text-slate-500">{template.tagline}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{template.blurb}</p>

      <p className="tnum mt-3 text-[11px] text-slate-500">
        Starts at {sizeText(design, unit, 0)} in {design.material}
      </p>
    </a>
  )
}

/**
 * "600 × 400 × 300 mm".
 *
 * `formatShort` rather than `formatLength` because the long form appends a
 * decimal-inch tail to every figure and three of those in a row is a sentence
 * nobody reads; the unit suffix is skipped for inches because the fraction
 * already carries its own ″.
 *
 * The template cards pass 0 decimals: an advertised starting size is not a cut
 * size, every template is a round number, and "600.0" is a decimal place
 * carrying nothing. The resume line does NOT — that is somebody's own saved
 * box, it may well be 612.5 mm, and rounding a number the user typed is how a
 * page tells them their design is something it isn't.
 */
function sizeText(design: Design, unit: Unit, mmDecimals: 0 | 1): string {
  const dims = [design.width, design.depth, design.height]
    .map((mm) => formatShort(mm, unit, mmDecimals))
    .join(' × ')
  return unit === 'in' ? dims : `${dims} ${unit}`
}

/**
 * A left-click with no modifier — the only kind an SPA should intercept.
 * Ctrl/Cmd/Shift-click and middle-click are the browser's to handle, and
 * swallowing them is how a link stops being able to open in a new tab.
 */
function isPlainClick(e: React.MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
