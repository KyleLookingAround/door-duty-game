// Doing the work: grading a tested design, signing off, and the firm's own decisions (research, staff, premises, servicing).
import { designCost, designSig, violatesRules } from './contracts.js';
import { TECH } from '../content/tech.js';
import { PREMISES, STAFF } from '../content/company.js';
import { money } from '../util/format.js';
import { feeOf, charge, prem, rep, serviceCost } from './economy.js';

// Grade a rush-hour result against the brief. r: world stats plus minTemp, maxTemp, wait.
export function grade(S, c, design, r) {
  const g = c.goals;
  const cost = designCost(design, c.existing);
  const rows = [
    ['Through', r.through, `≥ ${g.through}`, r.through >= g.through],
    ['Bumps', r.bumps, `≤ ${g.bumps}`, r.bumps <= g.bumps],
  ];
  if (g.minTemp != null) rows.push(['Coldest lobby', r.minTemp.toFixed(1) + '°', `≥ ${g.minTemp}°`, r.minTemp >= g.minTemp]);
  if (g.wait != null) rows.push(['9 in 10 through within', r.wait.toFixed(1) + 's', `≤ ${g.wait}s`, r.wait <= g.wait]);
  if (g.maxTemp != null) rows.push(['Hottest lobby', r.maxTemp.toFixed(1) + '°', `≤ ${g.maxTemp}°`, r.maxTemp <= g.maxTemp]);
  if (g.access) rows.push(['Wheelchairs and prams turned away', r.accessFail, '0', r.accessFail === 0]);
  if (g.bikes) rows.push(['Cyclists turned away', r.bikeFail, '0', r.bikeFail === 0]);
  if (g.laps != null) rows.push(['Went round again', r.laps, `≤ ${g.laps}`, r.laps <= g.laps]);
  if (c.drill) rows.push(['Fire drill: lobby cleared in', r.evac == null ? 'not cleared' : r.evac.toFixed(1) + 's', `≤ ${g.evac}s`, r.evac != null && r.evac <= g.evac]);
  if (violatesRules(c, design)) rows.push(['Client rules', 'broken', c.rules.forbid ? 'no ' + c.rules.forbid.join(', ') + ' doors' : 'listed door', false]);
  rows.push(['Cost', money(cost), `≤ ${money(c.budget)}`, cost <= c.budget]);
  if (g.laps == null) rows.push(['Went round again', r.laps, '', null]);
  rows.push(['Safety stops', r.stops, '', null]);
  const pass = rows.every(x => x[3] !== false);
  let stars = 0;
  if (pass) { stars = 1; if (cost <= c.par.cost) { stars = 2; if (r.bumps === 0 && r.stops === 0) stars = 3; } }
  const hint = pass ? '' : !rows[0][3] ? 'Not enough got through. More doors, faster wings, or wider mouths.'
    : !rows[1][3] ? 'Too many bumps. Slow the wings so the tips stay under the safe speed, or give swing doors a direction.'
    : (g.wait != null && r.wait > g.wait) ? 'The queues at the gates are too long. Each lane takes one person at a time, so point more lanes the busy way (Auto lanes follow the rush), and gate-line staff help people tap through faster.'
    : (g.maxTemp != null && r.maxTemp > g.maxTemp) ? 'The lobby got too hot. Every open door lets the heat in, just as it lets the cold in during winter. Revolving doors seal; air curtains help.'
    : (g.minTemp != null && r.minTemp < g.minTemp) ? 'The lobby got too cold. Swing and sliding doors leak; revolving doors with enough wings seal.'
    : (g.access && r.accessFail) ? `Wheelchairs and prams need a sliding door they can reach${S.unlocks.wide ? ', or a wide drum with 3 wings or fewer' : ''}${c.site && c.site.rampBays ? ` in a bay with the ramp (bay ${c.site.rampBays.map(i => i + 1).join(', ')})` : ''}.`
    : (g.bikes && r.bikeFail) ? 'Cyclists can\'t wheel a bike through a revolving door. Give them a swing or sliding door that isn\'t push-button only.'
    : violatesRules(c, design) ? 'The client\'s rules forbid one of your doors. Swap it out.'
    : (c.drill && !(r.evac != null && r.evac <= g.evac)) ? 'The lobby took too long to empty. More or wider exits help, and a pillar just inside a busy exit stops the crowd jamming in the doorway.'
    : (g.laps != null && r.laps > g.laps) ? 'People near the slow hub are missing their exit and riding round again. A bigger core keeps them on the fast outer ring.' : 'Over budget.';
  const green = pass && isGreen(c, r);
  return { rows, pass, stars, hint, cost, profit: feeOf(S, c) - charge(S, cost), green };
}
// a lobby kept snug against the weather earns a green star
export const isGreen = (c, r) => (c.goals.minTemp != null && c.outsideTemp < 12 && r.minTemp >= 19.5) || (c.goals.maxTemp != null && r.maxTemp <= 22.5);

// Sign off a passed job. r: the result the stars were earned with.
export function signOff(S, p, c, design, stars, r) {
  const cost = designCost(design, c.existing), profit = feeOf(S, c) - charge(S, cost);
  const lockedBefore = S.plots.filter(x => x.status === 'locked').length;
  S.cash += profit;
  p.install = design.map(s => ({ ...s }));
  p.stars = Math.max(p.stars, stars);
  p.fee = Math.max(p.fee, c.fee);
  p.status = 'fitted'; p.contract = null; p.reason = null;
  // a fresh install: new doors, a clean record, and a green star if the lobby stayed snug
  p.wear = 0; p.broken = false; p.cert = false;
  p.bumpRec = r.bumps; p.stopRec = r.stops;
  p.green = isGreen(c, r);
  S.jobs++;
  S.recent = [...(S.recent || []), designSig(p.install)].slice(-4);
  return { profit, lockedBefore };
}

// the firm's decisions; each returns false if it isn't allowed right now
export function startResearch(S, key) {
  const t = TECH.find(x => x.key === key);
  if (!t || S.cash < t.price || S.research.length >= prem(S).labs || S.unlocks[key] || S.research.some(r => r.key === key)) return false;
  S.cash -= t.price; S.research.push({ key: t.key, left: t.months }); return true;
}
export function hire(S, key) { S.staff[key] = true; return true; }
export function fire(S, key) { S.staff[key] = false; return true; }
export function movePremises(S, i) {
  const p = PREMISES[i];
  if (!p || S.cash < p.price || rep(S) < (p.rep || 0)) return false;
  S.cash -= p.price; S.premises = i; return true;
}
export function service(S, p) {
  const cost = serviceCost(p);
  if (S.cash < cost) return false;
  S.cash -= cost; p.wear = 0; p.broken = false; return true;
}
export { STAFF };
