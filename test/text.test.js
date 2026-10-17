// Player-facing wording that depends on the job: every case has words, and the words match the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { callText, jobLabel } from '../src/game/briefs.js';
import { CALLBACKS } from '../src/content/town.js';
import { CHANGES } from '../src/content/changes.js';
import { STARS, STARS_INSIDE, BASICS, COACH } from '../src/content/guides.js';
import { grade } from '../src/game/jobs.js';
import { freshState } from '../src/game/state.js';

// every reason a plot can be given, read from the rules themselves so a new one can't slip through
function reasons() {
  const out = new Set(['paradox', ...Object.keys(CALLBACKS), ...CHANGES.map(d => d.reason)]);
  const dir = new URL('../src/game/', import.meta.url);
  for (const f of readdirSync(dir)) {
    for (const line of readFileSync(new URL(f, dir), 'utf8').split('\n')) {
      if (!/\breason\s*=\s*[^=]/.test(line)) continue;
      for (const m of line.matchAll(/\breason\s*=\s*([^;]+)/g)) for (const q of m[1].matchAll(/'(\w+)'/g)) out.add(q[1]);
    }
  }
  return [...out];
}

test('every callback reason has wording, on door and inside briefs', () => {
  const all = reasons();
  assert.ok(all.includes('safety') && all.includes('botched'), 'the reasons scan finds inspections and rescues');
  for (const reason of all) {
    for (const inside of [false, true]) {
      const t = callText({ status: 'callback', reason, callText: 'They want the new kit put to work.' }, inside);
      assert.doesNotMatch(t, /undefined|null|NaN/, `${reason}${inside ? ' (inside)' : ''}: ${t}`);
      assert.ok(t.length > 20, `${reason}: says something`);
    }
    if (reason !== 'paradox') assert.ok(CALLBACKS[reason], `${reason} has its own wording in CALLBACKS`);
  }
});

test('a research call reads as new work and says what the client wants', () => {
  const p = { status: 'callback', reason: 'paradox', callText: 'Their rush hour is getting heavier.' };
  assert.equal(jobLabel(p), 'New work');
  assert.match(callText(p, false), /^Their rush hour is getting heavier\. Your existing doors stay/);
  assert.equal(callText(p, true), 'Their rush hour is getting heavier.');
  assert.match(callText({ status: 'callback', reason: 'paradox' }, false), /new research/, 'a call with no text still says something');
  assert.equal(jobLabel({ status: 'callback', reason: 'cold' }), 'Callback');
  assert.equal(jobLabel({ status: 'open' }), 'Tender');
});

test('the star wording matches the grading rule', () => {
  // three stars at exactly par with a clean run: the wording must not say "under par"
  const S = freshState(1);
  const c = { goals: { through: 10, bumps: 2 }, budget: 10000, par: { cost: 5000 }, existing: null, rules: {}, outsideTemp: 15, margin: 3000, fee: 8000 };
  const atPar = [{ type: 'swing', flow: 'in' }, { type: 'swing', flow: 'out' }];   // £5,000, exactly par
  const r = { through: 12, bumps: 0, stops: 0, laps: 0, accessFail: 0, bikeFail: 0, minTemp: 18, maxTemp: 20, wait: 3 };
  assert.equal(grade(S, c, atPar, r).stars, 3, 'three stars at par');
  assert.equal(grade(S, c, atPar, { ...r, stops: 1 }).stars, 2, 'a safety stop costs the third star');
  for (const text of [STARS, STARS_INSIDE, COACH.result[1], BASICS.find(b => b[0] === 'test')[2]]) {
    assert.doesNotMatch(text, /(?<!at or )under par with/, text);
  }
  assert.match(STARS, /★★★ at or under par with no bumps or safety stops/);
});

// ---- hints, the coach, research calls and stage twists say what's true of this job ----
import { COACH as TIPS } from '../src/content/guides.js';
import { PARADOX_CALLS, callFits } from '../src/content/paradoxes.js';
import { makeContract } from '../src/game/contracts.js';
import { stageTwist } from '../src/game/briefs.js';
import { monthlyIncome } from '../src/game/economy.js';

const RUN = { through: 60, bumps: 0, stops: 0, laps: 0, accessFail: 0, bikeFail: 0, minTemp: 20, maxTemp: 21, wait: 3 };
const job = (extra = {}) => ({ goals: { through: 50, bumps: 3 }, budget: 20000, par: { cost: 5000 }, existing: null, rules: {}, outsideTemp: 15, margin: 3000, fee: 8000, ...extra });
const hint = (S, c, design, r) => grade(S, c, design, { ...RUN, ...r }).hint;
const twoWay = [{ type: 'swing', flow: 'both' }, { type: 'wall' }];
const drum = [{ type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 6, flow: 'both' }, { type: 'wall' }];

test('hints only name hardware the job allows and the firm has', () => {
  const S = freshState(1);
  const noRevolving = job({ rules: { forbid: ['revolve'] } });
  // the first café job: revolving doors banned, a two-way swing door clipping people
  let h = hint(S, noRevolving, twoWay, { bumps: 9 });
  assert.doesNotMatch(h, /the wings|faster wings|mouths|revolving/i, h);
  assert.match(h, /direction/);
  assert.match(hint(S, job(), drum, { bumps: 9 }), /Slow the wings/);
  // not enough through with a revolving door, before Mouth adjusters: no talk of mouths
  h = hint(S, job(), drum, { through: 10 });
  assert.match(h, /faster wings/); assert.doesNotMatch(h, /mouth/i, h);
  S.unlocks.mouth = 1;
  assert.match(hint(S, job(), drum, { through: 10 }), /wider mouths/);
  // a cold lobby on a no-revolving job: only what the firm can actually fit
  const cold = job({ rules: { forbid: ['revolve'] }, goals: { through: 50, bumps: 3, minTemp: 18 } });
  h = hint(freshState(1), cold, twoWay, { minTemp: 12 });
  assert.doesNotMatch(h, /revolving|air curtain|draught/i, h);
  const S2 = freshState(1); S2.unlocks.curtain = 1;
  assert.match(hint(S2, cold, twoWay, { minTemp: 12 }), /air curtains help/);
  // go-rounds before Big-core drums point at the research, not a slider you don't have
  const surge = job({ goals: { through: 50, bumps: 3, laps: 1 } });
  assert.match(hint(freshState(1), surge, drum, { laps: 9 }), /Big-core drums would/);
  for (const c of [noRevolving, cold, surge]) for (const d of [twoWay, drum]) for (const r of [{ bumps: 9 }, { through: 1 }, { minTemp: 1 }, { laps: 9 }]) {
    assert.doesNotMatch(hint(freshState(1), c, d, r), /undefined|NaN|\.\./, 'every hint reads cleanly');
  }
});

test('the coach\'s door tip leaves out doors the client has banned', () => {
  const tip = TIPS.doors[1];
  assert.match(tip({}), /Revolving doors keep the heat in/);
  assert.doesNotMatch(tip({ forbid: ['revolve'] }), /Revolving doors keep/);
  assert.match(tip({ forbid: ['revolve'] }), /ruled out revolving doors/);
});

test('research calls and enquiries only come from clients they are true of', () => {
  const swingCafe = { kind: 'cafe', install: twoWay };
  const oneWayCafe = { kind: 'cafe', install: [{ type: 'swing', flow: 'in' }, { type: 'swing', flow: 'out' }] };
  const lanes = PARADOX_CALLS.barriers.find(d => d.kinds.includes('cafe'));
  assert.ok(callFits(lanes, swingCafe));
  assert.ok(!callFits(lanes, oneWayCafe), 'nobody is clipped by one-way doors');
  assert.ok(!callFits(PARADOX_CALLS.mouth[0], { kind: 'bank', install: [{ type: 'slider' }] }), 'no wind through a revolving door you never fitted');
  assert.ok(callFits(PARADOX_CALLS.mouth[0], { kind: 'bank', install: drum }));
  // any door call that talks about a revolving door, a drum or the wings must check for one
  for (const [key, defs] of Object.entries(PARADOX_CALLS)) for (const d of defs) {
    if (!d.stage && !d.chain && /revolving door|drum|the wings|swing door|open doors/i.test(d.text)) assert.ok(d.fits, `${key}: "${d.text}" needs fits()`);
  }
});

test('the arena\'s inside jobs speak concert, not bank', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const c = makeContract('arena', seed % 8, seed % 12, seed, { stage: 'chain', chain: ['queue', 'escalator', 'bottleneck'], tech: {} });
    for (const t of c.twists) {
      const { label, text } = stageTwist(c, t);
      assert.doesNotMatch(`${label} ${text}`, /customer|shopper|mortgage|pension|payday|cheque/i, `${t}: ${label}. ${text}`);
    }
  }
  const bank = makeContract('bank', 5, 3, 3, { stage: 'queue', tech: {} });
  for (const t of Object.keys({ payday: 1, mortgages: 1, pensions: 1 })) assert.ok(stageTwist({ ...bank, twists: [t] }, t).label, 'the bank keeps its own words');
});

test('the street header can show one street\'s maintenance', () => {
  const S = freshState(1);
  const cafe = S.plots.find(p => p.kind === 'cafe'), museum = S.plots.find(p => p.kind === 'museum');
  for (const p of [cafe, museum]) Object.assign(p, { status: 'fitted', fee: 9000, stars: 3, install: twoWay });
  const all = monthlyIncome(S), high = monthlyIncome(S, 'high'), market = monthlyIncome(S, 'market');
  assert.ok(high > 0 && market > 0);
  assert.equal(high + market, all);
  assert.equal(monthlyIncome(S, 'riverside'), 0);
});
