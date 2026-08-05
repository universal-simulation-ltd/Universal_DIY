// ---------------------------------------------------------------------------
// Routing — deliberately tiny, and deliberately not a router.
//
// /diy is a ONE-TOOL app today: its home IS the box calculator. But `/diy/cutlist`
// is registered as a working alias from day one, so that if a second DIY tool
// ever lands and /diy becomes a tool index, the calculator's URL does not move
// and nobody's bookmark or link breaks. Adding the index later is then a pure
// addition.
//
// The alias is not decorative: arriving on it opens the same page with the cut
// list scrolled to, because somebody who typed /diy/cutlist wants the list.
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
