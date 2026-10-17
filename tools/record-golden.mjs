#!/usr/bin/env node
// Re-record the surveyor golden file after a deliberate rules change. Keeps the same case list,
// surveys each one with the current code and writes the results, then prints which cases changed and how,
// so the re-record can be reviewed rather than waved through: every changed case is a job that now plays
// differently. Paste the summary into the commit message.
// usage: node tools/record-golden.mjs [--dry]   (--dry: print the summary, don't write the file)
import { readFileSync, writeFileSync } from 'node:fs';
import { survey } from '../test/golden-case.js';

const FILE = new URL('../test/fixtures/surveyor-golden.json', import.meta.url);
const dry = process.argv.includes('--dry');
const old = JSON.parse(readFileSync(FILE));
const out = [];
for (const [i, g] of old.entries()) {
  out.push({ case: g.case, ...(await survey(g.case)) });
  process.stdout.write(`\r${i + 1}/${old.length}`);
}
process.stdout.write('\n');

// what changed, case by case: twists, par, cost, goals, fee and budget
const name = cs => [cs.k, cs.first ? 'first visit' : cs.cb ? `callback ${cs.cb}` : 'tender', `tech ${cs.tn}`, `month ${cs.month}`, cs.ev ? cs.ev : '', `seed ${cs.seed}`].filter(Boolean).join(' · ');
const fmt = v => typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
const changed = [];
for (const [i, now] of out.entries()) {
  const was = old[i], diffs = [];
  for (const key of ['twists', 'par', 'cost', 'goals', 'fee', 'budget', 'relaxed', 'slots', 'temp']) {
    if (fmt(was[key]) !== fmt(now[key])) diffs.push(`${key} ${fmt(was[key])} → ${fmt(now[key])}`);
  }
  if (diffs.length) changed.push(`  ${name(now.case)}\n    ${diffs.join('\n    ')}`);
}
console.log(changed.length ? `${changed.length} of ${out.length} cases changed:\n${changed.join('\n')}` : `No case changed (${out.length} cases).`);
if (!dry) { writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n'); console.log(`wrote ${out.length} cases`); }
