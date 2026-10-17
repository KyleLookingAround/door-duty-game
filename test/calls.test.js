// Research calls: a client calls about the problem your new research solves, so the job must have that problem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContract, generateSolved } from '../src/game/contracts.js';
import { PARADOX_CALLS } from '../src/content/paradoxes.js';
import { TECH } from '../src/content/tech.js';

// a firm that has the research behind the call (and what that research needed first)
function techFor(key) {
  const have = {};
  const add = k => { if (have[k]) return; have[k] = 1; for (const r of (TECH.find(t => t.key === k) || {}).req || []) add(r); };
  add(key);
  return have;
}
const DOORS = [{ type: 'revolve', wings: 4, mouth: 45, core: 0.15, rpm: 6.5, flow: 'both' }, { type: 'wall' }, { type: 'wall' }, { type: 'revolve', wings: 4, mouth: 45, core: 0.15, rpm: 6.5, flow: 'both' }];

test('every door research call keeps its twist, over 20 seeds, even as a last-resort plain job', () => {
  let checked = 0;
  for (const [key, defs] of Object.entries(PARADOX_CALLS)) {
    for (const def of defs) {
      if (!def.twist) continue;
      const tech = techFor(key);
      for (const kind of def.kinds) {
        for (let seed = 1; seed <= 20; seed++) {
          for (const extra of [{}, { plain: true }, { severity: 2 }]) {
            const c = makeContract(kind, 4 + (seed % 4), seed % 12, seed, { callback: 'paradox', existing: DOORS, need: [def.twist], tech, event: seed % 3 ? null : 'sales', ...extra });
            assert.ok(c.twists.includes(def.twist), `${key} call at ${kind}, seed ${seed} ${JSON.stringify(extra)}: twists ${c.twists}`);
            checked++;
          }
        }
      }
    }
  }
  assert.ok(checked > 1000);
});

test('the big-core call grades go-rounds', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const c = makeContract('store', 6, 12, seed, { callback: 'paradox', existing: DOORS, need: ['surge'], tech: techFor('core'), event: 'sales' });
    assert.notEqual(c.goals.laps, null, `seed ${seed}: twists ${c.twists}`);
  }
});

test('the surveyor keeps a research call\'s twist through its retries', async () => {
  // seed 1 lost its surge twist before: the random draws took the slots and the retries wiped it
  const c0 = makeContract('store', 6, 12, 1, { callback: 'paradox', existing: DOORS, need: ['surge'], tech: techFor('core'), event: 'sales' });
  const c = await generateSolved(c0, techFor('core'), ['r4,r4']);
  assert.ok(c.twists.includes('surge'), `twists ${c.twists}`);
  assert.notEqual(c.goals.laps, null);
});
