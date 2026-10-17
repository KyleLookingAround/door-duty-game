// The end of a month: money in and out, wear, claims, inspections, research, callbacks, the rival, new tenders.
// Pure: mutates the save and returns a report for the screen to show.
import { STAFF } from '../content/company.js';
import { eventOf } from '../content/events.js';
import { PARADOX_CALLS, callFits } from '../content/paradoxes.js';
import { CHANGES, CHANGE } from '../content/changes.js';
import { STREETS } from '../content/town.js';
import { makeContract, runHeadless } from './contracts.js';
import { random, randomInt } from './state.js';
import { settleEnquiries, hasWork } from './enquiries.js';
import { monthlyIncome, prem, insurance, wearRate, rivalActive, stepFreeOk, techOf, tierOf, streetOf, streetOpen } from './economy.js';

export const CLAIM_EXCESS = 1200, INSPECTION_FINE = 2500;

// an inspector re-runs an old install against today's crowd
export function inspect(S, p) {
  const c = makeContract(p.kind, tierOf(S, p), S.month, 1 + randomInt(S, 1e6), { plain: true, existing: p.install, tech: techOf(S) });
  const r = runHeadless(c, p.install, techOf(S));
  const access = ['library', 'townhall', 'station'].includes(p.kind) ? stepFreeOk(p) : true;
  const safe = r.bumps <= c.goals.bumps && r.stops <= 3;
  return { pass: safe && access, safe, access, bumps: r.bumps, limit: c.goals.bumps };
}

// Put a street change on the calendar two months ahead, now and then. Where it lands is decided now,
// so the calendar can say where; who it touches is decided when it lands.
export function scheduleChange(S) {
  const at = S.month + 2;
  // most months bring something; only a quiet month in five brings nothing
  if ((S.changes || []).some(x => x.month === at) || random(S) > 0.85) return null;
  // no hot spells in a new firm's first summer
  const pool = CHANGES.filter(d => (!d.months || d.months.includes(at % 12)) && !(d.reason === 'hot' && at < 12));
  const def = pool[randomInt(S, pool.length)];
  const ch = { key: def.key, month: at };
  if (def.street) { const open = STREETS.filter(st => streetOpen(S, st.key)); ch.street = open[randomInt(S, open.length)].key; }
  if (def.near) {
    const fitted = S.plots.filter(p => p.status === 'fitted' || p.status === 'callback');
    if (!fitted.length) return null;
    ch.at = fitted[randomInt(S, fitted.length)].i;
  }
  S.changes = [...(S.changes || []), ch];
  return ch;
}
// where a change lands, in words: a street, a client, or the whole town
export function changeWhere(S, ch) {
  const def = CHANGE[ch.key];
  if (def.street) return (STREETS.find(st => st.key === ch.street) || STREETS[0]).name;
  if (def.near) return S.plots[ch.at] ? S.plots[ch.at].name : 'the High Street';
  return 'the whole town';
}
// A change lands: pick the fitted clients it touches and mark them for a check. Returns them.
export function landChange(S, ch) {
  const def = CHANGE[ch.key];
  let near = S.plots.filter(p => p.status === 'fitted');
  if (def.street) near = near.filter(p => streetOf(p) === ch.street);
  if (def.near) { const a = S.plots[ch.at]; near = near.filter(p => streetOf(p) === streetOf(a) && Math.abs(p.i - ch.at) <= 2); }
  // weather and access are the doors' business; a client with only inside work is checked on crowds
  near = near.filter(p => p.install || def.reason === 'busier' || def.reason === 'older');
  const out = [];
  while (near.length && out.length < def.max) out.push(near.splice(randomInt(S, near.length), 1)[0]);
  for (const p of out) {
    p.status = 'checking'; p.reason = def.reason; p.change = ch.key; p.contract = null;
    p.callStage = null; p.callChain = null; p.callTwist = null;
    // a client with no doors of yours (Riverside) is checked on an inside setup
    const inside = Object.keys(p.inside || {});
    if (!p.install && inside.length) { const k = inside[randomInt(S, inside.length)]; if (k.startsWith('chain:')) p.callChain = k.slice(6).split('+'); else p.callStage = k; }
  }
  return out;
}

export function endMonth(S) {
  const inc = monthlyIncome(S), rent = prem(S).rent, ins = insurance(S);
  const premName = prem(S).name;
  const wages = STAFF.filter(s => S.staff[s.key]);
  const wageTotal = wages.reduce((a, s) => a + s.wage, 0);
  S.cash += inc - rent - wageTotal - ins;
  // claims: someone clipped by one of your doors sues; you pay the excess
  const claims = [];
  for (const p of S.plots) if (p.status === 'fitted' && p.bumpRec > 0 && random(S) < Math.min(0.15, 0.02 * p.bumpRec)) { claims.push(p); S.cash -= CLAIM_EXCESS; }
  // wear: doors age every month, and break down at the end of their tether
  const broke = [];
  for (const p of S.plots) {
    if (p.status !== 'fitted' || p.broken) continue;
    p.wear = Math.min(1, (p.wear || 0) + wearRate(S, p));
    if (p.wear >= 1) { p.broken = true; broke.push(p); }
  }
  // now and then an inspector turns up at one of your old jobs
  let insp = null;
  const due = S.plots.filter(p => p.status === 'fitted' && p.install && !p.cert && (S.month - (p.inspected || -99)) >= 6);
  if (due.length && random(S) < 0.15) {
    const p = due[randomInt(S, due.length)];
    p.inspected = S.month + 1;
    try {
      const res = inspect(S, p);
      insp = { p, ...res };
      if (res.pass) p.cert = true;
      else { S.cash -= INSPECTION_FINE; p.status = 'callback'; p.reason = res.access ? 'safety' : 'access'; p.contract = null; p.tier++; }
    } catch (e) { insp = null; }
  }
  S.month++; if (S.month % 12 === 0) S.year++;
  // research
  const done = [];
  for (const r of S.research) { r.left--; if (r.left <= 0) { S.unlocks[r.key] = true; done.push(r.key); } }
  S.research = S.research.filter(r => r.left > 0);
  // deep in the red: the crew walks
  let walked = [];
  if (S.cash < -15000) { walked = wages.map(s => s.name); S.staff = {}; }
  const winter = [10, 11, 0, 1].includes(S.month % 12);
  const calls = [];
  // street changes: the one due this month lands, and the clients it touches have their doors checked
  // against it (the surveyor decides in the background: see survey.js). Another may be put on the calendar.
  const changes = [];
  for (const ch of (S.changes || []).filter(x => x.month === S.month)) {
    const checked = landChange(S, ch);
    changes.push({ ...ch, checked });
    calls.push(...checked);
  }
  S.changes = (S.changes || []).filter(x => x.month > S.month);
  scheduleChange(S);
  // paradox callbacks: finished research reaches the clients it could help. If none is fitted yet,
  // the call waits until one is.
  S.pendingCalls = [...(S.pendingCalls || []), ...done.flatMap(k => (PARADOX_CALLS[k] || []).map((_, j) => [k, j]))];
  const paradox = [];
  S.pendingCalls = S.pendingCalls.filter(([k, j]) => {
    const def = PARADOX_CALLS[k] && PARADOX_CALLS[k][j];
    if (!def) return false;
    const pool = S.plots.filter(p => p.status === 'fitted' && !p.broken && !p.enquiry && callFits(def, p));
    if (!pool.length) return true;
    const p = pool[randomInt(S, pool.length)];
    p.status = 'callback'; p.reason = 'paradox'; p.contract = null; p.tier++;
    p.callText = def.text; p.callTech = k; p.callTwist = def.twist || null; p.callStage = def.stage || null; p.callChain = def.chain || null;
    paradox.push(p);
    return false;
  });
  // enquiries: a client waiting on research hears it's done (or gives up). With nothing else on, a new one comes in.
  const enquiry = settleEnquiries(S, !hasWork(S));
  paradox.push(...enquiry.won);
  // Brassworks bids on tenders you've left sitting
  const lost = [];
  if (rivalActive(S)) for (const p of S.plots) {
    if (p.status !== 'open' || !p.contract || p.contract.first || p.contract.landmark || p.contract.stage || !p.contract.solved) continue;
    if (random(S) < 0.18) { p.status = 'rival'; p.rivalUntil = S.month + 3 + randomInt(S, 3); p.contract = null; lost.push(p); }
  }
  // stale tenders refresh with the season; new tech means new kinds of tender
  const evNow = eventOf(S.month), evKey = evNow ? evNow.key : null;
  for (const p of S.plots) {
    if (!p.contract || (p.status !== 'open' && p.status !== 'callback')) continue;
    const wantEv = p.contract.first ? null : evKey;   // a new month's event replaces last month's tenders
    if ((p.contract.event || null) !== wantEv || (p.status === 'open' && (done.length || random(S) < 0.35))) p.contract = null;
  }
  const net = inc - rent - wageTotal - ins - claims.length * CLAIM_EXCESS - (insp && !insp.pass ? INSPECTION_FINE : 0);
  return { inc, rent, premName, ins, wages, claims, broke, insp, done, walked, winter, calls, lost, evNow, net, paradox, changes, enquiry };
}
