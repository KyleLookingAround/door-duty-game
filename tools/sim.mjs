#!/usr/bin/env node
// Headless full-game simulator: a simple policy plays a seeded firm month by month with no browser.
// It uses the same game modules as the page, so it checks that a whole game holds together:
// every surveyed job is passable with the surveyor's own par design, money and reputation move
// sensibly, and nothing throws. Same seed, same game.
//
// usage: node tools/sim.mjs [months=24] [seed=1] [--quiet]
import { freshState } from '../src/game/state.js';
import { refreshPlots, settleCheck } from '../src/game/plots.js';
import { generateSolved, runHeadless } from '../src/game/contracts.js';
import { grade, signOff, startResearch, service, hire, movePremises } from '../src/game/jobs.js';
import { endMonth } from '../src/game/month.js';
import { rep, prem, techOf, feeOf, charge, serviceCost, plotNeeds } from '../src/game/economy.js';
import { TECH } from '../src/content/tech.js';
import { PREMISES, STAFF } from '../src/content/company.js';
import { MONTHS } from '../src/game/contracts.js';

export async function simulate({ months = 24, seed = 1, log = () => {} } = {}) {
  const S = freshState(seed);
  const tally = { jobs: 0, parFails: [], falseAlarms: 0, unsurveyable: 0, skipped: 0, months: [] };
  for (let m = 0; m < months; m++) {
    refreshPlots(S);
    // survey and do every job on the table, using the surveyor's par design
    for (const p of S.plots) {
      if ((p.status !== 'open' && p.status !== 'callback' && p.status !== 'checking') || !p.contract) continue;
      let c = p.contract;
      if (!c.solved) {
        c = await generateSolved(c, techOf(S), S.recent || []);
        if (!c) { p.contract = null; tally.unsurveyable++; continue; }
        if (p.status === 'checking') { if (settleCheck(S, p, c) === 'coped') { tally.coped = (tally.coped || 0) + 1; continue; } tally.calls = (tally.calls || 0) + 1; }
        else if (p.status === 'callback' && c.existing && c.par.cost === 0) { p.status = 'fitted'; p.contract = null; p.reason = null; tally.falseAlarms++; continue; }
        if (p.status === 'callback' && p.reason !== 'paradox' && c.opts && c.opts.callback) p.reason = c.opts.callback;
        p.contract = c;
      }
      if (feeOf(S, c) - charge(S, c.par.cost) < 0 || S.cash < charge(S, c.par.cost)) { tally.skipped++; continue; }
      const r = runHeadless(c, c.par.slots, techOf(S));
      const g = grade(S, c, c.par.slots, r);
      if (!g.pass) { tally.parFails.push(`${MONTHS[S.month % 12]} ${S.year} ${p.name}: ${g.hint}`); continue; }
      signOff(S, p, c, c.par.slots, g.stars, r);
      tally.jobs++;
      if (c.stage) { tally.inside = tally.inside || {}; const k = c.chain ? 'chain:' + c.chain.join('+') : c.stage; tally.inside[k] = (tally.inside[k] || 0) + 1; }
    }
    // run the firm: fix what's broken, research what clients are waiting on, grow when there's money
    for (const p of S.plots) if (p.broken && S.cash > serviceCost(p) + 5000) service(S, p);
    const wanted = [...S.plots.filter(p => p.enquiry && !p.enquiry.ready).map(p => p.enquiry.tech), ...S.plots.filter(p => p.status === 'locked').flatMap(p => plotNeeds(p))].filter(k => !S.unlocks[k]);
    const order = [...TECH].sort((a, b) => (wanted.includes(b.key) - wanted.includes(a.key)) || a.price - b.price);
    for (const t of order) {
      if (S.cash < t.price + 15000 || t.tier > prem(S).tier || (t.req || []).some(k => !S.unlocks[k])) continue;
      startResearch(S, t.key);
    }
    const next = PREMISES[(S.premises || 0) + 1];
    if (next && S.cash > next.price + 40000) movePremises(S, (S.premises || 0) + 1);
    for (const s of STAFF) {
      const hired = STAFF.filter(x => S.staff[x.key]).length;
      if (!S.staff[s.key] && hired < prem(S).staff && (!s.req || S.unlocks[s.req]) && S.cash > s.wage * 12 + 20000) hire(S, s.key);
    }
    const label = `${MONTHS[S.month % 12]} ${S.year}`;
    const rpt = endMonth(S);
    refreshPlots(S);
    if (!S.plots.some(p => ['open', 'callback', 'checking'].includes(p.status))) tally.quiet = (tally.quiet || 0) + 1;
    tally.asked = (tally.asked || 0) + (rpt.enquiry.fresh ? 1 : 0); tally.won = (tally.won || 0) + rpt.enquiry.won.length; tally.lapsed = (tally.lapsed || 0) + rpt.enquiry.lapsed.length;
    const row = { month: label, cash: S.cash, rep: rep(S), jobs: S.jobs, fitted: S.plots.filter(p => p.status === 'fitted').length, net: rpt.net, calls: rpt.calls.length };
    tally.months.push(row);
    log(`${row.month.padEnd(9)} cash ${String(Math.round(row.cash)).padStart(8)}  rep ${String(row.rep).padStart(3)}★  jobs ${String(row.jobs).padStart(3)}  fitted ${String(row.fitted).padStart(2)}  net ${String(row.net).padStart(7)}  callbacks ${row.calls}`);
  }
  return { S, tally };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const nums = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
  const quiet = process.argv.includes('--quiet');
  const t0 = Date.now();
  const { S, tally } = await simulate({ months: nums[0] || 24, seed: nums[1] || 1, log: quiet ? () => {} : console.log });
  console.log(`\ninside jobs: ${JSON.stringify(tally.inside || {})}`);
  console.log(`enquiries: ${tally.asked || 0} asked · ${tally.won || 0} ready in time · ${tally.lapsed || 0} lapsed · ${tally.quiet || 0} months with nothing on the table`);
  console.log(`\n${tally.jobs} jobs · rep ${rep(S)}★ · cash ${Math.round(S.cash)} · ${tally.coped || 0} clients coped with street changes · ${tally.calls || 0} called back · ${tally.falseAlarms} false alarms · ${tally.unsurveyable} unsurveyable · ${tally.skipped} skipped · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (tally.parFails.length) { console.log('PAR FAILURES (the surveyor\'s own design did not pass):\n  ' + tally.parFails.join('\n  ')); process.exit(1); }
}
