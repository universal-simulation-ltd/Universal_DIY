import { useEffect, useRef } from 'react'
import { useUniversal, useUsageTracker, track } from '@unisim/sdk'

/**
 * Emits a single `session.opened` usage_events row when a signed-in user with an
 * active org opens the app, so god-mode's "last product used" column populates.
 *
 * No-op while anonymous — the SDK drops usage events without a session/org,
 * which is the state almost every visitor to a no-signup tool is in. That is
 * also why a wrong product code here would fail late and quietly: the insert
 * only happens for a signed-in visitor. 'diy' is in the `product_code` enum
 * (universal-platform migration 0112), so it does not. Mount once inside
 * <UniversalProvider>.
 */
export default function UsageTracker() {
  useUsageTracker()
  const { session, activeOrgId } = useUniversal()
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current || !session || !activeOrgId) return
    fired.current = true
    track('session.opened')
  }, [session, activeOrgId])
  return null
}
