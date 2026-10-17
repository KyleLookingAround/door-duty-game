// A fire-drill survey that used to crash (slow: its own file so it runs alongside the rest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContract, solveContract } from '../src/game/contracts.js';

test('a fire drill nobody can clear in time is flagged unfair, not a crash', async () => {
  // seed 5's game crashed here: a Pillars call at the cinema whose best evacuation was too slow for the
  // target, so every design was filtered out and the surveyor read past the end of an empty list
  const tech = { mouth: true, padded: true, barriers: true, doorman: false, pillars: true };
  const swings = [{ type: 'swing', curtain: false, flow: 'in', vestibule: false }, { type: 'swing', curtain: false, flow: 'out', vestibule: false }];
  const c = makeContract('cinema', 7, 13, 85023, { callback: 'paradox', existing: swings, need: ['drill'], tech, event: 'storm' });
  await solveContract(c, tech);
  assert.ok(c.relaxed, 'flagged so the surveyor rerolls it');
  assert.ok(Number.isFinite(c.goals.evac) && c.par && c.par.slots, 'and still has a target and a par design');
});
