#!/usr/bin/env node
// Re-record the surveyor golden file after a deliberate rules change. Keeps the same case list,
// surveys each one with the current code and writes the results. Review the diff before committing:
// every changed line is a job that now plays differently.
// usage: node tools/record-golden.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { survey } from '../test/golden-case.js';

const FILE = new URL('../test/fixtures/surveyor-golden.json', import.meta.url);
const old = JSON.parse(readFileSync(FILE));
const out = [];
for (const [i, g] of old.entries()) {
  out.push({ case: g.case, ...(await survey(g.case)) });
  process.stdout.write(`\r${i + 1}/${old.length}`);
}
writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
console.log(`\nwrote ${out.length} cases`);
