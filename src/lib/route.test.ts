import { describe, expect, it } from 'vitest'
import { hrefFor, pathAfterBase, routeFor } from './route'

describe('/diy/cutlist works as an alias from day one', () => {
  it('resolves under the production base path', () => {
    expect(routeFor('/diy/', '/diy/')).toBe('home')
    expect(routeFor('/diy', '/diy/')).toBe('home')
    expect(routeFor('/diy/cutlist', '/diy/')).toBe('cutlist')
    expect(routeFor('/diy/cutlist/', '/diy/')).toBe('cutlist')
  })

  it('resolves under the dev base path, where base is just /', () => {
    expect(routeFor('/', '/')).toBe('home')
    expect(routeFor('/cutlist', '/')).toBe('cutlist')
  })

  it('falls back to the calculator for anything else', () => {
    // One-tool app: an unknown path is not a 404, it is the tool.
    for (const p of ['/diy/nope', '/diy/cutlist/extra', '/diy/CUTLIST']) {
      expect(routeFor(p, '/diy/')).toBe('home')
    }
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
