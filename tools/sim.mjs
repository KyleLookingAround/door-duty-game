#!/usr/bin/env node
// Headless full-game simulator: a simple policy plays a seeded firm month by month with no browser.
// It uses the same game modules as the page, so it checks that a whole game holds together:
// every surveyed job is passable with the surveyor's own par design, money and reputation move
// sensibly, and nothing throws. Same seed, same game.
//
// usage: node tools/sim.mjs [months=24] [seed=1] [--quiet]
import { freshState } from '../src/game/state.js';
import { falseAlarm, refreshPlots, settleCheck } from '../src/game/plots.js';
import { generateSolved, runHeadless, designSig } from '../src/game/contracts.js';
import { advertise, grade, signOff, service, hire, movePremises } from '../src/game/jobs.js';
import { startResearch, canResearch, benchesFilled, instalment } from '../src/game/research.js';
import { endMonth } from '../src/game/month.js';
import { advertCost, streetGate, rep, prem, techOf, feeOf, charge, serviceCost, plotNeeds, jobsLeft, jobsPerMonth } from '../src/game/economy.js';
import { TECH } from '../src/content/tech.js';
import { PREMISES, STAFF } from '../src/content/company.js';
import { MONTHS } from '../src/game/contracts.js';

// onMonth(S, row) is called after each month ends, with the save as it stands for the next one.
// A door answer's shape, ignoring fine settings: R revolving, W swing, L sliding, G gates, plus i/o for one-way.
export function shape(slots) {
  const code = { revolve: 'R', swing: 'W', slider: 'L', gates: 'G' };
  return slots.filter(s => s.type !== 'wall').map(s => code[s.type] + (s.flow && s.flow !== 'both' && s.flow !== 'auto' ? s.flow[0] : '')).sort().join('+') || 'none';
}

// The answers a lazy player tries first, without reading the brief: one sliding door, a pair of one-way swing
// doors, or on the Galleria, closing the bridge. A job one of these passes isn't much of a puzzle.
export function lazyDesigns(c) {
  if (c.stage) return c.stage === 'braess' ? [{ ...c.existing, bridge: 'closed' }] : [];
  const walls = () => Array.from({ length: c.slots }, () => ({ type: 'wall' }));
  const one = walls(); one[0] = { type: 'slider', flow: 'both' };
  const out = [one];
  if (c.slots >= 2) { const two = walls(); two[0] = { type: 'swing', flow: 'in' }; two[c.slots - 1] = { type: 'swing', flow: 'out' }; out.push(two); }
  return out;
}

// style: how well the firm plays (the pacing bands, npm run pacing):
//   strong: the surveyor's par design (2-3★), and research the street's clients want first
//   weak:   gets every job through but only just (1★), and researches the cheapest thing going
//   poor:   turns down or fumbles a third of its jobs (1★ on the rest), and researches at random
export async function simulate({ months = 24, seed = 1, style = 'strong', log = () => {}, onMonth = () => {} } = {}) {
  const S = freshState(seed);
  const pick = () => { S.simRng = ((S.simRng || seed * 2654435761) * 1103515245 + 12345) >>> 0; return S.simRng / 4294967296; };   // the policy's own dice, apart from the game's
  const tally = { jobs: 0, parFails: [], falseAlarms: 0, unsurveyable: 0, skipped: 0, months: [] };
  for (let m = 0; m < months; m++) {
    refreshPlots(S);
    // the work on the table, in the order a sensible firm takes it: street-change checks first (they aren't
    // jobs), then callbacks (they pay nothing until fixed), research calls, then tenders. The crews can only
    // sign off so many jobs a month (jobsPerMonth); what doesn't fit waits for next month. Each job is done
    // with the surveyor's par design.
    const rank = p => p.status === 'checking' ? 0 : p.status === 'callback' && p.reason !== 'paradox' ? 1 : p.status === 'callback' ? 2 : 3;
    const work = S.plots.filter(p => (p.status === 'open' || p.status === 'callback' || p.status === 'checking') && p.contract).sort((a, b) => rank(a) - rank(b) || a.i - b.i);
    for (const p of work) {
      if (p.status !== 'checking' && !jobsLeft(S)) { tally.waiting = (tally.waiting || 0) + 1; continue; }
      let c = p.contract;
      if (!c.solved) {
        // a survey that can't produce a fair job (or throws): the page draws a fresh tender, and so does this
        const job = { name: p.name, kind: c.kind, tier: c.tier, month: c.month, seed: c.seed, opts: c.opts };
        try { c = await generateSolved(c, techOf(S), S.recent || []); } catch (err) { c = null; tally.failed = [...(tally.failed || []), { ...job, error: String(err && err.message || err) }]; }
        if (!c) { p.contract = null; tally.unsurveyable++; continue; }
        if (p.status === 'checking') { if (settleCheck(S, p, c) === 'coped') { tally.coped = (tally.coped || 0) + 1; continue; } tally.calls = (tally.calls || 0) + 1; }
        else if (p.status === 'callback' && c.existing && c.par.cost === 0) { falseAlarm(S, p); tally.falseAlarms++; continue; }
        if (p.status === 'callback' && p.reason !== 'paradox' && c.opts && c.opts.callback) p.reason = c.opts.callback;
        p.contract = c;
      }
      if (feeOf(S, c) - charge(S, c.par.cost) < 0) { tally.skipped++; continue; }   // the page lets you take a job whatever your cash: the fee covers the hardware
      if (!jobsLeft(S)) { tally.waiting = (tally.waiting || 0) + 1; continue; }   // a check that became a callback, with the crews booked up
      if (style === 'poor' && pick() < 0.33) { tally.fumbled = (tally.fumbled || 0) + 1; continue; }   // turned down, or failed the test
      const r = runHeadless(c, c.par.slots, techOf(S));
      const g = grade(S, c, c.par.slots, r);
      if (style !== 'strong') g.stars = Math.min(g.stars, 1);
      if (!g.pass) { tally.parFails.push(`${MONTHS[S.month % 12]} ${S.year} ${p.name}: ${g.hint}`); continue; }
      if (lazyDesigns(c).some(d => grade(S, c, d, runHeadless(c, d, techOf(S))).pass)) tally.lazy = (tally.lazy || 0) + 1;   // a lazy answer would have done
      if ((S.recent || []).includes(designSig(c.par.slots))) tally.repeats = (tally.repeats || 0) + 1;   // the same answer as a recent job
      if (Array.isArray(c.par.slots)) (tally.played = tally.played || []).push({ m: S.month, shape: shape(c.par.slots) });
      signOff(S, p, c, c.par.slots, g.stars, r);
      tally.jobs++;
      if (c.stage) { tally.inside = tally.inside || {}; const k = c.chain ? 'chain:' + c.chain.join('+') : c.stage; tally.inside[k] = (tally.inside[k] || 0) + 1; }
    }
    // run the firm: fix what's broken, research what clients are waiting on, grow when there's money
    for (const p of S.plots) if (p.broken && S.cash > serviceCost(p) + 5000) service(S, p);
    // wanted: what clients are waiting for, what locked clients need, and what the next street's gate asks for
    const gk = ['market', 'riverside'].find(k => !S[k + 'Open']), gate = gk && streetGate(S, gk);
    const wanted = [...S.plots.filter(p => p.enquiry && !p.enquiry.ready).map(p => p.enquiry.tech), ...S.plots.filter(p => p.status === 'locked').flatMap(p => plotNeeds(p)), ...(gate ? gate.list : [])].filter(k => !S.unlocks[k]);
    // research never stops: keep every bench busy and one project queued, wanted research first, then the
    // cheapest; pay-as-you-go, so only take on what the month's instalments allow (otherwise a market study)
    const order = style === 'poor' ? [...TECH].sort(() => pick() - 0.5) : style === 'weak' ? [...TECH].sort((a, b) => a.price - b.price)
      : [...TECH].sort((a, b) => (wanted.includes(b.key) - wanted.includes(a.key)) || a.price - b.price);
    for (const t of order) {
      if (!canResearch(S, t) || S.cash < instalment(t, S) * 2 + 10000 || (S.queue || []).length >= 1) continue;
      startResearch(S, t.key);
    }
    // a quiet month: a strong firm advertises for work
    if (style === 'strong' && !S.plots.some(p => ['open', 'callback', 'checking'].includes(p.status)) && S.cash > advertCost(S) + 30000 && advertise(S)) tally.adverts = (tally.adverts || 0) + 1;
    const next = PREMISES[(S.premises || 0) + 1];
    if (next && S.cash > next.price + 40000) movePremises(S, (S.premises || 0) + 1);
    for (const s of STAFF) {
      const hired = STAFF.filter(x => S.staff[x.key]).length;
      if (!S.staff[s.key] && hired < prem(S).staff && (!s.req || S.unlocks[s.req]) && S.cash > s.wage * 12 + 20000) hire(S, s.key);
    }
    const label = `${MONTHS[S.month % 12]} ${S.year}`;
    if (!benchesFilled(S)) tally.idleBench = (tally.idleBench || 0) + 1;   // a market study fills it at the month end
    if ((S.monthJobs || 0) > jobsPerMonth(S)) tally.overbooked = (tally.overbooked || 0) + 1;   // never: the crews' limit holds
    const rpt = endMonth(S);
    refreshPlots(S);
    if (!S.plots.some(p => ['open', 'callback', 'checking'].includes(p.status))) tally.quiet = (tally.quiet || 0) + 1;
    tally.asked = (tally.asked || 0) + (rpt.enquiry.fresh ? 1 : 0); tally.won = (tally.won || 0) + rpt.enquiry.won.length; tally.lapsed = (tally.lapsed || 0) + rpt.enquiry.lapsed.length;
    tally.studies = (tally.studies || 0) + rpt.research.studies.length; tally.mastered = Object.keys(S.mastered || {}).length;
    const row = { month: label, cash: S.cash, rep: rep(S), jobs: S.jobs, fitted: S.plots.filter(p => p.status === 'fitted').length, net: rpt.net, calls: rpt.calls.length, market: !!S.marketOpen, riverside: !!S.riversideOpen, standing: { ...(S.standing || {}) }, mastered: Object.keys(S.mastered || {}).length };
    tally.months.push(row);
    onMonth(S, row);
    log(`${row.month.padEnd(9)} cash ${String(Math.round(row.cash)).padStart(8)}  rep ${String(row.rep).padStart(3)}★  jobs ${String(row.jobs).padStart(3)}  fitted ${String(row.fitted).padStart(2)}  net ${String(row.net).padStart(7)}  callbacks ${row.calls}`);
  }
  return { S, tally };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const nums = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
  const quiet = process.argv.includes('--quiet');
  const t0 = Date.now();
  const style = (process.argv.find(a => a.startsWith('--style=')) || '--style=strong').slice(8);
  const { S, tally } = await simulate({ months: nums[0] || 24, seed: nums[1] || 1, style, log: quiet ? () => {} : console.log });
  console.log(`\ninside jobs: ${JSON.stringify(tally.inside || {})}`);
  console.log(`jobs that waited for the crews: ${tally.waiting || 0} · jobs that repeated a recent answer: ${tally.repeats || 0} of ${tally.jobs} · a lazy answer passed ${tally.lazy || 0}`);
  console.log(`research: ${Object.keys(S.unlocks).length} owned, ${tally.mastered || 0} mastered, ${tally.studies || 0} market studies`);
  console.log(`enquiries: ${tally.asked || 0} asked · ${tally.won || 0} ready in time · ${tally.lapsed || 0} lapsed · ${tally.quiet || 0} months with nothing on the table`);
  for (const f of tally.failed || []) console.log(`SURVEY FAILED: ${f.name} (${f.kind}) tier ${f.tier} month ${f.month} seed ${f.seed}: ${f.error} ${JSON.stringify(f.opts)}`);
  console.log(`\n${tally.jobs} jobs · rep ${rep(S)}★ · cash ${Math.round(S.cash)} · ${tally.coped || 0} clients coped with street changes · ${tally.calls || 0} called back · ${tally.falseAlarms} false alarms · ${tally.unsurveyable} unsurveyable · ${tally.skipped} skipped · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (tally.parFails.length) console.log('PAR FAILURES (the surveyor\'s own design did not pass):\n  ' + tally.parFails.join('\n  '));
  if (tally.parFails.length || (tally.failed || []).length) process.exit(1);
}
