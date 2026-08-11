// GENERATED FILE — do not edit by hand.
// Source: backoffice/universal-platform/scripts/app-marks/marks.mjs
// Regenerate: node scripts/app-marks/build.mjs (from backoffice/universal-platform)
// Mark: Universal DIY — A box seen as a net, one panel lapping the next.
// Hover: The lapping panel slides to where the wrap order puts it.
//
// Icon-only by design: the SDK's UniversalAppsNavBar renders the product name
// from its catalogue beside this slot, so a wordmark here would print it twice.

const CSS = `
  /* Resting states */
  .uam-diy-lap { transform: translateX(0); transition: transform .5s cubic-bezier(0.16,1,0.3,1); }
  .uam-diy-edge { transform: scaleX(0.35); transition: transform .5s cubic-bezier(0.16,1,0.3,1); transform-origin: left center; transform-box: fill-box; }

  /* Active states */
  .uam-host-diy:hover .uam-diy-lap,
  .uam-host-diy:focus-visible .uam-diy-lap { transform: translateX(9px); }
  .uam-host-diy:hover .uam-diy-edge,
  .uam-host-diy:focus-visible .uam-diy-edge { transform: scaleX(1); }

  @media (prefers-reduced-motion: reduce) {
    .uam-diy-lap,
    .uam-diy-edge { transition: none !important; }
  }
`

export default function ProductLogo() {
  return (
    <span
      className="uam-host-diy inline-flex h-6 w-6 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      <style>{CSS}</style>
      <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="14" fill="#0f172a" />
        <g fill="none" strokeWidth={4} strokeLinejoin="round" stroke="#fe8c01">
          <rect x={10} y={18} width={44} height={30} rx={3} />
          <path d="M10 28h44" />
        </g>
        <path d="M24 18v30" fill="none" strokeWidth={4} strokeLinejoin="round" stroke="#fe8c01" className="uam-diy-lap" />
        <rect x={10} y={51} width={44} height={4} rx={2} fill="#ff9a1f" className="uam-diy-edge" />
      </svg>
    </span>
  )
}
