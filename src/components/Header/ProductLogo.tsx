// Universal DIY brand icon — icon-only by design. The SDK's UniversalAppsNavBar
// renders the product name beside this slot.
//
// It draws the thing the app is about: a box seen as a net, with one panel
// stepped in from the edge — the lap that the wrap order decides.
export default function ProductLogo() {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-700 text-white"
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="2" width="12" height="12" rx="1" />
        <path d="M2 5.5h12M5.5 5.5V14" />
      </svg>
    </span>
  )
}
