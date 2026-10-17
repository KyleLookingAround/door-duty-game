# Door Duty Contractors

A crowd-science tycoon/puzzle game. The player runs a firm fitting entrances on a town's streets: each client is a puzzle (design a frontage of bays, test it in a 40-second simulated rush hour, sign it off), and the firm earns maintenance, researches new hardware, hires staff and moves premises month by month.

It ships as **one self-contained HTML page** (`dist/index.html`), deployed to GitHub Pages by `.github/workflows/pages.yml`. No runtime or build dependencies: plain ES modules, Node's built-in test runner, and a small bundler in `tools/build.mjs`.

## Commands

```
npm run dev          # serve the repo; open http://localhost:8080/src/shell.html (live modules, no build step)
npm run build        # bundle to dist/index.html
npm run watch        # rebuild on change
npm test             # fast suite (~2 min): content checks, save/month determinism, grading, a spread of golden surveys
npm run test:full    # every golden survey plus a 6-month headless game (~10 min)
npm run sim -- 24 1  # headless game: 24 months, seed 1, prints the firm's books month by month
npm run bot -- 12    # browser smoke test (Playwright, Python): plays dist/index.html for 12 months; add --dev for src/
npm run record-golden  # re-record test/fixtures/surveyor-golden.json after a deliberate rules change
```

## Layout

```
src/
  engine/world.js        the crowd and door physics. World steps at SIM_DT = 1/60. No DOM.
  engine/stages/         inside jobs: one small crowd model per paradox (queue, escalator, lifts, paternoster,
                         walkway, carousel, braess, bottleneck), common.js (StageSim base), chain.js (stages run
                         together as one crowd), index.js (STAGES registry)
  content/               data: what the game is made of. Add things here first.
    buildings/*.js       one file per client (see buildings/README.md); index.js fixes the save order
    twists.js tech.js company.js town.js events.js guides.js
    paradoxes.js         which finished research makes which fitted client call, and about what
  game/                  rules, pure functions over the save S. No DOM.
    contracts.js         makeContract, the surveyor (generateSolved / solveContract), runHeadless, prices
    stagejobs.js         inside jobs: makeStageContract, solveStage (the surveyor for stages), runStage, result rows
    economy.js           fees, upkeep, wear, insurance, reputation, unlock checks
    jobs.js              grade a result, signOff, and the firm's decisions (research, hire, premises, service)
    month.js             endMonth(S) -> report; inspect
    plots.js             refreshPlots: which clients talk to you, and new tenders
    state.js             freshState, migrate, the seeded random stream (S.rng)
  ui/                    the page. Every module that touches the DOM exposes an init function called from main.js.
    main.js              boot order and the frame loop
    store.js             the live save S (only this module replaces it)
    street.js scene.js   the street screen: ledger and the painted SVG street
    workshop.js canvas.js  the job screen: editor, test run, canvas plan view
    stageart.js          drawing the inside jobs, and laying out a chained level's stages
    sheets.js            bottom sheets: brief, company, client, lessons, the month report
    coach.js survey.js dom.js
  worker.js              the survey worker: runs generateSolved off the main thread
  shell.html             markup and CSS; the build fills <!--CORE--> and <!--APP-->
tools/  build.mjs sim.mjs bot.py record-golden.mjs
test/   *.test.js, fixtures/surveyor-golden.json
docs/game-loop.html      the design page: the game loop, systems and roadmap
```

## House rules (the bundler enforces 1 and 2)

1. **Top-level names are unique across the whole program.** The build concatenates modules into one scope. Locals can shadow freely.
2. **Imports are single-line and never renamed**: `import { a, b } from './x.js'` or `import x from './x.js'`.
3. **`game/`, `content/` and `engine/` never touch the DOM**, so they run in the worker, in Node tests and in `tools/sim.mjs`.
4. **Randomness in game rules goes through `random(S)`** (seeded, stored in the save), so a month replays exactly. The engine and the surveyor are deterministic per contract seed. `Math.random` is only for cosmetics (confetti, art).
5. **The surveyor is pinned by the golden test.** If a change alters which jobs are generated or how they solve, that's a rules change: re-record the fixture on purpose and say so in the commit.
6. **Plots are saved by position.** Only append to `BUILDINGS`; bump `SAVE_VERSION` and add a step to `migrate()` when the save's shape changes.
7. Player-facing text is British English, plain and short.

## Inside jobs (stages) and paradoxes

Door jobs are about the frontage. Inside jobs are about what happens behind it, and each one teaches a paradox where the obvious fix is the wrong one. A stage file in `src/engine/stages/` exports:

| field | what |
|---|---|
| `key`, `name`, `paradox`, `about` | ids and player-facing text |
| `level(c, rng, tier)` | sets `c.params`, `c.crowd` (`rate`, `mix`), `c.arrive` (arrivals window) and `c.run` (test length), from the tier and `c.twists`. Call `StageSim.tune(c, rate, scale)` so clients can adjust it |
| `twists` | the stage's own level twists: `{ key: { label, text } }` |
| `options(c, tech)` | editor controls: `stepper`, `seg` (choices may need a tech), `range`, `toggle` (may need a tech) |
| `defaults()`, `cost(d, existing)`, `sig(d)` | a design is `{ stage, ...settings }`; callbacks only charge for changes |
| `candidates(c, tech)` | what the surveyor tries |
| `reference(ok, c)`, `slack`, `metric` | how targets are set: the best of `reference` (e.g. "without a new lift") × `slack`. `metric` is `p90` or `mean` |
| `bumps(c)`, `waitLabel`, `bumpLabel`, `hint(r, c)`, `explain(d, c)`, `box` | grading text, and the drawing area in metres |
| `Sim` | a `StageSim` subclass: `admit(p)` takes a person in (from the street or the stage before), `step(dt)`, `finish(p)` when they leave, `over()` |

Rules: a stage must work fed (`sim.fed`, people come from `admit`) as well as on its own, because chained levels (`chain.js`) hand each stage's finished people to the next. Check the paradox numerically before wiring it up: `test/stages.test.js` asserts each one holds on average over several seeds.

Clients get inside jobs three ways: a paradox callback when research finishes (`content/paradoxes.js`, see `endMonth`), a building whose `jobs` list is all inside work (Riverside), or a normal callback about an inside setup they already have (`p.inside`). A building can rename and retune a stage for itself (`tune: { queue: { name: 'Bag check', rate, params } }`) and set what's already there (`inside: { queue: { desks: 3 } }`).

## Adding a building

1. Copy a similar file in `src/content/buildings/`, change `key`, `plot`, `kind`, `site`, `floor`, `look` and the art hooks.
2. Append it to `BUILDINGS` in `buildings/index.js`.
3. `npm test` (the content test checks fields and builds the site at every width), then look at it: `npm run dev`.

## Known issues / TODO

- Callbacks the installed doors already cope with escalate (up to three times) and then switch complaint, so false alarms should now be rare; if they reappear, check generateSolvedInner in contracts.js.
- A chained level's survey takes 5 to 20 seconds (it improves the route one change at a time, not every combination).
- The survey is CPU-heavy (a few seconds per tender); the worker hides it, but a full golden run takes ~8 minutes.
- `prototype/` was removed in the restructure; the original single-file build is in the first commit if a comparison is needed.
