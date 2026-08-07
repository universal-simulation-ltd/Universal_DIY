import { EXAMPLES } from '../../lib/examples'
import { navigate } from '../../lib/route'
import { useDiyStore } from '../../stores/diyStore'

// The per-app rows that slot into <UniversalAppsNavBar />'s `actions` prop —
// ROWS ONLY, no trigger and no panel of its own. The SDK renders them inside the
// merged profile pill, so the bar carries one dropdown on the right rather than
// a button on the left and an avatar on the right.
//
// Styling is inline rather than Tailwind to match the SDK dropdown's own rows
// (the same 8px/14px rhythm and 13px label the profile and language rows use) —
// these render inside SDK chrome, not ours.
export default function AppMenu() {
  const replace = useDiyStore((s) => s.replace)
  const unit = useDiyStore((s) => s.unit)
  const reset = useDiyStore((s) => s.reset)

  // The bar is on both pages now, so every row has to say where it goes as well
  // as what it does: picking an example from the landing page used to load a
  // design nothing on screen was showing.
  return (
    <>
      {EXAMPLES.map((example) => (
        <MenuRow
          key={example.id}
          label={example.label}
          onClick={() => {
            replace({ ...example.design }, unit, {})
            navigate('cutlist')
          }}
        />
      ))}
      <MenuRow
        label="Start a new box"
        glyph="✦"
        onClick={() => {
          reset()
          navigate('cutlist')
        }}
      />
    </>
  )
}

const TINT = { bg: '#fffbeb', fg: '#b45309' }
const REST_COLOR = '#374151'

function MenuRow({ label, onClick, glyph = '📦' }: { label: string; onClick: () => void; glyph?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        width:      '100%',
        padding:    '8px 14px',
        fontSize:   13,
        fontFamily: 'inherit',
        textAlign:  'left',
        border:     0,
        background: 'transparent',
        color:      REST_COLOR,
        cursor:     'pointer',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = TINT.bg
        e.currentTarget.style.color = TINT.fg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = REST_COLOR
      }}
    >
      <span aria-hidden>{glyph}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
    </button>
  )
}
