import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Same shape as the other TypeScript Universal Apps (Universal_Exports,
// Universal_Webinar) and UNISIM_Compare — js.configs.recommended plus
// typescript-eslint, the two React plugins, and `dist` ignored.
//
// Two file-scoped blocks are load-bearing here and are not decoration:
//   * the config files run in NODE, not the browser, so without node globals
//     every `process` / `__dirname` reads as undefined; and
//   * the tests run in vitest, where `describe`/`it`/`expect` are imported
//     explicitly — they are listed anyway so a future globals-style test file
//     doesn't produce a wall of fake no-undef findings.
export default tseslint.config(
  { ignores: ['dist', 'dev-dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.config.{ts,js}', 'scripts/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
