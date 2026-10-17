# Door Duty Contractors

A crowd-science tycoon/puzzle game. The player runs a firm fitting entrances on a town's streets: each client is a puzzle (design a frontage of bays, test it in a 40-second simulated rush hour, sign it off), and the firm earns maintenance, researches new hardware, hires staff and moves premises month by month.

It ships as **one self-contained HTML page** (`dist/index.html`), deployed to GitHub Pages by `.github/workflows/pages.yml`. No runtime or build dependencies: plain ES modules, Node's built-in test runner, and a small bundler in `tools/build.mjs`.

## Commands

```
npm run dev          # serve the repo; open http://localhost:8080/src/shell.html (live modules, no build step)
npm run build        # bundle to dist/index.html
npm run watch        # rebuild on change
npm test             # fast suite (~45 s on 4 cores): content checks, save/month determinism, grading, a spread of golden surveys
npm run test:full    # every golden survey plus a 6-month headless game (~3 min on 4 cores)
npm run sim -- 24 1  # headless game: 24 months, seed 1, prints the firm's books month by month
npm run bot -- 9     # browser smoke test (Playwright for Python, pinned in tools/requirements.txt): plays dist/index.html
                     # for 9 rounds (about 3 months); exits 1 on script errors, broken text, a wrong cost or a failed par
                     # design. --dev plays src/ instead. CI runs it on every push.
npm run balance      # balance report: answer variety and pacing over 5 seeds (~30 min on 4 cores; --quick ~6 min);
                     # --compare test/fixtures/balance-baseline.json to see it next to the baseline. Runs nightly in CI.
npm run record-golden  # re-record test/fixtures/surveyor-golden.json after a deliberate rules change (~2 min); prints which
                       # cases changed (--dry to only print). Put the summary in the commit message.
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
    changes.js           street changes: the causes of ordinary callbacks
  game/                  rules, pure functions over the save S. No DOM.
    contracts.js         makeContract, the surveyor (generateSolved / solveContract), runHeadless, prices
    designs.js           new and copied designs (always deep copies), defaultSlot
    briefs.js            brief wording that depends on the job: job labels, why a client called, stage twists
    stagejobs.js         inside jobs: makeStageContract, solveStage (the surveyor for stages), runStage, result rows
    economy.js           fees, upkeep, wear, insurance, reputation, unlock checks
    jobs.js              grade a result, signOff, and the firm's decisions (research, hire, premises, service)
    month.js             endMonth(S) -> report; inspect
    enquiries.js         clients asking for research you haven't done (with a date), and advice(S) for quiet months
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
tools/  build.mjs sim.mjs bot.py (requirements.txt) record-golden.mjs balance.mjs
test/   *.test.js, fixtures/surveyor-golden.json, fixtures/balance-baseline.json (after the last phase), balance-before-phase0.json
.github/workflows/  pages.yml (test, build, bot, deploy on main), nightly.yml (full tests, balance, a year of bot)
docs/game-loop.html      the design page: the game loop, systems and roadmap
docs/PLAN.md             the build plan: verified findings, phases, testing and architecture changes
```

## House rules (the bundler enforces 1 and 2)

1. **Top-level names are unique across the whole program.** The build concatenates modules into one scope. Locals can shadow freely.
2. **Imports are single-line and never renamed**: `import { a, b } from './x.js'` or `import x from './x.js'`.
3. **`game/`, `content/` and `engine/` never touch the DOM**, so they run in the worker, in Node tests and in `tools/sim.mjs`.
4. **Randomness in game rules goes through `random(S)`** (seeded, stored in the save), so a month replays exactly. The engine and the surveyor are deterministic per contract seed. `Math.random` is only for cosmetics (confetti, art).
5. **The surveyor is pinned by the golden test.** If a change alters which jobs are generated or how they solve, that's a rules change: re-record the fixture on purpose and say so in the commit.
6. **Plots are saved by position.** Only append to `BUILDINGS`; bump `SAVE_VERSION` and add a step to `migrate()` when the save's shape changes.
7. Player-facing text is British English, plain and short.
8. **Rules and wording that depend on the job live in `game/` or `content/`, not `ui/`**, so tests can check them: design copies (`designs.js`), why a client called and twist wording (`briefs.js`), hints (`hintFor` in `jobs.js`), star rules (`STARS` in `guides.js`). `ui/` renders what they return.
9. **Text must be true of the job in front of the player.** A hint names only hardware the job allows and the firm owns; a research call or enquiry only comes from a client its words fit (`fits` in `content/paradoxes.js`).

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

Clients get inside jobs three ways: a paradox callback when research finishes (`content/paradoxes.js`, see `endMonth`), a building whose `jobs` list is all inside work (Riverside), or a normal callback about an inside setup they already have (`p.inside`). A building can rename and retune a stage for itself (`tune: { queue: { name: 'Bag check', rate, params } }`), reword its twists (`tune: { queue: { twists: { payday: { label, text } } } }`, as the arena does) and set what's already there (`inside: { queue: { desks: 3 } }`).

## Callbacks

Ordinary callbacks are caused, not random. Each month a **street change** (`content/changes.js`: a bus stop moves, a care home opens, a cold snap) may go on the calendar two months ahead (`scheduleChange`). When it lands (`landChange`), up to a few fitted clients it touches go to status `checking`: they keep paying while the surveyor runs a **check** contract (`opts.check`: the client's normal day plus a moderate version of the change, no random twists, no escalation, and the client's own doors tried exactly as they stand). If they still pass, the client copes (`settleCheck`): `p.coped` goes up and so does their maintenance (`loyalty`, up to +15%). If not, it becomes a normal callback with that job. So doors built with room to spare ride changes out; doors built exactly to par usually don't.

**Enquiries** keep research pulling: now and then (always, in a month with nothing on the table) a fitted client asks for work that needs a tech you could research now (`settleEnquiries`, from `PARADOX_CALLS`). `p.enquiry = { tech, j, by, text, bonus }`. If the tech is in by `by`, they call with that job and `signOff` pays the bonus (30% of the research price); if not, they stop waiting: to the rival once it's active, otherwise a step of loyalty. `advice(S)` suggests the one thing that would bring in work; the month report and the empty ledger show it.

Other callbacks: paradox calls when research finishes (`content/paradoxes.js`), failed inspections, and the rival's botched work coming back. A research call's problem travels as `opts.need` (from `p.callTwist`): `makeContract` puts it in before any random twist, and the surveyor's retries never drop it. A new firm starts in May; first visits are warm in the warm months and there is no heatwave in the first summer, so temperature arrives in the autumn.

## Adding a building

1. Copy a similar file in `src/content/buildings/`, change `key`, `plot`, `kind`, `site`, `floor`, `look` and the art hooks.
2. Append it to `BUILDINGS` in `buildings/index.js`.
3. `npm test` (the content test checks fields and builds the site at every width), then look at it: `npm run dev`.

## Known issues / TODO

The build plan is `docs/PLAN.md`: what's next, the tests each phase must pass, and the decisions already made.
- `designSig` uses a door type's first letter, so swing and sliding doors share `s`: the anti-repeat rule can't tell them apart (Phase 1).

- Real callbacks (inspections, the rival, paradox calls) still escalate if the doors already cope (generateSolvedInner); street-change checks don't, by design.
- A chained level's survey takes 5 to 20 seconds (it improves the route one change at a time, not every combination).
- The survey is CPU-heavy (a few seconds per tender); the worker hides it. Golden surveys run on every core (`surveyAll` in `test/golden-case.js`), so a full golden run is about 2 minutes on 4 cores; a headless game is still one month after another (10-25 s a month).
- `prototype/` was removed in the restructure; the original single-file build is in the first commit if a comparison is needed.
