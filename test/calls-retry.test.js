// Research calls, end to end through the surveyor (slow: its own file so it runs alongside the rest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContract, generateSolved } from '../src/game/contracts.js';
import { TECH } from '../src/content/tech.js';

// a firm that has the research behind the call (and what that research needed first)
function techFor(key) {
  const have = {};
  const add = k => { if (have[k]) return; have[k] = 1; for (const r of (TECH.find(t => t.key === k) || {}).req || []) add(r); };
  add(key);
  return have;
}
const DOORS = [{ type: 'revolve', wings: 4, mouth: 45, core: 0.15, rpm: 6.5, flow: 'both' }, { type: 'wall' }, { type: 'wall' }, { type: 'revolve', wings: 4, mouth: 45, core: 0.15, rpm: 6.5, flow: 'both' }];

test('the surveyor keeps a research call\'s twist through its retries', async () => {
  // seed 1 lost its surge twist before: the random draws took the slots and the retries wiped it
  const c0 = makeContract('store', 6, 12, 1, { callback: 'paradox', existing: DOORS, need: ['surge'], tech: techFor('core'), event: 'sales' });
  const c = await generateSolved(c0, techFor('core'), ['r4,r4']);
  assert.ok(c.twists.includes('surge'), `twists ${c.twists}`);
  assert.notEqual(c.goals.laps, null);
});
