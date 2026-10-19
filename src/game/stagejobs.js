// Inside jobs: contracts, the surveyor and running a design, for the stages behind the doors.
// The shape mirrors the door jobs (goals, par, budget, fee) so grading, signing off and the month all work alike.
// No DOM, and no imports from contracts.js (it imports this file).
import { STAGES } from '../engine/stages/index.js';
import { makeRng } from '../engine/world.js';
import { EVENTS } from '../content/events.js';
import { BUILDING } from '../content/buildings/index.js';

const STAGE_DT = 1 / 60;

// a new inside job at a client: opts.stage says which; opts.existing is the setup already there
export function makeStageContract(kindKey, tier, month, seed, opts = {}) {
  const st = STAGES[opts.stage], B = BUILDING[kindKey], rng = makeRng(seed * 7919 + 41);
  const c = { kind: kindKey, stage: st.key, tier, month, seed, first: !!opts.first, rules: {}, wind: 0, budgetCap: null, solved: false, slots: 0, opts };
  // the client's hall as it stands: what you fitted last time, or what they had before you came
  c.existing = opts.existing ? JSON.parse(JSON.stringify(opts.existing)) : st.defaults(opts);
  // a client's hall as built: e.g. the bank already has three desks
  const own = k => (B.inside && B.inside[k]) || {};
  if (!opts.existing) { if (c.existing.parts) c.existing.parts = c.existing.parts.map(p => ({ ...p, ...own(p.stage) })); else Object.assign(c.existing, own(st.key)); }
  // levels: the stage's own twists, more of them as the client's tier rises
  // (a client can switch off a stage twist that makes no sense there: null in its tune, as the airport does for paper tickets)
  const off = t => Object.values(B.tune || {}).some(tu => tu.twists && tu.twists[t] === null);
  const stTwists = st.twistsOf ? st.twistsOf(opts, kindKey) : st.twists, pool = Object.keys(stTwists).filter(t => !off(t)), twists = [];
  if (opts.callback && st.callbackTwist && st.callbackTwist[opts.callback]) twists.push(st.callbackTwist[opts.callback]);
  // a paradox callback is about the paradox: at most one extra wrinkle
  const n = opts.callback === 'paradox' ? (tier >= 4 ? 1 : 0) : (tier >= 4 ? 2 : tier >= 1 ? 1 : 0) + (opts.callback ? 1 : 0);
  while (twists.length < n && pool.length) { const t = pool.splice(Math.floor(rng() * pool.length), 1)[0]; if (!twists.includes(t)) twists.push(t); }
  for (const t of opts.extra || []) if (stTwists[t] && !twists.includes(t)) twists.push(t);
  c.twists = opts.plain ? twists.slice(0, opts.callback ? 1 : 0) : twists;
  c.metric = st.metric || 'p90';
  c.tunes = B.tune || {};
  c.tune = c.tunes[st.key];
  st.level(c, rng, tier);
  // footfall from the buildings that feed this one (game/footfall.js)
  const foot = c.first ? 1 : opts.footfall || 1;
  if (foot !== 1) { c.crowd.rate = +(c.crowd.rate * foot).toFixed(3); for (const ph of c.crowd.phases || []) ph.rate = +(ph.rate * foot).toFixed(3); }
  c.arrivals = Math.round((c.crowd.rate || 0) * c.arrive);
  // a callback the current setup copes with gets stronger (see generateSolvedInner)
  const sev = Math.min(3, opts.severity || 0);
  if (sev) {
    if (opts.callback === 'older' || opts.callback === 'safety') c.crowd.mix = { ...c.crowd.mix, elderly: Math.min(0.8, (c.crowd.mix.elderly || 0.2) + 0.15 * sev) };
    else c.crowd.rate = +(c.crowd.rate * (1 + 0.18 * sev)).toFixed(3);
  }
  const ev = !c.first && opts.event ? Object.values(EVENTS).find(e => e.key === opts.event) : null;
  if (ev && ['sales', 'blackfriday', 'xmas', 'marathon'].includes(ev.key)) { c.event = ev.key; c.crowd.rate = +(c.crowd.rate * 1.15).toFixed(3); }
  c.goals = { through: 0, wait: 0, bumps: st.bumps ? st.bumps(c) : 0, minTemp: null, maxTemp: null, access: false, laps: null };
  c.outsideTemp = 18;
  if (opts.callback === 'paradox') c.paradox = true;
  return c;
}

export function newStageSim(contract, design, tech) { return new STAGES[contract.stage].Sim(contract, design, tech || {}); }
export function runStage(contract, design, tech) {
  const s = newStageSim(contract, design, tech), n = Math.round(contract.run / STAGE_DT);
  for (let i = 0; i < n && !s.over(); i++) s.step(STAGE_DT);
  return s.result();
}
export const stageCost = (design, existing) => STAGES[design.stage].cost(design, existing);
export const stageSig = design => STAGES[design.stage].sig(design);
const meets = (g, r) => r.bumps <= g.bumps && r.through >= g.through && r.wait <= g.wait;

// the surveyor for an inside job: try every sensible setup, set targets from the best, price the cheapest pass
export async function solveStage(contract, unlocks, onProgress, yieldStep) {
  const st = STAGES[contract.stage], g = contract.goals;
  let results = [];
  if (st.explore) {
    // a chained level: too many combinations to try them all, so the stage searches step by step
    results = await st.explore(contract, unlocks, async d => { const r = runStage(contract, d, unlocks); if (yieldStep) await yieldStep(contract.job); return r; }, onProgress);
    if (contract.budgetCap != null) results = results.filter(x => x.cost <= contract.budgetCap);
  } else {
    const cands = st.candidates(contract, unlocks).filter(d => contract.budgetCap == null || stageCost(d, contract.existing) <= contract.budgetCap);
    for (let i = 0; i < cands.length; i++) {
      results.push({ slots: cands[i], r: runStage(contract, cands[i], unlocks), cost: stageCost(cands[i], contract.existing) });
      if (onProgress) onProgress((i + 1) / cands.length);
      if (yieldStep) await yieldStep(contract.job);
    }
  }
  let ok = results.filter(x => x.r.bumps <= g.bumps);
  contract.relaxed = false;
  if (!ok.length) { const least = Math.min(...results.map(x => x.r.bumps)); g.bumps = least; ok = results.filter(x => x.r.bumps <= least); }
  const top = Math.max(...ok.map(x => x.r.through));
  g.through = Math.max(3, Math.floor(top * 0.9));
  // the target time comes from a reference set the stage chooses (e.g. setups the client could afford),
  // so the counterintuitive answer is the cheap one that passes, not the only one
  const ref = (st.reference ? st.reference(ok, contract) : ok).filter(x => x.r.through >= g.through);
  const best = Math.min(...(ref.length ? ref : ok).map(x => x.r.wait));
  g.wait = Math.ceil(best * (st.slack || 1.2) + 1);
  // on a callback the setup already there must fall short
  const r0 = runStage(contract, contract.existing, unlocks);
  contract.before = { through: r0.through, bumps: r0.bumps, wait: +r0.wait.toFixed(1) };
  // the hall as it stands must fall short: if it already passes, tighten the time to what spending can buy
  if (meets(g, r0)) {
    // (aiming first at what the client could do without rebuilding: a cheap change beats a new escalator)
    const want = Math.floor(r0.wait * 0.8), refs = st.reference ? st.reference(ok, contract) : ok;
    const can = xs => xs.filter(x => x.cost > 0 && x.r.through >= g.through);
    const cheap = can(refs).filter(x => x.r.wait + 1 < r0.wait);
    if (cheap.length) g.wait = Math.max(3, Math.max(want, Math.ceil(Math.min(...cheap.map(x => x.r.wait)) + 1)));
    else if (can(ok).some(x => x.r.wait <= want)) g.wait = Math.max(3, want);
  }
  let passing = ok.filter(x => meets(g, x.r)).sort((a, b) => a.cost - b.cost);
  if (!passing.length) { contract.relaxed = true; passing = [ok.slice().sort((a, b) => a.r.wait - b.r.wait)[0]]; g.wait = Math.ceil(passing[0].r.wait + 1); }
  const par = meets(g, r0) ? { cost: 0, slots: contract.existing, r: r0 } : passing[0];
  contract.par = { cost: par.cost, slots: par.slots, through: par.r.through, sig: stageSig(par.slots) };
  contract.distinct = new Set(passing.map(x => stageSig(x.slots))).size;
  const parCost = Math.max(par.cost, 2500);
  contract.budget = contract.budgetCap != null ? contract.budgetCap : Math.ceil(parCost * 1.5 / 500) * 500 + 3000;
  contract.margin = Math.ceil((Math.max(3500, par.cost * 0.3) + Math.min(contract.tier, 6) * 900) * (contract.event ? 1.25 : 1) * (contract.paradox ? 1.3 : 1) * (BUILDING[contract.kind].landmark ? 1.5 : 1) / 500) * 500;
  contract.fee = par.cost + contract.margin;
  contract.solved = true;
  return contract;
}

// the rows of a test result, alongside the door jobs' rows
export function stageRows(contract, r) {
  const st = STAGES[contract.stage], g = contract.goals;
  const rows = [
    [st.throughLabel || 'Through', r.through, `≥ ${g.through}`, r.through >= g.through],
    [(contract.tune && contract.tune.waitLabel) || st.waitLabel, r.wait.toFixed(1) + 's', `≤ ${g.wait}s`, r.wait <= g.wait],
  ];
  if (st.bumps) rows.push([st.bumpLabel || 'Bumps', r.bumps, `≤ ${g.bumps}`, r.bumps <= g.bumps]);
  return rows;
}
