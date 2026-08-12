import { describe, expect, it, vi } from 'vitest'
import { arrivedByClick, hrefFor, navigate, pathAfterBase, routeFor } from './route'

describe('/diy is the landing page and /diy/cutlist is the calculator', () => {
  it('resolves under the production base path', () => {
    expect(routeFor('/diy/', '/diy/')).toBe('home')
    expect(routeFor('/diy', '/diy/')).toBe('home')
    expect(routeFor('/diy/cutlist', '/diy/')).toBe('cutlist')
    expect(routeFor('/diy/cutlist/', '/diy/')).toBe('cutlist')
  })

  it('resolves under the dev base path, where base is just /', () => {
    expect(routeFor('/', '/')).toBe('home')
    expect(routeFor('/cutlist', '/')).toBe('cutlist')
    expect(routeFor('/parts', '/')).toBe('parts')
  })

  it('resolves the free parts list, which is a page and not a box', () => {
    expect(routeFor('/diy/parts', '/diy/')).toBe('parts')
    expect(routeFor('/diy/parts/', '/diy/')).toBe('parts')
    expect(hrefFor('parts', '/diy/')).toBe('/diy/parts')
    expect(hrefFor('parts', '/')).toBe('/parts')
  })

  it('falls back to the landing page for anything else', () => {
    // An unknown path is not a 404, it is the front door.
    for (const p of ['/diy/nope', '/diy/cutlist/extra', '/diy/CUTLIST']) {
      expect(routeFor(p, '/diy/')).toBe('home')
    }
  })

  // The alias was registered before there was anything to alias, against exactly
  // this change. It is the reason adding a landing page did not move a single
  // existing URL: every bookmark and shared link made when /diy WAS the
  // calculator was already pointing at /diy/cutlist too.
  it('did not move the calculator when the landing page landed', () => {
    expect(routeFor('/diy/cutlist', '/diy/')).toBe('cutlist')
    expect(hrefFor('cutlist', '/diy/')).toBe('/diy/cutlist')
  })

  it('builds hrefs that keep the deployed base', () => {
    expect(hrefFor('home', '/diy/')).toBe('/diy/')
    expect(hrefFor('cutlist', '/diy/')).toBe('/diy/cutlist')
    expect(hrefFor('cutlist', '/')).toBe('/cutlist')
  })

  it('strips the base cleanly', () => {
    expect(pathAfterBase('/diy/cutlist', '/diy/')).toBe('cutlist')
    expect(pathAfterBase('/diy/', '/diy/')).toBe('')
    expect(pathAfterBase('/other/thing', '/diy/')).toBe('other/thing')
  })
})

// A page reached by a click opens at the top of itself. Picking a template
// from half-way down the grid used to land on the calculator part-way down
// too — past the size inputs, at a cut list for a box no number had been typed
// into yet. `navigate` puts the viewport at the top, and `arrivedByClick` is
// how the page it lands on knows not to move it again.
describe('a clicked-through page starts at the top', () => {
  it('scrolls to the top on a push, and records that the arrival was a click', () => {
    const scrollTo = vi.fn()
    const pushState = vi.fn()
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: { pathname: '/', hash: '' },
      history: { pushState, replaceState },
      scrollTo,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    // A fresh document: nothing has been clicked, so a deep link may still open
    // a page at the part of itself its URL named.
    expect(arrivedByClick()).toBe(false)

    navigate('cutlist')
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(arrivedByClick()).toBe(true)

    // The scroll happens after the push, so the entry we left keeps the reader's
    // place in the template grid for Back.
    expect(pushState.mock.invocationCallOrder[0]).toBeLessThan(scrollTo.mock.invocationCallOrder[0])

    // A replace is the address bar being tidied for an arrival already in
    // progress — not a second one, and not a reason to move the viewport.
    navigate('cutlist', { replace: true, keepHash: true })
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })
})
