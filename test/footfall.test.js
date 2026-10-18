// Footfall between buildings (game/footfall.js): settled the same every replay, capped, and good work at the
// Station brings busier tenders up the High Street.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from '../src/game/state.js';
import { refreshPlots } from '../src/game/plots.js';
import { scheduleChange, landChange } from '../src/game/month.js';
import { makeContract } from '../src/game/contracts.js';
import { footfallNext, footfallReport, footfallTarget, settleFootfall, streetFootfall, footfallLine } from '../src/game/footfall.js';
import { FLOWS, FOOTFALL_CAP, FOOTFALL_STEP } from '../src/content/town.js';
import { PLOTS } from '../src/content/buildings/index.js';

const clone = x => JSON.parse(JSON.stringify(x));
const plot = (S, kind) => S.plots.find(p => p.kind === kind);
// a firm with every source of footfall fitted at the given stars
function town(stars, seed = 5) {
  const S = freshState(seed);
  for (const fl of FLOWS) Object.assign(plot(S, fl.from), { status: 'fitted', stars, fee: 20000, install: [{ type: 'swing' }] });
  return S;
}

test('the flow map names real buildings', () => {
  const kinds = new Set(PLOTS.map(p => p.kind));
  for (const fl of FLOWS) { assert.ok(kinds.has(fl.from), fl.from); for (const k of fl.to) assert.ok(kinds.has(k) && k !== fl.from, k); assert.ok(fl.share > 0 && fl.who); }
});

test('footfall settles the same every replay, and never moves more than its step or past the cap', () => {
  const a = town(3), b = clone(a);
  for (let m = 0; m < 4; m++) {
    const before = clone(a.footfall || {});
    const ma = settleFootfall(a), mb = settleFootfall(b);
    assert.deepEqual(ma, mb); assert.deepEqual(a.footfall, b.footfall);
    for (const p of a.plots) {
      const was = before[p.kind] || 1, now = a.footfall[p.kind] || 1;
      assert.ok(Math.abs(now - was) <= FOOTFALL_STEP + 1e-9, `${p.kind} moved ${was} → ${now}`);
      assert.ok(Math.abs(now - 1) <= FOOTFALL_CAP + 1e-9, `${p.kind} past the cap: ${now}`);
    }
  }
  assert.equal(a.footfall.cafe, 1 + FOOTFALL_CAP, 'the café is fed by three flows: capped');
  // broken doors at every source: footfall falls, within the cap
  const c = town(3); for (const fl of FLOWS) plot(c, fl.from).broken = true;
  for (const p of c.plots) assert.ok(footfallTarget(c, p.kind) >= 1 - FOOTFALL_CAP - 1e-9);
  assert.ok(footfallTarget(c, 'cafe') < 1);
});

test('a better station gate line raises the High Street\'s next tenders', () => {
  const crowdAt = stars => {
    const S = town(1);
    plot(S, 'station').stars = stars;
    settleFootfall(S); settleFootfall(S);
    const bank = plot(S, 'bank'); Object.assign(bank, { status: 'open', stars: 1 });   // not a first visit
    refreshPlots(S);
    return { c: bank.contract, S, bank };
  };
  const lo = crowdAt(1), hi = crowdAt(3);
  assert.equal(lo.c.seed, hi.c.seed, 'same draw either way');
  assert.ok(hi.c.crowd.in > lo.c.crowd.in * 1.1, `${hi.c.crowd.in} vs ${lo.c.crowd.in}`);
  assert.ok(footfallLine(hi.S, hi.bank).includes('commuters'));
  // inside jobs too
  const st = f => makeContract('bank', 2, 6, 99, { stage: 'queue', footfall: f });
  assert.ok(Math.abs(st(1.15).crowd.rate / st(1).crowd.rate - 1.15) < 0.01);
  // a first visit is the client's usual day
  assert.deepEqual(makeContract('cafe', 0, 6, 9, { first: true, footfall: 1.2 }).crowd, makeContract('cafe', 0, 6, 9, { first: true }).crowd);
});

test('a street you made busier brings checks on the clients there', () => {
  const S = town(3);
  for (const k of ['cafe', 'pharmacy', 'bank', 'hotel']) Object.assign(plot(S, k), { status: 'fitted', stars: 2, fee: 9000, install: [{ type: 'swing' }] });
  settleFootfall(S);
  const moved = settleFootfall(S);
  assert.ok(footfallReport(S, moved));
  assert.ok(streetFootfall(S, 'high') && streetFootfall(S, 'high', footfallNext(S)) !== undefined);
  const ch = scheduleChange(S, moved);
  assert.equal(ch.key, 'crowds'); assert.equal(ch.street, 'high');
  ch.month = S.month;
  const checked = landChange(S, ch);
  assert.ok(checked.length > 0);
  for (const p of checked) { assert.ok(ch.plots.includes(p.i)); assert.equal(p.reason, 'busier'); }
});
