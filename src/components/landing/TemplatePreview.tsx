import { previewLayout } from '../../lib/preview'
import type { Design } from '../../lib/panels'

/**
 * The animated thumbnail on a template card.
 *
 * Not an icon — the real plan and elevation cross-sections of the real design,
 * drawn to a common scale by the same code that draws them in the calculator
 * (src/lib/preview.ts). Every wall is one true material thickness, so a card
 * for 12 mm stock draws visibly thinner walls than one for 18 mm without
 * anybody being told.
 *
 * The animation is the assembly, played in WRAP ORDER, outermost first: the
 * sides arrive at full height and then the top drops in between them. That is
 * the single idea the whole app rests on, and this is the only place it can be
 * shown happening rather than described.
 *
 * `replay` restarts it. A CSS animation cannot be re-triggered by changing a
 * class without a reflow hack, so the card bumps a counter on hover and React
 * remounts this subtree — the honest version of the hack, and cheap on a
 * drawing this size.
 */
export default function TemplatePreview({ design, replay = 0 }: { design: Design; replay?: number }) {
  const preview = previewLayout(design)
  const reach = Math.max(preview.width, preview.height) || 1
  const pad = reach * 0.03
  // Room above each half for its caption. Without it the two sections read as
  // two boxes stacked up rather than two views of one — which is worse than no
  // drawing, because it invents a shape the template does not have.
  const lead = reach * 0.075
  const stroke = reach / 220
  const fs = reach * 0.05

  return (
    <svg
      viewBox={`${-pad} ${-pad - lead} ${preview.width + pad * 2} ${preview.height + pad * 2 + lead}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {preview.sections.map((s) => (
        <g key={s.id}>
          <text x={0} y={s.y - lead * 0.32} fontSize={fs} fill="#94a3b8">
            {s.id}
          </text>
          <rect
            x={0}
            y={s.y}
            width={s.width}
            height={s.height}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={stroke}
            strokeDasharray={`${stroke * 5} ${stroke * 4}`}
          />
        </g>
      ))}

      <g key={replay}>
        {preview.rects.map((r) => (
          <rect
            key={r.id}
            className="diy-piece"
            style={{
              // Read by the diy-fly-in keyframes. Unitless numbers are invalid in
              // a CSS translate, and one px in an SVG transform is one user unit
              // — which is one millimetre here, the same space the rects are in.
              '--dx': `${r.dx}px`,
              '--dy': `${r.dy}px`,
              animationDelay: `${r.step * 70}ms`,
            } as React.CSSProperties}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill="#e2e8f0"
            stroke="#334155"
            strokeWidth={stroke * 1.2}
          />
        ))}
      </g>
    </svg>
  )
}
