# Universal DIY

> Pick the shape, type three numbers, say how the panels meet, get a checked cut
> list and a scale drawing in about sixty seconds.

> Open source — self-host free or hosted by UNI SIM.

A parametric **cut-list calculator for simple butt-joint wooden boxes**. Enter the
outer **W × D × H** and your material thickness, say which panels run through and
which fit between them, and you get every piece's cut size, a **2D exploded
diagram drawn to scale**, a **cutting plan showing where each piece goes on the
sheet**, and a **cut list you can print and take to the saw**.

No sign-up. No upload. No paywall. The whole calculation is arithmetic in your
browser, so it works offline and nothing you type leaves the device.

**[Try the live app →](https://opensource.unisim.co.uk/diy)**

Part of the [Universal Apps](https://opensource.unisim.co.uk) suite by
[UNI SIM](https://www.unisim.co.uk).

## What it does

- **Starts with the shape, not the sums.** The landing page asks what you are
  building — box, shelf unit, tray, cabinet carcass, drawer, plinth — and each
  card is a starting design, not a mode. See below.
- **Or no shape at all.** The custom parts list takes any pieces you like:
  length, width, how many. Click the two ends that meet to butt-join them, or
  leave every piece separate. Several projects can share one cut.
- **Six panels, one box.** Left, Right, Top, Bottom, Back and Front. Each can be
  present or omitted, so open-top trays and open-back cabinets work.
- **Says how the panels meet, correctly.** Not six independent switches — a
  **wrap order**. See below; it is the whole point.
- **Millimetres, centimetres or inches**, one display unit for the whole
  document. Inches print as the nearest 1/32″ with the exact decimal alongside.
- **A scale exploded diagram** — an unfolded net plus a plan and an elevation
  cross-section, because a net shows sizes but cannot show which panel laps
  which.
- **A printable cut list** with a tick box per piece, a label to pencil on the
  board, grain direction, and a check line giving the interior cavity.
- **A cutting plan for the sheet.** Where every piece goes on a 2440 × 1220, how
  many sheets you need, and what is left over — allowing for the saw kerf, the
  grain and the trim off the factory edges. See below.
- **CSV export** in `Length,Width,Qty,Label,Material,Grain,Notes` — the column
  order that pastes straight into cutlistoptimizer or OptiCutter.
- **Save, open and share.** A `.unidiy.json` project file, and the whole design
  encoded in the URL hash so a link needs no server at all.

## How the panels meet — the one thing that has to be right

The obvious model is six switches: each panel either *extends to the edge* or
*sits inside*. That model is broken. At the edge where the Top meets the Left:

- both extending puts **two pieces of wood in the same corner**;
- both sitting inside leaves a **t × t groove running the full depth of the box**.

Two of the four states at each of the twelve edges are physically impossible, so
most of the 64 combinations are nonsense.

So the model is a **wrap order** — a strict ranking of the six panels, outermost
first. At each edge the panel ranked higher runs through to the outer surface,
and its neighbour butts against the inner face and loses exactly one thickness at
that end:

```
size along axis b = outer(b)
                  − t  if the panel at b-min exists and is ranked outside this one
                  − t  if the panel at b-max exists and is ranked outside this one
```

Every edge has exactly one winner, so **the box is valid by construction for all
720 orderings** — there is no way to reach an overlap or a gap from the UI. The
tests check that exhaustively rather than taking it on trust.

The familiar toggle survives as the *interaction*: "extends to the edge" promotes
a panel to the top of the order, "sits inside" drops it to the bottom, and the
resolved order is always shown and directly reorderable. Four presets cover what
most people are actually building.

Thickness is never rounded. A ¾″ board is 19.05 mm and deducts 38.1 mm; calling
it 19 is a 1 mm lie you will find at glue-up.

## Picking a template first

The calculator's first question used to be the outer width of a box, which is
the right question only if you already knew you wanted a box calculator. The
landing page asks the one anybody can answer — *what are you building?* — and
turns the answer into a starting `Design`.

A template is **nothing but a starting design**. It is not a mode and not a
stored kind; nothing downstream branches on which card was clicked, and the
moment it lands every control still moves. That is deliberate: a template that
locked anything would be a second model of the box sitting alongside
`panels.ts`, and the whole point of the wrap order is that there is exactly one.
So the only real content of `src/lib/templates.ts` is which panels are present
and what the wrap order is — both already expressible, both already covered by
the exhaustive tests.

The card drawings are the **real plan and elevation cross-sections** of each
template, from the same `sectionLayout` the calculator prints, at a common
scale, with walls one true material thickness thick. A hand-drawn icon would be
a decorative second model free to drift from the first, and it would be the
first thing a visitor sees. Both sections are shown because either alone is
blind: an elevation cut contains no front or back panel, so a shelf unit and a
closed box have identical elevations; the plan has the mirrored blind spot for
the top and bottom. `preview.test.ts` asserts exactly that.

The animation is the assembly, played in wrap order, outermost first — the
sides arrive at full height and then the top drops in *between* them. It is the
one place the model can be shown happening rather than described.
`prefers-reduced-motion` and print both get the finished drawing, held.

| Route | Page |
|---|---|
| `/diy` | The landing page — templates |
| `/diy/cutlist` | The box calculator |
| `/diy/parts` | The free parts list |

`/diy/cutlist` was registered as a working alias on day one against exactly this
change, so **no existing URL moved**: every bookmark and shared link made while
`/diy` was the calculator already pointed at `/diy/cutlist` too. A shared link
skips the landing page entirely — its hash carries a whole design, and somebody
who followed one wants the box, not a menu.

## Not a box: the custom parts list

`/diy/parts` is the free-form page, and it is a **different model**, not a
seventh template. Give each piece a length and a width, add as many as you
like, and where two pieces butt together click the two ends that meet. One runs
through and keeps its length; the other butts into its face and loses exactly
one thickness. Leave them separate and each piece is cut to precisely the
length typed.

It keeps the one idea that made the box model worth having and throws away the
shape. Where the box settles "who runs through" globally with a wrap order over
six fixed panels, `src/lib/parts.ts` settles it per joint:

```ts
interface Joint { through: PartEnd; butt: PartEnd }
```

A joint *names* its through piece and its butt piece, so there is no state in
which both run through (two pieces of wood in the same place) or neither does
(a `t`-wide gap) — the same argument that rejected six "extends / sits inside"
booleans for the box. Every joint list is buildable by construction, and
`parts.test.ts` checks that under every combination rather than trusting it.

Three things follow that the box model never has to face:

- **The deduction is the partner's thickness, not the piece's own.** A parts
  list may mix stock, so a 12 mm rail butting into an 18 mm stile loses 18. A
  box has one thickness by definition, so it cannot express the mistake.
- **Each end takes at most one joint.** Two rails butting into the same end of
  one stile is not a frame, it is two rails in the same place.
- **Positions are not modelled.** A joint says "this end butts into that
  piece", never where either piece is, so the page cannot tell you a frame
  closes up and does not pretend to — no assembled drawing, no cavity check.
  Widths are never deducted either; a joint is at an end, and the end is on the
  length.

Several projects can share one list. Rows carry a project tag, the printed
sheet groups and tallies by it, and one cutting plan covers the lot — which
is the point, since one trip to the merchant often covers two builds. Two rows
that happen to come out the same size stay two rows: merging them would take
away the thing a multi-project list is for.

There is no share link on this page. A box is a dozen numbers and fits in a
URL; a parts list has no length limit, so it saves to a file instead.

## What it deliberately will not do

The value here is that you can check the answer by hand, at the saw, with a tape
measure. Everything below trades that away, and every one of them is already done
better elsewhere (Fusion 360, SketchUp + OpenCutList, Boxes.py, OpenSCAD).

| Not supported | Why |
|---|---|
| Mitres | Changes the angle, not just the length — the cut list needs a bevel column and the diagram needs to show angles. |
| Rabbets, dados, grooves | Turns sizes into machining operations, and changes the deduction rule. |
| Finger joints, dovetails | The output becomes a vector cutting path, not a number. That is Boxes.py's job. |
| Pocket holes, dowels, hardware | Becomes a drilling plan and a hardware schedule. |
| Doors, drawers, shelves, face frames | Each has its own reveal and clearance conventions — this is where a box calculator becomes a cabinet designer and then CAD. |
| Curves, tapers, non-rectangular boxes | The model assumes axis-aligned rectangles throughout. |
| Per-panel thickness | One thickness per box for now. The formula already supports it; the input surface is the cost. |
| Free nesting | The cutting plan is deliberately **guillotine-only** — see below. A tighter layout that no table saw can cut is not a better layout. |
| 3D preview | You cannot read dimensions off a perspective view, and it cannot be printed. Two orthogonal sections show everything a rotatable box would. |

## The cutting plan

Cut sizes tell you how big each piece is. The cutting plan tells you **where it
goes on the sheet** — how many sheets to buy, what is left over, and in what
order to cut.

Every cut in the plan runs **edge to edge**. That is not a simplification, it is
the constraint that makes the plan usable: a table saw and a track saw can only
make cuts that cross the whole workpiece, so a layout has to be *guillotine*
-cuttable or you cannot follow it. Packers that nest freely produce tighter
arrangements that nobody with a table saw can cut. The tests check the property
directly, and they are run against a deliberately non-guillotine layout first to
prove the check can fail.

Three things it models, none of them optional:

- **Offcuts you already own** — tell it what is on the rack and those get used up
  before a single new sheet is bought. **No trim is taken off an offcut**: its
  edges came off your saw, so they are already square, and deducting again would
  quietly shrink every piece in the rack. If the whole job comes out of your
  offcuts it says so instead of quoting a waste percentage against sheets you
  never bought.
- **Saw kerf** (3 mm by default) — the wood the blade turns to dust at every cut.
  Ten cuts is 30 mm, which is the difference between a plan that works and a plan
  that is one piece short.
- **Grain lock** — a piece whose grain runs along its length cannot be turned
  90°. This is the main reason a real layout wastes more than the arithmetic
  suggests, and it is why the cut list has a Grain column.
- **Trim** (10 mm by default, off one long and one short edge) — factory edges
  are rarely square, and a piece sized to the nominal sheet does not fit.

Kerf, trim and your offcut rack are facts about **your workshop**, not about this
project, so they are remembered once and shared by both pages rather than asked
for per project. A list that mixes
materials or thicknesses gets one plan each — 18 mm carcass parts and a 6 mm back
do not come off the same sheet.

**Its limits, plainly.** It returns a *good* layout, not a proven optimum: 2D
cutting stock is NP-hard and an exact solver would be wildly out of proportion to
a six-to-thirty-piece cut list. It is **deterministic** — the same design always
gives the same plan, because a layout that reshuffles on refresh is not a plan.
It knows nothing about voids, warp or damage in a real sheet. And a piece longer
than the stock is reported as impossible rather than quietly squeezed in.

## Running it

```bash
git clone https://github.com/universal-simulation-ltd/Universal_DIY.git
cd Universal_DIY
npm install
npm run dev
```

Or use the preview scripts, which pin the port and install on first run:

```bash
./scripts/preview.sh        # macOS / Linux
.\scripts\preview.ps1       # Windows
```

Then open <http://localhost:5196> for the template chooser, or
<http://localhost:5196/cutlist> to go straight to the calculator.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Run the test suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b --noEmit` |

## Contributing

Issues and pull requests are welcome. Two things to know first:

1. **`src/lib/panels.ts` and `src/lib/nest.ts` are the product.** Everything else
   is presentation. A change to either needs a test that fails without it — the
   existing suite includes hand-checked worked examples, an exhaustive walk over
   all 720 wrap orders × all 64 present/omitted combinations, and an independent
   guillotine checker that every emitted layout has to satisfy.
2. **The "will not do" table above is a design decision, not a backlog.** A pull
   request adding dados or a 3D view will be declined, however good it is.

MIT licensed — free and open source, like all Universal Apps.
