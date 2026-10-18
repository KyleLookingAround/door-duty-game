// Footfall between buildings (content/town.js FLOWS): how busy each client is, from how well the doors that
// feed it work. Settled at the month end (endMonth), read by refreshPlots as a crowd multiplier for new work
// (opts.footfall), by upkeep (a busier client pays a little more), and by scheduleChange: a street that got
// busier because of your work brings 'busier' checks. No randomness: a building's footfall comes only from the
// state of the buildings feeding it (never from their footfall), so it can't cascade along the town.
import { FLOWS, FOOTFALL_CAP, FOOTFALL_STEP } from '../content/town.js';
import { streetOf } from './economy.js';

// how well a building sends its crowd on: -1 (broken doors) to +1 (three-star work)
export function sendsOn(p) {
  if (!p) return 0;
  if (p.status === 'fitted' || p.status === 'checking' || (p.status === 'callback' && p.reason === 'paradox')) return p.broken ? -1 : Math.max(0, (p.stars - 1) / 2);
  if (p.status === 'callback' || p.status === 'rival') return -0.5;
  return 0;
}
// where a building's footfall is heading: what its feeders send, within the cap
export function footfallTarget(S, kind) {
  let f = 1;
  for (const fl of FLOWS) if (fl.to.includes(kind)) f += fl.share * sendsOn(S.plots.find(p => p.kind === fl.from));
  return Math.max(1 - FOOTFALL_CAP, Math.min(1 + FOOTFALL_CAP, f));
}
export const footfallOf = (S, p) => (S.footfall || {})[p.kind] || 1;
// next month's footfall for every building: a step of at most FOOTFALL_STEP towards its target
export function footfallNext(S) {
  const out = {};
  for (const p of S.plots) {
    const now = footfallOf(S, p), t = footfallTarget(S, p.kind);
    out[p.kind] = +(now + Math.max(-FOOTFALL_STEP, Math.min(FOOTFALL_STEP, t - now))).toFixed(2);
  }
  return out;
}
// the month end: footfall moves; returns who changed (kind, from, to) for the report and street changes
export function settleFootfall(S) {
  const next = footfallNext(S), moved = [];
  for (const p of S.plots) { const was = footfallOf(S, p); if (next[p.kind] !== was) moved.push({ kind: p.kind, i: p.i, street: streetOf(p), from: was, to: next[p.kind] }); }
  S.footfall = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== 1));
  return moved;
}
// the busiest flow into a building, in words (for the brief and the calendar)
export function footfallWhy(S, kind) {
  let best = null, bv = 0;
  for (const fl of FLOWS) if (fl.to.includes(kind)) { const v = Math.abs(fl.share * sendsOn(S.plots.find(p => p.kind === fl.from))); if (v > bv) { bv = v; best = fl; } }
  return best;
}
// a line about a client's footfall, or null when it's as usual
// (f: a job's own footfall, c.opts.footfall, so the brief says what the job was drawn with)
export function footfallLine(S, p, f = footfallOf(S, p)) {
  if (Math.abs(f - 1) < 0.03) return null;
  const why = footfallWhy(S, p.kind), pc = Math.round(Math.abs(f - 1) * 100);
  return f > 1 ? `Footfall up ${pc}%${why ? `: ${why.who}` : ''}.` : `Footfall down ${pc}%${why ? `: fewer ${why.who}` : ''}.`;
}
// a street's footfall for the calendar: the biggest change among the clients you can see (now, or `next` from
// footfallNext), e.g. "Footfall +12% · commuters off the trains", or null when it's as usual
export function streetFootfall(S, street, next) {
  let best = null, bv = 0.03;
  for (const p of S.plots) {
    if (streetOf(p) !== street || p.status === 'locked') continue;
    const f = next ? next[p.kind] : footfallOf(S, p);
    if (Math.abs(f - 1) >= bv) { bv = Math.abs(f - 1); best = { p, f }; }
  }
  if (!best) return null;
  const why = footfallWhy(S, best.p.kind), pc = Math.round(Math.abs(best.f - 1) * 100);
  return `Footfall ${best.f > 1 ? '+' : '−'}${pc}% · ${best.f > 1 ? '' : 'fewer '}${why ? why.who : 'visitors'}`;
}
// the month report: where footfall moved, grouped up and down, with the busiest reason; null if nowhere did
export function footfallReport(S, moved) {
  const say = (list, up) => {
    if (!list.length) return '';
    const why = footfallWhy(S, list[0].kind), names = list.map(m => S.plots[m.i].name);
    return `${up ? 'up' : 'down'} at ${names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')}${why ? ` (${up ? '' : 'fewer '}${why.who})` : ''}`;
  };
  const seen = (moved || []).filter(m => S.plots[m.i].status !== 'locked');
  const up = seen.filter(m => m.to > m.from), down = seen.filter(m => m.to < m.from);
  if (!up.length && !down.length) return null;
  return `Footfall ${[say(up, true), say(down, false)].filter(Boolean).join('; ')}. Busier clients pay a little more, and their next jobs have bigger crowds.`;
}
