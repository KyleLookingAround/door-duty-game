// Inside jobs: every stage runs and replays exactly, chains keep everyone, each paradox actually holds
// (the counterintuitive setup beats the obvious one on average), and finished research brings its callback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, STAGE_LIST, STAGE_TWISTS } from '../src/engine/stages/index.js';
import { makeContract } from '../src/game/contracts.js';
import { runStage } from '../src/game/stagejobs.js';
import { freshState } from '../src/game/state.js';
import { endMonth } from '../src/game/month.js';
import { refreshPlots } from '../src/game/plots.js';
import { PARADOX_CALLS } from '../src/content/paradoxes.js';
import { BUILDING } from '../src/content/buildings/index.js';
import { stageTwist } from '../src/game/briefs.js';

const ALL = { barriers: 1, escalators: 1, markings: 1, zoning: 1, paternoster: 1, travelator: 1, permits: 1, stewarding: 1, doorman: 1 };
// where each stage is usually played
const HOME = { queue: 'bank', escalator: 'station', lifts: 'towers', paternoster: 'townhall', walkway: 'skyport', carousel: 'skyport', braess: 'galleria', bottleneck: 'arena', doors: 'stadium', security: 'skyport', boarding: 'skyport' };
const job = (stage, seed, tier = 2, kind = HOME[stage]) => makeContract(kind, tier, 3, seed, { stage, tech: ALL });
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

for (const st of STAGE_LIST) {
  test(`stage ${st.key}: runs, replays exactly, and every option list is sound`, () => {
    const c = job(st.key, 7);
    assert.ok(c.crowd.rate > 0 && c.arrive > 0 && c.run > c.arrive, 'a crowd and a test length');
    const cands = st.candidates(c, ALL);
    assert.ok(cands.length >= 2, 'more than one thing to try');
    for (const d of cands) { assert.equal(d.stage, st.key); assert.ok(st.cost(d, c.existing) >= 0); assert.equal(typeof st.sig(d), 'string'); }
    const a = runStage(c, cands[cands.length - 1], ALL), b = runStage(c, cands[cands.length - 1], ALL);
    assert.deepEqual(a, b, 'same contract, same setup, same result');
    assert.ok(a.through > 0, 'people get through');
    assert.ok(Number.isFinite(a.wait));
    for (const o of st.options(c, ALL)) assert.ok(o.key && o.label && o.kind);
  });
}

test('a chained level hands everyone on and finishes', () => {
  const c = makeContract('arena', 2, 3, 5, { stage: 'chain', chain: ['queue', 'escalator', 'bottleneck'], tech: ALL });
  const r = runStage(c, c.existing, ALL);
  assert.equal(r.parts.length, 3);
  assert.ok(r.through > 0.9 * c.arrivals, `nearly everyone through (${r.through} of about ${c.arrivals})`);
  // the moving bottleneck: with more bag-check desks, the bag check gets quicker and the concourse gets busier
  const more = { stage: 'chain', parts: [{ ...c.existing.parts[0], desks: 12 }, c.existing.parts[1], c.existing.parts[2]] };
  const r2 = runStage(c, more, ALL);
  assert.ok(r2.parts[0].wait < r.parts[0].wait, 'the bag check speeds up');
  assert.ok(r2.parts[2].wait + r2.parts[2].bumps > r.parts[2].wait + r.parts[2].bumps, 'and the crush moves on to the concourse');
});

// the paradoxes: averaged over several jobs so one lucky seed can't decide it
const compare = (stage, a, b, { tier = 2, seeds = 6, kind, keep = () => true } = {}) => {
  const wa = [], wb = [];
  for (let s = 0, n = 0; n < seeds && s < 200; s++) { const c = job(stage, 100 + s, tier, kind); if (!keep(c)) continue; n++; wa.push(runStage(c, { stage, ...a }, ALL)); wb.push(runStage(c, { stage, ...b }, ALL)); }
  return [wa, wb];
};
test('paradox: one snaking queue beats a line per desk', () => {
  const [snake, lines] = compare('queue', { desks: 5, layout: 'snake' }, { desks: 5, layout: 'lines' });
  assert.ok(mean(snake.map(r => r.wait)) < mean(lines.map(r => r.wait)));
});
test('paradox: standing on both sides beats walk-left on a deep escalator, not on a short one', () => {
  const [stand, walk] = compare('escalator', { count: 2, rule: 'stand' }, { count: 2, rule: 'walk' });
  assert.ok(mean(stand.map(r => r.wait + r.bumps)) < mean(walk.map(r => r.wait + r.bumps)), 'deep: stand wins');
  const [s2, w2] = compare('escalator', { count: 1, rule: 'stand' }, { count: 1, rule: 'walk' }, { kind: 'store' });
  assert.ok(mean(w2.map(r => r.wait)) < mean(s2.map(r => r.wait)), 'short: walking wins');
});
test('escalators: turn one round for the evening peak; a fast escalator trips older travellers', () => {
  const evening = seed => makeContract('station', 2, 3, 200 + seed, { stage: 'escalator', tech: ALL, extra: ['evening'] });
  const allUp = [], oneDown = [];
  for (let s = 0; s < 4; s++) { const c = evening(s); allUp.push(runStage(c, { stage: 'escalator', count: 2, down: 0, rule: 'stand', speed: 'std' }, ALL)); oneDown.push(runStage(c, { stage: 'escalator', count: 2, down: 1, rule: 'stand', speed: 'std' }, ALL)); }
  assert.ok(mean(oneDown.map(r => r.wait)) < mean(allUp.map(r => r.wait)), 'everyone going down was stuck on the stairs');
  const seniors = makeContract('station', 2, 3, 210, { stage: 'escalator', tech: ALL, extra: ['seniors'] });
  const fast = runStage(seniors, { stage: 'escalator', count: 2, down: 0, rule: 'stand', speed: 'fast' }, ALL), std = runStage(seniors, { stage: 'escalator', count: 2, down: 0, rule: 'stand', speed: 'std' }, ALL);
  assert.ok(fast.bumps > std.bumps, `stumbles on the fast escalator: ${fast.bumps} against ${std.bumps}`);
  // a research call is about the rule alone: nobody going down, no speed to change
  const call = makeContract('store', 4, 3, 5, { stage: 'escalator', tech: ALL, callback: 'paradox' });
  assert.equal(call.params.down, 0);
  assert.ok(STAGES.escalator.candidates(call, ALL).every(d => d.speed === 'std' && !d.down));
});
test('every stage twist a level can draw has its own key, a label and its text in the brief', () => {
  const seen = {};
  for (const st of STAGE_LIST) for (const g of ['twists', 'turnTwists', 'deepTwists', 'dayTwists']) for (const k of Object.keys(st[g] || {})) {
    assert.ok(!seen[k], `twist ${k} is in both ${seen[k]} and ${st.key}`);
    seen[k] = st.key;
  }
  for (const st of STAGE_LIST) {
    const c = job(st.key, 7);
    for (const k of Object.keys(st.twistsOf ? st.twistsOf(c.opts) : st.twists)) { const t = stageTwist(c, k); assert.ok(STAGE_TWISTS[k] && t.label !== k && t.text, `${st.key} twist ${k}`); }
  }
});
test('paternoster: a stairs sign helps a wedding day; an attendant stops a school trip riding round', () => {
  const run = (extra, d) => { const w = []; for (let s = 0; s < 6; s++) { const c = makeContract('townhall', 3, 3, 1800 + s, { stage: 'paternoster', tech: ALL, extra }); w.push(runStage(c, { stage: 'paternoster', speed: 0.3, wide: false, attendant: false, stairs: false, ...d }, ALL).wait); } return mean(w); };
  assert.ok(run(['wedding'], { stairs: true }) < run(['wedding'], {}) * 0.6, 'most trips are one floor: walk them');
  const [plainA, schoolA, school] = [run([], { attendant: true }), run(['school'], { attendant: true }), run(['school'], {})];
  assert.ok(school - schoolA > (run([], {}) - plainA), `the attendant matters more on a school trip: ${school} -> ${schoolA}`);
  const call = makeContract('townhall', 4, 3, 5, { stage: 'paternoster', tech: ALL, callback: 'paradox' });
  assert.ok(STAGES.paternoster.candidates(call, ALL).every(d => !d.stairs), 'a research call is about the loop speed');
});
test('doors as a stage: fed or on its own, everyone handed in comes out; more bays move a crowd faster', () => {
  const c = makeContract('skyport', 3, 3, 21, { stage: 'doors', tech: ALL });
  const run = d => runStage(c, { stage: 'doors', bays: 2, type: 'slider', staff: false, wide: false, ...d }, ALL);
  const one = run({ bays: 1 }), four = run({ bays: 4 });
  assert.ok(four.through === four.spawned && !four.lost, 'everyone gets through sliders');
  assert.ok(four.wait < one.wait, `four bays beat one: ${four.wait} against ${one.wait}`);
  // revolving doors and cases: the arrivals doors' lesson
  assert.ok(run({ type: 'revolve' }).wait > run({}).wait, 'revolving doors are slower for people with cases');
  // fed from the stage before: a chained level hands everyone on, and the doors count them out
  const ch = makeContract('skyport', 3, 3, 22, { stage: 'chain', chain: ['carousel', 'doors'], tech: ALL });
  const r = runStage(ch, { stage: 'chain', parts: [{ ...ch.existing.parts[0] }, { stage: 'doors', bays: 4, type: 'slider', staff: false, wide: false }] }, ALL);
  assert.ok(r.through === r.parts[1].handed && r.through > 20, `everyone off the belt goes out through the doors: ${r.through} of ${r.parts[1].handed}`);
  // a gate line's people need the wide aisle
  const g = makeContract('skyport', 3, 3, 23, { stage: 'doors', tech: ALL });
  g.params.types = ['gates']; g.crowd.mix = { wheel: 0.1 };
  assert.ok(runStage(g, { stage: 'doors', bays: 3, type: 'gates', staff: false, wide: false }, ALL).lost > 0, 'no wide aisle: wheelchairs can\'t get through');
  assert.equal(runStage(g, { stage: 'doors', bays: 3, type: 'gates', staff: false, wide: true }, ALL).lost, 0);
});
test('paradox: at security, smart lanes and longer benches beat a new lane; smart lanes alone stop the belt', () => {
  const run = d => { const w = [], st = []; for (let s = 0; s < 6; s++) { const c = makeContract('skyport', 3, 3, 300 + s, { stage: 'security', tech: ALL }); const r = runStage(c, { ...c.existing, ...d }, ALL); w.push(r.wait); st.push(r.stops); } return [mean(w), mean(st)]; };
  const [plainW, plainS] = run({}), [smartW, smartS] = run({ smart: true }), [bothW] = run({ smart: true, bench: true });
  const c = makeContract('skyport', 3, 3, 300, { stage: 'security', tech: ALL }), [laneW] = run({ lanes: c.existing.lanes + 1 });
  assert.ok(smartS > plainS, `smart lanes alone fill the benches: ${smartS} stops against ${plainS}`);
  assert.ok(bothW < laneW && bothW < plainW, `smart lanes with benches ${bothW}s, a new lane ${laneW}s, as it was ${plainW}s`);
  assert.ok(STAGES.security.cost({ ...c.existing, smart: true, bench: true }, c.existing) < STAGES.security.cost({ ...c.existing, lanes: c.existing.lanes + 1 }, c.existing), 'and for less');
});
test('Skyport\'s security and departures wait for Security lanes', () => {
  const kinds = unlocks => { const seen = new Set(); for (let seed = 1; seed <= 24; seed++) {
    const S = freshState(seed); Object.assign(S.unlocks, unlocks); S.marketOpen = S.riversideOpen = true;
    const p = S.plots.find(q => q.kind === 'skyport'); p.status = 'open'; p.stars = 1; p.contract = null;
    refreshPlots(S); seen.add(p.contract.chain ? p.contract.chain.join('+') : p.contract.stage);
  } return seen; };
  const before = kinds({ travelator: 1 }), after = kinds({ travelator: 1, security: 1 });
  assert.ok(!before.has('security') && !before.has('doors+queue+security'), [...before].join());
  assert.ok(after.has('security') && after.has('doors+queue+security'), [...after].join());
});
test('paradox: boarding back to front is slower than any order; windows first is quicker still', () => {
  const run = d => mean(Array.from({ length: 6 }, (_, s) => { const c = makeContract('skyport', 3, 3, 600 + s, { stage: 'boarding', tech: ALL }); return runStage(c, { stage: 'boarding', method: 'backfront', staff: false, gatecheck: false, rear: false, ...d }, ALL).wait; }));
  const back = run({}), strict = run({ staff: true }), any = run({ method: 'random' }), windows = run({ method: 'outsidein', staff: true });
  assert.ok(any < back && back < strict, `any order ${any}, back to front ${back}, kept strictly ${strict}`);
  assert.ok(windows < any, `windows first ${windows}`);
  const call = makeContract('skyport', 4, 3, 5, { stage: 'boarding', tech: ALL, callback: 'paradox' });
  assert.ok(STAGES.boarding.candidates(call, ALL).every(d => !d.gatecheck && !d.rear), 'a research call is about the order');
});
test('counter hall: lunchtime cover beats a full desk on a lunch-rush day, not an opening rush; an express desk speeds a quick day', () => {
  const run = (extra, d) => { const w = []; for (let s = 0; s < 10; s++) { const c = makeContract('bank', 3, 3, 700 + s, { stage: 'queue', tech: ALL, extra }); w.push(runStage(c, { stage: 'queue', layout: 'snake', express: false, cover: 0, ...d }, ALL).wait); } return mean(w); };
  // the same £5,000: a fourth full desk, or two part-time desks through the middle of the day
  assert.ok(run(['opening'], { desks: 4 }) < run(['opening'], { desks: 3, cover: 2 }), 'an opening rush: the full desk');
  assert.ok(run(['lunch'], { desks: 3, cover: 2 }) < run(['lunch'], { desks: 4 }), 'a lunch rush: the cover');
  assert.ok(run(['quick'], { desks: 3, express: true }) < run(['quick'], { desks: 3 }), 'quick jobs go faster at an express desk');
  // research calls and the Arena's chained level keep the plain hall
  const call = makeContract('bank', 4, 3, 5, { stage: 'queue', tech: ALL, callback: 'paradox' });
  assert.ok(STAGES.queue.candidates(call, ALL).every(d => !d.express && !d.cover));
});
test('lifts: destination keypads win an ordinary morning and lose one full of visitors; a top-floor canteen breaks zoning', () => {
  const run = (extra, d) => { const w = []; for (let s = 0; s < 6; s++) { const c = makeContract('office', 3, 3, 800 + s, { stage: 'lifts', tech: ALL, extra }); w.push(runStage(c, { stage: 'lifts', count: c.existing.count, dwell: 'standard', ...d }, ALL).wait); } return mean(w); };
  assert.ok(run([], { mode: 'dest' }) < run([], { mode: 'zoned' }), 'keypads group the trips');
  assert.ok(run(['visitors'], { mode: 'dest' }) > run(['visitors'], { mode: 'zoned' }), 'visitors who don\'t use the keypad ride the wrong car');
  assert.ok(run(['canteen'], { mode: 'zoned' }) > run(['canteen'], { mode: 'all' }), 'half the lifts serve floors nobody wants');
  const call = makeContract('office', 4, 3, 5, { stage: 'lifts', tech: ALL, callback: 'paradox' });
  assert.ok(STAGES.lifts.candidates(call, ALL).every(d => d.mode !== 'dest' && d.dwell === 'standard'), 'a research call is about zoning');
});
test('walkways: a fast belt gets people there sooner, but older travellers stumble off it on a holiday charter', () => {
  const run = (extra, d) => { const w = [], b = []; for (let s = 0; s < 6; s++) { const c = makeContract('skyport', 3, 3, 1000 + s, { stage: 'walkway', tech: ALL, extra }); const r = runStage(c, { stage: 'walkway', belt: 40, place: 'start', speed: 'std', signs: false, ...d }, ALL); w.push(r.wait); b.push(r.bumps); } return [mean(w), mean(b)]; };
  const [stdW, stdB] = run([], {}), [fastW] = run([], { speed: 'fast' }), [, holB] = run(['holiday'], { speed: 'fast' });
  assert.ok(fastW < stdW, `faster: ${fastW} against ${stdW}`);
  assert.equal(stdB, 0, 'nobody stumbles off a standard belt');
  assert.ok(holB > STAGES.walkway.bumps(), `stumbles on a holiday charter: ${holB}`);
  const call = makeContract('skyport', 4, 3, 5, { stage: 'walkway', tech: ALL, callback: 'paradox' });
  assert.ok(STAGES.walkway.candidates(call, ALL).every(d => d.speed === 'std' && !d.signs), 'a research call is about where the walkway goes');
});
test('baggage reclaim: a fast belt suits most crowds, not a coach party; handlers matter when bags are held up', () => {
  const run = (extra, d) => { const w = []; for (let s = 0; s < 4; s++) { const c = makeContract('skyport', 3, 3, 1200 + s, { stage: 'carousel', tech: ALL, extra }); w.push(runStage(c, { stage: 'carousel', belts: 1, line: true, speed: 'std', handlers: false, ...d }, ALL).wait); } return mean(w); };
  assert.ok(run(['coach'], { speed: 'fast' }) > run(['coach'], {}), 'older travellers miss bags on a fast belt');
  assert.ok(run(['heldup'], { handlers: true }) < run(['heldup'], {}), 'handlers get held-up bags out sooner');
  const call = makeContract('skyport', 4, 3, 5, { stage: 'carousel', tech: ALL, callback: 'paradox' });
  assert.ok(STAGES.carousel.candidates(call, ALL).every(d => d.speed === 'std' && !d.handlers), 'a research call is about the line');
});
test('concourse: double-width openings pay off with metering and do nothing without it', () => {
  const run = d => { const w = []; for (let s = 0; s < 4; s++) { const c = makeContract('arena', 3, 3, 1400 + s, { stage: 'bottleneck', tech: ALL }); w.push(runStage(c, { stage: 'bottleneck', openings: c.existing.openings, metering: false, wide: false, ...d }, ALL).wait); } return mean(w); };
  const plain = run({}), wide = run({ wide: true }), metered = run({ metering: true }), both = run({ metering: true, wide: true });
  assert.ok(both < metered, `metered and wide: ${both} against ${metered}`);
  assert.ok(Math.abs(wide - plain) < (plain - both) / 4, `wide alone barely helps a packed concourse: ${wide} against ${plain}`);
});
test('paradox: zoned lifts beat the same lifts stopping everywhere', () => {
  const [zoned, all] = compare('lifts', { count: 6, mode: 'zoned' }, { count: 6, mode: 'all' });
  assert.ok(mean(zoned.map(r => r.wait)) < mean(all.map(r => r.wait)));
});
test('paradox: a slower paternoster bumps fewer people than the fastest loop', () => {
  const [slow, fast] = compare('paternoster', { speed: 0.25, wide: true, attendant: false }, { speed: 0.45, wide: true, attendant: false });
  assert.ok(mean(slow.map(r => r.bumps)) < mean(fast.map(r => r.bumps)));
});
test('paradox: a walkway with room to step off beats one to the desks', () => {
  const [start, end] = compare('walkway', { belt: 40, place: 'start' }, { belt: 40, place: 'end' });
  assert.ok(mean(start.map(r => r.stops)) < mean(end.map(r => r.stops)));
  assert.ok(mean(start.map(r => r.wait)) < mean(end.map(r => r.wait)));
});
test('paradox: a stand-back line beats crowding the belt', () => {
  const [line, crowd] = compare('carousel', { belts: 1, line: true }, { belts: 1, line: false }, { seeds: 3 });
  assert.ok(mean(line.map(r => r.wait)) < mean(crowd.map(r => r.wait)));
});
test("paradox: closing the footbridge speeds everyone up (Braess), except where the malls are long", () => {
  const plain = { bridge: 'open', wideEsc: false, wideStairs: false };
  const [closed, open] = compare('braess', { ...plain, bridge: 'closed' }, plain, { keep: c => c.params.layout === 'shortcut' });
  assert.ok(mean(closed.map(r => r.wait)) < mean(open.map(r => r.wait)));
  // long malls: the bridge is a real shortcut, so closing it is slower, and widening a pinch point is what helps
  const [closedL, openL] = compare('braess', { ...plain, bridge: 'closed' }, plain, { keep: c => c.params.layout === 'long' });
  const [stairsL] = compare('braess', { ...plain, wideStairs: true }, plain, { keep: c => c.params.layout === 'long' });
  assert.ok(mean(closedL.map(r => r.wait)) > mean(openL.map(r => r.wait)));
  assert.ok(mean(stairsL.map(r => r.wait)) < mean(openL.map(r => r.wait)));
  // a research call is always about the paradox
  for (let seed = 1; seed <= 10; seed++) assert.equal(makeContract('galleria', 4, 3, seed, { stage: 'braess', tech: ALL, callback: 'paradox' }).params.layout, 'shortcut');
});
test('paradox: metering the crowd beats letting everyone into the concourse', () => {
  const [meter, none] = compare('bottleneck', { openings: 4, metering: true }, { openings: 4, metering: false }, { tier: 4, seeds: 4 });
  assert.ok(mean(meter.map(r => r.wait + r.bumps)) < mean(none.map(r => r.wait + r.bumps)));
});

test('finished research brings a paradox callback from a fitted client', () => {
  const S = freshState(11);
  refreshPlots(S);
  const bank = S.plots.find(p => p.kind === 'bank');
  bank.status = 'fitted'; bank.stars = 2; bank.fee = 9000; bank.install = [{ type: 'swing', flow: 'both' }, { type: 'wall' }];
  S.research = [{ key: 'barriers', left: 1 }];
  const r = endMonth(S);
  assert.ok(S.unlocks.barriers);
  // the bank may have rung about its doors this month; then the paradox call waits for the next one
  if (!r.paradox.length) { assert.ok((S.pendingCalls || []).some(([k]) => k === 'barriers'), 'the call is waiting'); bank.status = 'fitted'; bank.reason = null; r.paradox = endMonth(S).paradox; }
  const call = r.paradox.find(p => p.kind === 'bank') || r.paradox[0];
  assert.ok(call, 'someone calls about the new research');
  assert.equal(call.reason, 'paradox');
  refreshPlots(S);
  if (call.kind === 'bank') assert.equal(call.contract.stage, 'queue', 'the bank calls about its counter hall');
});

test('paradox calls point at real clients and stages', () => {
  for (const [tech, defs] of Object.entries(PARADOX_CALLS)) for (const d of defs) {
    for (const k of d.kinds) assert.ok(BUILDING[k], `${tech}: ${k} exists`);
    if (d.stage) assert.ok(STAGES[d.stage], `${tech}: stage ${d.stage}`);
    for (const k of d.chain || []) assert.ok(STAGES[k], `${tech}: chain stage ${k}`);
    assert.ok(d.text);
  }
});
