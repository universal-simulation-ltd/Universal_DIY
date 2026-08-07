import { useSyncExternalStore } from 'react'
import { currentRoute, subscribeRoute, type Route } from './route'

/**
 * The current route, kept in step with the address bar.
 *
 * `useSyncExternalStore` rather than state + an effect because the browser's
 * history IS the store — holding a React copy of "where we are" would give the
 * app a second answer that can disagree with the URL for a frame, and the frame
 * it disagrees on is the one right after Back.
 *
 * `currentRoute` returns a string, so the snapshot is compared by value and
 * cannot loop. The server snapshot is 'home' because that is what a crawler
 * fetching the bare URL should get.
 */
export function useRoute(): Route {
  return useSyncExternalStore(subscribeRoute, currentRoute, serverRoute)
}

function serverRoute(): Route {
  return 'home'
}
