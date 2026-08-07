import { useState } from 'react'

/**
 * The card illustration for the parts list: two pieces meeting at a butt joint.
 *
 * It draws the one thing that page adds — a rail arrives, stops at the stile's
 * face, and the hatched slice is the 18 mm it gave up to get there. Drawn to
 * scale in millimetres like everything else, so the stub really is one
 * thickness of the piece it butts into.
 *
 * Deliberately NOT a box, and deliberately not six panels: the card's whole job
 * is to say "this one is a different model", and a drawing that looked like the
 * template thumbnails would say the opposite.
 */
export default function JoinSketch() {
  const [replay, setReplay] = useState(0)

  const t = 18
  const W = 220
  const H = 120
  const railY = 46
  const railEnd = 196

  return (
    <svg
      viewBox={`-6 -22 ${W + 12} ${H + 34}`}
      className="h-28 w-full sm:h-32"
      preserveAspectRatio="xMidYMid meet"
      onMouseEnter={() => setReplay((n) => n + 1)}
      role="img"
      aria-label={
        'Two pieces meeting at a butt joint. The upright piece runs through at its full length; ' +
        'the rail stops at its face and is cut 18 millimetres shorter as a result.'
      }
    >
      <defs>
        <pattern id="diy-join-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="2" />
        </pattern>
      </defs>

      <g key={replay}>
        {/* The through piece: full length, loses nothing, arrives first. */}
        <g className="diy-piece" style={{ '--dx': '0px', '--dy': '-70px' } as React.CSSProperties}>
          <rect x={0} y={0} width={t} height={H} fill="#e2e8f0" stroke="#334155" strokeWidth={1.6} />
          <text x={t + 5} y={12} fontSize={11} fill="#334155" fontWeight="600">runs through</text>
        </g>

        {/* The butt piece: flies in from the right and stops at the face. */}
        <g className="diy-piece" style={{ '--dx': '90px', '--dy': '0px', animationDelay: '160ms' } as React.CSSProperties}>
          <rect x={t} y={railY} width={railEnd - t} height={t} fill="#e2e8f0" stroke="#334155" strokeWidth={1.6} />
          <text x={(t + railEnd) / 2} y={railY + t / 2 + 4} textAnchor="middle" fontSize={11} fill="#334155" fontWeight="600">
            butts in
          </text>
        </g>

        {/* What it gave up — the slice of the through piece it stops against. */}
        <g className="diy-fade" style={{ animationDelay: '620ms' }}>
          <rect x={0} y={railY} width={t} height={t} fill="url(#diy-join-hatch)" stroke="#b45309" strokeWidth={1.4} />
          <line x1={0} y1={railY + t + 8} x2={t} y2={railY + t + 8} stroke="#b45309" strokeWidth={1.2} />
          <line x1={0} y1={railY + t + 4} x2={0} y2={railY + t + 12} stroke="#b45309" strokeWidth={1.2} />
          <line x1={t} y1={railY + t + 4} x2={t} y2={railY + t + 12} stroke="#b45309" strokeWidth={1.2} />
          <text x={t + 6} y={railY + t + 12} fontSize={11} fill="#b45309" fontWeight="600">
            18 mm off the rail
          </text>
        </g>
      </g>
    </svg>
  )
}
