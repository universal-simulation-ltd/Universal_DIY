import { CONTAINER } from '../../lib/layout'
import { hrefFor, navigate } from '../../lib/route'
import { usePartsCutlist, usePartsStore } from '../../stores/partsStore'
import JoinBoard from './JoinBoard'
import PartsCutList from './PartsCutList'
import PartsExports from './PartsExports'
import PartsTable from './PartsTable'

/**
 * The free parts list page.
 *
 * Same shape as the box page and for the same reasons: inputs first, then the
 * drawing that shows what the inputs mean, then the sheet, then the exports.
 * The one difference is that the drawing is also the control — the join board
 * is where a joint is made, because "click the two ends that meet" is a thing
 * you do to a picture and not to a form.
 */
export default function PartsApp() {
  const project = usePartsStore((s) => s.project)
  const cutlist = usePartsCutlist()
  const blocked = cutlist.errors.length > 0

  return (
    <div className={`${CONTAINER} py-5 sm:py-7`}>
      <header className="no-print mb-5">
        <a
          href={hrefFor('home')}
          onClick={(e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            navigate('home')
          }}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-800"
        >
          <span aria-hidden>←</span> All templates
        </a>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900">
          Custom parts list
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Any pieces you like — give each one a length and a width. Where two pieces butt together,
          click the two ends that meet and one loses a thickness to the other; leave them separate
          and they are cut exactly as typed. Several projects can share one list, and one sheet.
        </p>
      </header>

      <div className="space-y-4">
        <PartsTable project={project} cutlist={cutlist} />

        {blocked ? (
          <section className="rounded-lg border border-red-300 bg-red-50 p-4" role="alert">
            <h2 className="text-sm font-semibold text-red-900">No cut list — the numbers do not work</h2>
            <ul className="mt-2 space-y-1 text-sm text-red-800">
              {cutlist.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-red-700">
              Nothing is shown rather than something plausible: a cut size is the worst possible
              place to discover a bad input.
            </p>
          </section>
        ) : (
          <>
            <JoinBoard project={project} cutlist={cutlist} />
            <PartsCutList project={project} cutlist={cutlist} />
            <PartsExports project={project} cutlist={cutlist} />
          </>
        )}
      </div>
    </div>
  )
}
