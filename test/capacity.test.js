// How many jobs a month the firm can take: set by its premises and some research.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREMISES } from '../src/content/company.js';
import { TECH, LESSONS } from '../src/content/tech.js';
import { freshState, migrate, SAVE_VERSION } from '../src/game/state.js';
import { jobsPerMonth, jobsLeft } from '../src/game/economy.js';
import { signOff } from '../src/game/jobs.js';
import { endMonth } from '../src/game/month.js';
import { bookedText, jobsLine } from '../src/game/briefs.js';

const job = () => ({ goals: { through: 10, bumps: 2 }, budget: 10000, par: { cost: 5000 }, existing: null, rules: {}, outsideTemp: 15, margin: 3000, fee: 8000 });
const run = { through: 12, bumps: 0, stops: 0, laps: 0, accessFail: 0, bikeFail: 0, minTemp: 18, maxTemp: 20, wait: 3 };
const doors = [{ type: 'swing', flow: 'in' }, { type: 'swing', flow: 'out' }];
const signAt = (S, i) => { const p = S.plots[i]; p.status = 'open'; signOff(S, p, job(), doors, 2, run); };

test('bigger premises and some research mean more jobs a month', () => {
  assert.deepEqual(PREMISES.map(p => p.jobs), [2, 3, 4], 'garage, workshop, headquarters');
  const S = freshState(1);
  assert.equal(jobsPerMonth(S), 2);
  S.premises = 1; assert.equal(jobsPerMonth(S), 3);
  S.premises = 2; assert.equal(jobsPerMonth(S), 4);
  const extra = TECH.filter(t => t.jobs);
  assert.deepEqual(extra.map(t => t.key), ['sitemgmt', 'prefab']);
  for (const t of extra) { S.unlocks[t.key] = true; assert.ok(LESSONS[t.key], `${t.key} has a lesson`); }
  assert.equal(jobsPerMonth(S), 6, 'headquarters and both research nodes');
  assert.deepEqual(TECH.find(t => t.key === 'prefab').req, ['sitemgmt']);
});

test('every sign-off uses a job, and a new month frees the crews', () => {
  const S = freshState(2);
  assert.equal(jobsLeft(S), 2);
  signAt(S, 0); assert.equal(jobsLeft(S), 1);
  signAt(S, 1); assert.equal(jobsLeft(S), 0);
  assert.equal(S.monthJobs, 2);
  assert.match(jobsLine(S), /booked up/);
  endMonth(S);
  assert.equal(S.monthJobs, 0);
  assert.equal(jobsLeft(S), 2);
  assert.match(jobsLine(S), /^2 of 2 jobs left this month$/);
});

test('when the crews are booked up, the brief says why and what would help', () => {
  const S = freshState(3);
  S.monthJobs = 2;
  let t = bookedText(S);
  assert.match(t, /booked up: 2 of 2 jobs this month/);
  assert.match(t, /move to the workshop/); assert.match(t, /research Site management/);
  S.premises = 2; S.unlocks.sitemgmt = true; S.unlocks.prefab = true; S.monthJobs = 6;
  t = bookedText(S);
  assert.doesNotMatch(t, /move to|research/, 'nothing left to buy: just end the month');
  assert.doesNotMatch(t, /undefined|NaN/);
});

test('an old save gets a count of this month\'s jobs', () => {
  const S = freshState(4); delete S.monthJobs; S.version = 3;
  migrate(S);
  assert.equal(S.monthJobs, 0);
  assert.equal(S.version, SAVE_VERSION);
});
