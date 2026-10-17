// The surveyor must keep producing the same jobs for the same seeds: this pins the engine and the
// contract generator. The fixture was recorded from the prototype. A full run surveys 69 jobs
// (a few minutes on every core); by default a spread of them is checked. GOLDEN=full checks all.
// If you change game rules on purpose, re-record with: node tools/record-golden.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { surveyAll } from './golden-case.js';

const GOLDEN = JSON.parse(readFileSync(new URL('./fixtures/surveyor-golden.json', import.meta.url)));
const cases = process.env.GOLDEN === 'full' ? GOLDEN : GOLDEN.filter((_, i) => i % 7 === 0);
// every case is surveyed at once on worker threads; each test then waits for its own result
const results = surveyAll(cases.map(g => g.case));
results.catch(() => {});   // a failure is reported by the tests below, not as an unhandled rejection
cases.forEach((g, i) => {
  const cs = g.case;
  test(`surveyor: ${cs.k} ${cs.first ? 'first visit' : cs.tn + ' tech'}${cs.ev ? ' · ' + cs.ev : ''}${cs.cb ? ' · callback ' + cs.cb : ''}`, async () => {
    const { case: _, ...want } = g;
    assert.deepEqual(JSON.parse(JSON.stringify((await results)[i])), want);
  });
});
