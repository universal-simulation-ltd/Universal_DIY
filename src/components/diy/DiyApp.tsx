import { useEffect, useRef } from 'react'
import { CONTAINER } from '../../lib/layout'
import { currentRoute, hrefFor, navigate } from '../../lib/route'
import { useCutlist, useDiyStore } from '../../stores/diyStore'
import BoxInputs from './BoxInputs'
import CutList from './CutList'
import Diagram from './Diagram'
import Exports from './Exports'
import WrapOrder from './WrapOrder'

export default function DiyApp() {
  const design = useDiyStore((s) => s.design)
  const cutlist = useCutlist()
  const listRef = useRef<HTMLDivElement>(null)

  // /diy/cutlist is a working alias for the same one-tool app, and arriving on
  // it is not a no-op: somebody who typed that URL wants the list, so the page
  // opens scrolled to it.
  useEffect(() => {
    if (currentRoute() === 'cutlist') {
      listRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [])

  const blocked = cutlist.errors.length > 0

  return (
    <div className={`${CONTAINER} py-5 sm:py-7`}>
      <header className="no-print mb-5">
        {/* Back to the templates. A real href so it can be opened in a new tab,
            and it deliberately does NOT reset the design — coming back here
            finds the box exactly as it was left. */}
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
          Cut list for a butt-joint box
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Type the outer size and your material thickness, say how the six panels meet, and every
          piece's cut size falls out. Runs entirely in your browser — nothing is uploaded, and it
          works offline.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4 items-start">
        <div className="no-print space-y-4 lg:sticky lg:top-4">
          <BoxInputs />
          <WrapOrder />
        </div>

        <div className="space-y-4 min-w-0">
          {blocked ? (
            <section className="rounded-lg border border-red-300 bg-red-50 p-4" role="alert">
              <h2 className="text-sm font-semibold text-red-900">No cut list — the numbers do not make a box</h2>
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
              <div className="print-sheet">
                <Diagram design={design} cutlist={cutlist} />
              </div>
              {/* No forced page break: for an ordinary box the drawing and the
                  list fit one sheet, and a break here would print a blank half
                  page every time. A list long enough to need page 2 gets there
                  on its own, with the header row repeated (see index.css). */}
              <div ref={listRef}>
                <CutList design={design} cutlist={cutlist} />
              </div>
              <Exports design={design} cutlist={cutlist} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
