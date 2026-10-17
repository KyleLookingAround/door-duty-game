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

// ---- street changes: the causes of callbacks ----
import { scheduleChange, landChange, changeWhere } from '../src/game/month.js';
import { settleCheck } from '../src/game/plots.js';
import { CHANGES } from '../src/content/changes.js';
import { upkeep } from '../src/game/economy.js';

test('a new firm starts in the spring, with no heatwave in its first summer', async () => {
  const S = freshState(3);
  assert.equal(S.month % 12, 4, 'May');
  const { eventOf } = await import('../src/content/events.js');
  assert.equal(eventOf(6), null, 'no heatwave in the first July');
  assert.equal(eventOf(18).key, 'heatwave', 'but there is one the next year');
});

test('street changes go on the calendar ahead, and land on the clients they touch', () => {
  const S = firm(21);
  for (let k = 0; k < 20 && !(S.changes || []).length; k++) scheduleChange(S);
  const ch = S.changes[0];
  assert.ok(ch && ch.month === S.month + 2, 'two months ahead');
  assert.ok(changeWhere(S, ch).length > 0);
  // force a change on the High Street and land it
  const busy = { key: 'busstop', month: S.month, street: 'high' };
  const checked = landChange(S, busy);
  assert.ok(checked.length > 0 && checked.length <= CHANGES.find(d => d.key === 'busstop').max);
  for (const p of checked) { assert.equal(p.status, 'checking'); assert.equal(p.reason, 'busier'); assert.equal(p.change, 'busstop'); }
  for (const d of CHANGES) assert.ok(d.label && d.text && d.reason && d.max > 0);
});

test('a check either copes (the client remembers) or becomes a callback', () => {
  const S = firm(22);
  const [a, b] = S.plots.slice(0, 2);
  a.status = b.status = 'checking'; a.change = b.change = 'busstop'; a.reason = b.reason = 'busier';
  const pay = upkeep(S, a);
  assert.equal(settleCheck(S, a, { existing: a.install, par: { cost: 0 } }), 'coped');
  assert.equal(a.status, 'fitted'); assert.equal(a.coped, 1);
  assert.ok(upkeep(S, a) > pay, 'riding out a change is worth a little more maintenance');
  const tier = b.tier;
  assert.equal(settleCheck(S, b, { existing: b.install, par: { cost: 5000 } }), 'call');
  assert.equal(b.status, 'callback'); assert.equal(b.tier, tier + 1);
});

// ---- enquiries: clients waiting on research ----
import { settleEnquiries, advice } from '../src/game/enquiries.js';
import { signOff } from '../src/game/jobs.js';

test('a quiet month brings an enquiry; research in time brings the job and a bonus', () => {
  const S = firm(31);
  for (const p of S.plots.slice(0, 4)) p.kind = 'cafe';   // cafés call about air curtains
  S.cash = 50000;
  const { fresh } = settleEnquiries(S, true);
  assert.ok(fresh && fresh.enquiry, 'with nothing on, a client asks');
  const e = fresh.enquiry;
  assert.ok(e.by > S.month && e.bonus > 0);
  assert.match(advice(S).text, /^Start /, 'the advice is to start it');
  S.unlocks[e.tech] = true; S.month = e.by;
  const { won } = settleEnquiries(S, false);
  assert.deepEqual(won.map(p => p.i), [fresh.i]);
  assert.equal(fresh.status, 'callback'); assert.equal(fresh.reason, 'paradox');
  const cash = S.cash;
  const c = { existing: fresh.install, par: { cost: 0 }, margin: 2000, fee: 2000, goals: { minTemp: 16 } };
  const { bonus } = signOff(S, fresh, c, fresh.install, 2, { bumps: 0, stops: 0, minTemp: 18 });
  assert.equal(bonus, e.bonus);
  assert.ok(S.cash >= cash + e.bonus);
  assert.equal(fresh.enquiry, null);
});

test('an enquiry left too long lapses', () => {
  const S = firm(32);
  for (const p of S.plots.slice(0, 4)) p.kind = 'cafe';
  S.cash = 50000;
  const { fresh } = settleEnquiries(S, true);
  fresh.coped = 2;
  S.month = fresh.enquiry.by + 1;
  const { lapsed } = settleEnquiries(S, false);
  assert.equal(lapsed.length, 1);
  assert.equal(fresh.enquiry, null);
  assert.equal(fresh.coped, 1, 'no rival yet: just a little less loyal');
});
