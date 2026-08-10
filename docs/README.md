# Universal DIY — docs

Working notes for whoever picks this repo up next. The user-facing story is in
the root `README.md`; this file is about how the code is put together and what
is still outstanding.

## What this repo is

A Vite + React 18 + TypeScript PWA that turns three outer dimensions, a material
thickness and a wrap order into panel sizes, a scale 2D diagram and a printable
cut list. **Pure client-side arithmetic** — the calculator makes no network call
at all, which is what makes the "runs entirely in your browser / works offline"
claim on the page literally true.

- **Live (once launched):** `opensource.unisim.co.uk/diy` — served by path via the
  `opensource-portal` Worker, which proxies `/diy` to a Git-connected
  `universal-diy` Cloudflare Pages project.
- **Route:** `/diy` is the calculator. **`/diy/cutlist` is a working alias for
  the same page** from day one (`src/lib/route.ts`), so if a second DIY tool ever
  lands and `/diy` becomes a tool index, the calculator's URL does not move.
  Arriving via the alias scrolls to the cut list.
- **Shared chrome:** `@unisim/sdk`'s `UniversalAppsNavBar` (the open-source apps'
  simplified navbar — *not* `UniversalNavBar`).
- **Local preview port: 5196**, reserved in `Docs_UNI_SIM/dev-preview.md`.
  `scripts/preview.ps1` / `scripts/preview.sh` default to it with `--strictPort`.

## The layout

```
src/lib/        the product — pure functions, no React, no DOM
  panels.ts     THE MODEL: the wrap order and the size formula
  geometry.ts   the same arithmetic as solids in space; feeds the sections
                and the exhaustive validity tests
  parts.ts      THE OTHER MODEL: free pieces, joined per-joint not per-box
  nest.ts       THE OPTIMISER: guillotine shelf packing, kerf/grain/trim
  diagram.ts    net + section layout, in millimetre space
  units.ts      mm is canonical; display/entry conversion and rounding
  materials.ts  stock thicknesses (exact mm) and the sheet ESTIMATE
  csv.ts        the cutlistoptimizer-shaped export
  share.ts      the whole design in the URL hash
  storage.ts    localStorage + .unidiy.json + the saw settings, all sanitised
  route.ts      /diy vs /diy/cutlist vs /diy/parts
  examples.ts   the navbar's example boxes
src/stores/     diyStore (box) · partsStore (free list) · sheetStore (the saw)
src/components/ presentation only; components/sheet/ is shared by both pages
```

**`src/lib/panels.ts` and `src/lib/nest.ts` are the product; everything else is
presentation.** If a number in either is wrong somebody cuts up a sheet of birch
ply for nothing.

`sheetStore` is a third store on purpose. The two page stores are separate
because they hold two different models; kerf, trim and sheet size belong to
neither — a blade is 3 mm wide whichever page you are on. Keeping them in one
small shared store is what stops the same three numbers being typed twice and
then disagreeing.

## The model, in one paragraph

Six panels, each normal to one axis. A **strict wrap order** ranks them,
outermost first. At each of the twelve edges the lower-ranked panel runs through
to the outer surface and the other butts against its inner face, losing exactly
one thickness at that end. Omitted panels deduct nothing — that is why the
deduction is written per-end and not as a flat −2t, and getting it wrong is the
single most likely arithmetic bug here. Every edge has exactly one winner, so the
box is valid by construction for all 720 orderings, and
`geometry.test.ts` proves it by building the six solids and asserting no pair
intersects and no edge prism is left unfilled — across 720 orders × 64
present/omitted masks.

That test is only worth something because the same file also feeds the detector
**deliberately broken** input (the naive both-extend and both-inside states) and
checks that it reports them. A validator that has never failed on a known-bad
input has been run, not tested.

## Landmines in this repo

- **The share format's field separator is `_`, not `.`.** The first draft used
  `.` and every link carrying an imperial thickness decoded as `null`, because
  `19.05` split into two fields. The one case the format exists to carry was the
  one case it could not encode. See the warning at the top of `share.ts`.
- **`computeCutlist` returns errors OR a cut list, never both.** An earlier draft
  pushed the "cavity has no room left" error *after* building the pieces and
  returned both, so a caller reading `pieces` without reading `errors` would have
  printed sizes for an impossible box. Any new validation must block the same way.
- **`public/_redirects` is load-bearing.** The Pages project builds flat, so
  without it every asset 404s under `/diy/`. The SPA fallback in that file is
  also what makes `/diy/cutlist` resolve.
- **Print is a requirement, not polish.** Workshop printers are black-and-white
  and the sheet gets sawdust on it, so **nothing may be encoded in colour alone**.
  The on-screen highlight is a tint *and* a heavier outline; `@media print` drops
  every fill to white. The print block also forces the two sections side by side
  and caps the SVG height, or the drawing runs to three sheets and the cut list
  lands on page four.
- **Light only, deliberately.** The suite rule is that an app opens light until
  the user asks otherwise; here the deliverable is ink on paper, so there is no
  dark palette and the comment in `index.css` says why.
- **Orientation is a search variable in `nest.ts`, not a rule.** Opening a strip
  with the piece laid flat is the right default and is sometimes catastrophically
  wrong: three ungrained 1180 × 700 panels laid flat need **two** sheets, because
  a second 700 mm strip will not fit under the first; stood upright they are
  three 700 mm-wide pieces in one 1180 mm strip and fit on **one**. No amount of
  reordering finds that — every ordering makes the same wrong turn — so the hill
  climb can flip a piece as well as move it, and "everything stood up" is one of
  the fixed starting candidates. **Found by looking at a rendered plan, not by a
  failing test**, which is the argument for rendering the thing before believing
  the suite.
- **Perturb the best order; do not shuffle.** Measured: full random restarts
  improved the layout on one of five realistic cut lists and never saved a sheet.
  First-fit-decreasing is already at the area lower bound on realistic input, so
  a random permutation is so much worse that best-of-2000 just re-elects the
  heuristic. What the search actually buys is a deeper single offcut, not a
  sheet.
- **`product: 'diy'` is written with no cast.** `'diy'` is a real member of the
  SDK's `ProductCode` union (≥ 0.85.0) *and* a real value in the Postgres
  `product_code` enum (universal-platform migration 0112). If the compiler ever
  objects here it is correctly reporting that the database will reject the insert
  too — fix the enum, never the type. `as unknown as ProductCode` is what turned
  Universal Converter's build error into a silent production insert failure.

## Where the spec was wrong or thin

The scope-out (`Docs_UNI_SIM/next-products.md` §14) was followed closely. Three
places it could not be:

1. **The fourth preset.** §14 lists "Everything inset (butt box)" with the order
   `Back → Left, Right → Top, Bottom → Front, with the front inset` — which is
   character-for-character its own third preset, "Overlay back". The name is also
   unbuildable: "everything inset" is exactly the no-outermost-panel state the
   wrap order exists to forbid. Somebody has to be outermost. The slot is spent
   instead on **"Sides + applied back"**, which is a genuinely different box.
2. **"Good face" is a fixed column.** §14 asks for a "which face points out"
   column but no state to drive it. For a box the good face always points out, so
   it prints `Out` for every piece with a line in the header block saying so, and
   the Notes column carries the exceptions. Making it per-piece editable would
   need a second persisted record for very little.
3. **Grain is `along length` or `none`.** §14's column allows `along width` too,
   but nothing produces it: the length *is* defined as the along-the-grain
   dimension. The optimiser did not change that — it rotates a *placement* and
   records `rotated` on it, which is a fact about the sheet, not about the piece.

## The optimiser, and where §14's plan needed correcting

Shipped 2026-08-09. Guillotine shelf packing with a seeded search, in `nest.ts`,
rendered by `components/sheet/SheetPlan.tsx` on **both** pages.

Two places the scope-out's recipe was wrong, both found by measuring:

1. **"Randomised-restart search over the piece ordering" does almost nothing.**
   Measured over five realistic cut lists at 0 / 50 / 400 / 2000 restarts: it
   improved one of them and **never saved a sheet**. The reason is the good news —
   first-fit-decreasing already hits the **area lower bound** (no layout of any
   kind can use fewer sheets than the total piece area needs) on realistic input,
   so there is no sheet left to save and a random permutation is far too poor to
   beat the heuristic. Replaced with a hill climb that perturbs the best
   candidate. What the search buys is a deeper single offcut.
2. **The ordering is not the only decision.** See the orientation landmine above.
   That one *does* save whole sheets, and no reordering search can reach it.

Both are why the honest claim in the UI is "a good layout, not a proven optimum"
with the determinism stated next to it, rather than a percentage.

## Still to do

1. **Phase 3: per-panel thickness.** The formula already supports it — the
   deductions are per-neighbour, so `t` becomes `t(neighbour)`. The cost is input
   surface, not arithmetic.
2. **Offcuts as stock, and linear (1D) cutting.** The two rows the comparison
   page shows us losing to OpenCutList, and the two most defensible next
   features. Offcuts is the cheaper of the pair: `nest()` already opens sheets one
   at a time, so a user-supplied offcut is a sheet with different dimensions
   consumed before the full ones.
3. **Three.js: demoted, probably never.** Decorative at best, and it implies an
   editability the app refuses.

The `UNISIM_Compare` entry is **done** (2026-08-10, `/comparisons/diy` — vs
CutList Optimizer, OptiCutter, MaxCut and OpenCutList). ⚠️ Its competitor claims
are quoted from live pages read on that date; if you change a row there, re-read
the vendor page rather than trusting the quote's age.

Launch is done: the public repo exists, the Pages project is live behind
`opensource.unisim.co.uk/diy` (via `'/diy': 'https://unisim-diy.pages.dev'` in
the portal Worker's `TARGETS`), and the portal tile is up.
