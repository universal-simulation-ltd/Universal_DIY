import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The theme key is written down TWICE, and this is what stops the two drifting.
// `src/stores/themeStore.ts` names it for the SDK's store; `index.html` names it
// again in the inline script that puts `.dark` on <html> before the first paint
// (the only place early enough to matter). A bundled module and a script that
// runs during head parsing cannot share a constant, so renaming either without
// the other fails here. The key IS every user's saved choice: change it and
// everybody who chose dark is silently back on light.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const key = /createThemeStore\('([^']+)'\)/.exec(read('src/stores/themeStore.ts'))?.[1]
const html = read('index.html')
const head = html.slice(0, html.indexOf('</head>'))

describe('the pre-paint theme script', () => {
  it('the store is created with a literal key', () => {
    expect(key).toBe('unisim-diy-theme')
  })

  it('reads the same localStorage key as the theme store', () => {
    expect(head).toContain(`localStorage.getItem('${key}')`)
  })

  it("falls back to the global universal:color-scheme when the app has no override", () => {
    expect(head).toContain("localStorage.getItem('universal:color-scheme')")
  })

  it("defaults to light and honours 'system' before anything is painted", () => {
    expect(head).toMatch(/\|\| 'light'/)
    expect(head).toContain("classList.add('dark')")
    expect(head).toContain('prefers-color-scheme: dark')
  })

  it('never removes the class — light is the default, so it only ever adds', () => {
    expect(head).not.toContain("classList.remove('dark')")
  })
})

describe('dark mode never reaches the paper', () => {
  const css = read('src/index.css')

  it('every dark token sits inside @media screen, so print stays ink on white', () => {
    const screen = css.indexOf('@media screen {')
    const print = css.indexOf('@media print {')
    expect(screen).toBeGreaterThan(-1)
    // No `.dark` rule before the screen block, and none inside the print block.
    expect(css.slice(0, screen)).not.toMatch(/^\s*[^/*\n]*\.dark[^\n]*\{/m)
    expect(css.slice(print)).not.toMatch(/\.dark/)
  })
})
