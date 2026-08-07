// ---------------------------------------------------------------------------
// Routing — deliberately tiny, and deliberately not a router.
//
// Two pages:
//
//   /diy          the landing page — "what are you building?", a template grid.
//   /diy/cutlist  the calculator, unchanged.
//
// `/diy/cutlist` was registered as a working alias from day one against exactly
// this change, so the calculator's URL does not move now that /diy has become a
// front door: every bookmark and shared link made before the landing page
// existed still lands on the calculator. That was the whole point of putting the
// alias in early, and it is why this file did not need a rewrite to gain a
// second page — only a second thing to render.
//
// An unknown path is still not a 404. It used to fall through to the tool
// because the tool was all there was; now it falls through to the landing page,
// which is the better answer to "I typed something odd" anyway.
//
// In production Vite's `base` is /diy/ and public/_redirects rewrites /diy/* to
// the SPA shell; in dev the base is / and Vite's history fallback does the same.
// Both are handled by stripping BASE_URL, which is why this takes the base as an
// argument rather than reading it — that also makes it testable in node.
// ---------------------------------------------------------------------------

export type Route = 'home' | 'cutlist'

/** Everything after the app's base path, with no leading or trailing slash. */
export function pathAfterBase(pathname: string, base: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const rest = b && pathname.startsWith(b) ? pathname.slice(b.length) : pathname
  return rest.replace(/^\/+/, '').replace(/\/+$/, '')
}

export function routeFor(pathname: string, base: string): Route {
  return pathAfterBase(pathname, base) === 'cutlist' ? 'cutlist' : 'home'
}

export function currentRoute(): Route {
  if (typeof window === 'undefined') return 'home'
  return routeFor(window.location.pathname, import.meta.env.BASE_URL)
}

/** Absolute href for a route, respecting the deployed base path. */
export function hrefFor(route: Route, base = typeof window === 'undefined' ? '/' : import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base : `${base}/`
  return route === 'cutlist' ? `${b}cutlist` : b
}

// --- navigation -------------------------------------------------------------
//
// pushState plus a subscriber list, rather than a router. Two pages that share
// one store do not need a route table, and the browser's own history is already
// the source of truth — `currentRoute()` reads it, so Back and Forward work
// without this file holding a copy of where we are that could disagree.

const listeners = new Set<() => void>()

/** Subscribe to route changes — both our own pushes and the browser's Back. */
export function subscribeRoute(fn: () => void): () => void {
  listeners.add(fn)
  window.addEventListener('popstate', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('popstate', fn)
  }
}

export interface NavigateOptions {
  /**
   * Keep the URL hash. Off by default, and that default is load-bearing: the
   * hash holds a whole shared design (share.ts), so carrying a stale one onto a
   * freshly picked template would mean a reload silently reinstates the OLD box
   * — a link quietly overruling the choice just made. Only the code that is
   * deliberately preserving a shared design turns this on.
   */
  keepHash?: boolean
  /** Replace the current entry instead of pushing, for URL normalisation. */
  replace?: boolean
}

export function navigate(route: Route, { keepHash = false, replace = false }: NavigateOptions = {}): void {
  if (typeof window === 'undefined') return
  const url = hrefFor(route) + (keepHash ? window.location.hash : '')
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
  if (!replace) window.scrollTo(0, 0)
  for (const fn of listeners) fn()
}
