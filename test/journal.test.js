// The paradox journal and the local paper (Phase 4): every research that can be mastered has a journal entry,
// the journal fills as techs are mastered, and the month report's headline tells the month's biggest story.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState } from '../src/game/state.js';
import { signOff } from '../src/game/jobs.js';
import { endMonth } from '../src/game/month.js';
import { headline, journal } from '../src/game/briefs.js';
import { needsMastery } from '../src/game/economy.js';
import { TECH } from '../src/content/tech.js';
import { JOURNAL, HEADLINES } from '../src/content/journal.js';

const BROKEN = /undefined|NaN|\[object/;

test('every research that can be mastered has a journal entry, and every entry is a tech', () => {
  for (const t of TECH) if (needsMastery(t.key)) assert.ok(JOURNAL[t.key], `${t.key} has a journal entry`);
  for (const k of Object.keys(JOURNAL)) assert.ok(TECH.some(t => t.key === k), `${k} is a tech`);
});

test('mastering a tech writes the journal and makes the headline', () => {
  const S = freshState(1); S.unlocks.core = true; S.unlocks.mouth = true;
  assert.deepEqual(journal(S), []);
  const p = S.plots.find(x => x.kind === 'office');
  p.status = 'callback'; p.reason = 'paradox'; p.callTech = 'core';
  signOff(S, p, { goals: {}, par: { cost: 0 }, fee: 5000, margin: 5000, existing: null, lesson: 'core' }, [{ type: 'wall' }], 2, { bumps: 0 });
  assert.equal(journal(S)[0].key, 'core');
  const h = headline(S, endMonth(S));
  assert.match(h.head, /big-core|slow hub/i);
  assert.doesNotMatch(h.head + h.text, BROKEN);
  assert.equal(headline(S, endMonth(S)), null, 'news is only news once: a quiet month has no headline');
});

test('every headline reads properly for every month', () => {
  const n = { name: 'Lark Café', what: 'Big-core drums', lesson: 'The slow hub', rival: 'Brassworks Ltd' };
  for (const hs of Object.values(HEADLINES)) for (const h of hs) { const t = h(n); assert.doesNotMatch(t, BROKEN); assert.ok(t.length < 80, t); }
});
