import { describe, expect, it } from 'vitest'
import { hrefFor, pathAfterBase, routeFor } from './route'

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
