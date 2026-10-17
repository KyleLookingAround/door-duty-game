// Moving premises takes months: you work from the old place until it's done, and research waits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREMISES } from '../src/content/company.js';
import { freshState, migrate } from '../src/game/state.js';
import { jobsPerMonth, prem } from '../src/game/economy.js';
import { movePremises, startResearch } from '../src/game/jobs.js';
import { endMonth } from '../src/game/month.js';
import { canResearch } from '../src/game/enquiries.js';
import { movingText } from '../src/game/briefs.js';
import { TECH } from '../src/content/tech.js';

const rich = seed => { const S = freshState(seed); S.cash = 500000; S.plots[0].stars = 20; return S; };

test('a move takes months, and the firm works from the old premises until it is done', () => {
  assert.deepEqual(PREMISES.map(p => p.moveMonths || 0), [0, 1, 2]);
  const S = rich(1);
  assert.ok(movePremises(S, 1));
  assert.equal(S.premises, 0, 'still in the garage');
  assert.equal(jobsPerMonth(S), 2, 'with the garage\'s crews');
  assert.ok(!movePremises(S, 2), 'one move at a time');
  assert.match(movingText(S), /Moving to the workshop: 1 month to go/);
  const r = endMonth(S);
  assert.equal(r.moved, 'Workshop'); assert.equal(S.premises, 1); assert.equal(S.moving, null);
  assert.equal(jobsPerMonth(S), 3);
  assert.ok(!movePremises(S, 1) && movePremises(S, 2), 'only to the next premises');
  endMonth(S); assert.equal(S.premises, 1, 'headquarters takes two months');
  endMonth(S); assert.equal(prem(S).name, 'Headquarters');
});

test('research waits during a move: nothing advances and nothing new starts', () => {
  const S = rich(2);
  assert.ok(startResearch(S, 'mouth'));
  assert.ok(movePremises(S, 1));
  assert.ok(!startResearch(S, 'curtain'), 'no new research mid-move');
  assert.ok(!TECH.some(t => canResearch(S, t)), 'and enquiries don\'t ask for any');
  endMonth(S);   // the move month: mouth (1 month) doesn't finish
  assert.ok(!S.unlocks.mouth); assert.equal(S.research[0].left, 1, 'progress kept');
  endMonth(S);   // in the workshop: research picks up
  assert.ok(S.unlocks.mouth);
});

test('an old save is not mid-move', () => {
  const S = freshState(3); delete S.moving; S.version = 4;
  migrate(S);
  assert.equal(S.moving, null);
});
