import { netLayout, sectionLayout, type Rect } from '../../lib/diagram'
import { formatShort } from '../../lib/units'
import type { Cutlist, Design, PanelId } from '../../lib/panels'
import { useDiyStore } from '../../stores/diyStore'

/**
 * The 2D exploded diagram — a net and two cross-sections, all drawn to a common
 * scale in millimetre space with the SVG viewBox doing the scaling.
 *
 * Scale is the trust mechanism. A piece that is meant to fit BETWEEN its
 * neighbours shows a visible step at each end; one that wrongly runs the full
 * width does not. That is how a wrong number gets caught before anybody cuts,
 * and it only works if nothing here is nudged for looks.
 *
 * Nothing is encoded in colour alone: the highlight is a heavier outline as well
 * as a tint, and on paper the tints are dropped entirely (workshop printers are
 * black-and-white and the sheet gets sawdust on it).
 */
export default function Diagram({ design, cutlist }: { design: Design; cutlist: Cutlist }) {
  const net = netLayout(design)
  const plan = sectionLayout(design, 'plan')
  const elevation = sectionLayout(design, 'elevation')
  const labels = Object.fromEntries(cutlist.pieces.map((p) => [p.panel, p.label])) as Record<PanelId, string>

  return (
    <div className="space-y-4">
      <Drawing
        id="net"
        title="Every piece, flat — as it will be cut"
        caption="An unfolded net: Back in the centre, sides and top and bottom folded out around it, Front to one side. Drawn to scale, so a piece that should fit between its neighbours looks inset."
        width={net.width}
        height={net.height}
        rects={net.rects}
        labels={labels}
        grained={design.grained}
        design={design}
        showDims
      />

      {/* `sections-grid` is a print hook: on paper this must be two columns
          whatever the page width, or the diagram runs to three sheets and the
          cut list lands on page four. */}
      <div className="sections-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[plan, elevation].map((section) => (
          <Drawing
            key={section.id}
            id={section.id}
            title={section.title}
            caption={`${section.caption} This is the drawing that shows which panel laps which — a net cannot.`}
            width={section.width}
            height={section.height}
            rects={section.rects}
            labels={labels}
            grained={false}
            design={design}
            outline
          />
        ))}
      </div>
    </div>
  )
}

interface DrawingProps {
  /** Stable hook for tests and for anyone linking to one drawing. */
  id: 'net' | 'plan' | 'elevation'
  title: string
  caption: string
  width: number
  height: number
  rects: Rect[]
  labels: Record<PanelId, string>
  grained: boolean
  design: Design
  showDims?: boolean
  outline?: boolean
}

function Drawing({ id, title, caption, width, height, rects, labels, grained, design, showDims, outline }: DrawingProps) {
  const hover = useDiyStore((s) => s.hover)
  const setHover = useDiyStore((s) => s.setHover)
  const unit = useDiyStore((s) => s.unit)
  const mmDecimals = useDiyStore((s) => s.mmDecimals)

  const reach = Math.max(width, height) || 1
  // Margin in millimetre space, so the dimension text has somewhere to live at
  // whatever size the box is.
  const pad = reach * (showDims ? 0.11 : 0.06)
  const fs = reach / 42
  const stroke = reach / 400

  return (
    <figure data-drawing={id} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 break-inside-avoid">
      <figcaption className="mb-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-[11px] leading-snug text-slate-500">{caption}</p>
      </figcaption>
      <svg
        viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${title}. ${rects.map((r) => `${r.part} ${Math.round(Math.max(r.w, r.h))} by ${Math.round(Math.min(r.w, r.h))} millimetres`).join('. ')}`}
      >
        {outline && (
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={stroke}
            strokeDasharray={`${stroke * 6} ${stroke * 4}`}
          />
        )}

        {rects.map((r) => {
          const on = hover === r.panel
          // A section panel is one thickness thin, so a label sized off the
          // SHORT side would be a speck. Size it off the long side, cap it at
          // the short one, and turn it to run along the piece — a letter you
          // cannot read is not a label.
          const upright = r.h > r.w
          const long = upright ? r.h : r.w
          const short = upright ? r.w : r.h
          const letter = Math.min(long * 0.35, short * 0.7, fs * 1.6)
          const roomy = short > reach / 12
          return (
            <g
              key={r.panel}
              onMouseEnter={() => setHover(r.panel)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'default' }}
            >
              <rect
                data-ink
                data-panel={r.panel}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                className="panel-fill"
                fill={on ? '#fef3c7' : '#f8fafc'}
                stroke={on ? '#b45309' : '#334155'}
                strokeWidth={on ? stroke * 2.5 : stroke * 1.5}
              />

              <text
                x={r.x + r.w / 2}
                y={r.y + r.h / 2 + (roomy ? -letter * 0.1 : letter * 0.35)}
                textAnchor="middle"
                fontSize={letter}
                fontWeight="700"
                fill="#0f172a"
                transform={upright ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}
              >
                {labels[r.panel] ?? ''}
              </text>
              {roomy && (
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 + letter * 0.85}
                  textAnchor="middle"
                  fontSize={letter * 0.55}
                  fill="#334155"
                >
                  {r.part}
                </text>
              )}

              {grained && roomy && (
                <GrainArrow rect={r} stroke={stroke} />
              )}

              {showDims && (
                <>
                  {/* Both dimensions written on the edges — the length along the
                      top, the width up the side. */}
                  <text
                    x={r.x + r.w / 2}
                    y={r.y - fs * 0.35}
                    textAnchor="middle"
                    fontSize={fs * 0.8}
                    fill="#475569"
                  >
                    {formatShort(r.w, unit, mmDecimals)}
                  </text>
                  <text
                    x={r.x - fs * 0.35}
                    y={r.y + r.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fs * 0.8}
                    fill="#475569"
                    transform={`rotate(-90 ${r.x - fs * 0.35} ${r.y + r.h / 2})`}
                  >
                    {formatShort(r.h, unit, mmDecimals)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      {showDims && (
        <p className="mt-1 text-[11px] text-slate-500">
          Sizes in {unit}. {design.grained ? 'The arrow is the grain direction — it runs along each piece’s length.' : 'No grain on this material, so any piece may be rotated.'}
        </p>
      )}
    </figure>
  )
}

/** Grain runs along the piece's length, which is the longer drawn side. */
function GrainArrow({ rect, stroke }: { rect: Rect; stroke: number }) {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const len = (rect.grainHorizontal ? rect.w : rect.h) * 0.32
  const head = Math.min(rect.w, rect.h) * 0.06
  const [x1, y1, x2, y2] = rect.grainHorizontal
    ? [cx - len, cy + rect.h * 0.3, cx + len, cy + rect.h * 0.3]
    : [cx + rect.w * 0.3, cy - len, cx + rect.w * 0.3, cy + len]

  return (
    <g data-ink stroke="#64748b" strokeWidth={stroke * 1.2} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {rect.grainHorizontal ? (
        <>
          <path d={`M ${x2 - head} ${y2 - head} L ${x2} ${y2} L ${x2 - head} ${y2 + head}`} />
          <path d={`M ${x1 + head} ${y1 - head} L ${x1} ${y1} L ${x1 + head} ${y1 + head}`} />
        </>
      ) : (
        <>
          <path d={`M ${x2 - head} ${y2 - head} L ${x2} ${y2} L ${x2 + head} ${y2 - head}`} />
          <path d={`M ${x1 - head} ${y1 + head} L ${x1} ${y1} L ${x1 + head} ${y1 + head}`} />
        </>
      )}
    </g>
  )
}
