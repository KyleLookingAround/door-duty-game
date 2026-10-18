// Research rules (Phase 2a, PLAN section 4.5): research never stops, queues, monthly payments that pause when
// overdrawn, the market study, mastery from lesson jobs only, landmarks needing mastery, and old saves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, migrate } from '../src/game/state.js';
import { endMonth } from '../src/game/month.js';
import { signOff } from '../src/game/jobs.js';
import { benchesFilled, startResearch, instalment, researchMonth } from '../src/game/research.js';
import { isMastered, missingNeeds, needsMastery, rep } from '../src/game/economy.js';
import { TECH } from '../src/content/tech.js';

const T = k => TECH.find(t => t.key === k);
const fakeJob = { goals: {}, par: { cost: 0 }, fee: 5000, margin: 5000, existing: null };

test('a month needs every bench busy; the safety net runs a market study on a free one', () => {
  const S = freshState(1);
  assert.ok(!benchesFilled(S));
  const r = endMonth(S).research;
  assert.equal(r.studies.length, 1, 'the free bench ran a market study');
  assert.equal(r.cost, 0, 'which is free');
  assert.equal(startResearch(S, 'mouth'), 'started');
  assert.ok(benchesFilled(S));
});

test('a queued project starts when the one before finishes', () => {
  const S = freshState(2); S.cash = 1e6;
  assert.equal(startResearch(S, 'mouth'), 'started');
  assert.equal(startResearch(S, 'curtain'), 'queued');
  assert.equal(startResearch(S, 'curtain'), false, 'not twice');
  endMonth(S);
  assert.ok(S.unlocks.mouth);
  assert.equal(S.research[0].key, 'curtain', 'the queue moved up');
  assert.equal((S.queue || []).length, 0);
});

test('research is paid month by month, and waits (keeping progress) while overdrawn', () => {
  const S = freshState(3); S.cash = 1e6;
  startResearch(S, 'curtain');   // £14k over 2 months
  const before = S.cash, r = researchMonth(S);
  assert.equal(r.cost, instalment(T('curtain')));
  assert.equal(S.cash, before - instalment(T('curtain')));
  assert.equal(S.research[0].left, 1);
  S.cash = -5000;
  const r2 = researchMonth(S);
  assert.deepEqual(r2.paused, ['curtain'], 'overdrawn: it waits');
  assert.equal(r2.cost, 0);
  assert.equal(r2.studies.length, 1, 'and the bench ran a market study instead');
  assert.equal(S.queue[0].key, 'curtain'); assert.equal(S.queue[0].left, 1, 'progress kept');
  assert.equal(startResearch(S, 'study'), 'started', 'the market study is always there, even overdrawn');
  S.research = []; S.cash = 50000;
  researchMonth(S);   // back in the black: it resumes and finishes
  assert.ok(S.unlocks.curtain);
});

test('mastery comes only from signing off the job that teaches it', () => {
  const S = freshState(4); S.unlocks.core = true; S.unlocks.mouth = true;
  assert.ok(needsMastery('core') && !isMastered(S, 'core'));
  const p = S.plots.find(x => x.kind === 'office');
  p.status = 'callback'; p.reason = 'cold';
  signOff(S, p, fakeJob, [{ type: 'wall' }], 1, { bumps: 0 });
  assert.ok(!isMastered(S, 'core'), 'an ordinary job doesn\'t master anything');
  const stars = rep(S);
  p.status = 'callback'; p.reason = 'paradox'; p.callTech = 'core';
  const out = signOff(S, p, { ...fakeJob, lesson: 'core' }, [{ type: 'wall' }], 1, { bumps: 0 });
  assert.equal(out.mastered, 'core');
  assert.ok(isMastered(S, 'core'));
  assert.equal(rep(S), stars + 2, 'the job\'s star, and a star for mastering it');
  // research only the client that needs it could teach is mastered as soon as it's owned
  assert.ok(!needsMastery('permits'));
  S.research = [{ key: 'permits', left: 1, owe: 0 }]; researchMonth(S);
  assert.ok(isMastered(S, 'permits'));
});

test('landmarks need their research mastered; an everyday client only owned', () => {
  const S = freshState(5);
  const arena = S.plots.find(p => p.kind === 'arena'), bank = S.plots.find(p => p.kind === 'bank');
  for (const k of ['stewarding', 'escalators', 'barriers', 'mouth']) S.unlocks[k] = true;
  assert.deepEqual(missingNeeds(S, bank), [], 'the bank only needs mouth adjusters owned');
  assert.deepEqual(missingNeeds(S, arena).sort(), ['barriers', 'escalators'], 'stewarding is mastered on finish (only the arena teaches it)');
  S.mastered = { escalators: true, barriers: true };
  assert.deepEqual(missingNeeds(S, arena), []);
});

test('an old save migrates: running research was paid for, owned techs count as mastered, empty queue', () => {
  const S = freshState(6); S.version = 6; S.unlocks = { mouth: true, core: true }; S.research = [{ key: 'padded', left: 1 }]; delete S.queue; delete S.mastered;
  migrate(S);
  assert.deepEqual(S.queue, []);
  assert.ok(isMastered(S, 'core'));
  assert.equal(S.research[0].owe, 0);
  const cash = S.cash; researchMonth(S);
  assert.equal(S.cash, cash, 'nothing more to pay');
  assert.ok(S.unlocks.padded);
});

test('refinements go up a level at a time, dearer each time, and stop at the top', () => {
  const S = freshState(7); S.cash = 1e7; S.premises = 2;
  const prices = [];
  for (let lv = 1; lv <= 3; lv++) {
    assert.equal(startResearch(S, 'supplier'), 'started', `level ${lv}`);
    prices.push(S.research[0].per * S.research[0].left);
    while (S.research.length) researchMonth(S);
    assert.equal(S.unlocks.supplier, lv);
  }
  assert.ok(prices[0] < prices[1] && prices[1] < prices[2], `rising prices ${prices}`);
  assert.equal(startResearch(S, 'supplier'), false, 'no level 4');
  // heat recovery level 2 is heat pumps: Office Towers asks for it
  const towers = S.plots.find(p => p.kind === 'towers');
  S.unlocks.vestibule = S.unlocks.wide = true; S.mastered = { vestibule: true, wide: true };
  S.unlocks.heat = 1; S.mastered.heat = true;
  assert.deepEqual(missingNeeds(S, towers), ['heat']);
  startResearch(S, 'heat'); while (S.research.length) researchMonth(S);
  assert.deepEqual(missingNeeds(S, towers), []);
  assert.ok(S.unlocks.heat2, 'the engine reads heat pumps as heat2');
});

test('the research lab adds a bench; the sales network needs market studies behind it', () => {
  const S = freshState(8); S.cash = 1e7; S.premises = 2;
  assert.equal(startResearch(S, 'network'), false, 'no studies yet');
  S.studiesDone = 3;
  assert.equal(startResearch(S, 'network'), 'started');
  assert.equal(startResearch(S, 'lab'), 'started', 'headquarters has two benches');
  assert.equal(startResearch(S, 'curtain'), 'queued');
  for (let m = 0; m < 3; m++) researchMonth(S);
  assert.ok(S.unlocks.lab);
  assert.equal(S.research.length + (S.queue || []).length <= 3, true);
  assert.ok(S.research.some(r => r.key === 'curtain') || S.unlocks.curtain, 'the third bench picked up the queue');
});

test('tier 3 research needs what it builds on mastered, not just owned', () => {
  const S = freshState(9); S.cash = 1e6; S.premises = 2;
  for (const k of ['mouth', 'padded', 'sensor']) S.unlocks[k] = true;
  S.mastered = { mouth: true };
  assert.equal(startResearch(S, 'wide'), false, 'presence sensors owned but not mastered');
  S.mastered.sensor = true;
  assert.equal(startResearch(S, 'wide'), 'started');
});

test('every tier: research needs what it builds on mastered', () => {
  const S = freshState(9); S.cash = 1e6; S.premises = 2;
  S.unlocks.mouth = true; S.mastered = {};
  assert.equal(startResearch(S, 'core'), false, 'mouth adjusters owned but not mastered');
  S.mastered.mouth = true;
  assert.equal(startResearch(S, 'core'), 'started');
  // a refinement is mastered at its first level, and research no client could teach is mastered on finish
  S.unlocks.zoning = true; S.mastered.zoning = true;
  assert.ok(['started', 'queued'].includes(startResearch(S, 'paternoster')));
});
