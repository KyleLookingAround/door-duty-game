// The save and the month: fresh firms, migrations, and the seeded random stream that makes a month replay exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, migrate, random, SAVE_VERSION } from '../src/game/state.js';
import { endMonth } from '../src/game/month.js';
import { refreshPlots } from '../src/game/plots.js';
import { grade } from '../src/game/jobs.js';
import { PLOTS } from '../src/content/buildings/index.js';

const clone = x => JSON.parse(JSON.stringify(x));

test('a fresh firm', () => {
  const S = freshState(42);
  assert.equal(S.version, SAVE_VERSION);
  assert.equal(S.cash, 20000);
  assert.equal(S.plots.length, PLOTS.length);
  assert.ok(S.plots.every(p => p.status === 'locked'));
});

test('the random stream is seeded', () => {
  const a = freshState(7), b = freshState(7), c = freshState(8);
  const run = S => Array.from({ length: 5 }, () => random(S));
  const ra = run(a);
  assert.deepEqual(ra, run(b));
  assert.notDeepEqual(ra, run(c));
  assert.ok(ra.every(x => x >= 0 && x < 1));
});

test('old saves are brought up to date', () => {
  const old = clone(freshState(3));
  delete old.premises; delete old.research; delete old.staff; delete old.upg; delete old.seed; delete old.rng; delete old.version;
  old.jobs = 4; old.plots = old.plots.slice(0, 8);
  const S = migrate(old);
  assert.equal(S.version, SAVE_VERSION);
  assert.equal(S.plots.length, PLOTS.length, 'new buildings appended');
  assert.ok(S.unlocks.core && S.unlocks.mouth, 'firms that had played keep core and mouth');
  assert.ok(S.seed > 0);
  assert.equal(migrate(null).cash, 20000, 'no save: a fresh firm');
});

// a small established firm, so the month has fitted clients to wear, claim on and call back
function firm(seed) {
  const S = freshState(seed);
  refreshPlots(S);
  for (const p of S.plots.slice(0, 4)) {
    p.status = 'fitted'; p.contract = null; p.stars = 2; p.fee = 12000; p.bumpRec = 2; p.stopRec = 1; p.wear = 0.4;
    p.install = [{ type: 'swing', flow: 'both' }, { type: 'wall' }];
  }
  return S;
}

test('a month replays identically from the same save', () => {
  const a = firm(99), b = clone(a);
  const ra = [], rb = [];
  for (let i = 0; i < 6; i++) {
    const x = endMonth(a), y = endMonth(b);
    ra.push([x.net, x.calls.map(p => p.i), x.claims.map(p => p.i)]);
    rb.push([y.net, y.calls.map(p => p.i), y.claims.map(p => p.i)]);
  }
  assert.deepEqual(ra, rb);
  assert.deepEqual(clone(a), clone(b));
});

test('a month moves money and the calendar', () => {
  const S = firm(5), before = S.cash, m = S.month;
  const r = endMonth(S);
  assert.equal(S.month, m + 1);
  assert.ok(r.inc > 0, 'fitted clients pay maintenance');
  assert.ok(Math.abs(S.cash - (before + r.net)) < 1, 'cash moves by the net shown');
});

test('grading', () => {
  const S = freshState(1);
  const c = { goals: { through: 10, bumps: 2 }, budget: 10000, par: { cost: 5000 }, existing: null, rules: {}, outsideTemp: 15, margin: 3000, fee: 8000 };
  const design = [{ type: 'swing', flow: 'both' }];   // £2,500, under par
  const r = { through: 12, bumps: 0, stops: 0, laps: 0, accessFail: 0, bikeFail: 0, minTemp: 18, maxTemp: 20, wait: 3 };
  let g = grade(S, c, design, r);
  assert.ok(g.pass); assert.equal(g.stars, 3);
  g = grade(S, c, design, { ...r, bumps: 1 });
  assert.equal(g.stars, 2, 'a bump costs the third star');
  g = grade(S, c, design, { ...r, through: 9 });
  assert.ok(!g.pass); assert.match(g.hint, /Not enough got through/);
});
