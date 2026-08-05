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
  diagram.ts    net + section layout, in millimetre space
  units.ts      mm is canonical; display/entry conversion and rounding
  materials.ts  stock thicknesses (exact mm) and the sheet ESTIMATE
  csv.ts        the cutlistoptimizer-shaped export
  share.ts      the whole design in the URL hash
  storage.ts    localStorage + .unidiy.json, with untrusted-input sanitising
  route.ts      /diy vs /diy/cutlist
  examples.ts   the navbar's example boxes
src/stores/     one zustand store; the cut list is DERIVED, never stored
src/components/ presentation only
```

**`src/lib/panels.ts` is the product; everything else is presentation.** If a
number there is wrong somebody cuts up a sheet of birch ply for nothing.

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
   but nothing in v1 can produce it: the length *is* defined as the
   along-the-grain dimension. The value stays in the type for the Phase 2
   optimiser, which is where a rotated piece becomes meaningful.

## Still to do — owner-gated

Nothing in this list can be done from inside this repo.

1. **Create the public GitHub repo** `universal-simulation-ltd/Universal_DIY` and
   push. Deliberately not done here.
2. **Migration first, then go live.** `alter type product_code add value if not
   exists 'diy';` — *check* whether universal-platform migration 0112 has actually
   been applied to prod. The SDK type already lists `'diy'` as coming from 0112,
   but the type is kept in sync by hand, so the type saying so is not evidence the
   database agrees. It must land before a signed-in visitor opens the app, or
   every usage insert fails — quietly, because the SDK drops events when there is
   no session.
3. **Cloudflare Pages project `universal-diy`** (a clean name, never issued, so it
   gets a suffix-free `universal-diy.pages.dev`).
4. **`'/diy'` in `backoffice/opensource-portal/src/worker.js` `TARGETS`**, plus a
   portal tile in its `public/index.html`. The portal groups tiles Every
   Day · Business · Geeky; **Geeky** is the least-wrong home today.
5. **Suite changelog entry** once it is live.
6. **`UNISIM_Compare` entry — hold it.** Until a sheet optimiser ships,
   `features.optimiser` is a ✗ against cutlistoptimizer's ✓ on the row most
   visitors care about, and a comparison table we lose is worse than no table.

## Phase 2 and beyond

- **Phase 2, and it is the priority: the guillotine sheet optimiser.** Hobbyists
  cut on a table or track saw, so the correct problem is **guillotine-constrained**
  2D bin packing, not free nesting — easier *and* the only kind of layout they can
  physically cut. Shelf / first-fit-decreasing with randomised restarts, kept
  deterministic. It must model kerf (default 3 mm), grain lock and a trim
  allowance. Do not reach for an exact solver or a generic nesting library.
- **Phase 3: per-panel thickness.** The formula already supports it — the
  deductions are per-neighbour, so `t` becomes `t(neighbour)`. The cost is input
  surface, not arithmetic.
- **Three.js: demoted, probably never.** Decorative at best, and it implies an
  editability the app refuses.
