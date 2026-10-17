// The anti-repeat rule: a job whose cheapest answer matches one of the player's last four gets a new wrinkle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeContract, generateSolved, designSig } from '../src/game/contracts.js';
import { freshState, migrate } from '../src/game/state.js';

test('swing and sliding doors have different signatures', () => {
  assert.equal(designSig([{ type: 'swing', flow: 'both' }]), 's');
  assert.equal(designSig([{ type: 'slider', flow: 'both' }]), 'l');
  assert.equal(designSig([{ type: 'swing', flow: 'in' }, { type: 'swing', flow: 'out' }]), 'si,so');
  assert.notEqual(designSig([{ type: 'swing' }]), designSig([{ type: 'slider' }]));
});

test('a first visit gets a new wrinkle when its answer repeats a recent job, and the first summer stays warm', async () => {
  // the café's first visit in June: two one-way swing doors, unless that was just used
  const plain = await generateSolved(makeContract('cafe', 0, 5, 7, { first: true, tech: {} }), {}, []);
  assert.ok(!plain.novelty);
  const again = await generateSolved(makeContract('cafe', 0, 5, 7, { first: true, tech: {} }), {}, [plain.par.sig]);
  assert.ok(again.novelty, 'the surveyor asked for something different');
  assert.ok(again.twists.length > plain.twists.length, `a twist was added: ${again.twists}`);
  assert.ok(!again.twists.includes('cold') && !again.twists.includes('wind'), `no cold or gales in the first summer: ${again.twists}`);
});

test('an old save forgets recent answers written with the old letters', () => {
  const S = freshState(1); S.recent = ['s', 'si,so']; S.version = 5;
  migrate(S);
  assert.deepEqual(S.recent, []);
  const T = freshState(2); T.recent = ['l']; migrate(T);
  assert.deepEqual(T.recent, ['l'], 'a current save keeps them');
});
