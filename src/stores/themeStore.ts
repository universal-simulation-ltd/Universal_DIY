import { createThemeStore, type ThemePref } from '@unisim/sdk'

// The light/dark/system preference. The store itself lives in @unisim/sdk
// (createThemeStore) — this file only names the key. It opens LIGHT and stays
// light until the user chooses otherwise (the suite rule); the choice is made
// in Tune this app (Light / Dark / Match my device), which the SDK navbar draws
// from the `themeStore` prop in App.tsx.
//
// The key holds this app's OVERRIDE. Absent, the app follows the account's
// global choice (`universal:color-scheme`, itself light until chosen).
//
// ⚠️ The key is every user's saved choice. Renaming it silently puts them all
// back on following global. It is written down a second time in index.html's
// pre-paint script; src/lib/theme.test.ts is what keeps the two the same.
export type { ThemePref }

export const useThemeStore = createThemeStore('unisim-diy-theme')
