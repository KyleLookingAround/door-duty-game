// The town day: a sped-up day on one street, played in the month report while the surveyor works.
// A cheap flow model, not the door physics: each client's crowd comes on its own rhythm (DAY_RHYTHMS), scaled
// by its footfall, and its doors take people at a rate set by how well they were fitted (stars, wear, a
// callback). What's left over queues outside. A street change that landed this month shows up on the day
// (a bus stop, a care home, a cold snap), and the clients being checked against it are marked: the surveyor
// decides whether they coped, and the report says so when it's done. Deterministic from the save's seed and
// the month, with its own random stream, so it never moves the game's.
import { DAY_RHYTHMS, DAY_RHYTHM, STREETS, RIVAL } from '../content/town.js';
import { CHANGE } from '../content/changes.js';
import { makeRng } from '../engine/world.js';
import { streetOf } from './economy.js';
import { footfallOf } from './footfall.js';

export const DAY_FROM = 7, DAY_TO = 20, DAY_STEPS = 52;   // 7am to 8pm in quarter hours
const SPILL = 10;   // a queue this long spills down the pavement

// how quickly a client's doors take people, against its busiest quarter hour
function doorPace(p) {
  if (p.status === 'fitted' || p.status === 'checking' || (p.status === 'callback' && p.reason === 'paradox')) {
    if (p.broken) return 0.45;
    return [0.95, 1.0, 1.1, 1.25][Math.min(3, p.stars || 0)] * (1 - 0.25 * Math.max(0, (p.wear || 0) - 0.5));
  }
  if (p.status === 'callback') return 0.8;   // the doors fall short: that's why they called
  if (p.status === 'rival') return 0.85;
  return 0.92;                               // old doors, not yours
}

// the day on a street: who, how busy, the queues, and what happened when. `rpt` is endMonth's report.
export function townDay(S, rpt = {}) {
  const changes = (rpt.changes || []).filter(ch => ch.checked && ch.checked.length);
  const street = changes.length ? streetOf(changes[0].checked[0]) : S.street || 'high';
  const ch = changes.find(x => streetOf(x.checked[0]) === street) || null;
  const def = ch ? CHANGE[ch.key] : null;
  const rng = makeRng(((S.seed || 1) * 31 + S.month * 977) >>> 0);
  const plots = S.plots.filter(p => streetOf(p) === street && p.status !== 'locked');
  const hourOf = k => DAY_FROM + (DAY_TO - DAY_FROM) * k / DAY_STEPS;
  // the change lands in the morning or at lunch
  const at = def ? (def.reason === 'busier' ? 8 + Math.floor(rng() * 4) : 10) : null;
  const moments = [];
  const out = plots.map(p => {
    const peaks = DAY_RHYTHMS[DAY_RHYTHM[p.kind] || 'shop'], size = 14 + 4 * Math.min(6, p.tier || 0);
    const checked = !!(ch && ch.checked.some(q => q.i === p.i));
    const demand = [], queue = [];
    let peak = 0;
    for (let k = 0; k < DAY_STEPS; k++) {
      const h = hourOf(k);
      let d = 1.5 + peaks.reduce((a, [ph, w, wt]) => a + wt * size * Math.exp(-((h - ph) ** 2) / (2 * w * w)), 0);
      d *= footfallOf(S, p) * (0.9 + rng() * 0.2);
      // the change, from its hour on, at the clients it touches
      if (checked && h >= at) d *= def.reason === 'busier' ? 1.3 : def.reason === 'older' ? 1.15 : 1;
      demand.push(+d.toFixed(2)); peak = Math.max(peak, d);
    }
    // the doors' pace is set against the usual busiest quarter hour (before the change)
    const cap = Math.max(...demand.map((d, k) => checked && hourOf(k) >= at && def.reason !== 'cold' && def.reason !== 'hot' ? d / (def.reason === 'busier' ? 1.3 : 1.15) : d)) * doorPace(p) * 0.9;   // even good doors have a short queue at the peak
    const flow = c => { let q = 0, spilled = null; const qs = []; for (let k = 0; k < DAY_STEPS; k++) { q = Math.max(0, q + demand[k] - c); qs.push(+q.toFixed(1)); if (q >= SPILL && spilled == null) spilled = k; } return { qs, spilled }; };
    const short = flow(cap);
    // a client being checked: the surveyor decides whether its doors cope, so the day has both endings
    // (coped: the doors keep up with the change; short: the queue it would bring), and the report picks one
    const coped = checked ? flow(Math.max(...demand) * 1.02) : null;
    return { i: p.i, kind: p.kind, name: p.name, status: p.status, stars: p.stars || 0, broken: !!p.broken, rival: p.status === 'rival', yours: !!(p.install || p.inside) && p.status !== 'rival', checked,
      demand, queue: short.qs, spilled: checked ? null : short.spilled, short: checked ? short : null, coped: coped ? coped.qs : null, foot: footfallOf(S, p) };
  });
  // what happened when, for the caption: the rushes, the change, queues spilling over
  const rhythms = new Set(out.map(o => DAY_RHYTHM[o.kind] || 'shop'));
  if (rhythms.has('commute')) moments.push({ k: stepOf(8.25), text: street === 'riverside' ? 'The first flights: the morning rush' : street === 'docks' ? 'The first ferry: the morning rush' : 'The morning rush off the trains' });
  if (rhythms.has('lunch')) moments.push({ k: stepOf(12.5), text: 'Lunchtime' });
  if (def) moments.push({ k: stepOf(at), text: `${def.label}: ${def.reason === 'busier' ? 'more people on the street' : def.reason === 'older' ? 'an older crowd' : def.reason === 'access' ? 'the council\'s access audit' : 'the weather turns'}`, change: ch.key });
  if (rhythms.has('commute')) moments.push({ k: stepOf(17.25), text: street === 'docks' ? 'The evening ferry home' : 'The evening rush home' });
  if (rhythms.has('match')) moments.push({ k: stepOf(17.25), text: 'Match day: the crowd heads for kick-off' });
  else if (rhythms.has('evening')) moments.push({ k: stepOf(18), text: 'The evening shows' });
  // queues spilling over (not at clients being checked: the surveyor says how that went), the worst three
  for (const o of out.filter(x => x.spilled != null).sort((a, b) => Math.max(...b.queue) - Math.max(...a.queue)).slice(0, 3)) moments.push({ k: o.spilled, text: `A queue spills out of ${o.name}${o.rival ? ` (${RIVAL}'s doors)` : o.status === 'callback' && !o.checked ? ' (waiting on your callback)' : ''}`, i: o.i });
  moments.sort((a, b) => a.k - b.k);
  return { street, streetName: (STREETS.find(s => s.key === street) || STREETS[0]).name, change: ch ? ch.key : null, plots: out, moments, steps: DAY_STEPS, from: DAY_FROM, to: DAY_TO };
}
const stepOf = h => Math.max(0, Math.min(DAY_STEPS - 1, Math.round((h - DAY_FROM) / (DAY_TO - DAY_FROM) * DAY_STEPS)));
// the clock for a step, e.g. "08:15"
export const dayClock = k => { const m = Math.round((DAY_FROM + (DAY_TO - DAY_FROM) * k / DAY_STEPS) * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
