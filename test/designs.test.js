import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContract, designCost } from '../src/game/contracts.js';
import { newDesign, cloneDesign } from '../src/game/designs.js';

const ARENA = ['queue', 'escalator', 'bottleneck'];

test('editing a chained level leaves the setup already there alone, and the changes cost money', () => {
  const c = makeContract('arena', 7, 3, 5, { stage: 'chain', chain: ARENA, tech: { barriers: 1, pillars: 1, stewarding: 1, escalators: 1 } });
  const before = JSON.stringify(c.existing);
  const d = newDesign(c);
  assert.equal(designCost(d, c.existing), 0, 'an untouched setup costs nothing');
  d.parts[0].desks += 4;
  d.parts[2].openings += 1;
  assert.equal(JSON.stringify(c.existing), before, 'the existing setup is unchanged');
  assert.ok(designCost(d, c.existing) > 0, 'four more desks and an opening are not free');
  assert.equal(designCost(d, c.existing), designCost(d, undefined) - designCost(c.existing, undefined), 'you pay for exactly what you add');
});

test('a reset copy is independent of the design being edited', () => {
  const c = makeContract('arena', 7, 3, 6, { stage: 'chain', chain: ARENA, tech: {} });
  const d = newDesign(c), start = cloneDesign(d);
  d.parts[1].count += 1;
  assert.notEqual(start.parts[1].count, d.parts[1].count);
});

test('a callback starts from the doors already fitted, without sharing them', () => {
  const existing = [{ type: 'revolve', wings: 4, mouth: 45, core: 0.15, rpm: 6.5, flow: 'both' }, { type: 'wall' }];
  const d = newDesign({ existing, slots: 2 });
  d[0].core = 0.35; d[1] = { type: 'swing', flow: 'in' };
  assert.equal(existing[0].core, 0.15);
  assert.equal(existing[1].type, 'wall');
  assert.deepEqual(newDesign({ slots: 3 }).map(s => s.type), ['wall', 'wall', 'wall'], 'a first visit starts as a bare frontage');
});
