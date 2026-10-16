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
  content/               data: what the game is made of. Add things here first.
    buildings/*.js       one file per client (see buildings/README.md); index.js fixes the save order
    twists.js tech.js company.js town.js events.js guides.js
  game/                  rules, pure functions over the save S. No DOM.
    contracts.js         makeContract, the surveyor (generateSolved / solveContract), runHeadless, prices
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

## Adding a building

1. Copy a similar file in `src/content/buildings/`, change `key`, `plot`, `kind`, `site`, `floor`, `look` and the art hooks.
2. Append it to `BUILDINGS` in `buildings/index.js`.
3. `npm test` (the content test checks fields and builds the site at every width), then look at it: `npm run dev`.

## Known issues / TODO

- **False-alarm callbacks are common**: about 16 in a 48-month bot game, the client calls back and the surveyor finds your existing doors already cope. Callbacks should more often come with a change that the installed doors genuinely fail.
- The survey is CPU-heavy (a few seconds per tender); the worker hides it, but a full golden run takes ~8 minutes.
- `prototype/` was removed in the restructure; the original single-file build is in the first commit if a comparison is needed.
