// The town day (game/townday.js): the same day every time for a month, its own random stream, and nothing said
// about a client being checked until the surveyor is back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from '../src/game/state.js';
import { landChange } from '../src/game/month.js';
import { townDay, dayClock, DAY_STEPS } from '../src/game/townday.js';

const clone = x => JSON.parse(JSON.stringify(x));
function street(stars, set = {}) {
  const S = freshState(3); S.month = 9;
  for (const p of S.plots) if ((p.street || 'high') === 'high') Object.assign(p, { status: 'fitted', install: [{ type: 'swing' }], tier: 3, stars }, set);
  return S;
}

test('the town day replays exactly and leaves the game\'s random stream alone', () => {
  const S = street(2), rng = S.rng;
  const a = townDay(S, {}), b = townDay(clone(S), {});
  assert.deepEqual(a, b);
  assert.equal(S.rng, rng);
  assert.equal(a.plots.length, 9); assert.equal(a.plots[0].queue.length, DAY_STEPS);
  assert.equal(dayClock(0), '07:00'); assert.equal(dayClock(DAY_STEPS), '20:00');
});

test('better doors keep shorter queues', () => {
  const worst = S => Math.max(...townDay(S, {}).plots.flatMap(o => o.queue));
  assert.ok(worst(street(3)) < worst(street(1)));
  assert.ok(worst(street(1)) < worst(street(2, { broken: true })));
  // a client calling you back about doors that fall short spills over
  const day = townDay(street(2, { status: 'callback', reason: 'busier' }), {});
  assert.ok(day.moments.some(m => m.text.startsWith('A queue spills out of')));
});

test('a street change plays out on the street it landed on, with both endings for the clients checked', () => {
  const S = street(2);
  const checked = landChange(S, { key: 'busstop', month: S.month, street: 'high' });
  const day = townDay(S, { changes: [{ key: 'busstop', checked }] });
  assert.equal(day.street, 'high'); assert.equal(day.change, 'busstop');
  assert.ok(day.moments.some(m => m.change === 'busstop'));
  for (const o of day.plots.filter(x => x.checked)) {
    assert.ok(o.coped && o.short, o.name);
    assert.ok(Math.max(...o.coped) <= Math.max(...o.short.qs));
    assert.ok(!day.moments.some(m => m.i === o.i), 'no word on a checked client before the surveyor is back');
  }
});
