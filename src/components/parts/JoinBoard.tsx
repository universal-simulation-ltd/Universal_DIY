import {
  END_IDS,
  END_NAME,
  jointAt,
  roleAt,
  type EndId,
  type Part,
  type PartsCutlist,
  type PartsProject,
} from '../../lib/parts'
import { formatShort } from '../../lib/units'
import { usePartsStore } from '../../stores/partsStore'

/**
 * The join board: one bar per piece, drawn to a common scale, with a clickable
 * cap at each end.
 *
 * Click an end, then click the end it meets. The first one clicked runs
 * THROUGH; the second butts into it and loses one thickness. Click a joined end
 * again to separate them. That is the whole interaction, and it is one control
 * per end because an end has one thing to be: joined or not.
 *
 * The bars are to scale for the same reason every other drawing in this app is:
 * a piece that has lost 18 mm off a 400 mm rail has to LOOK 4% shorter without
 * anybody reading a digit. What each butted end lost is drawn as a hatched
 * stub beyond the cut length, so the bar shows both numbers at once — what you
 * typed, and what you cut.
 *
 * The caps are real <button>s rather than SVG hit areas. A drawing you can only
 * operate with a mouse would put the one genuinely new control in this app out
 * of reach of a keyboard, and an aria-label on each cap is the only way the
 * board says anything at all to a screen reader.
 */
export default function JoinBoard({ project, cutlist }: { project: PartsProject; cutlist: PartsCutlist }) {
  const arming = usePartsStore((s) => s.arming)
  const refusal = usePartsStore((s) => s.refusal)
  const cancelArming = usePartsStore((s) => s.cancelArming)
  const clickEnd = usePartsStore((s) => s.clickEnd)
  const flipJoint = usePartsStore((s) => s.flipJoint)
  const unjoin = usePartsStore((s) => s.unjoin)
  const unit = usePartsStore((s) => s.unit)
  const mmDecimals = usePartsStore((s) => s.mmDecimals)

  // One scale for every bar. Nominal, not cut, so a bar never grows when a
  // joint is removed — the drawing would appear to reward unjoining.
  const longest = Math.max(...project.parts.map((p) => p.length), 1)
  const letterOf = (id: string) => cutlist.pieces.find((p) => p.id === id)?.typeLetter ?? ''

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">How the pieces meet</h2>
        {/* Instructions for a control, so they belong on screen and nowhere
            near a sheet somebody carries to a saw. */}
        <p className="no-print mt-1 text-[11px] leading-snug text-slate-500">
          Click one end, then the end it meets. The first runs through; the second butts into it and
          loses one thickness — the hatched stub is what it lost. Click a joined end to separate
          them again. Pieces with no joints are cut to exactly the length you typed.
        </p>
      </header>

      <div
        aria-live="polite"
        className={`no-print mb-3 rounded-md px-3 py-2 text-xs ${
          refusal
            ? 'border border-red-300 bg-red-50 text-red-800'
            : arming
              ? 'border border-amber-300 bg-amber-50 text-amber-900'
              : 'border border-slate-200 bg-slate-50 text-slate-600'
        }`}
      >
        {refusal ? (
          refusal
        ) : arming ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>
              <strong>{nameOf(project, arming.part)}</strong>’s {END_NAME[arming.end]} will run
              through. Now click the end that butts into it.
            </span>
            <button
              type="button"
              onClick={cancelArming}
              className="rounded border border-amber-400 bg-white px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100"
            >
              Cancel
            </button>
          </span>
        ) : (
          'Nothing selected. Click the end of a piece to start a joint, or leave every piece separate.'
        )}
      </div>

      <ul className="space-y-2.5">
        {project.parts.map((part) => (
          <li key={part.id} className="flex items-center gap-3">
            <div className="w-28 sm:w-36 shrink-0 min-w-0">
              <p className="truncate text-xs font-medium text-slate-900">
                {letterOf(part.id) && <span className="tnum mr-1 text-slate-500">{letterOf(part.id)}</span>}
                {part.name.trim() || <span className="text-slate-400">Unnamed</span>}
              </p>
              {part.project.trim() && (
                <p className="truncate text-[10px] text-slate-500">{part.project}</p>
              )}
            </div>
            <Bar
              part={part}
              project={project}
              longest={longest}
              onEnd={(end) => clickEnd({ part: part.id, end })}
              arming={arming}
              label={`${formatShort(cutLength(part, cutlist), unit, mmDecimals)} ${unit === 'in' ? '' : unit}`}
            />
          </li>
        ))}
      </ul>

      {/* `no-print`: the cut list prints these same sentences in its header, so
          on paper this block is a second copy with two dead buttons attached. */}
      {project.joints.length > 0 && (
        <div className="no-print mt-4 border-t border-slate-200 pt-3">
          <h3 className="text-xs font-semibold text-slate-900">
            Joints ({project.joints.length})
          </h3>
          <ul data-testid="joints" className="mt-2 space-y-1.5">
            {project.joints.map((joint) => (
              <li key={joint.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                <span className="min-w-0 flex-1">
                  {cutlist.jointSummary[project.joints.indexOf(joint)] ?? ''}
                </span>
                <button
                  type="button"
                  onClick={() => flipJoint(joint.id)}
                  className="no-print rounded border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-amber-50"
                >
                  Swap which runs through
                </button>
                <button
                  type="button"
                  onClick={() => unjoin(joint.id)}
                  className="no-print rounded border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-amber-50"
                >
                  Separate
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** The cut length as the model computed it — never recalculated here. */
function cutLength(part: Part, cutlist: PartsCutlist): number {
  return cutlist.pieces.find((p) => p.id === part.id)?.length ?? part.length
}

function nameOf(project: PartsProject, id: string): string {
  return project.parts.find((p) => p.id === id)?.name.trim() || 'Unnamed piece'
}

interface BarProps {
  part: Part
  project: PartsProject
  longest: number
  onEnd: (end: EndId) => void
  arming: { part: string; end: EndId } | null
  label: string
}

function Bar({ part, project, longest, onEnd, arming, label }: BarProps) {
  const pct = (part.length / longest) * 100

  return (
    <div className="min-w-0 flex-1">
      <div className="relative h-9" style={{ width: `${pct}%`, minWidth: '5.5rem' }}>
        {/* The solid body plus a hatched stub at each butted end. The three
            segments together are the NOMINAL length, so the bar's total width
            stays put when a joint is added and only the fill moves. */}
        <div className="absolute inset-0 flex overflow-hidden rounded border border-slate-400 bg-slate-100">
          {END_IDS.map((end) => {
            const joint = jointAt(project.joints, { part: part.id, end })
            const butts = joint ? roleAt(joint, { part: part.id, end }) === 'butt' : false
            const through = joint ? project.parts.find((p) => p.id === joint.through.part) : undefined
            const lost = butts && through ? through.thickness : 0
            if (!lost) return null
            return (
              <div
                key={end}
                title={`${lost} mm lost to ${through?.name.trim() || 'the other piece'}`}
                className="diy-lost h-full shrink-0"
                style={{
                  width: `${(lost / part.length) * 100}%`,
                  // The stub belongs at the end that lost it, and `end` is the
                  // right-hand end, so it has to be pushed past the body.
                  order: end === 'start' ? 0 : 2,
                  minWidth: '3px',
                }}
              />
            )
          })}
          <div className="flex h-full min-w-0 flex-1 items-center justify-center px-1" style={{ order: 1 }}>
            <span className="tnum truncate text-[11px] font-medium text-slate-800">{label}</span>
          </div>
        </div>

        {END_IDS.map((end) => (
          <EndCap
            key={end}
            end={end}
            part={part}
            project={project}
            armed={arming?.part === part.id && arming.end === end}
            onClick={() => onEnd(end)}
          />
        ))}
      </div>
    </div>
  )
}

function EndCap({
  end, part, project, armed, onClick,
}: {
  end: EndId; part: Part; project: PartsProject; armed: boolean; onClick: () => void
}) {
  const joint = jointAt(project.joints, { part: part.id, end })
  const role = joint ? roleAt(joint, { part: part.id, end }) : null
  const partner = joint
    ? project.parts.find((p) => p.id === (role === 'through' ? joint.butt.part : joint.through.part))
    : undefined

  const state = armed ? 'armed' : role ?? 'free'
  const style = {
    armed: 'border-amber-600 bg-amber-500 text-white',
    through: 'border-slate-700 bg-slate-700 text-white',
    butt: 'border-amber-700 bg-amber-100 text-amber-900',
    free: 'border-slate-300 bg-white text-slate-400 hover:border-amber-500 hover:text-amber-700',
  }[state]

  // The glyph is never the only thing carrying the state: the label says it in
  // words, and the two joined roles differ in fill AND outline as well as sign.
  const glyph = { armed: '●', through: '▐', butt: '◁', free: '+' }[state]

  const words = armed
    ? 'selected — click another end to join, or click again to cancel'
    : role === 'through'
      ? `runs through, ${partner?.name.trim() || 'another piece'} butts into it. Click to separate`
      : role === 'butt'
        ? `butts into ${partner?.name.trim() || 'another piece'}. Click to separate`
        : 'not joined. Click to start a joint'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${part.name.trim() || 'Unnamed piece'}, ${END_NAME[end]} — ${words}`}
      title={words}
      className={`no-print absolute top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border text-[11px] leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${style} ${
        end === 'start' ? '-left-3' : '-right-3'
      }`}
    >
      <span aria-hidden>{glyph}</span>
    </button>
  )
}
