# Door Duty: the plan from here

Written October 2026 after a full playthrough: a fresh firm played by hand, saves jumped to winter and to month 24 with the headless sim, the browser bot for 18 rounds, sims on seeds 1–4, and extra surveys over several seeds. Every finding below was checked against the code and, where it is about balance, across seeds. `npm test` passes (62 pass, 1 skipped) and the bot hit no script errors; the problems are in gameplay, wording and layout, not crashes.

How to use this page: work the phases in order. Each phase lists the work, the architecture change that goes with it, the tests that must pass before it merges, and how we know it's done. `docs/game-loop.html` stays the design bible; this is the build order.

---

## 1. Where the game stands

### Bugs

| # | What the player sees | Cause | Evidence |
|---|---|---|---|
| B1 | **Chained levels are free.** Adding desks at Apollo Arena leaves the cost at £0, and sign-off charges nothing. | `ui/workshop.js:31` copies an inside job's design shallowly (`{ ...c.existing }`), so a chain's `parts` are the client's existing setup. Editing one edits both, so `designCost(design, c.existing)` is 0 (`game/jobs.js:70`), and the saved "as it stands" setup is overwritten. `cloneDesign` (line 19) has the same flaw for Reset. Single-stage jobs are unaffected. | Seen in the browser; the same design costs £72.5k against no existing setup |
| B2 | **Research-call briefs open with "undefined."** | The door brief (`ui/sheets.js:75`) reads `CALLBACKS[p.reason]`; research calls use `reason: 'paradox'`, which `content/town.js:5` doesn't have. The inside-job brief (line 124) handles it. Affects every door research call: mouth, core, padded, sensor, seals, curtain, vestibule, wide, café barriers, pillars, doorman. The eyebrow says "Callback" while the street says "New work". | Screenshot, Halden's big-core call |
| B3 | **A research call's own problem often isn't in the job.** Halden's "people keep going round again" call had no surge twist and no go-round goal; it passed with 48 go-rounds. | `game/contracts.js:108` adds the call's twist after the random ones and skips it on a clash; the retries at 506–526 drop `extra` entirely. | Twist kept in 2 of 6 seeds |
| B4 | **The ★★★ rule is described wrongly.** Text says "under par"; the code gives it at or under par. | `ui/sheets.js:107`, `ui/sheets.js:145`, `content/guides.js:5` vs `game/jobs.js:32` | Café: ★★★ at exactly par |
| B5 | **Text that ignores the job in front of you.** | Bumps hint says "Slow the wings" when revolving doors are banned (`game/jobs.js:34`). The coach describes revolving doors on a no-revolving job (`content/guides.js:17`). Enquiries use fixed text, so a café with 0 bumps "keeps getting clipped" (`content/paradoxes.js`). The Arena pulls bank/shop twists ("mortgages", "payday", "shoppers"). Every street header shows the whole firm's maintenance (`ui/street.js:46`). | Code; Arena twists over 4 seeds |

### Design

| # | Finding | Evidence |
|---|---|---|
| D1 | **The first summer has one answer.** In June and July, 27 of 36 first visits are solved by two one-way swing doors (£5k) or one slider (£6k). In December nearly every one needs revolving doors, and the first cold snap fails every summer client at once. | First-visit surveys, 12 buildings × 3 seeds, June, July and December |
| D2 | **The anti-repeat rule skips the early game.** The surveyor won't reuse your last 4 answers, but first visits are exempt (`contracts.js:481`, `!c.first`), and the early game is nearly all first visits. | Code; the bot got the swing pair 6 times in 15 jobs |
| D3 | **Research calls don't test their lesson.** Go-rounds weren't graded on the big-core call (B3). Apollo Arena's par never uses the snaking queue and uses stewarding in 2 of 4 seeds. | Surveys, 4 seeds |
| D4 | **The Galleria is the same job every time:** same two twists, close the bridge, £1,500 against a £7k budget, with £35k widening options that can never be afforded. | 4 seeds |
| D5 | **Reputation runs out by month 4.** Every seed reaches 31–35★ by August, then stays flat for the rest of the year. After that only research time moves the game. | Sims, seeds 1–4 |
| D6 | **Cash piles up.** £177k–£391k by month 12, £649k by month 24. The research tree is 23 techs, £810k and 58 bench-months, with at most 2 benches, so time, not money, limits it. (The sim plays a perfect par every job; a real player earns less.) | Sims |
| D7 | **Locked buildings hide their research needs** until you have the stars (`ui/street.js:33`, `ui/street.js:89`). Only the Station's painted card shows them up front. | Code |

### UX

- The coach bubble covers what it points at: the TENDER label on the street, the goals and par on the brief.
- At 390px: the title cuts to "Door Dut", calendar cards are truncated, a 4-bay frontage cuts off its outer revolving doors, and the Galleria plan is tiny and clips "ENTRANCE".
- On desktop the game is a ~530px column with empty space either side.
- Inside jobs say "Your doors" in the cost bar and show a "Bumps 0/0" counter where it doesn't apply.
- Surveys are slow: 16–19s for an Arena chain in Node, 34s for a door research call in the browser in this container. All surveys go through one worker (`ui/survey.js`).
- Worth keeping: per-stage times on a chain's tabs show where the bottleneck went; the street art and seasons.

### Docs and tooling

- `docs/game-loop.html` is out of date: loop 3 still marks "Town grows" and "Landmark opens" as Next, landmark cards say lifts and escalator standing "come later", the list of researched techs is stale, and the callbacks step says "A service engineer halves these".
- `tools/bot.py` only works when Playwright's version matches the installed Chromium (`playwright==1.56.0` here). Nothing pins it.
- CI (`.github/workflows/pages.yml`) runs `npm test` and the build. Nothing in CI opens the page.

---

## 2. Principles

- **Keep the architecture.** No-dependency ES modules, pure rules with no DOM, the survey worker, the one-file build, the seeded `random(S)`, plots saved by position, the golden pin. None of the bugs came from missing a framework. A UI framework or TypeScript would add build dependencies and work against the single-page deploy.
- **Move rules out of the UI.** The bugs that got through live where logic and wording sit in `ui/`, which no test touches.
- **Every job teaches something.** A job whose cheapest answer ignores its lesson is a bug, not a balance quirk.
- **Measure balance, don't eyeball it.** Variety and pacing become numbers that tests check.

---

## 3. Phases

### Phase 0: fixes (one session)

**Work**
1. B1: deep-copy designs. *Architecture:* move the design model into `game/` (`newDesign(c)`, a deep `cloneDesign` using `structuredClone`, `designCost`); the workshop only calls them.
2. B2: wording for research calls in the door brief; "New work" everywhere for them.
3. B3: a call's twist goes first and is never dropped on retry.
4. B4: one shared ★ rules string, used by the brief, the result and the guide.
5. B5: hints name only hardware the job allows; the coach's door text depends on what's allowed; enquiry text depends on the client's actual results; concert twists for the Arena; each street header shows that street's income.
6. Re-record `test/fixtures/surveyor-golden.json` (items 3 and 5 change which jobs are made) and say so in the commit.

**Tests that must pass:** the new Phase 0 regression tests (section 5, layer 1); `npm test`; golden re-recorded on purpose; the bot's text sweep is clean.

**Done when** no brief, result or report shows "undefined", chain costs match their parts, and every research call carries its twist.

### Phase 1: every job a real puzzle

**Work**
1. D2: the anti-repeat rule covers first visits too, so two clients in a row can't share an answer.
2. D1: summer pressures that defeat the cheap pair some of the time: surges with a go-round limit, crosswinds on corner plots, heat, bikes. Revolving doors appear before October.
3. D3: every research call grades its lesson: a go-round limit for big cores, an older-guest goal for sensors, a time goal for pillars on fire drills.
4. D3: the surveyor rejects a par that ignores the lesson, and regenerates the job.
5. D4: vary the Galleria (more routes, budgets that let widening compete, a wider twist pool), and check every Riverside level varies across seeds.
6. Grow the Open doors branch (section 4.3) so summer has research to reach for: door closers, automatic swing operators, telescopic sliders. Summer jobs then have more than one good answer, and the branch has more than its current two nodes.

*Architecture:* split `makeContract` (`contracts.js`, 534 lines) into explicit steps: required twists (call or lesson), then random twists that can't evict them, then goals, then the lesson goal. Give each job a lesson record, `c.lesson = { tech, goal, mustUse }`. Move brief, result and hint text into a pure `game/briefs.js` that returns data from `(S, p, c)`; `ui/sheets.js` only renders it.

**Tests that must pass:** variety and lesson tests (layer 3); the bot's lazy player passes under about 25% of the time; golden re-recorded on purpose.

**Done when** no single answer covers more than about 25% of any month's jobs, and no research job can be passed without its research.

### Phase 2: pacing and economy

**Work**
1. D5: spread reputation over about 12 months instead of 4. Options: raise the Market Square thresholds, award stars more slowly, or let stars fade while a callback waits.
2. D6: give money a use. Planned: monthly research costs, refinements and the Research lab (section 4). Still to choose: rushing research, landmark buy-ins or opening-night preparation, advertising that brings tenders in quiet months.
3. **The research rework** (section 4): research never stops, queues, the market study, mastery, refinements, the five-branch layout, paying monthly, and three new nodes (Crowd counters, Sales network, Research lab). Mastery needs `c.lesson` from Phase 1. The other new nodes come in Phases 1, 4 and 5, with what they open.

*Architecture:* move prices, star thresholds, wages, rent and research times into `content/balance.js`; let `simulate()` take overrides so values can be tried without code edits. The research changes are in section 4.

**Tests that must pass:** the pacing bands (layer 4) on 4 seeds; the research tests (layers 1 and 3).

**Done when** the sim shows steady reputation growth for about a year, cash stays meaningful at month 12, no bench is ever idle at month end on any seed, and every finished tech gets its lesson job within a few months.

### Phase 3: UX pass

**Work**
1. Place the coach bubble away from what it points at.
2. Fit the canvas to the frontage width. *Architecture:* one fitting function shared by `ui/canvas.js` and `ui/stageart.js`.
3. Fix the 390px truncation; use desktop width better.
4. D7: show locked buildings' research needs from the start.
5. Inside-job wording ("Your setup"); hide counters that don't apply.
6. Faster surveys. *Architecture:* a pool of `hardwareConcurrency − 1` survey workers, surveying the next likely job before it's opened, and a time cap on chain searches. Profile `engine/world.js` (700 lines) before tuning the surveyor.
7. Bring the rest of `docs/game-loop.html` up to date (its tech and landmark tables are generated from `TECH` from Phase 2).

**Tests that must pass:** layout checks at both sizes (layer 5); survey times within budget (layer 6).

**Done when** a phone player never meets a clipped control or a hidden target, and briefs open in a few seconds.

### Phase 4: roadmap content

Already on the design page as Later, plus two unbuilt landmarks. Each comes with its research node from section 4.3: Design office, Chain modelling, Child sensors, Wayfinding signs, Turnstiles and bag search, Security lanes.

1. **Blueprint book:** save a design and reuse it on later jobs. More useful once Phase 1 makes answers vary. *Architecture:* new save data, so bump `SAVE_VERSION` again (Phase 2 bumps it first) with a `migrate()` step; store blueprints by job type and stage key, not by plot.
2. **Doors as a chain stage:** the Station's escalators feeding the gate line, the Skyport kerb into the terminal. *Architecture:* the biggest structural piece. A `DoorStage` adapter gives the door `World` the `StageSim` interface (`admit`, `finish`), so a frontage can feed a stage or be fed by one. Design it early: it changes where the World's arrivals come from.
3. **New guests:** kids racing ahead, tourists riding the door round, phone zombies.
4. **Landmarks:** the Stadium (pillars, gates, barriers) and the full airport chain (kerb, check-in, security, gate, bags).
5. **Paradox journal and local paper headlines:** cheap to build, and they reward finishing a lesson.
6. From CLAUDE.md: real callbacks still escalate when the doors already cope.

**Tests that must pass:** each new stage gets a paradox test, golden cases, variety coverage and a bot pass.

### Phase 5: endgame

1. **Programmable doors**, opened by the Door controllers node. *Architecture:* rules as data (condition, then action, from a fixed list) read by the engine each step; never run as code, so the engine stays deterministic.
2. **Daily contract** on a shared seed, to compare costs with friends.

---

## 4. Research tree

### 4.1 What's wrong with it now

The tree is 23 techs in four branches (`content/tech.js`), costing £810k and 58 bench-months in all, gated by premises tier (garage and workshop have 1 bench, HQ has 2).

- **Owning isn't knowing.** A tech counts the moment it finishes. Nothing checks you ever used it, and landmarks unlock on ownership (`game/economy.js:40`), though the design page says they need the paradox *mastered*.
- **No real choices.** Everything is eventually owned, so the only decision is order. The sim's cheapest-first policy does as well as anything.
- **Four techs are passive.** Brush seals, Heat recovery, Heat pumps and the Supplier contract are automatic boosts with no decision in the workshop.
- **Five open one client each:** Paternoster (Town Hall), Route closures (the Galleria), Floor markings and Travelators (Skyport), Event stewarding (the Arena). They pay off once.
- **Lopsided branches.** Open doors has two nodes, though swing and sliding doors are the summer's whole game. Inside work is split between Crowd science and Building & staff.
- **It ends.** After 58 bench-months there is nothing left, while cash keeps rising (D6).
- **One decision a month,** paid in full up front, and idle benches are allowed.
- **Three sources to keep in step:** `TECH`, `LESSONS` (same file) and `PARADOX_CALLS` (`content/paradoxes.js`), plus a hand-written copy in `docs/game-loop.html` that has already drifted.

### 4.2 How research will work

1. **Research never stops.** End the Month needs every bench busy; with one free, the button reads "Choose research" and opens the Research tab. The check lives in `game/` (`benchesFilled(S)`), so the page, the sim and the bot share it.
2. **A queue per bench.** Line up the next projects; when one finishes the next starts. One decision every few months, not every month.
3. **Paid monthly** (recommended; see decisions). A project costs its price spread over its months, like wages. Research becomes a running cost, a big project is easier to start early, and a queue never needs a lump of cash. If you're overdrawn, paid projects pause (they keep their progress) and the bench falls back to a market study.
4. **The market study is always available.** Free, one month, any bench: it brings in a tender or an enquiry. The rule can never lock you in, even when you're overdrawn, broke or at the end of the tree, and it fills quiet months with work.
5. **Owned, then mastered.** A finished tech is *owned*: it's in the workshop. It becomes *mastered* when you sign off a job that grades its lesson (the `c.lesson` from Phase 1). That's usually the research call that follows, or a job that needs it.
   - **Landmarks and deeper nodes need mastery,** not just ownership, as the design page always said.
   - **A lesson job is guaranteed.** If no fitted client fits the call (`S.pendingCalls` waits today), an open tender carrying the lesson appears within two months.
   - **Mastery earns a star** on the firm's own record ("known for big-core drums"). That gives reputation beyond the 3★-per-client ceiling that flattens D5, and a page in the paradox journal (Phase 4).
6. **Passive boosts become refinements:** repeatable levels with rising prices, available once their base tech is owned. They never run out, so they're the long-term use for money.
7. **Clearer screen.**
   - At the top: each bench, with its project, progress, months left and its queue.
   - On each node, its state (Owned, Mastered, Researching, Queued, or the reason it's locked) and what it opens: named clients, job types, landmarks, refinements.
   - A "Wanted" strip listing techs that clients are waiting on.
   - On a phone, branches stack; on desktop, they sit side by side.

### 4.3 The new tree

Five branches instead of four. Prices and months are starting values for `content/balance.js`; the pacing bands set the final ones. New nodes are marked **new**; the phase says when each is built.

**Revolving doors**

| Node | Tier | Needs | Opens or does | Phase |
|---|---|---|---|---|
| Mouth adjusters | 1 | – | Mouth setting; windy-corner jobs | as now |
| Big-core drums | 1 | Mouth | Core setting | as now |
| Padded wing edges | 1 | Mouth | Faster safe speed | as now |
| Presence sensors | 2 | Padded | Slows for older guests only | as now |
| **Child sensors** (new) | 2 | Sensors | Stops the wings for children racing ahead (the "kids" guest) | 4 |
| Wide-drum revolving | 3 | Sensors | Step-free revolving | as now |
| **Door controllers** (new) | 3 | Sensors, Crowd counters (both mastered) | Programmable doors | 5 |

Refinement: **Brush seals** levels (wind kept out at wider mouths).

**Open doors**

| Node | Tier | Needs | Opens or does | Phase |
|---|---|---|---|---|
| **Door closers** (new) | 1 | – | Hold-open time on swing doors: longer means fewer bumps, more heat in or out. Gives summer jobs a setting worth tuning. About £8k, 1 month. | 1 |
| Air curtains | 1 | – | Heat loss down 70% | as now |
| **Automatic swing operators** (new) | 1 | Closers | Step-free swing doors (today only sliders are step-free). About £12k, 2 months. | 1 |
| **Telescopic sliders** (new) | 2 | Operators | A wider sliding opening in a narrow bay; more heat loss | 1 |
| Draught lobbies | 2 | Curtains | Heat loss down 90% | as now |

Refinement: **Heat recovery** levels (today's Heat recovery and Heat pumps become levels 1 and 2; Office Towers needs level 2).

**Crowd science**

| Node | Tier | Needs | Opens or does | Phase |
|---|---|---|---|---|
| Queue barriers | 1 | – | Lanes; the bank's counter hall | as now |
| **Wayfinding signs** (new) | 1 | – | Signs that turn phone zombies and tourists the right way early: information beats capacity | 4 |
| Pillars | 2 | Barriers | Fire drills | as now |
| Ticket gates | 2 | Barriers | Station Quarter | as now |
| **Crowd counters** (new) | 2 | Barriers | Live counts: metering at doors as well as concourses, and the prerequisite for stewarding and door controllers | 2 |
| Tidal-flow gates | 3 | Gates | Auto lanes | as now |
| Event stewarding | 3 | Pillars, Counters | Apollo Arena | as now, new prerequisite |
| **Turnstiles and bag search** (new) | 3 | Gates, Stewarding (mastered) | The Stadium | 4 |

**Inside work** (new branch, gathering today's inside techs)

| Node | Tier | Needs | Opens or does | Phase |
|---|---|---|---|---|
| Escalator campaign | 2 | – (was Barriers) | Halden's and the station escalators | as now, moved |
| Lift dispatch | 2 | – | Atlas House and Office Towers | as now, moved |
| Floor markings | 2 | Escalators | Skyport reclaim | as now, moved |
| Paternoster restoration | 2 | Lift dispatch | The Town Hall | as now, moved |
| Travelators | 3 | Escalators | Skyport pier | as now, moved |
| Route closures | 3 | Lift dispatch | The Galleria | as now, moved |
| **Chain modelling** (new) | 3 | Two inside techs mastered | Doors as a chain stage: the Station's escalators feeding the gate line, the Skyport kerb into the terminal | 4 |
| **Security lanes** (new) | 3 | Chain modelling, Barriers | The airport chain's security stage | 4 |

To stop the one-client techs paying off only once, each also gets a second home. Some examples:
- Floor markings: platform-edge lines at the station.
- Paternoster: a second, faster one at Office Towers.
- Route closures: a closed walkway at the Arena concourse.

**The firm** (new branch: business, no crowd science)

| Node | Tier | Needs | Opens or does | Phase |
|---|---|---|---|---|
| **Market study** (new) | – | – | Always available, free, 1 month: a tender or an enquiry | 2 |
| Door staff training | 2 | – | Doorman crew | as now, moved |
| **Design office** (new) | 2 | – | The blueprint book | 4 |
| **Sales network** (new) | 2 | Market study done 3 times | More tenders a month, and enquiries wait a month longer | 2 |
| **Research lab** (new) | 3 | HQ premises | A third bench: a big one-off use for money | 2 |

Refinements: **Supplier contract** levels (hardware discount, capped), **Crew training** levels (fitting discount), **Service plans** levels (maintenance).

**Totals.** 32 one-off nodes (19 of today's techs plus 13 new; the other 4 become refinements), plus the market study, roughly 75–85 bench-months. With 1 bench, then 2, then 3 with the lab, the tree finishes around months 30–36 of play, with mastery and refinements running alongside and after. The pacing bands decide the final numbers.

### 4.4 Architecture

- **One source for each tech.** Each `TECH` entry carries its text, lesson text (today's `LESSONS`), research calls (today's `PARADOX_CALLS`), its lesson goal for `c.lesson`, `kind` (`unlock`, `refine` or `study`), levels for refinements, and what it opens. The research screen, the advice line, enquiries and calls all read from it.
- **Generated docs.** The build writes the tech and landmark tables in `docs/game-loop.html` from `TECH`, so the design page stops drifting.
- **New save data.** `S.mastered`, `S.levels` and per-bench queues in `S.research`. Bump `SAVE_VERSION`; `migrate()` gives old saves empty queues and counts every owned tech as mastered, so nobody loses a landmark they already have.
- **Gating in one place.** `canResearch(S, t)` and `needsMet(S, p)` check tier, prerequisites and mastery; the page, sim and advice all use them.

### 4.5 Tests for the tree

- **Shape** (`test/content.test.js`):
  - no cycles
  - every node reachable within its premises tier
  - every `unlock` node has lesson text, a lesson goal and at least two kinds of client that call about it
  - every landmark's needs are reachable
- **Rules** (`npm test`):
  - a month can't end with a free bench
  - a queued project starts when the one before finishes
  - monthly payments pause when overdrawn and keep progress
  - the market study is always available
  - mastery comes only from signing off a job that grades the lesson
  - an old save migrates with owned techs mastered
- **Variety and lessons** (layer 3): a design without the tech can't pass its lesson job.
- **Pacing** (layer 4): over 4 seeds, every owned tech is mastered within a few months, no bench is idle, and the tree finishes inside the target months.

---

## 5. Testing plan

### What exists
- `npm test` (~2 min, in CI before deploy): content checks, save and month replay, grading, each paradox holding on average, a seventh of the golden surveys.
- `npm run test:full` (~10 min, by hand): every golden survey plus a 6-month headless game.
- `tools/bot.py` (by hand): plays the built page with the surveyor's par designs and reports script errors.

### The gaps
Nothing in CI opens the page; nothing checks text; nothing checks variety or balance; the bot only plays perfectly; the bot's Playwright version isn't pinned.

### Layers

**1. A regression test per bug** (`npm test`, Phase 0)
- Editing a chained design leaves `c.existing` alone, and cost and charge aren't £0 (possible once the design model is in `game/`).
- Every `p.reason` set in `month.js`, `plots.js` or `enquiries.js` has wording, or a deliberate fallback.
- A research call keeps its twist over 20 seeds.
- The ★ wording matches the grading rule (one shared constant).
- Every hint names only hardware the job allows.
- The Arena's twists come from a concert list.
- Research rules (Phase 2), listed in section 4.5: no free bench at month end, queues, monthly payments pausing when overdrawn, the market study always available, mastery only from a lesson job, refinements after the tree, and an old save migrating with empty queues and owned techs mastered.

**2. Golden surveys** (unchanged): the pin on the surveyor. Re-record on purpose after Phase 0 and each Phase 1 change, and say so in the commit.

**3. Variety and lesson tests** (new `tools/balance.mjs`, in `test:full`)
- First visits for every building, every month, 5 seeds: no single answer above about 25% of a month's jobs.
- Each research call: par uses the tech; the client's design before the call fails the lesson goal; a design without the tech can't pass.
- Each Riverside level varies across seeds.

**4. Pacing bands** (in `test:full`): the sim on 4 seeds for 18 months, asserting ranges set once Phase 2 settles. For example: under 25★ at month 4, Market Square open by month 6–9, cash under a cap at month 12, no more than 2 quiet months in a row, every bench busy at every month end. The sim's policy has to obey the research rule too (`tools/sim.mjs` fills benches only when it has spare cash today). Print a short table so balance changes show as a diff in review.

**5. Browser checks** (extend `tools/bot.py`)
- Text sweep: fail on "undefined", "NaN", "[object" or "£-" on any screen the bot visits.
- Layout at 390×844 and 1280×800: no sideways scrolling, title and calendar cards not cut off, every bay inside the canvas, the coach bubble not overlapping its target.
- Cost check: after changing any setting on an inside or chained job, the cost readout changes.
- Lazy player: before applying par, try the cheapest common answers (two swing doors, one slider, close the bridge) and log how often they pass.
- CI: a Python step in `pages.yml` with Playwright pinned in `requirements.txt`; the bot for 3 months on `dist/` at phone size before deploy; 12 months nightly. (Alternative: rewrite the bot on Node's Playwright for one language. It adds a dev-only dependency, against the README's "no dependencies".)

**6. Speed** (in `test:full`): time `generateSolved` for a door job, a research call and the Arena chain; fail over budget (for example 5s in Node). The bot logs in-browser survey times.

**7. People playing:** at the end of each phase, on a real phone, a fresh start through the first winter, one research call of each kind, and the Arena. Ideally 2–3 people who haven't seen it, noting where they stall or misread. Automated checks can't tell you whether a paradox lands.

### What each phase must pass

| Phase | Must pass before merging |
|---|---|
| 0 Fixes | Layer 1 tests; golden re-recorded on purpose; bot text sweep clean |
| 1 Puzzles | Layer 3 variety and lesson tests; lazy player passes under about 25% |
| 2 Pacing and research | Layer 4 bands on 4 seeds; research rules and tree-shape tests (section 4.5) |
| 3 UX | Layer 5 layout at both sizes; layer 6 survey times within budget |
| 4–5 Content | Paradox test, golden cases, variety coverage and a bot pass per new stage |

---

## 6. Architecture changes, in one place

| Change | Phase | Why |
|---|---|---|
| Design model in `game/` (`newDesign`, deep `cloneDesign`, `designCost`) | 0 | Removes the shared-object bug class (B1); testable in Node |
| Brief, result and hint text as pure data in `game/briefs.js` | 1 | Wording can be tested; ends "undefined"-style bugs (B2, B5) |
| `makeContract` in explicit steps; `c.lesson` on every job | 1 | Required twists can't be evicted (B3); the surveyor and tests can check lessons (D3) |
| Balance numbers in `content/balance.js`; `simulate()` overrides | 2 | Tuning becomes data edits; sweeps without code changes |
| `benchesFilled(S)` in `game/`; bench queues, monthly payments, `S.mastered` and refinement levels in the save (`SAVE_VERSION` bump, owned techs migrate as mastered) | 2 | Research never stops; mastery gates landmarks; one rule the page, sim and bot all share |
| One `TECH` record per tech (text, lesson, calls, lesson goal, kind, levels, what it opens); docs tables generated from it | 2 | Ends three hand-synced sources and the drifting design page |
| Survey worker pool, pre-surveying, chain time cap | 3 | Survey waits |
| One canvas-fitting function for `canvas.js` and `stageart.js` | 3 | Clipped frontages and plans |
| Pinned Playwright, bot in CI | 0–3 | The page itself gets tested |
| Another `SAVE_VERSION` bump for blueprints | 4 | New save data |
| `DoorStage` adapter on `StageSim` | 4 | Doors inside chains |
| Programmable doors as rule data | 5 | Deterministic and safe on a shared seed |

---

## 7. Decisions for the owner

1. **Pacing target.** How long should reaching every street take: about 12 months of play, or longer? (The research tree is planned to finish around months 30–36.)
2. **Money sinks.** Refinements and the research lab are planned (section 4). Which others: rushing research, landmark buy-ins, advertising?
3. **Research payment.** Monthly while a project runs (recommended), or up front as now?
4. **Mastery.** Should mastery gate landmarks and deeper nodes (recommended), or only add a bonus?
5. **Mastery stars.** Should mastering a tech add a star to the firm's reputation?
6. **Bot language.** Keep Python with a pinned version, or move to Node's Playwright as a dev-only dependency?
7. **Summer.** Keep the warm start, but with pressures and new Open doors research that beat the cheap pair (as planned), or start the firm in autumn?

---

## 8. Reproducing the numbers

- Pacing and cash: `npm run sim -- 12 <seed>` for seeds 1–4; `npm run sim -- 24 1` for month 24.
- Answer variety: call `makeContract(kind, 0, month, seed, { first: true })` then `generateSolved` for each building, month and seed, and group by `par.sig`. This becomes `tools/balance.mjs` in Phase 1.
- Research calls keeping their twist: `makeContract('store', 6, 12, seed, { callback: 'paradox', extra: ['surge'], ... })` over seeds, checking `c.twists` and `c.goals.laps`.
- Browser: `pip install playwright==1.56.0` (match it to the installed Chromium), then `npm run build && npm run bot -- 18`.
