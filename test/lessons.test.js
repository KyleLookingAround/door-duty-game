// Research calls teach their research: the par uses it, the client's doors before the call fall short, and no
// design without the research passes (Phase 1, items 3 and 4). One client per call here; every client the call
// can come from, on two seeds, in test:full.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surveyAll } from './golden-case.js';
import { PARADOX_CALLS } from '../src/content/paradoxes.js';
import { LESSON_GOALS } from '../src/content/tech.js';
import { KINDS } from '../src/content/buildings/index.js';

const full = process.env.GOLDEN === 'full';
const REV = { type: 'revolve', wings: 4, mouth: 45, core: 0.15, rpm: 6.5, flow: 'both' };
// what the client has before the call: the kind of door the call is about
const BEFORE = {
  revolve: [REV], open: [{ type: 'swing', flow: 'in' }, { type: 'slider', flow: 'out' }],
  swing: [{ type: 'swing', flow: 'in' }, { type: 'swing', flow: 'out' }], twoWay: [{ type: 'swing', flow: 'both' }], slider: [{ type: 'slider', flow: 'both' }],
};
const kindOf = key => ['curtain', 'vestibule'].includes(key) ? 'open' : ['closer', 'autoswing'].includes(key) ? 'swing' : key === 'barriers' ? 'twoWay' : key === 'telescopic' ? 'slider' : key === 'pillars' ? 'open' : 'revolve';
const fitTo = (doors, n) => Array.from({ length: n }, (_, i) => ({ ...(doors[i] || { type: 'wall' }) }));

const cases = [];
for (const [key, defs] of Object.entries(PARADOX_CALLS)) {
  if (!LESSON_GOALS[key]) continue;
  for (const def of defs) {
    if (def.stage || def.chain) continue;
    for (const k of full ? def.kinds : def.kinds.slice(0, 1)) for (const seed of full ? [21, 22] : [21]) {
      cases.push({ check: 'lesson', k, lesson: key, need: def.twist, month: seed % 2 ? 11 : 6, seed, existing: fitTo(BEFORE[kindOf(key)], KINDS[k].slots) });
    }
  }
}

test(`every research call teaches its research (${cases.length} calls)`, { timeout: 30 * 60 * 1000 }, async () => {
  const results = await surveyAll(cases);
  const bad = [], relaxed = [];
  for (const [i, r] of results.entries()) {
    const cs = cases[i], what = `${cs.lesson} call at ${cs.k} (seed ${cs.seed}, twists ${r.twists})`;
    // a call no fair lesson could be made for falls back to an ordinary job (see PLAN, Phase 1 status)
    if (r.relaxed) { relaxed.push(what); continue; }
    if (!r.parUses) bad.push(`${what}: the par (${r.par}) doesn't use the research`);
    if (r.existingPasses) bad.push(`${what}: the doors they already have pass`);
    if (r.passWithout.length) bad.push(`${what}: passes without the research: ${r.passWithout.join(', ')}`);
  }
  if (relaxed.length) console.log(`no fair lesson for ${relaxed.length} of ${cases.length}:\n  ${relaxed.join('\n  ')}`);
  assert.ok(relaxed.length <= cases.length / 3, `too many calls without a lesson: ${relaxed.length} of ${cases.length}`);
  assert.deepEqual(bad, []);
});
