// A whole firm, played headless for a few months by tools/sim.mjs's policy. Slow (a few minutes), so it
// runs with the full suite only: npm run test:full
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/sim.mjs';

test('a seeded firm plays six months: every par design passes, and the same seed replays', { skip: process.env.GOLDEN !== 'full' }, async () => {
  const a = await simulate({ months: 6, seed: 3 });
  assert.deepEqual(a.tally.parFails, []);
  assert.ok(a.tally.jobs >= 4, `did some work (${a.tally.jobs} jobs)`);
  const b = await simulate({ months: 6, seed: 3 });
  assert.deepEqual(b.tally.months, a.tally.months);
});
