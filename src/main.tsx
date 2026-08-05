import React from 'react'
import ReactDOM from 'react-dom/client'
import { UniversalProvider } from '@unisim/sdk'
import App from './App'
import UsageTracker from './UsageTracker'
import './index.css'

// Universal DIY is pure arithmetic — the calculator path makes no network call
// at all, and the "runs entirely in your browser / works offline" claim on the
// page is literally true. <UniversalProvider> is mounted for the shared navbar
// and so a visitor already signed in on .unisim.co.uk sees their profile and
// their suite-wide language choice; the app writes nothing to Supabase beyond
// the standard usage ping in <UsageTracker />.
//
// The fallback is the REAL public suite project (publishable anon key — safe to
// ship; RLS is the security boundary). A placeholder fallback would leave the
// SDK pointed at a dead project whenever the build lacks VITE_PLATFORM_SUPABASE_*
// env, so the suite session never resolves and the navbar shows no profile.
// Env overrides.
//
// `product: 'diy'` is written plainly, with no cast. 'diy' is a real member of
// the SDK's ProductCode union (>= 0.85.0) and a real value in the Postgres
// product_code enum (universal-platform migration 0112). If a future change
// makes the compiler object here, that is the compiler correctly reporting that
// the database will reject the insert too — fix the enum, never the type.
const universalConfig = {
  supabaseUrl: import.meta.env.VITE_PLATFORM_SUPABASE_URL || 'https://rygfxgalojojppxmhddo.supabase.co',
  supabaseAnonKey: import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Z2Z4Z2Fsb2pvanBweG1oZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTY4MjUsImV4cCI6MjA5NDMzMjgyNX0.hLy_vt9vY_rdPKF3nL32yAuMCD604E3CH5VM7D7CaNE',
  product: 'diy' as const,
  cookieDomain: import.meta.env.PROD ? '.unisim.co.uk' : undefined,
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UniversalProvider config={universalConfig}>
      <UsageTracker />
      <App />
    </UniversalProvider>
  </React.StrictMode>
)
