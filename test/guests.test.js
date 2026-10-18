// New guests (Phase 4): children racing ahead on a school run. A fast revolving door bumps them; slowing the
// whole door for them costs everyone time; a presence sensor slows it only while a child or an older guest
// rides, so it keeps nearly everyone moving and hurts nobody. Averaged over seeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContract, runHeadless } from '../src/game/contracts.js';
import { TWIST_POOL, TWIST_REQ } from '../src/content/twists.js';

const tech = { mouth: 1, padded: 1, sensor: 1, core: 1 };
const rev = o => ({ type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 5, flow: 'both', ...o });
const frontage = (c, d) => Array.from({ length: c.slots }, (_, i) => i === 0 || i === c.slots - 1 ? rev(d) : { type: 'wall' });

test('school run: a presence sensor beats slowing the door for everyone', () => {
  const sum = { fast: [0, 0], slow: [0, 0], sensor: [0, 0] };
  for (let seed = 1; seed <= 6; seed++) {
    const c = makeContract('hotel', 3, 6, 300 + seed, { tech, extra: ['kids'] });
    assert.ok(c.twists.includes('kids') && c.crowd.mix.kid > 0, `a school run (${c.twists})`);
    for (const [k, d] of [['fast', {}], ['slow', { rpm: 3 }], ['sensor', { sensor: true }]]) { const r = runHeadless(c, frontage(c, d), tech); sum[k][0] += r.bumps; sum[k][1] += r.through; }
  }
  assert.ok(sum.fast[0] > 5 * Math.max(1, sum.sensor[0]), `children get bumped by a fast door: ${sum.fast[0]} against ${sum.sensor[0]}`);
  assert.ok(sum.sensor[1] > sum.slow[1], `the sensor keeps more people moving: ${sum.sensor[1]} against ${sum.slow[1]}`);
});

test('school runs only come to firms with presence sensors', () => {
  assert.ok(TWIST_POOL.includes('kids'));
  assert.ok(!TWIST_REQ.kids({}) && TWIST_REQ.kids({ sensor: 1 }));
});

// Tourists (Phase 4): a tour group rides the revolving door round once each for the photo, holding up a
// compartment. A doorman sees them off; a faster door only spins them round faster.
test('tour group: a doorman wins back what the tourists cost; a faster door doesn\'t', () => {
  const t = { doorman: 1 }, two = (c, d) => Array.from({ length: c.slots }, (_, i) => i < 2 ? rev(d) : { type: 'wall' });
  const sum = { plain: 0, tour: 0, doorman: 0, fast: 0 };
  for (let seed = 1; seed <= 6; seed++) {
    // the same day with and without the tour group
    const tc = makeContract('hotel', 3, 6, 900 + seed, { tech: t, extra: ['tourists'] }), c = structuredClone(tc);
    assert.ok(tc.crowd.mix.tourist > 0, 'a tour group');
    c.crowd.mix.tourist = 0;
    sum.plain += runHeadless(c, two(c, {}), t).through;
    sum.tour += runHeadless(tc, two(tc, {}), t).through;
    sum.doorman += runHeadless(tc, two(tc, { doorman: true }), t).through;
    sum.fast += runHeadless(tc, two(tc, { rpm: 5.5 }), t).through;
  }
  assert.ok(sum.tour < sum.plain * 0.9, `tourists hold the door up: ${sum.tour} against ${sum.plain}`);
  assert.ok(sum.doorman > sum.tour * 1.15, `a doorman sees them off: ${sum.doorman}`);
  assert.ok(sum.fast <= sum.tour * 1.05, `a faster door doesn't help: ${sum.fast}`);
  assert.ok(TWIST_POOL.includes('tourists') && !TWIST_REQ.tourists({}) && TWIST_REQ.tourists({ doorman: 1 }), 'only for firms with door staff');
});
