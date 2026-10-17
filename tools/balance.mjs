#!/usr/bin/env node
// Balance report: how varied the jobs are and how the game paces, measured with the headless sim.
// Each seed plays the game with the sim's policy (tools/sim.mjs). Its save at the start of each month
// gives the tech and tier a firm has by then, and every everyday client's first visit is surveyed with
// them, to see how many different answers the month's jobs have. Work is spread over worker threads.
//
// usage: node tools/balance.mjs [--quick] [--seeds 1,2,3] [--months 24] [--out file.json] [--compare file.json]
//   --quick    2 seeds, 4 sample months, a 12-month game (about 6 minutes on 4 cores; the full report is about 30)
//   --out      save the report as JSON (test/fixtures/balance-baseline.json is the baseline)
//   --compare  print the report next to a saved one
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';

// the everyday door clients (landmarks and Riverside's inside work are left out)
const KINDS = ['cafe', 'pharmacy', 'bank', 'office', 'hotel', 'library', 'store', 'townhall', 'museum', 'cinema', 'gym', 'clinic'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The answer's shape, ignoring fine settings: R revolving, W swing, L sliding, G gates, plus i/o for one-way.
export function shape(slots) {
  const code = { revolve: 'R', swing: 'W', slider: 'L', gates: 'G' };
  return slots.filter(s => s.type !== 'wall').map(s => code[s.type] + (s.flow && s.flow !== 'both' && s.flow !== 'auto' ? s.flow[0] : '')).sort().join('+') || 'none';
}

// ---- worker: one task at a time ----
async function runTask(t) {
  if (t.type === 'sim') {
    const { simulate } = await import('./sim.mjs');
    const { rep } = await import('../src/game/economy.js');
    // the state at the start of month i: 0 is a fresh firm, i is after month i-1 ended
    const starts = [{ month: 4, jobs: 0, unlocks: {} }];
    const rows = [];
    const { S, tally } = await simulate({
      months: t.months, seed: t.seed,
      onMonth: (S, row) => {
        starts.push({ month: S.month, jobs: S.jobs, unlocks: { ...S.unlocks, doorman: !!(S.unlocks.doorman && S.staff.doorman) } });
        rows.push({ cash: Math.round(row.cash), rep: row.rep, jobs: row.jobs, market: !!S.marketOpen, riverside: !!S.riversideOpen, research: S.research.length });
      },
    });
    return { seed: t.seed, starts, rows, rep: rep(S), parFails: tally.parFails, failed: tally.failed || [], waiting: tally.waiting || 0, quiet: tally.quiet || 0, unlocks: Object.keys(S.unlocks).length };
  }
  if (t.type === 'survey') {
    const { makeContract, generateSolved } = await import('../src/game/contracts.js');
    const out = [];
    for (const kind of KINDS) {
      const seed = 5000 + t.seed * 997 + t.i * 31 + KINDS.indexOf(kind);
      const tier = Math.min(7, Math.floor(t.start.jobs / 3));
      const c0 = makeContract(kind, tier, t.start.month, seed, { first: true, tech: t.start.unlocks });
      const c = await generateSolved(c0, t.start.unlocks, []);
      out.push(c ? { kind, shape: shape(c.par.slots), cost: c.par.cost } : { kind, shape: 'unsurveyable', cost: 0 });
    }
    return { seed: t.seed, i: t.i, out };
  }
}
if (!isMainThread) parentPort.on('message', async t => parentPort.postMessage(await runTask(t)));

// ---- main: one pool of workers for the games and the surveys ----
// The games go first (they're the longest), and each game's surveys join the queue the moment that game
// ends, so no thread sits idle while the last game plays. Results are put back in seed and month order,
// so the report is the same however the work was scheduled.
function runAll(seeds, months, sample, n, onProgress) {
  return new Promise((resolve, reject) => {
    const queue = seeds.map(seed => ({ type: 'sim', seed, months }));
    const sims = [], surveys = [], idle = [];
    let busy = 0;
    const workers = Array.from({ length: n }, () => new Worker(new URL(import.meta.url)));
    const stop = () => workers.forEach(w => w.terminate());
    const dispatch = () => {
      while (queue.length && idle.length) { const w = idle.pop(); w.t = queue.shift(); busy++; w.postMessage(w.t); }
      if (!queue.length && !busy) {
        stop();
        const at = seed => seeds.indexOf(seed);
        resolve({ sims: sims.sort((a, b) => at(a.seed) - at(b.seed)), surveys: surveys.sort((a, b) => at(a.seed) - at(b.seed) || sample.indexOf(a.i) - sample.indexOf(b.i)) });
      }
    };
    for (const w of workers) {
      w.on('message', r => {
        busy--;
        if (w.t.type === 'sim') {
          sims.push(r);
          queue.push(...sample.filter(i => r.starts[i]).map(i => ({ type: 'survey', seed: r.seed, i, start: r.starts[i] })));
        } else surveys.push(r);
        onProgress(sims.length, seeds.length, surveys.length);
        idle.push(w); dispatch();
      });
      w.on('error', e => { stop(); reject(e); });
      idle.push(w);
    }
    dispatch();
  });
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// the spread of a value over seeds, as "lo–hi" (or one number, or – when no seed got there)
const spread = (xs, fmt = x => x) => { const v = xs.filter(x => x != null); if (!v.length) return '–'; const lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? String(fmt(lo)) : `${fmt(lo)}–${fmt(hi)}`; };
const k = n => `£${Math.round(n / 1000)}k`;

export function summarise(sims, surveys, months) {
  // variety: per month of play, over every seed
  const variety = months.filter(i => surveys.some(s => s.i === i)).map(i => {
    const all = surveys.filter(s => s.i === i).flatMap(s => s.out);
    const count = {};
    for (const x of all) count[x.shape] = (count[x.shape] || 0) + 1;
    const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]);
    const month = sims[0].starts[i] ? sims[0].starts[i].month : 4 + i;
    return {
      i, name: MONTH_NAMES[month % 12], jobs: all.length, answers: ranked.length,
      top: ranked[0] ? ranked[0][0] : '–', topShare: all.length ? +(ranked[0][1] / all.length).toFixed(2) : 0,
      revolving: all.length ? +(all.filter(x => x.shape.includes('R')).length / all.length).toFixed(2) : 0,
      ranked: ranked.slice(0, 5),
    };
  });
  // pacing: per seed
  const pacing = sims.map(s => {
    const opened = key => { const j = s.rows.findIndex(r => r[key]); return j < 0 ? null : j + 1; };
    const at = (m, f) => s.rows[m - 1] ? f(s.rows[m - 1]) : null;
    return {
      seed: s.seed, months: s.rows.length, marketAt: opened('market'), riversideAt: opened('riverside'),
      rep4: at(4, r => r.rep), rep12: at(12, r => r.rep), rep24: at(24, r => r.rep),
      cash12: at(12, r => r.cash), cash24: at(24, r => r.cash),
      jobsPerMonth: +(s.rows[s.rows.length - 1].jobs / s.rows.length).toFixed(1),
      idleBenchMonths: s.rows.filter(r => r.research === 0).length,
      quiet: s.quiet, waiting: s.waiting, parFails: s.parFails.length, failedSurveys: s.failed.length,
    };
  });
  return { variety, pacing };
}

export function printReport(rep, base) {
  const line = (label, now, was) => console.log(`  ${label.padEnd(30)} ${String(now).padStart(12)}${base ? `   (baseline ${was})` : ''}`);
  console.log('\nVariety: first visits by month of play (every everyday client, every seed)');
  console.log('  month         jobs  answers  most common       share  revolving');
  for (const v of rep.variety) {
    const b = base && base.variety.find(x => x.i === v.i);
    console.log(`  ${String(v.i + 1).padStart(2)} ${v.name.padEnd(9)} ${String(v.jobs).padStart(5)}  ${String(v.answers).padStart(7)}  ${v.top.padEnd(16)} ${String(Math.round(v.topShare * 100)).padStart(4)}%  ${String(Math.round(v.revolving * 100)).padStart(8)}%${b ? `   (baseline ${Math.round(b.topShare * 100)}% ${b.top}, ${b.answers} answers)` : ''}`);
  }
  console.log('\nPacing (month of play; spread over seeds)');
  const P = rep.pacing, B = base ? base.pacing : null;
  const f = (xs, key, fmt) => spread(xs.map(x => x[key]), fmt);
  line('Market Square opens at month', f(P, 'marketAt'), B && f(B, 'marketAt'));
  line('Riverside opens at month', f(P, 'riversideAt'), B && f(B, 'riversideAt'));
  line('Reputation at month 4', f(P, 'rep4'), B && f(B, 'rep4'));
  line('Reputation at month 12', f(P, 'rep12'), B && f(B, 'rep12'));
  line('Reputation at month 24', f(P, 'rep24'), B && f(B, 'rep24'));
  line('Cash at month 12', f(P, 'cash12', k), B && f(B, 'cash12', k));
  line('Cash at month 24', f(P, 'cash24', k), B && f(B, 'cash24', k));
  line('Jobs a month', f(P, 'jobsPerMonth'), B && f(B, 'jobsPerMonth'));
  line('Months with an idle bench', f(P, 'idleBenchMonths'), B && f(B, 'idleBenchMonths'));
  line('Months with nothing on', f(P, 'quiet'), B && f(B, 'quiet'));
  line('Jobs that waited for the crews', f(P, 'waiting'), B && f(B, 'waiting'));
  line('Par failures', f(P, 'parFails'), B && f(B, 'parFails'));
  line('Surveys that failed', f(P, 'failedSurveys'), B && f(B, 'failedSurveys'));
}

if (isMainThread && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2);
  const opt = name => { const j = args.indexOf(name); return j >= 0 ? args[j + 1] : null; };
  const quick = args.includes('--quick');
  const seeds = opt('--seeds') ? opt('--seeds').split(',').map(Number) : quick ? [1, 2] : [1, 2, 3, 4, 5];
  const months = +(opt('--months') || (quick ? 12 : 24));
  const sample = quick ? [0, 2, 5, 7] : range(0, 11);   // months of play to survey (0 is the first May)
  const n = availableParallelism();
  const t0 = Date.now();

  const { sims, surveys } = await runAll(seeds, months, sample, n, (g, all, sv) => process.stderr.write(`\rgames ${g}/${all} · month surveys ${sv}   `));
  process.stderr.write('\n');

  const report = { when: new Date().toISOString().slice(0, 10), seeds, months, sample, ...summarise(sims, surveys, sample), failed: sims.flatMap(s => s.failed.map(f => ({ game: s.seed, ...f }))) };
  const base = opt('--compare') ? JSON.parse(readFileSync(opt('--compare'))) : null;
  printReport(report, base);
  console.log(`\n${seeds.length} seeds · ${months} months · ${surveys.length * KINDS.length} first visits surveyed · ${((Date.now() - t0) / 1000).toFixed(0)}s on ${n} threads`);
  for (const x of report.failed) console.log(`SURVEY FAILED (game seed ${x.game}): ${x.name} tier ${x.tier} month ${x.month} contract seed ${x.seed}: ${x.error}`);
  if (opt('--out')) { writeFileSync(opt('--out'), JSON.stringify(report, null, 1) + '\n'); console.log(`wrote ${opt('--out')}`); }
  if (report.pacing.some(p => p.parFails)) console.log('PAR FAILURES: the surveyor\'s own design did not pass (npm run sim -- <months> <seed> for details)');
  if (report.pacing.some(p => p.parFails || p.failedSurveys)) process.exit(1);
}
