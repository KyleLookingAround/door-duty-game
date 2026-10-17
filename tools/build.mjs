#!/usr/bin/env node
// Build the game into one self-contained page: dist/index.html.
//
// No dependencies. The source is plain ES modules; this script stitches them into a single scope in
// dependency order, dropping import/export syntax. That works because of two house rules, which it checks:
//   1. every top-level name is unique across the whole program (so modules can share one scope), and
//   2. imports are one line each, by name (`import { a, b } from './x.js'`) or default (`import x from './x.js'`), never renamed.
// Two bundles go into the page: the app, and the "core" (engine + contracts) that the survey worker runs.
import { readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => relative(ROOT, p);

function bundle(entry) {
  const order = [], seen = new Set();
  const visit = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^import\s+[^;]*?from\s+['"](.+?)['"];?\s*$/gm)) visit(resolve(dirname(file), m[1]));
    order.push(file);
  };
  visit(resolve(ROOT, entry));
  const owners = new Map(), errors = [];
  const id = file => '__' + rel(file).replace(/[^a-zA-Z0-9]/g, '_');
  const parts = order.map(file => {
    let src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    const out = [];
    for (const line of lines) {
      let m;
      if ((m = line.match(/^import\s+(\w+)\s+from\s+['"](.+?)['"];?\s*$/))) { out.push(`const ${m[1]} = ${id(resolve(dirname(file), m[2]))};`); continue; }
      if (/^import\s/.test(line)) { if (/\sas\s/.test(line)) errors.push(`${rel(file)}: renamed import (not allowed): ${line.trim()}`); continue; }
      if (/^export\s*\{[^}]*\}\s*;?\s*$/.test(line)) continue;                       // re-export list
      if (/^export default /.test(line)) { out.push(line.replace(/^export default /, `const ${id(file)} = `)); continue; }
      out.push(line.replace(/^export (?=(const|let|var|function|async function|class)\b)/, ''));
    }
    const body = out.join('\n');
    // house rule 1: top-level names are unique across the program
    const names = [];
    for (const m of body.matchAll(/^(?:function|async function|class)\s+([\w$]+)/gm)) names.push(m[1]);
    // const a = 1, b = 2: every name in the statement, not just the first
    for (const m of body.matchAll(/^(?:const|let|var)\s+([^;\n]*)/gm)) {
      let depth = 0, part = '';
      for (const ch of m[1] + ',') {
        if ('([{'.includes(ch)) depth++;
        if (')]}'.includes(ch)) depth--;
        if (ch === ',' && depth === 0) { const n = part.trim().match(/^([\w$]+)\s*(=|$)/); if (n) names.push(n[1]); part = ''; } else part += ch;
      }
    }
    for (const name of names) {
      if (owners.has(name) && owners.get(name) !== rel(file)) errors.push(`duplicate top-level name "${name}" in ${rel(file)} and ${owners.get(name)}`);
      owners.set(name, rel(file));
    }
    return `// ---- ${rel(file)} ----\n${body}`;
  });
  if (errors.length) throw new Error('build failed:\n  ' + errors.join('\n  '));
  return `(() => {\n'use strict';\n${parts.join('\n')}\n})();\n`;
}

export function build() {
  const app = bundle('src/ui/main.js');
  const core = bundle('src/worker.js');
  const shell = readFileSync(resolve(ROOT, 'src/shell.html'), 'utf8');
  // GitHub Pages serves the page as-is: without these a phone renders it as a shrunken desktop page
  if (!/^<!doctype html>/i.test(shell) || !/<meta name="viewport"/.test(shell)) throw new Error('build failed: src/shell.html needs <!doctype html> and a viewport meta tag');
  const html = shell
    .replace('<!--CORE-->', () => `<script id="core" type="text/plain">\n${core.replace(/<\/script/g, '<\\/script')}</script>`)
    .replace('<!--APP-->', () => `<script>\n${app.replace(/<\/script/g, '<\\/script')}</script>`)
    .replace(/<script type="module" src="[^"]*"><\/script>\s*/g, '');   // the dev-mode loader
  mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
  writeFileSync(resolve(ROOT, 'dist/index.html'), html);
  return html.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const run = () => { try { console.log(`built dist/index.html (${(build() / 1024).toFixed(0)} KB)`); } catch (e) { console.error(e.message); if (!process.argv.includes('--watch')) process.exit(1); } };
  run();
  if (process.argv.includes('--watch')) { let t; watch(resolve(ROOT, 'src'), { recursive: true }, () => { clearTimeout(t); t = setTimeout(run, 100); }); console.log('watching src/ …'); }
}
