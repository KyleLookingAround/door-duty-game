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

**Status: done, October 2026.** B1–B5 are fixed, each with a test (`test/designs.test.js`, `test/text.test.js`, `test/calls.test.js`). The tests went from 62 to 76 passing. Every fixed screen was checked in the built page. The bot runs in CI and the PR concurrency bug is fixed. The first full balance run also found a survey crash on slow fire drills; that's fixed too.

Two balance reports are saved. `test/fixtures/balance-before-phase0.json` is the game before any change. `test/fixtures/balance-phase0.json` is the game after Phase 0. `test/fixtures/balance-baseline.json` is always the game after the last merged phase (now Phase 1), and it's what the next phase compares against.

They differ in one important way. With research calls and enquiries now true of the client, a summer of swing doors makes air curtains the first thing clients ask for. Before, there were padded-wing calls from clients with no revolving door. So the sim researches curtains early, and from September a slider with an air curtain answers about 60% of first visits (revolving doors: 65–78% of winter jobs before, 25% now). Summer is unchanged (two one-way swing doors, 37–42%). The fix is right; it shows D1 is a whole-year problem, and Phase 1 has to handle it. The golden re-record (item 6) turned out not to be needed: `record-golden --dry` showed none of the 69 cases changed, because the fixture has no research calls or inside jobs. Phase 1 adds them.

**Work**
1. B1: deep-copy designs. *Architecture:* move the design model into `game/` (`newDesign(c)`, a deep `cloneDesign` using `structuredClone`, `designCost`); the workshop only calls them.
2. B2: wording for research calls in the door brief; "New work" everywhere for them.
3. B3: a call's twist goes first and is never dropped on retry.
4. B4: one shared ★ rules string, used by the brief, the result and the guide.
5. B5: hints name only hardware the job allows; the coach's door text depends on what's allowed; enquiry text depends on the client's actual results; concert twists for the Arena; each street header shows that street's income.
6. Re-record `test/fixtures/surveyor-golden.json` (items 3 and 5 change which jobs are made) and say so in the commit. `tools/record-golden.mjs` first learns to print what changed (which cases' twists, par or cost moved), so every re-record from here on is reviewed rather than waved through.
7. **CI that protects every later phase:**
   - Today every pull-request run shares the `pages` concurrency group with `cancel-in-progress: true` (`.github/workflows/pages.yml`), so pushing to a PR can cancel a deploy from main that's in progress. Give pull requests their own group.
   - Pin Playwright in `tools/requirements.txt` and add the browser bot (layer 5) now rather than in Phase 3.
8. **A baseline before anything changes.** Build `tools/balance.mjs` (variety and pacing, section 5 layers 3–4) and record today's numbers. Phases 1 and 2 are judged against them.
9. Add the new house rules to `CLAUDE.md` as they land: rules and wording out of `ui/`, a lesson on every job, balance numbers in one file. Each later phase updates it too.

**Tests that must pass:** the new Phase 0 regression tests (section 5, layer 1); `npm test`; golden re-recorded on purpose; the bot's text sweep is clean, in CI.

**Done when** no brief, result or report shows "undefined", chain costs match their parts, every research call carries its twist, the bot runs in CI, and the baseline numbers are recorded.

### Phase 1: every job a real puzzle

**Status: done, October 2026.** Items 1 and 3–10 are done; item 2 is partly done (summer first visits are still the swing pair about 40% of the time). Full balance run, 5 seeds, 24 months, against the Phase 0 baseline (`balance-phase0.json`; the new baseline is `balance-baseline.json`):

| | Phase 0 | Phase 1 |
|---|---|---|
| First visits, October to April: most common answer | L (slider) 58–63% | L 30–33% |
| First visits, May to September: most common answer | Wi+Wo 37–42% | Wi+Wo 37–42% |
| Jobs played, May to September: most common answer | L about 60% (quick run) | L 29% |
| Jobs played, October to April: most common answer | L about 68% (quick run) | L 35% |
| Jobs repeating one of the last four answers | 61–65% (quick run) | 15–36% |
| Jobs a lazy answer passes (one slider, a one-way swing pair, closing the bridge) | – | 11–21% |
| Market Square / Riverside open at month | 3 / 4 | 4–5 / 9–11 |
| Reputation at month 12 / 24 | 36 / 41–48 | 32–36 / 39–45 |

**Done-criteria, as changed.** The first-visit target ("no answer above about 25% of any month's first visits") can't be met in the first summer: with no research yet, a café or a pharmacy really is best served by a pair of swing doors, and the anti-repeat rule only acts on jobs the player is offered next to each other. So Phase 1 is judged on the jobs a player actually plays: the lazy player passes under 25% (met: 11–21%), and repeats of a recent answer fell from about 63% to 15–36%. The most common answer played is still 29–35%; the Phase 2 mastery and lesson jobs add more research to reach for. "No research job can be passed without its research" holds for the calls that get a lesson; about a third of the lesson sample still falls back to an ordinary job on some seeds (item 4).

*The lazy player* runs headless in `tools/sim.mjs` and `npm run balance` (same rules as the page, far more jobs than a bot run), not in the browser bot.

*Survey times* (`test/speed.test.js`, in `test:full`, Node, one core): a door tender about 2.5s, a station escalator job 3s, the Arena chain 17s, a research call with its lesson 14–29s (the slowest: lesson checks and calm retries add surveys). That last one is the Phase 3 worker pool's first customer.

**Work**
1. D2: the anti-repeat rule covers first visits too, so two clients in a row can't share an answer. **Done (October 2026):** first visits count, sliders sign as `l`, and in the first summer the added wrinkle is a surge, step-free access or cyclists, never cold or wind. Measured in play (quick balance run): jobs repeating one of the last four answers fell from 61–65% to 52%. A wrinkle often leaves the same answer cheapest, so item 2 has to do the rest. Fix `designSig` first: it uses a door type's first letter (`contracts.js:49`), so swing and sliding doors both read `s` and the rule can't tell them apart. `tools/balance.mjs` already uses its own unambiguous shape (`W`, `L`, `R`, `G`).
   - Add golden cases for research calls and inside jobs (including a chained level): done, see item 9.
2. D1: summer pressures that defeat the cheap pair some of the time: surges with a go-round limit, crosswinds on corner plots, heat, bikes. Revolving doors appear before October. Winter needs the same treatment: since Phase 0, a slider with an air curtain answers about 60% of first visits from September (see the Phase 0 status).
   - **Done (October 2026), partly.** A price sweep (432 first visits, slider £6–9k, revolving £9–12k, curtain £3.5–5.5k, swing £2.5–3.5k, through goal 70–88% of the best) showed prices can't fix winter: the best table still left sliders on 78–80% of mid-tech winter visits, because one revolving door can't carry the crowd a slider can. Prices stay as they are. Instead, air curtains are weaker in a hard frost or a wind (70% cut at 4°C and above, about 40% at −5°C, less again in a gale), which is true of real ones. Winter first visits: L 54% (was 60–63%). Summer is still the swing pair or a slider; the anti-repeat breakers do most of the work in play (see the status below).
3. **Done (October 2026).** D3: every research call grades its lesson: a go-round limit for big cores, an older-guest goal for sensors, a time goal for pillars on fire drills. Watch the other goals too: Halden's big-core call (now with its surge) asks for only 8 people through against a rush of 321 a minute, so its throughput goal means nothing.
4. **Done (October 2026).** D3: the surveyor rejects a par that ignores the lesson, and regenerates the job. See `LESSON_GOALS` and `lessonGoal`: the client keeps the door type the call is about, the goal sits between the best design with the research and the best without (the surveyor tries both), and price lessons (closers, automatic openers, lane barriers, door staff) cap the budget below every design without it. In `test/lessons.test.js`'s sample, 9 of 13 calls teach their lesson; sensors at a pharmacy, lane barriers at a café, pillars at a cinema and automatic openers at a library in December fall back to an ordinary job on some seeds. Closer and air-curtain calls come on a raw day, not a frost.
5. D4: vary the Galleria (more routes, budgets that let widening compete, a wider twist pool), and check every Riverside level varies across seeds. **Done (October 2026):** 40% of levels have long malls, where the bridge is a real shortcut and widening a pinch point is the answer; widening costs £9k (stairs) or £14k (escalators), not £35k; new twists: roadworks, escalator repairs, late opening. Pushchair levels always have long malls (pushchairs set the slowest times whichever way the crowd goes). Over 24 levels: close the bridge 14, widen the stairs 9, widen the escalators 1. Research calls are always the paradox.
6. Grow the Open doors branch (section 4.3) so summer has research to reach for: door closers, automatic swing operators, telescopic sliders. Summer jobs then have more than one good answer, and the branch has more than its current two nodes. **Done (October 2026):** Door closers (tier 1, £8k, +£600 a door), Automatic swing operators (tier 1, £12k, needs closers, +£2k: step-free swing doors) and Telescopic sliders (tier 2, £30k, +£3.5k: 2.4 m openings), each with a research call.
7. **Job capacity (owner's request).** The firm can only sign off so many jobs a month, set by its premises and some research. That turns "do every job" into a choice: what's worth this month's crews.
   - **Premises:** lock-up garage 2 jobs a month, workshop 3, headquarters 4.
   - **Research:** Site management (tier 1, £12k, 1 month) and Prefabricated door sets (tier 2, £30k, 2 months, needs Site management) each add one. Headquarters with both: 6. In the Phase 2 tree they belong to The firm.
   - **What counts:** every sign-off: tenders, callbacks, research calls, inside jobs. A street-change check doesn't (no work is done).
   - **When the crews are booked up,** "Take the job" is disabled and the brief says why and what would help (`bookedText`). The street shows the jobs left this month. What's left waits: tenders can go to the rival, and callbacks pay nothing until fixed.
   - **Done (October 2026).** `jobsPerMonth` and `jobsLeft` in `economy.js`; `S.monthJobs` counted in `signOff`, reset in `endMonth`; save version 4. The sim takes checks, then callbacks, then research calls, then tenders, and never overbooks. The bot handles booked-up months. Tests in `test/capacity.test.js`.
   - **Balance** (quick run, 2 seeds, against the 5-seed baseline): reputation at month 4 drops from 31–35 to 21–24, and Riverside opens at month 9 instead of 4. Market Square still opens at month 3: 2 jobs a month at 3★ still reaches 18★ by then. 18–22 jobs over the first year waited for a free crew. Variety didn't change. Capacity is also a Phase 2 pacing lever (6–12 months a street).

8. **Moving takes time (owner's request).** A move takes 1 month to the workshop and 2 to headquarters. You pay up front and keep working from the old premises (its rent, benches, staff room and jobs a month) until the move finishes at a month end. While moving, research in progress waits (it keeps its progress) and nothing new can start; enquiries don't ask for research mid-move. **Done (October 2026):** `S.moving = { to, left }`, save version 5, `movingText` for the company sheet and the month report; tests in `test/premises.test.js`.
9. **Golden cases for research calls and inside jobs. Done:** 12 cases added (81 in all). The research-call cases now carry their lesson.
10. **Deeper escalators (owner's request). Done (October 2026).** Each escalator runs up or down (£500 to turn one round), at 0.5 or 0.65 m/s (£2,000), and anyone without an escalator their way takes the stairs. Stations and shops have a crowd both ways; Evening peak and Closing time turn it round. A fast escalator boards about 30% slower (people hesitate) and the unsteady can stumble, so it isn't more capacity. Research calls stay about the rule. Inside jobs whose setup already passes now tighten towards a cheap change before a rebuild, so Halden's tender is no longer "buy a £30k escalator".

*Architecture:* split `makeContract` (`contracts.js`, 534 lines) into explicit steps: required twists (call or lesson), then random twists that can't evict them, then goals, then the lesson goal. Give each job a lesson record, `c.lesson = { tech, goal, mustUse }`. Move brief, result and hint text into a pure `game/briefs.js` that returns data from `(S, p, c)`; `ui/sheets.js` only renders it.

*Watch:* lesson checks add survey runs (a run without the tech, regenerating a job whose par skips the lesson), and surveys are already slow on phones. Time surveys from this phase on (layer 6). If they slow down, bring the Phase 3 worker pool forward.

**Tests that must pass:** variety and lesson tests (layer 3); the bot's lazy player passes under about 25% of the time; survey times within budget (layer 6); golden re-recorded on purpose.

**Done when** no single answer covers more than about 25% of any month's jobs, and no research job can be passed without its research.

### Phase 2: research, pacing and economy

This is the biggest phase, so it ships as two pull requests: **2a** is the research rework (item 3) with its onboarding (item 4), and **2b** is pacing and money (items 1, 2 and 5).

**Status: 2a done, October 2026.** Items 3, 4 and 5 (`game/research.js`, save version 7):
- Research never stops: the month button reads "Choose research" while a bench is free, and `endMonth` puts a market study on any bench left free.
- A firm-wide queue (one queue feeding whichever bench comes free, simpler than a queue per bench).
- Paid monthly, pausing with its progress when overdrawn while the bench runs a market study.
- The market study: free, one month, brings an enquiry or a fitted client wanting more (reason `study`, still paying).
- Owned, then mastered: signing off the research call masters a tech and earns a ★. Landmarks and tier-3 research need mastery. Research only the client that needs it could teach is mastered on finish, so nothing deadlocks. A call that waits two months becomes a lesson tender.
- Five branches. Brush seals, heat recovery (level 2 is heat pumps, which Office Towers asks for) and the supplier contract are refinements with three levels each.
- New nodes: Sales network (needs 3 market studies; doubles what each brings, enquiries wait a month longer) and Research lab (a third bench). **Crowd counters is left for Phase 4**, with the door metering it unlocks: a node with nothing to do would be the passive kind this phase removes.
- Mastery uses the research call rather than `c.lesson` alone: about a third of door calls can still fall back to an ordinary job (Phase 1, item 4), and that mustn't block a landmark.

Tests: `test/research.test.js` (the PLAN 4.5 rules, refinements, the lab, the network, the tier-3 mastery gate). Quick balance (2 seeds, 12 months) against the Phase 1 baseline: months with an idle bench 6–10 → 1, reputation at month 12 32–36 → 38–40 (mastery stars), Market Square at month 4, Riverside at month 10, cash at month 12 £151k–£211k (still too much: 2b).

**Status: 2b done, October 2026.** Items 1, 2 and 5:
- **Reputation and standing.** Reputation is the stars from every job the firm signs (callbacks, research calls and repeat work count) plus a star per mastered tech, so it keeps growing however you play. Each job's stars also count as standing on its street.
- **Street gates** (`STREET_GATES` in the new `content/balance.js`): a street opens on standing earned on the street before it (20 on the High Street; 18 on Market Square), after at least 6 months there, with 2 techs from a short list mastered. Once open it stays open. Clients on a street that isn't open don't talk to you, and the street's "Not yet" list and the advice line say what's missing.
- **Advertising:** buy a client wanting more, or an enquiry, this month; £3k, then £3k more for each further advert that month, 30% off with the Sales network. Nothing is charged when there's nobody to reach.
- **Research calls always reach a client.** A false alarm puts the call back on the list, and a call that has waited two months goes to any fitted client of the right kind, in plain words. Without this, mastery stalled for months.
- **The sim plays in three styles** (`simulate({ style })`) and `npm run pacing` reports the bands (nightly in CI). The sim no longer refuses a job for want of cash on hand, since the page doesn't.
- Save version 8.

Pacing (`npm run pacing`; month of play when each street opens):

| Player | Market Square | Riverside | Target |
|---|---|---|---|
| Strong (par designs, the next street's research first) | 6 | 15–16 (9–10 months on Market Square) | about 6 a street |
| Weak (1★, cheapest research) | 12–13 | not by month 26 | about 12 a street |
| Poor (a third of jobs fumbled, random research) | 15–17 | not by month 26 | no limit, always progressing |

(First gates, 30 standing and 3 techs for Riverside, on 4 seeds × 30 months: strong 6–7 / 20–24, weak 16–21, poor 21–28. With the gates above, on 2 seeds: weak and poor from a 26-month run, strong from a 22-month run after the sim's strong player was taught to research the next street's techs first. Every street is inside the owner's 6–12 months for a strong or typical player; a strong player is nearer 10 than 6 on Market Square, mostly waiting for research calls to master its techs.)

**Not done in 2b, and why:**
- Cash stays high for a strong player: £206k–£273k at month 12 (weak £48k–£112k, poor £27k–£53k). Research spending is capped by the number of benches, so money piles up once they're full. The next levers are pricier refinements and premises, or lower maintenance; they need a pacing run each (20–60 minutes), so they're left for a tuning pass.
- `content/balance.js` holds only the new numbers (street gates, adverts). Moving every price, threshold, wage and rent into it, and letting `simulate()` take overrides, is still to do.
- "Enough work to fill 6–12 months" is met on jobs a month (strong 2.5, weak 1.8–2, poor 1.4–1.5), but the poor player still has months with an idle bench (5–7 in 26).

**Work**
1. D5: **each street takes 6–12 months.** Today the High Street and Market Square are both done by month 4. A strong player moves on after about 6 months, a typical one after about 12, and a player who plays poorly can take a lot longer; the difference comes from how well they play and which research they pick. So for most players Market Square opens between months 6 and 12, and Riverside 6–12 months after that (between months 12 and 24).
   - **Street standing, not total stars.** Each street opens on standing earned on the street before it: the stars from every job signed there (callbacks, research calls and repeat work count, not just each client's best), plus mastery stars. Today's single 3★ per client caps out in a few months; counting every job keeps standing growing for the whole stay.
   - **Skill moves you faster.** ★★★ work earns standing fastest. Doors with room to spare ride out street changes, and those clients pay more and call with bigger work. A 1★ player still progresses, just more slowly.
   - **Research picks move you faster.** Each street's entry needs a few mastered techs from a short list (for example any 3 of 5), and its clients ask for particular branches through enquiries and research calls. Research what this street's clients want and the work and stars come sooner. Research nobody here needs, and you wait.
   - **Enough work to fill 6–12 months.** Street changes, research calls, enquiries, the market study and advertising keep each street busy. Clients come back at a higher tier after a while, with bigger jobs. This is a requirement, not a nice-to-have. The target is a shorter game: about 2–6 hours to finish Riverside, so months stay light at 2–3 jobs each. That's roughly 12–36 jobs per street, and each of the High Street's 8 door clients needs 2–4 jobs during a stay. Months without many jobs still move: research runs every month, and street changes, enquiries and calls keep arriving.
   - **A floor, no ceiling.** No street opens in under 6 months on the last one. There's no upper limit: poor play takes longer. But there is always a way forward:
     - there's always work to take (the market study, advertising, tenders refreshing)
     - standing never falls below what it took to open the street you're on
     - the advice line says what's holding you back ("three more ★★★ jobs", "master one of these techs")
2. D6: give money a use. Monthly research costs, refinements and the Research lab (section 4), plus **advertising**: on the Company sheet, pay to bring in a tender this month, with the price rising for each one in the same month. The Sales network node makes it cheaper. It's the paid, immediate version of the free one-month market study. (Rushing research and landmark buy-ins were considered and left out.)
3. **The research rework** (section 4): research never stops, queues, the market study, mastery, refinements, the five-branch layout, paying monthly, and three new nodes (Crowd counters, Sales network, Research lab). Mastery needs `c.lesson` from Phase 1. The other new nodes come in Phases 1, 4 and 5, with what they open.
4. **Onboarding.** Update the coach and the Guide tab for queues, monthly costs, mastery and street standing. The first month now needs research before it can end, so the coach walks the player through it, with the market study as the safe first pick.
5. **Saves.** Nobody else plays yet, so `migrate()` only does enough for an old save to load without errors (owned techs count as mastered, empty queues). No backups, export or "What's changed" note for now. Revisit before the game is shared.

*Architecture:* move prices, star thresholds, wages, rent and research times into `content/balance.js`; let `simulate()` take overrides so values can be tried without code edits. The research changes are in section 4.

**Tests that must pass:** the pacing bands (layer 4) on 4 seeds; the research tests (layers 1 and 3).

**Done when** a strong sim player opens each street after about 6 months and a weak one after about 12, nobody opens one in under 6, and a poor player keeps progressing however long it takes, cash stays meaningful at month 12, no bench is ever idle at month end on any seed, and every finished tech gets its lesson job within a few months.

### Phase 3: UX pass

**Status: done, October 2026, except the cheaper single surveys (item 6) and the keyboard pass (item 7).**
- **1. The walk-through bubble** goes below, above or beside its target, wherever it fits without covering it; on a phone with a tall target it takes the side with more room. The bot fails if a bubble covers more than a quarter of what it points at.
- **2. Canvas fit:** door jobs already fit their bays to the canvas width (`sizeCanvas`), so no change was needed; stages use `stageLayout`.
- **3. Phone width and desktop:** at 390px the subtitle now hides as intended (a later rule was overriding it), and calendar cards wrap to two lines instead of an ellipsis. Desktop gets a 760px column and 600px sheets.
- **4. D7:** the "Not yet" list shows everything a client is waiting for from the start: the street opening, the stars and the research.
- **5. Inside jobs:** the cost bar says "Your setup", and the bumps counter is hidden where the stage doesn't grade bumps. The street tabs no longer show the old star thresholds.
- **6. Faster surveys:** a pool of survey workers (cores − 1, up to 3), so several briefs survey at once; the focused brief still goes first within its worker. In the bot, briefs open in 0.3–7s. Not done: cheaper single surveys (a capped chain search, fewer candidates). They change jobs, so they need a deliberate golden re-record. A research call with its lesson is still the slowest survey (about 29s in Node).
- **7. Accessibility:** steppers name what they change, and the plan view has a text label. Reduced motion was already honoured in the street and confetti. Not done: a keyboard pass on the street scene (the list view works from the keyboard).
- **8. The design page's** research-tree and landmark tables are generated from `TECH` and `BUILDINGS` by the build (between the `TECHDATA` markers); its street wording matches Phase 2b.
- **Layer 5:** the bot checks layout at 390×800 and 1280×800: no sideways scrolling, no clipped title, dock or cost bar, calendar cards within their lines, and bubbles off their targets.

**Work**
1. Place the coach bubble away from what it points at.
2. Fit the canvas to the frontage width. *Architecture:* one fitting function shared by `ui/canvas.js` and `ui/stageart.js`.
3. Fix the 390px truncation; use desktop width better.
4. D7: show locked buildings' research needs from the start.
5. Inside-job wording ("Your setup"); hide counters that don't apply.
6. Faster surveys. *Architecture:* a pool of `hardwareConcurrency − 1` survey workers, surveying the next likely job before it's opened, and a time cap on chain searches. Profile `engine/world.js` (700 lines) before tuning the surveyor.
   - **Measured after Phase 0.** A 24-month headless game spends 524 of its 532 s in surveys. A survey's time is the crowd physics: person-to-person collisions 31% (already on a grid), revolving-door collisions 17%, steering 17%, the step 16%, garbage collection 6% (a bigger young heap didn't help).
   - **Not worth it:** running a game's surveys side by side within a month would save at most about 40% (532 → 314 s on unlimited cores), because single surveys dominate. A chained level takes 20–65 s, and it also needs care to keep results identical.
   - **Worth it:** cheaper single surveys. Cap the chained-level search (it improves the route one change at a time), drop candidates that can't be the answer, and tune the physics hot spots. Fewer candidates changes some jobs, so it's a deliberate golden re-record.
   - **Already done (not Phase 3):** golden surveys, the golden re-record and the balance report run on every core; CI runs tests, bot and build side by side. `npm test` 120 → 43 s, `test:full` ~11 → 3 min, `record-golden` ~9 → 2 min.
7. Accessibility: honour reduced motion in the rush hour and the street, check text contrast, label every control, and make the editor work from the keyboard.
8. Bring the rest of `docs/game-loop.html` up to date (its tech and landmark tables are generated from `TECH` from Phase 2).

**Tests that must pass:** layout checks at both sizes (layer 5); survey times within budget (layer 6).

**Done when** a phone player never meets a clipped control or a hidden target, and briefs open in a few seconds.

### Phase 4: roadmap content

Already on the design page as Later, plus two unbuilt landmarks. Each comes with its research node from section 4.3: Design office, Chain modelling, Child sensors, Wayfinding signs, Turnstiles and bag search, Security lanes.

1. **Blueprint book:** save a design and reuse it on later jobs. More useful once Phase 1 makes answers vary. *Architecture:* new save data, so bump `SAVE_VERSION` again (Phase 2 bumps it first) with a `migrate()` step; store blueprints by job type and stage key, not by plot. **Done (October 2026):** the Design office (The firm, tier 2, £25k, 2 months) opens it. After a passing test, "Save as a blueprint"; on any later job of the same shape (the same number of bays, the same inside stage or chain), "Blueprints" starts from a saved design, naming any hardware the firm can't fit and any client rule it breaks. Up to 12, newest first, never the same design twice (`saveBlueprint`, `blueprintsFor`, `unownedIn` in `game/designs.js`; save version 9). Tests in `test/blueprints.test.js`.
2. **Doors as a chain stage:** the Station's escalators feeding the gate line, the Skyport kerb into the terminal. *Architecture:* the biggest structural piece. A `DoorStage` adapter gives the door `World` the `StageSim` interface (`admit`, `finish`), so a frontage can feed a stage or be fed by one. Design it early: it changes where the World's arrivals come from. **Done (October 2026):** `engine/stages/doors.js` wraps the World: people handed in step onto its street side (`spawn` takes who they are), and `World.onPass` hands them on once through. The design is stage-style (bays, door type, staff, a wide aisle), not the bay editor; a building's tune sets the frontage width and the door types. Runs take 40–200 ms. A Skyport reclaim-then-arrivals-doors chain was tried first and dropped: the belt lets people out a few at a time, so the doors never bind. Its first home is the Stadium. **The Station's whole route is done too:** Chain modelling (inside work, tier 3, £45k, needs escalators and ticket gates) brings a research call from a fitted Station Quarter: the escalators up from the platforms, then the gate line (a door stage, 3 bays wide). Changing the escalator rule moves the queue to the gates, then more gate bays help. The escalator part's answer is always "stand on both sides"; the gate line's varies (2 or 3 bays, staff, a wide aisle). About 30 s to survey. Still to do: the Skyport kerb.
3. **New guests:** kids racing ahead, tourists riding the door round, phone zombies. **Children done (October 2026):** a new guest (`kid`: small, fast, quick to react, and bruised by a much slower wing tip) and the School run twist, offered once the firm has presence sensors. A fast revolving door bumps them; slowing the whole door costs everyone time; a presence sensor (which now slows for children too) does both jobs (`test/guests.test.js`). **Child sensors were tried and dropped:** in this crowd model a sensor that stops the wings for a child did worse than the presence sensor (26 bumps and 279 through, against 2 and 357, over 6 seeds), so a separate node would add nothing. **Phone zombies were tried and left out:** a heads-down guest (walks to the nearest door, never sees its queue) arriving from one end of the street, with Wayfinding signs that let them see the queue. In the model one door carries the whole crowd (115 of 116 through, signs or not), so nobody queues long enough for a sign to matter. It needs door capacity that actually saturates (a doorway's flow limit) before it's worth building. **Tourists done (October 2026):** a new guest (`tourist`) and the Tour group twist, offered once the firm has door staff (`TWIST_REQ`). Each tourist rides a revolving door round once for the photo, holding up a compartment; that lap isn't counted against the door. On two revolving doors a tour group costs about a quarter of the throughput; a doorman on each wins it back (a doorman sees them off), and a faster door only spins them round faster (`test/guests.test.js`). The hint says so.
4. **Landmarks:** the Stadium (pillars, gates, barriers) and the full airport chain (kerb, check-in, security, gate, bags). **Decided (October 2026):** the Stadium goes at the end of Riverside for now; if there are enough levels later, it can move to a fourth street (which would bring its own 6–12 months). **Stadium done (October 2026):** Riverside Stadium (rep 42, needs Turnstiles and bag search, new, tier 3, £55k, and Event stewarding) is a chain: turnstiles (a door stage of ticket gates), the bag search (the queue) and a slow concourse to the stands. All three stages take turns as the bottleneck: fewer turnstiles shorten the bag-search queue; with paper tickets the turnstiles become the crush until more bays push it inside; clear the bag search and the concourse jams (worse overall) until stewards meter it. Over 6 chain jobs the par was 6 different setups; the turnstiles on their own 4 setups over 6. A chain survey takes about 40 s (the Arena's is similar). **Airport departures done (October 2026):** a new stage, security (`stages/security.js`): lanes with an X-ray scanner, an arch, unloading places and a repacking bench, plus search staff for pulled bags and pat-downs. The paradox: the scanner mostly waits for people unloading one at a time, so smart lanes (three unload at once) plus longer benches (or the belt stops when the bench is full) beat a new lane for about two thirds of the price; smart lanes alone make it worse. Twists: Early flights, Half term, Business travellers, Liquids check. Security lanes (inside work, tier 3, £50k, needs Chain modelling and Queue barriers) brings a research call at Skyport and opens two Skyport levels: security alone, and the whole departure (the terminal doors from the kerb, check-in, security) as one chain, where fixing check-in with a snake moves the queue to security. Research calls answer with smart lanes and benches every time (8 of 8); tenders vary a little (a new lane, more search staff). The departure chain surveys in 23–33 s. **Boarding done (October 2026):** a new stage, boarding (`stages/boarding.js`): 16 rows of six, one aisle; everyone stows a bag in the aisle, lockers fill and slow the next bag, and row-mates nearer the aisle stand up to let a window passenger in. The paradox: back to front (the airline's habit) is slower than boarding in any order, and slower still with gate staff enforcing it; windows first (outside in) is quickest of the orders. Other levers: gate staff (without them a third ignore their group), checking big bags at the gate, and rear stairs. Twists: Full flight, Hand luggage only, Coach tour. Boarding studies (inside work, tier 3, £30k, needs Security lanes) brings a research call at Skyport and opens the boarding level; research calls offer only the order and gate staff, and 10 of 10 were answered by changing the order (windows first 9). Tenders vary (11–12 passing setups each). The whole airport is now in: pier, reclaim, departures, security and boarding, though boarding isn't chained to security yet.
5. **Paradox journal and local paper headlines:** cheap to build, and they reward finishing a lesson. **Done (October 2026):** Company › Guide keeps a journal of every mastered tech's counterintuitive bit (`content/journal.js`, `journal` in `briefs.js`), and the month report opens with the Herald's headline for the month's biggest story: a landmark fitted, a street opened, a tech mastered, the rival winning, a claim or an inspection (`headline`, no dice, so a month replays). Tests in `test/journal.test.js`.
6. From CLAUDE.md: real callbacks still escalate when the doors already cope. **Done (October 2026), for the one that shouldn't:** a failed inspection's callback was a fresh job with new random twists, made harder until the old doors failed it. Now it replays the inspector's own day (`p.inspection` keeps the seed, tier and month; `opts.inspection`): no random twists, no escalation, and a step-free failure keeps its access goal, so the job is about what actually failed (`test/inspections.test.js`). Research calls, a client wanting more and the rival's botched work still escalate on purpose: those clients are asking for something new.
7. **Every kind of level gets deeper (owner's request).** The escalators were the model (Phase 1, item 10): three levers that trade against each other, taken from how the real thing is run, and twists that change which lever matters. Most other stages still have one or two controls and one answer. Give each one at least three levers, each with a catch, and twists that turn the answer round:
   - **Counter hall (queue):** desk staffing by time of day (open more for the lunch peak, fewer after), an express desk for quick jobs (it idles when quick jobs are few), and a ticket machine instead of a snake (people sit down, but they wander off and miss their number). **Done (October 2026), all but the ticket machine:** an express desk (+£1,500: the first desk takes quick business only, a third quicker at it) and lunchtime cover (£2,500 a desk: part-timers, a little slower, on from midday to closing), with three new day-shape twists: Lunch rush, Opening rush and Quick jobs. For the same £5,000, two cover desks beat a fourth full desk on a lunch-rush day and lose to it on an ordinary or opening-rush day (`test/stages.test.js`). Over 16 bank jobs the par was 13 different setups, none more than twice. Research calls and the Arena's chained level keep the plain hall.
   - **Lifts:** zoning, plus a sky-lobby or express lift, destination dispatch (fast, but people who don't key in their floor get lost), and capacity against door dwell time (bigger cars load slower). **Done (October 2026), all but the sky lobby:** destination keypads (£12,000, a third dispatch choice: people going to nearby floors share a car; visitors who don't use the keypad ride the wrong car and come back down) and door time (short, standard or long, £500 to reprogram), with a Canteen twist (half the rush to the top floor). Keypads beat zoning on an ordinary morning and lose with visitors; a top-floor canteen makes zoning worse than none (`test/stages.test.js`). Over 12 lift jobs the par was 10 different setups. Research calls stay about zoning.
   - **Paternoster:** loop speed and cabins, plus one-way floors at the busiest landings, and a stop rule when the queue at a landing grows. **Done (October 2026), differently:** a "One floor? Take the stairs" sign (+£500: people going one floor up walk, which frees the cabins but is slow for older visitors), the landing attendant now also stops anyone riding round over the top, and two twists: School trip (children riding round: about a third of cabins come past full) and Wedding day (most visitors only go to the first floor). Over 12 Town Hall jobs the par was 11 different setups (loop speed from 0.20 to 0.45 m/s). Research calls keep the plain loop.
   - **Pier walkways:** length and placement, plus a walk-on-the-walkway rule, belt speed (faster belts spill more people at the end), and a split into two shorter walkways. **Done (October 2026), all but the split:** a fast belt (1.5 m/s, +£8,000; older passengers and people with bags can stumble stepping off), "Please walk" signs (+£500; fewer people stand), and a Tight connections twist (hardly anyone stands, cabin bags only). Found on the way: a walkway pile-up counted as a bump against a limit of 0, so "no walkway" was the answer to 10 of 12 jobs; a pile-up is now a safety stop, and only stumbles count as bumps (2 allowed). Over 12 walkway jobs the par was 6 different setups, none more than 5 times.
   - **Baggage reclaim:** the stand-back line, plus which belt each flight goes to, bag-drop timing, and priority bags first (fewer waiting for most, longer for some). **Done (October 2026), in part:** belt speed (standard or fast, £1,000: bags come round sooner but are harder to grab, above all for older travellers) and extra baggage handlers (+£4,000: bags reach the belt sooner), with Bags held up and Coach party twists. A slow belt was tried and never helped, so it's out. Handlers are expected only when bags are held up. Over 12 reclaim jobs the line alone is still par for 7: the line is the strong lesson here, and it's over the half target. **Then (October 2026):** the reclaim target has no slack (the best the client would pay for), so the line alone doesn't always do: over 16 jobs the par is the line with a fast belt 8 times, the line alone 6, with handlers 2.
   - **The Galleria:** close or widen, plus one-way routes, timed bridge closures (closed at rush hour only), and a third route. **Tried (October 2026), nothing kept yet:** a rush-hour-only closure can't show in the score (the target is the slowest tenth, and they all leave at the rush, whatever happens after); signs sending people by the lower mall, a narrowed bridge (slower the busier it gets) and a third route through the car park each did no better than closing the bridge, or worse, in every layout and twist over 12 seeds. The two layouts still give three answers (close; widen the stairs; widen the escalators). What might work: a crowd coming the other way at the same time, so a pinch point is shared. **Left as it is (October 2026):** a crowd the other way only adds load to the pinch points; it adds no lever, so it can't change the answer. The Galleria keeps its two layouts and three answers.
   - **Concourse (bottleneck):** openings and metering, plus wider openings against more of them, holding areas, and staggered release by block. **Done (October 2026), in part:** double-width openings (£1,500 each: quicker, but they jam worse as the concourse packs, so they only pay off with metering), and a Last-minute crowd twist. Tighter metering was tried and always starved the openings, so it's out. Metering plus wide openings is par for 9 of 12 concourse jobs: over the half target; holding areas or staggered release are the next things to try. **Then (October 2026): timed entry by block** (+£3,000: tickets give each block a time to arrive, spreading most of the crowd over half as long again). It pays off with metering, but with a Walk-up night twist (new) most people have no time to keep, and a last-minute crowd ignores theirs. Over 16 concourse jobs the par is now 5 setups, the most common 6 times.
   - **Door jobs:** more levers that already exist on paper: rpm schedules (fast off-peak, slow at the rush), a door that turns one-way with the tide, and a frontage-wide sign or queue line. **Moved to Phase 5 (October 2026):** a door job is a 40-second rush with no off-peak to schedule for, except where the client's day has phases (the cinema, the towers, the station), and a door that changes with the tide or speed is exactly what Phase 5's programmable doors are (rules read by the engine each step). A frontage-wide setting needs a change to the door design model, also Phase 5's.
   - **Station gates:** lane direction and tidal flow, plus how many wide aisles, staff at the gate line, and holding people at the platform when the concourse is full. **Done already, but one (October 2026):** lane direction, tidal (Auto) lanes, wide aisles and gate-line staff are all in, and station pars vary (9 setups over 12). Holding people at the platform was tried by slowing how fast a train's passengers step off: the gate line never bumps anyone, so holding them only adds waiting, at every rate tried. Left out. The Station's whole route (escalators, then the gate line) is the deeper station level instead.
   *Tests:* each new lever gets a numeric check that it helps in some levels and hurts in others (as `test/stages.test.js` does for each paradox), golden cases, and variety coverage: across seeds, no single setup should be par for more than about half of a stage's levels.

**Tests that must pass:** each new stage gets a paradox test, golden cases, variety coverage and a bot pass.

**Phase 4 finished (October 2026).** Everything above is in, tried and left out with the reason, or moved to Phase 5 (door-job schedules and frontage-wide settings, which are programmable doors). Boarding isn't chained after security: it needs everyone at the gate when boarding is called, and a chain hands people on as they finish.

**Owner's idea (October 2026): the month change as a loading screen. Done.** The new month's tenders and callbacks already started surveying as the month report opened; now the report shows it. "The surveyor is out" lists each job with a progress bar and says when it's ready, a client coped with a street change, a check turned into a callback, or a callback was a false alarm. Back to the street works at any time; unfinished surveys carry on in the background as before.

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

1. **Research never stops.** End the Month needs every bench busy; with one free, the button reads "Choose research" and opens the Research tab. The check lives in `game/` (`benchesFilled(S)`), so the page, the sim and the bot share it. As a safety net, `endMonth` itself puts a market study on any bench still idle (an old save, a headless run), so research is ongoing by construction and existing tests don't break.
2. **A queue per bench.** Line up the next projects; when one finishes the next starts. One decision every few months, not every month.
3. **Paid monthly.** A project costs its price spread over its months, like wages. Research becomes a running cost, a big project is easier to start early, and a queue never needs a lump of cash. If you're overdrawn, paid projects pause (they keep their progress) and the bench falls back to a market study.
4. **The market study is always available.** Free, one month, any bench: it brings in a tender or an enquiry. The rule can never lock you in, even when you're overdrawn, broke or at the end of the tree, and it fills quiet months with work.
5. **Owned, then mastered.** A finished tech is *owned*: it's in the workshop. It becomes *mastered* when you sign off a job that grades its lesson (the `c.lesson` from Phase 1). That's usually the research call that follows, or a job that needs it.
   - **Landmarks and deeper nodes need mastery,** not just ownership, as the design page always said.
   - **A lesson job is guaranteed.** If no fitted client fits the call (`S.pendingCalls` waits today), an open tender carrying the lesson appears within two months. Lesson jobs never go to Brassworks (the rival bids on tenders left sitting), and one that's turned down comes back, so the rival can never block a landmark.
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
| ~~Child sensors~~ | 2 | Sensors | Dropped in Phase 4: presence sensors already handle the "kids" guest better in the model | – |
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
| **Crowd counters** (new) | 2 | Barriers | Live counts: metering at doors as well as concourses, and the prerequisite for stewarding and door controllers | 4 (moved from 2: it comes with door metering) |
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
| **Site management** (new) | 1 | – | One more job a month | 1 (done) |
| **Prefabricated door sets** (new) | 2 | Site management | One more job a month | 1 (done) |
| **Design office** (new) | 2 | – | The blueprint book | 4 |
| **Sales network** (new) | 2 | Market study done 3 times | More tenders a month, enquiries wait a month longer, and advertising costs less | 2 |
| **Research lab** (new) | 3 | HQ premises | A third bench: a big one-off use for money | 2 |

Refinements: **Supplier contract** levels (hardware discount, capped), **Crew training** levels (fitting discount), **Service plans** levels (maintenance).

**Totals.** 34 one-off nodes (19 of today's techs plus 15 new; the other 4 become refinements), plus the market study, roughly 75–85 bench-months. With 1 bench, then 2, then 3 with the lab, the tree finishes around months 30–36 of play. That's about when a typical player has spent their 6–12 months on Riverside, and mastery and refinements carry on after. The pacing bands decide the final numbers.

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

**Runtime.** Layers 3 and 4 are too slow for `test:full`'s 10 minutes. The full variety sweep is about 700 surveys, and the pacing runs are 12 sims of 30 months (about 10s a month each). Together that's roughly an hour on one core. They get their own `npm run balance`, which spreads the work over worker threads (15–20 minutes on CI's 4 cores) and has a `--quick` mode that samples 4 months and 2 seeds. The full run is nightly in CI and is required before merging Phases 1 and 2.

**3. Variety and lesson tests** (`npm run balance`)
- First visits for every building, every month, 5 seeds: no single answer above about 25% of a month's jobs.
- Each research call: par uses the tech; the client's design before the call fails the lesson goal; a design without the tech can't pass.
- Each Riverside level varies across seeds.

**4. Pacing bands** (`npm run balance`): the sim on 4 seeds for 30 months, with three player styles:
- **Strong:** ★★★ designs and research that matches what the street's clients want. Each street opens after 6–8 months, never under 6.
- **Weak:** 1★ designs (par plus an unneeded extra) and cheapest-first research. Each street opens after about 10–12 months.
- **Poor:** fails a share of jobs, skips some, and researches at random. There's no time limit, but standing must rise every quarter and there must always be work or research to take, so it can never get stuck.

Also, for every style: 2–3 jobs a month on average, cash under a cap at month 12, no more than 2 quiet months in a row, every bench busy at every month end. All three policies obey the research rule (`tools/sim.mjs` fills benches only when it has spare cash today). Print a short table, including an estimate of play time (jobs × about 3 minutes, target about 2–6 hours to finish Riverside), so balance changes show as a diff in review.

**5. Browser checks** (extend `tools/bot.py`)
- Text sweep: fail on "undefined", "NaN", "[object" or "£-" on any screen the bot visits.
- Layout at 390×844 and 1280×800: no sideways scrolling, title and calendar cards not cut off, every bay inside the canvas, the coach bubble not overlapping its target.
- Cost check: after changing any setting on an inside or chained job, the cost readout changes.
- Lazy player: before applying par, try the cheapest common answers (two swing doors, one slider, close the bridge) and log how often they pass.
- CI: the bot stays in Python. Add a Python step in `pages.yml` with Playwright pinned in `tools/requirements.txt` (matched to the Chromium the runner installs); run the bot for 3 months on `dist/` at phone size before deploy, and 12 months nightly.

**6. Speed** (in `test:full`, from Phase 1): time `generateSolved` for a door job, a research call and the Arena chain; fail over budget (for example 5s in Node). The bot logs in-browser survey times.

**7. People playing:** at the end of each phase, on a real phone, a fresh start through the first winter, one research call of each kind, and the Arena. Ideally 2–3 people who haven't seen it, noting where they stall or misread. Automated checks can't tell you whether a paradox lands.

### What each phase must pass

| Phase | Must pass before merging |
|---|---|
| 0 Fixes | Layer 1 tests; golden re-recorded on purpose, with its change summary; bot in CI with a clean text sweep; baseline balance numbers recorded |
| 1 Puzzles | Layer 3 variety and lesson tests; lazy player passes under about 25%; layer 6 survey times |
| 2a Research | Research rules and tree-shape tests (section 4.5); an old save still loads |
| 2b Pacing and money | Layer 4 bands for all three player styles on 4 seeds |
| 3 UX | Layer 5 layout at both sizes; layer 6 survey times within budget |
| 4–5 Content | Paradox test, golden cases, variety coverage and a bot pass per new stage |

---

## 6. Architecture changes, in one place

| Change | Phase | Why |
|---|---|---|
| Design model in `game/` (`newDesign`, deep `cloneDesign`, `designCost`) | 0 | Removes the shared-object bug class (B1); testable in Node |
| CI: pull requests in their own concurrency group; bot in CI; `npm run balance` nightly | 0 | A PR push can't cancel a deploy; every later phase is checked |
| Brief, result and hint text as pure data in `game/briefs.js` | 1 | Wording can be tested; ends "undefined"-style bugs (B2, B5) |
| `makeContract` in explicit steps; `c.lesson` on every job | 1 | Required twists can't be evicted (B3); the surveyor and tests can check lessons (D3) |
| Balance numbers in `content/balance.js`; `simulate()` overrides | 2 | Tuning becomes data edits; sweeps without code changes |
| Street standing (stars from every job on a street, plus mastery stars) and per-street entry lists in `game/` and `content/` | 2 | Each street takes 6–12 months for most players, longer for poor play, set by skill and research picks |
| `benchesFilled(S)` in `game/`; bench queues, monthly payments, `S.mastered` and refinement levels in the save (`SAVE_VERSION` bump, owned techs migrate as mastered) | 2 | Research never stops; mastery gates landmarks; one rule the page, sim and bot all share |
| One `TECH` record per tech (text, lesson, calls, lesson goal, kind, levels, what it opens); docs tables generated from it | 2 | Ends three hand-synced sources and the drifting design page |
| Survey worker pool, pre-surveying, chain time cap | 3 | Survey waits |
| One canvas-fitting function for `canvas.js` and `stageart.js` | 3 | Clipped frontages and plans |
| Another `SAVE_VERSION` bump for blueprints | 4 | New save data |
| `DoorStage` adapter on `StageSim` | 4 | Doors inside chains |
| Programmable doors as rule data | 5 | Deterministic and safe on a shared seed |

---

## 7. Decisions made

Decided by the owner, October 2026:

1. **Pacing:** each street takes 6–12 months for most players, and can take a lot longer for poor play. How well the player plays and which research they pick decide where they land. Never under 6 months; no upper limit, but always a way forward. For most players Market Square opens between months 6 and 12 and Riverside between 12 and 24; the research tree runs to about months 30–36.
2. **Money:** monthly research costs, refinements, the Research lab and advertising. No rushing research and no landmark buy-ins.
3. **Research payment:** monthly while a project runs.
4. **Mastery:** gates landmarks and deeper nodes.
5. **Mastery stars:** each mastery adds a star to the firm's reputation.
6. **Bot:** stays in Python, with Playwright pinned.
7. **Summer:** keep the May start, and make summer harder with new pressures and the new Open doors research.
8. **Releases:** each phase goes live as it merges to main.
9. **Old saves:** nobody else plays yet, so migrations only need to stop errors. Revisit before sharing the game.
10. **Length:** shorter than 3–12 hours. Each street still takes 6–12 game months, but months are lighter (2–3 jobs), aiming at about 2–6 hours to finish Riverside.
11. **Analytics:** none. Pacing is checked with the sim and playtesting; the game stays offline-capable with no tracking.
12. **The Stadium:** at the end of Riverside for now. If there are enough levels later, it can move to a fourth street.

---

## 8. Reproducing the numbers

- Pacing and cash: `npm run sim -- 12 <seed>` for seeds 1–4; `npm run sim -- 24 1` for month 24.
- Answer variety: call `makeContract(kind, 0, month, seed, { first: true })` then `generateSolved` for each building, month and seed, and group by `par.sig`. This becomes `tools/balance.mjs` in Phase 1.
- Research calls keeping their twist: `makeContract('store', 6, 12, seed, { callback: 'paradox', extra: ['surge'], ... })` over seeds, checking `c.twists` and `c.goals.laps`.
- Browser: `pip install playwright==1.56.0` (match it to the installed Chromium), then `npm run build && npm run bot -- 18`.
