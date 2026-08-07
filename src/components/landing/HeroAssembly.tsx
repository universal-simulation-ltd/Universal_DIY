import { sectionLayout } from '../../lib/diagram'
import { entryOffset, travelFor } from '../../lib/preview'
import { computeCutlist, priorities, type Design, type PanelId } from '../../lib/panels'

/**
 * The hero drawing: a box assembling itself, on a loop.
 *
 * It is the elevation cross-section of a real 600 × 400 × 300 box in 18 mm ply,
 * built by the same `sectionLayout` the calculator prints, and every number
 * written on it — the overall sizes, the piece labels, the interior cavity — is
 * read out of `computeCutlist` rather than typed into the markup. A hero image
 * with a made-up dimension on it would be the app lying in its own shop window.
 *
 * The elevation, specifically, because it is the only drawing that can show
 * which panel laps which, and that is the thing the animation exists to show:
 * the two sides arrive at their FULL height, and only then does the top drop in
 * BETWEEN them, one thickness short at each end. Six independent "extends /
 * sits inside" switches cannot produce that picture without also producing an
 * impossible one, which is why this app does not have them.
 *
 * The loop assembles, holds while the annotations fade up, and disperses. The
 * hold is long — most of the cycle — because a landing page that never settles
 * is a landing page nobody can read.
 */

const DEMO: Design = {
  name: 'Hero',
  width: 600,
  depth: 400,
  height: 300,
  thickness: 18,
  present: { left: true, right: true, top: true, bottom: true, back: true, front: true },
  // Sides outermost: the preset that makes the lap visible in this section.
  order: ['left', 'right', 'top', 'bottom', 'back', 'front'],
  material: '18 mm birch ply',
  grained: true,
}

export default function HeroAssembly() {
  const section = sectionLayout(DEMO, 'elevation')
  const cutlist = computeCutlist(DEMO)
  const labels = Object.fromEntries(cutlist.pieces.map((p) => [p.panel, p.label])) as Record<PanelId, string>
  const prio = priorities(DEMO.order)
  const travel = travelFor(DEMO)

  const { width, height } = section
  // Room to the right and below for the dimension lines, in the drawing's own
  // millimetre space so the annotations scale with everything else.
  const padX = width * 0.16
  const padY = height * 0.2
  const stroke = width / 320
  const fs = width / 26

  const t = DEMO.thickness
  // The top, which under this wrap order is one thickness short at each end —
  // read off the section rather than worked out here, so it can only ever agree
  // with the rectangle it is annotating.
  const topPiece = section.rects.find((r) => r.panel === 'top')!

  return (
    <svg
      viewBox={`${-padX * 0.6} ${-padY * 0.55} ${width + padX * 1.5} ${height + padY * 1.5}`}
      className="diy-hero w-full h-auto"
      role="img"
      aria-label={
        `An animated cross-section of a ${DEMO.width} by ${DEMO.depth} by ${DEMO.height} millimetre box in ` +
        `${DEMO.thickness} millimetre ply, assembling itself. The two sides run the full ${DEMO.height} ` +
        `millimetre height; the top and bottom fit between them and are ${Math.round(topPiece.w)} millimetres ` +
        `long — one material thickness shorter at each end.`
      }
    >
      {/* The outer envelope: where the finished box will be, drawn before it
          arrives so the pieces fly into something rather than at nothing. */}
      <rect
        className="diy-anno"
        x={0}
        y={0}
        width={width}
        height={height}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={stroke}
        strokeDasharray={`${stroke * 6} ${stroke * 5}`}
      />

      {section.rects.map((r) => {
        const { dx, dy } = entryOffset(r.panel, travel)
        const upright = r.h > r.w
        const letter = Math.min(upright ? r.h : r.w, (upright ? r.w : r.h) * 1.4, fs * 1.1)
        return (
          <g
            key={r.panel}
            className="diy-part"
            style={{
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              // Wrap order, outermost first: the sides land before the top does.
              animationDelay: `${(prio[r.panel] - 1) * 110}ms`,
            } as React.CSSProperties}
          >
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill="#e2e8f0"
              stroke="#334155"
              strokeWidth={stroke * 1.6}
            />
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={letter * 0.62}
              fontWeight="700"
              fill="#334155"
              transform={upright ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}
            >
              {labels[r.panel]}
            </text>
          </g>
        )
      })}

      {/* --- annotations, faded up once the box has landed ------------------ */}

      <g className="diy-anno" style={{ animationDelay: '260ms' }}>
        <Dimension
          x1={0} y1={height + padY * 0.42} x2={width} y2={height + padY * 0.42}
          label={`${width}`} stroke={stroke} fs={fs}
        />
        <Dimension
          x1={width + padX * 0.42} y1={0} x2={width + padX * 0.42} y2={height}
          label={`${height}`} stroke={stroke} fs={fs} vertical
        />
      </g>

      <g className="diy-anno" style={{ animationDelay: '520ms' }}>
        {/*
          The whole argument of the drawing, as two dimension lines one above
          the other: the box is 600 across, and the top inside it is 564. The
          difference is one thickness at each end, it is the deduction the wrap
          order exists to get right, and a shorter line visibly nested inside a
          longer one says it faster than any sentence.

          Deliberately the ONLY annotation in the box. The interior cavity is
          564 too, so labelling that as well would put the same number on the
          drawing twice meaning two different things.
        */}
        <Dimension
          x1={topPiece.x}
          y1={topPiece.y + topPiece.h + padY * 0.5}
          x2={topPiece.x + topPiece.w}
          y2={topPiece.y + topPiece.h + padY * 0.5}
          label={`top ${Math.round(topPiece.w)}`}
          stroke={stroke}
          fs={fs}
          color="#b45309"
        />
        {/*
          The thickness, on a leader into the TOP panel rather than into a side.
          Every panel here is the same t, so the choice is purely about where the
          line can run: a leader out of a side wall has to cross the 564
          dimension to reach clear space, and two annotation lines crossing is
          how a drawing starts looking like a diagram of itself.
        */}
        <line
          x1={width * 0.32} y1={t * 0.6} x2={width * 0.15} y2={-padY * 0.22}
          stroke="#475569" strokeWidth={stroke}
        />
        <text x={width * 0.16} y={-padY * 0.28} fontSize={fs * 0.8} fill="#475569">
          {`t = ${t} mm, never rounded`}
        </text>
      </g>
    </svg>
  )
}

/** A dimension line with ticks at both ends and the number sitting on it. */
function Dimension({
  x1, y1, x2, y2, label, stroke, fs, vertical = false, color = '#475569',
}: {
  x1: number; y1: number; x2: number; y2: number
  label: string; stroke: number; fs: number; vertical?: boolean; color?: string
}) {
  const tick = fs * 0.4
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g stroke={color} strokeWidth={stroke} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} />
        </>
      )}
      <text
        x={vertical ? mx + fs * 0.7 : mx}
        y={vertical ? my : my + fs * 0.95}
        textAnchor="middle"
        dominantBaseline={vertical ? 'central' : undefined}
        fontSize={fs * 0.85}
        fill={color}
        stroke="none"
        transform={vertical ? `rotate(-90 ${mx + fs * 0.7} ${my})` : undefined}
      >
        {label}
      </text>
    </g>
  )
}
