// A failed inspection's callback replays the day the inspector saw (PLAN Phase 4, item 6): the same crowd, no
// random twists, no escalation, so the job is about what actually failed. If the doors cope with that day after
// all, the client copes (a false alarm), the same as a street-change check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from '../src/game/state.js';
import { inspect } from '../src/game/month.js';
import { refreshPlots } from '../src/game/plots.js';
import { makeContract, runHeadless, meetsSoft, generateSolved } from '../src/game/contracts.js';

// a fast revolving door with hard wings: an inspector finds it bumping people
const FAST = [{ type: 'wall' }, { type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 9, padded: false, flow: 'both' }, { type: 'wall' }];

test('a failed inspection calls back with the inspector\'s own day, and the doors fail it', async () => {
  let S, p, res;
  for (let seed = 1; seed < 40 && !(res && !res.pass); seed++) {
    S = freshState(seed); S.month = 8;
    p = S.plots.find(q => q.kind === 'office'); p.status = 'fitted'; p.install = FAST; p.stars = 2;
    res = inspect(S, p);
  }
  assert.ok(res && !res.pass, 'found a failing inspection');
  p.status = 'callback'; p.reason = res.access ? 'safety' : 'access'; p.contract = null; p.inspection = res.day;
  refreshPlots(S);
  const c = p.contract, saw = makeContract(p.kind, res.day.tier, res.day.month, res.day.seed, { plain: true, existing: FAST, tech: {} });
  assert.ok(c.opts.inspection);
  assert.deepEqual(c.twists, saw.twists, 'no random twists on top of the inspector\'s day');
  assert.equal(c.crowd.in, saw.crowd.in);
  const s = await generateSolved(c, {}, []);
  assert.ok(!s.opts.severity, 'not made harder');
  assert.ok(!meetsSoft(s, runHeadless(s, FAST, {})), 'the doors as they stand still fail it');
  assert.ok(s.par.cost > 0);
});
