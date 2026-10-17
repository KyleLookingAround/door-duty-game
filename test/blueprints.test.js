// The blueprint book (Phase 4): needs the Design office; saves by shape, not by client; the same design isn't
// saved twice; a saved design is a deep copy; hardware the firm can't fit is named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, migrate } from '../src/game/state.js';
import { saveBlueprint, blueprintsFor, blueprintShape, unownedIn, BLUEPRINT_MAX } from '../src/game/designs.js';
import { makeContract } from '../src/game/contracts.js';

const pair = [{ type: 'swing', flow: 'in' }, { type: 'swing', flow: 'out', closer: true }];

test('the blueprint book needs the Design office, and keeps designs by shape', () => {
  const S = freshState(1), cafe = makeContract('cafe', 1, 5, 3, {}), pharmacy = makeContract('pharmacy', 1, 5, 4, {});
  assert.equal(saveBlueprint(S, cafe, pair, 'Café'), null, 'not without the research');
  S.unlocks.designoffice = true;
  const bp = saveBlueprint(S, cafe, pair, 'Café');
  pair[0].flow = 'both';
  assert.equal(bp.design[0].flow, 'in', 'a deep copy');
  saveBlueprint(S, cafe, bp.design, 'Café again');
  assert.equal(S.blueprints.length, 1, 'the same design once');
  assert.equal(blueprintsFor(S, pharmacy).length, cafe.slots === pharmacy.slots ? 1 : 0, 'any client with the same number of bays');
  assert.equal(blueprintShape(makeContract('bank', 1, 3, 5, { stage: 'queue' })), 'stage:queue');
  for (let i = 0; i < 20; i++) saveBlueprint(S, cafe, [{ type: 'slider', flow: 'both' }, { type: 'wall', n: i }], `n${i}`);
  assert.equal(S.blueprints.length, BLUEPRINT_MAX);
});

test('a blueprint names hardware the firm can\'t fit', () => {
  assert.deepEqual(unownedIn([{ type: 'swing', closer: true }, { type: 'revolve', core: 0.35, mouth: 40 }], { closer: 1 }), ['core']);
  assert.deepEqual(unownedIn({ stage: 'queue' }, {}), []);
});

test('an old save gets an empty blueprint book', () => {
  const S = freshState(2); delete S.blueprints; S.version = 8;
  migrate(S);
  assert.deepEqual(S.blueprints, []);
});
