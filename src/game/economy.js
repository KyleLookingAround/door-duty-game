// Money and standing: reputation, fees, costs, maintenance, wear, insurance. All pure functions of the save.
import { PREMISES, STAFF } from '../content/company.js';
import { TECH } from '../content/tech.js';
import { STREETS } from '../content/town.js';
import { PLOTS, KINDS, buildSite } from '../content/buildings/index.js';

export const rep = S => S.plots.reduce((a, p) => a + p.stars, 0);
export const prem = S => PREMISES[S.premises || 0];
// How many jobs the firm can sign off a month: the premises, plus research that adds crews' time.
// Every sign-off counts (tenders, callbacks, research calls, inside jobs); a street-change check doesn't.
export const jobsPerMonth = S => prem(S).jobs + TECH.filter(t => t.jobs && S.unlocks[t.key]).reduce((a, t) => a + t.jobs, 0);
export const jobsLeft = S => Math.max(0, jobsPerMonth(S) - (S.monthJobs || 0));
// the research the surveyor and the doors can use (a doorman needs the crew hired, not just the training)
export const techOf = S => ({ ...S.unlocks, doorman: !!(S.unlocks.doorman && S.staff.doorman) });
export const techName = k => (TECH.find(t => t.key === k) || {}).name || k;

export const costMult = S => (S.staff.fitter ? 0.9 : 1) * (S.unlocks.supplier ? 0.92 : 1);
export const feeMult = S => (1 + (S.staff.sales ? 0.3 : 0) + (prem(S).fee || 0));
export const charge = (S, c) => Math.round(c * costMult(S) / 50) * 50;            // what hardware actually costs you
export const feeOf = (S, c) => c.par.cost + Math.round((c.margin != null ? c.margin : c.fee - c.par.cost) * feeMult(S) / 500) * 500;   // bonuses scale your margin

// what a fitted client pays each month: worn doors pay less, broken ones nothing; green stars and certificates pay more
export const wearFactor = p => p.broken ? 0 : (p.wear || 0) < 0.5 ? 1 : 1 - ((p.wear || 0) - 0.5) * 0.8;
export const loyalty = p => 1 + 0.05 * Math.min(3, p.coped || 0);   // each street change their doors coped with: +5%, up to 15%
export const upkeep = (S, p) => Math.round((p.fee * 0.007 * p.stars + 100) * (S.staff && S.staff.engineer ? 1.4 : 1) * (p.green ? 1.15 : 1) * (p.cert ? 1.1 : 1) * loyalty(p) * wearFactor(p) / 50) * 50;
// a client calling about new research (a paradox callback) is still happy and still pays
export const paying = p => p.status === 'fitted' || p.status === 'checking' || (p.status === 'callback' && p.reason === 'paradox');
// maintenance coming in each month: the whole firm's, or one street's
export const monthlyIncome = (S, street) => S.plots.filter(p => paying(p) && (!street || streetOf(p) === street)).reduce((a, p) => a + upkeep(S, p), 0);
// doors wear with traffic: revolving doors and gates fastest, swing doors slowest
export const WEAR = { revolve: 0.1, slider: 0.08, swing: 0.06, gates: 0.1 };
export function wearRate(S, p) {
  const doors = (p.install || []).filter(s => s.type !== 'wall');
  if (!doors.length) return 0;
  const base = doors.reduce((a, s) => a + (WEAR[s.type] || 0.08) * (s.wide ? 1.2 : 1), 0) / doors.length;
  return base * (1 + 0.06 * Math.min(p.tier || 0, 6)) * (S.staff.engineer ? 0.5 : 1);
}
export const serviceCost = p => Math.round((300 + p.fee * 0.05 * (p.wear || 0) + (p.broken ? 800 : 0)) / 50) * 50;
// insurance: a base premium plus a loading for every bump and safety stop on your record
export const insurance = S => S.plots.filter(p => p.status === 'fitted' || p.status === 'callback').reduce((a, p) => a + 45 * (p.bumpRec || 0) + 25 * (p.stopRec || 0), S.jobs ? 60 : 0);
export const overheads = S => prem(S).rent + STAFF.reduce((a, s) => a + (S.staff[s.key] ? s.wage : 0), 0) + insurance(S);

// research a client insists on before it will take bids (a landmark needs several at once)
export const plotNeeds = p => { const n = (PLOTS[p.i] || {}).needs; return n ? [].concat(n) : []; };
export const missingNeeds = (S, p) => plotNeeds(p).filter(k => !S.unlocks[k]);
export const needsMet = (S, p) => missingNeeds(S, p).length === 0;
export const needsText = (S, p) => missingNeeds(S, p).map(techName).join(', ');

// the town
export const streetOf = p => (PLOTS[p.i] || {}).street || 'high';
export const streetOpen = (S, k) => rep(S) >= (STREETS.find(x => x.key === k) || {}).rep;
export const rivalActive = S => streetOpen(S, 'market');
// what Brassworks leaves behind: cheap swing doors in every other bay, both ways
export const rivalInstall = p => Array.from({ length: KINDS[p.kind].slots }, (_, i) => i % 2 === 0 ? { type: 'swing', curtain: false, flow: 'both' } : { type: 'wall' });
export const tierOf = (S, p) => Math.min(7, Math.floor(S.jobs / 3) + (p.tier || 0));

// can a wheelchair get in? (the inspector checks this at public buildings)
export function stepFreeOk(p) {
  const site = buildSite(p.kind, p.install.length);
  return p.install.some((s, i) => (s.type === 'slider' || (s.type === 'revolve' && s.wide && s.wings <= 3) || (s.type === 'gates' && s.wide)) && (!site.rampBays || site.rampBays.includes(i)));
}
