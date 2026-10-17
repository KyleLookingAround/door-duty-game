#!/usr/bin/env node
// Pacing bands (PLAN layer 4): the headless game played in three styles (strong, weak, poor: see simulate in
// sim.mjs), on several seeds, on worker threads. Prints when each street opens for each style, against the
// targets: a strong player moves on after about 6 months, a weak one after about 12, never under 6, and a poor
// one keeps progressing however long it takes. Also jobs a month, cash at month 12, idle benches, quiet spells.
// usage: node tools/pacing.mjs [--quick] [--months 30] [--seeds 1,2,3,4] [--styles strong,weak,poor] [--out file.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';
import { simulate } from './sim.mjs';

if (!isMainThread) {
  const { seed, style, months } = workerData, rows = [];
  const { tally } = await simulate({ months, seed, style, onMonth: (S, row) => rows.push({ ...row, research: S.research.length }) });
  parentPort.postMessage({ seed, style, rows, jobs: tally.jobs, quiet: tally.quiet || 0, fumbled: tally.fumbled || 0, adverts: tally.adverts || 0, parFails: tally.parFails.length });
} else {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const quick = args.includes('--quick');
  const months = +(opt('--months') || (quick ? 18 : 30));
  const seeds = (opt('--seeds') || (quick ? '1,2' : '1,2,3,4')).split(',').map(Number);
  const styles = (opt('--styles') || 'strong,weak,poor').split(',');
  const runs = styles.flatMap(style => seeds.map(seed => ({ seed, style, months })));
  const t0 = Date.now(), out = [];
  await new Promise((resolve, reject) => {
    let next = 0, live = 0;
    const go = () => {
      while (live < availableParallelism() && next < runs.length) {
        const w = new Worker(new URL(import.meta.url), { workerData: runs[next++] }); live++;
        w.on('message', m => { out.push(m); process.stdout.write(`\r${out.length}/${runs.length} games`); });
        w.on('error', reject);
        w.on('exit', () => { live--; if (out.length === runs.length) resolve(); else go(); });
      }
    };
    go();
  });
  process.stdout.write('\n');
  const opened = (rows, k) => { const j = rows.findIndex(r => r[k]); return j < 0 ? null : j + 1; };
  const spread = xs => { const v = xs.filter(x => x != null); if (!v.length) return '–'; const lo = Math.min(...v), hi = Math.max(...v); return (lo === hi ? `${lo}` : `${lo}–${hi}`) + (v.length < xs.length ? ` (${xs.length - v.length} never)` : ''); };
  const report = styles.map(style => {
    const rs = out.filter(r => r.style === style);
    const market = rs.map(r => opened(r.rows, 'market')), river = rs.map(r => opened(r.rows, 'riverside'));
    let worstQuiet = 0;
    for (const r of rs) { let run = 0; for (const row of r.rows) { run = row.calls || row.jobs ? 0 : run + 1; worstQuiet = Math.max(worstQuiet, run); } }
    return {
      style, market, riverside: river, onMarket: rs.map((r, i) => market[i] && river[i] ? river[i] - market[i] : null),
      jobsPerMonth: rs.map(r => +(r.jobs / r.rows.length).toFixed(1)), cash12: rs.map(r => r.rows[11] ? Math.round(r.rows[11].cash / 1000) : null),
      idleBench: rs.map(r => r.rows.filter(x => x.research === 0).length), parFails: rs.reduce((a, r) => a + r.parFails, 0), adverts: rs.map(r => r.adverts),
    };
  });
  console.log(`\nPacing: ${seeds.length} seeds × ${months} months (month of play; targets in brackets)`);
  console.log('  style    Market Square   Riverside   months on Market   jobs/month   cash at 12 (£k)   idle benches');
  const target = { strong: '(about 6)', weak: '(about 12)', poor: '(no limit)' };
  for (const r of report) console.log(`  ${r.style.padEnd(8)} ${spread(r.market).padStart(8)} ${target[r.style].padEnd(11)} ${spread(r.riverside).padStart(9)}   ${spread(r.onMarket).padStart(10)}       ${spread(r.jobsPerMonth).padStart(8)}   ${spread(r.cash12).padStart(12)}      ${spread(r.idleBench).padStart(6)}`);
  console.log(`\n${runs.length} games · ${((Date.now() - t0) / 1000).toFixed(0)}s on ${availableParallelism()} threads`);
  if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify(report, null, 1) + '\n');
  if (report.some(r => r.parFails)) process.exit(1);
}
