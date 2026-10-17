// Inside jobs: every stage runs and replays exactly, chains keep everyone, each paradox actually holds
// (the counterintuitive setup beats the obvious one on average), and finished research brings its callback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, STAGE_LIST } from '../src/engine/stages/index.js';
import { makeContract } from '../src/game/contracts.js';
import { runStage } from '../src/game/stagejobs.js';
import { freshState } from '../src/game/state.js';
import { endMonth } from '../src/game/month.js';
import { refreshPlots } from '../src/game/plots.js';
import { PARADOX_CALLS } from '../src/content/paradoxes.js';
import { BUILDING } from '../src/content/buildings/index.js';

const ALL = { barriers: 1, escalators: 1, markings: 1, zoning: 1, paternoster: 1, travelator: 1, permits: 1, stewarding: 1, doorman: 1 };
// where each stage is usually played
const HOME = { queue: 'bank', escalator: 'station', lifts: 'towers', paternoster: 'townhall', walkway: 'skyport', carousel: 'skyport', braess: 'galleria', bottleneck: 'arena' };
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
