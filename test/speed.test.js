// Survey times (layer 6, test:full only): the player waits on these, and lesson checks add survey runs.
// Budgets are for Node on one core; a phone is slower, and the worker hides some of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContract, generateSolved } from '../src/game/contracts.js';
import { TECHS } from './golden-case.js';

// run on its own after the rest of test:full (SPEED=1): timings mean nothing while other tests share the cores
const full = process.env.SPEED === '1';
const REV = { type: 'revolve', wings: 4, mouth: 45, core: 0.15, rpm: 6.5, flow: 'both' };
const time = async (c, tech) => { const t0 = Date.now(); await generateSolved(c, tech, []); return (Date.now() - t0) / 1000; };

test('surveys finish within their budgets', { skip: !full && 'SPEED=1 only (the end of test:full)', timeout: 5 * 60 * 1000 }, async () => {
  const rows = [
    ['a door tender', 8, () => time(makeContract('hotel', 3, 10, 11, { tech: TECHS.mid }), TECHS.mid)],
    ['a research call with its lesson', 40, () => time(makeContract('office', 4, 11, 21, { callback: 'paradox', existing: [REV, { type: 'wall' }, { type: 'wall' }], need: ['surge'], lesson: 'core', tech: TECHS.mid }), TECHS.mid)],
    ['a station escalator job', 15, () => time(makeContract('station', 3, 3, 5, { stage: 'escalator', tech: TECHS.inside, extra: ['evening'] }), TECHS.inside)],
    ['the Arena chain', 60, () => time(makeContract('arena', 3, 3, 4107, { stage: 'chain', chain: ['queue', 'escalator', 'bottleneck'], tech: TECHS.inside }), TECHS.inside)],
    ['the Stadium chain (turnstiles on the door physics)', 60, () => time(makeContract('stadium', 3, 3, 4109, { stage: 'chain', chain: ['doors', 'queue', 'bottleneck'], tech: TECHS.stadium }), TECHS.stadium)],
    ['Skyport departures (doors, check-in, security)', 60, () => time(makeContract('skyport', 3, 3, 4112, { stage: 'chain', chain: ['doors', 'queue', 'security'], tech: TECHS.airport }), TECHS.airport)],
  ];
  const over = [];
  for (const [what, budget, run] of rows) {
    const s = await run();
    console.log(`${what}: ${s.toFixed(1)}s (budget ${budget}s)`);
    if (s > budget) over.push(`${what} took ${s.toFixed(1)}s, over its ${budget}s budget`);
  }
  assert.deepEqual(over, []);
});
