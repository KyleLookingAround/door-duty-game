// Doing the work: grading a tested design, signing off, and the firm's own decisions (research, staff, premises, servicing).
import { designCost, designSig, violatesRules } from './contracts.js';
import { stageRows } from './stagejobs.js';
import { STAGES, stageName } from '../engine/stages/index.js';
import { TECH } from '../content/tech.js';
import { PREMISES, STAFF } from '../content/company.js';
import { money } from '../util/format.js';
import { advertCost, feeOf, charge, isLandmarkPlot, prem, rep, serviceCost, standing, streetOf } from './economy.js';
import { masterFrom, studyResult } from './research.js';

// "a, b or c"
const orList = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}` : a[0] || '';
const upFirst = t => t.charAt(0).toUpperCase() + t.slice(1);
// What went wrong and what to try. Only names hardware this job allows and the firm has: a hint about
// wings is no use when the client has banned revolving doors.
function hintFor(S, c, design, r, rows) {
  const g = c.goals, tech = S.unlocks || {}, has = t => design.some(s => s.type === t);
  const revOk = !((c.rules && c.rules.forbid) || []).includes('revolve');
  const rev = has('revolve'), open = has('swing') || has('slider');
  const twoWaySwing = design.some(s => s.type === 'swing' && (s.flow || 'both') === 'both' && !s.lanes);
  // tourists riding the drum round for the photo: a faster door only spins them faster
  if (!rows[0][3] && rev && (c.twists || []).includes('tourists')) return `Not enough got through. The tourists ride the revolving door round for the photo, holding up a compartment every time. ${tech.doorman && S.staff && S.staff.doorman ? 'A doorman sees them off; ' : ''}more doors spread them out, and a faster door only spins them round faster.`;
  if (!rows[0][3]) return `Not enough got through. ${upFirst(orList(['more doors', ...(rev ? ['faster wings'] : []), ...(rev && tech.mouth ? ['wider mouths'] : [])]))}.`;
  if (!rows[1][3]) {
    const fix = [];
    if (rev) fix.push(`slow the wings so the tips stay under the safe speed${tech.padded && !design.some(s => s.padded) ? ' (or pad their edges)' : ''}`);
    if (twoWaySwing) fix.push(`give swing doors a direction${tech.barriers ? ' or split them with lane barriers' : ''}`);
    if (!fix.length) fix.push('more doors spread the crowd so fewer people collide');
    return `Too many bumps. ${upFirst(orList(fix))}.`;
  }
  if (g.wait != null && r.wait > g.wait) return 'The queues at the gates are too long. Each lane takes one person at a time, so point more lanes the busy way (Auto lanes follow the rush), and gate-line staff help people tap through faster.';
  if (g.maxTemp != null && r.maxTemp > g.maxTemp) {
    const fix = [...(revOk ? ['revolving doors seal'] : []), ...(open && tech.curtain ? ['air curtains help'] : [])];
    return `The lobby got too hot. Every open door lets the heat in, just as it lets the cold in during winter. ${fix.length ? upFirst(fix.join('; ')) : 'Fewer open doors keep it cooler'}.`;
  }
  if (g.minTemp != null && r.minTemp < g.minTemp) {
    const fix = [...(revOk ? ['revolving doors with enough wings seal'] : []), ...(open && tech.curtain ? ['air curtains help'] : []), ...(open && tech.vestibule ? ['a draught lobby helps more'] : [])];
    const what = fix.length ? fix.join('; ') : 'fewer open doors keep it warmer';
    return `The lobby got too cold. ${open ? `Swing and sliding doors leak; ${what}` : upFirst(what)}.`;
  }
  if (g.access && r.accessFail) return `Wheelchairs and prams need a sliding door they can reach${tech.wide && revOk ? ', or a wide drum with 3 wings or fewer' : ''}${c.site && c.site.rampBays ? ` in a bay with the ramp (bay ${c.site.rampBays.map(i => i + 1).join(', ')})` : ''}.`;
  if (g.bikes && r.bikeFail) return 'Cyclists can\'t wheel a bike through a revolving door. Give them a swing or sliding door that isn\'t push-button only.';
  if (violatesRules(c, design)) return 'The client\'s rules forbid one of your doors. Swap it out.';
  if (c.drill && !(r.evac != null && r.evac <= g.evac)) return `The lobby took too long to empty. More or wider exits help${tech.pillars ? ', and a pillar just inside a busy exit stops the crowd jamming in the doorway' : ''}.`;
  if (g.laps != null && r.laps > g.laps) return `People near the slow hub are missing their exit and riding round again. ${tech.core ? 'A bigger core keeps them on the fast outer ring.' : 'Big-core drums would keep them on the fast outer ring (Company › Research).'}${tech.doorman ? ' A doorman gets riders out on time.' : ''}`;
  return 'Over budget.';
}

// Grade a rush-hour result against the brief. r: world stats plus minTemp, maxTemp, wait.
export function grade(S, c, design, r) {
  const g = c.goals;
  const cost = designCost(design, c.existing);
  if (c.stage) return gradeStage(S, c, design, r, cost);
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
  const hint = pass ? '' : hintFor(S, c, design, r, rows);
  const green = pass && isGreen(c, r);
  return { rows, pass, stars, hint, cost, profit: feeOf(S, c) - charge(S, cost), green };
}
// an inside job: through, the time target, bumps, cost. On a chained level the hint names the slowest stage.
function gradeStage(S, c, design, r, cost) {
  const g = c.goals, st = STAGES[c.stage];
  const rows = [...stageRows(c, r), ['Cost', money(cost), `≤ ${money(c.budget)}`, cost <= c.budget]];
  if (!st.bumps) rows.push(['Bumps', r.bumps, '', null]);
  const pass = rows.every(x => x[3] !== false);
  let stars = 0;
  if (pass) { stars = 1; if (cost <= c.par.cost) { stars = 2; if (r.bumps === 0 && !r.stops) stars = 3; } }
  let hint = '';
  if (!pass) {
    if (cost > c.budget) hint = 'Over budget.';
    else if (r.parts) {
      const parts = st.partsOf(c), worst = r.parts.map((x, i) => [x.wait + x.bumps * 15, i]).sort((a, b) => b[0] - a[0])[0][1];
      const ps = parts[worst].st, x = r.parts[worst];
      hint = `The crush is at stage ${worst + 1}, ${stageName(c, ps.key).toLowerCase()}: ${x.bumps ? `${x.bumps} bumped there, and ` : ''}people spent ${x.wait.toFixed(0)}s getting through it. ${ps.hint ? ps.hint(x, parts[worst].sub) : ''} Fix it and the queue may move on to the next stage.`;
    } else hint = st.hint ? st.hint(r, c) : 'Not quick enough yet.';
  }
  return { rows, pass, stars, hint, cost, profit: feeOf(S, c) - charge(S, cost), green: false };
}
// a lobby kept snug against the weather earns a green star
export const isGreen = (c, r) => (c.goals.minTemp != null && c.outsideTemp < 12 && r.minTemp >= 19.5) || (c.goals.maxTemp != null && r.maxTemp <= 22.5);

// Sign off a passed job. r: the result the stars were earned with.
export function signOff(S, p, c, design, stars, r) {
  const cost = designCost(design, c.existing), profit = feeOf(S, c) - charge(S, cost);
  const lockedBefore = S.plots.filter(x => x.status === 'locked').length, firstFit = !p.stars;
  // a client who asked for this and waited for your research pays a bonus for having it ready
  const bonus = p.enquiry && p.enquiry.ready && p.status === 'callback' && p.reason === 'paradox' ? p.enquiry.bonus || 0 : 0;
  const mastered = masterFrom(S, p, c);   // the job that teaches a tech masters it
  if (bonus) p.enquiry = null;
  S.cash += profit + bonus;
  if (c.stage) p.inside = { ...(p.inside || {}), [c.chain ? 'chain:' + c.chain.join('+') : c.stage]: JSON.parse(JSON.stringify(design)) };
  else p.install = design.map(s => ({ ...s }));
  p.stars = Math.max(p.stars, stars);
  p.fee = Math.max(p.fee, c.fee);
  p.status = 'fitted'; p.contract = null; p.reason = null; p.inspection = null;
  // a fresh install: new doors, a clean record, and a green star if the lobby stayed snug.
  // An inside job at a client whose doors you already fitted leaves the doors' wear and record alone.
  if (!c.stage || !p.install) { p.wear = 0; p.broken = false; p.cert = false; p.bumpRec = r.bumps; p.stopRec = r.stops || 0; }
  else { p.bumpRec = Math.max(p.bumpRec || 0, r.bumps); }
  p.green = c.stage ? p.green : isGreen(c, r);
  p.callStage = null; p.callTwist = null; p.callChain = null; p.callTech = null; p.lessonTender = false;
  S.jobs++; S.monthJobs = (S.monthJobs || 0) + 1;
  S.standing = { ...(S.standing || {}), [streetOf(p)]: standing(S, streetOf(p)) + stars };   // every job's stars count on its street
  S.recent = [...(S.recent || []), designSig(design)].slice(-4);
  // for the local paper at the month end
  if (mastered) S.news = [...(S.news || []), { kind: 'mastered', key: mastered }];
  if (firstFit && isLandmarkPlot(p)) S.news = [...(S.news || []), { kind: 'landmark', i: p.i }];
  return { profit: profit + bonus, bonus, lockedBefore, mastered };
}

// the firm's decisions; each returns false if it isn't allowed right now (research: see research.js)
// advertise: pay to bring in work this month (each advert in a month costs more). Returns what it brought, or false.
export function advertise(S) {
  const cost = advertCost(S);
  if (S.cash < cost) return false;
  const got = studyResult(S);
  if (got.kind === 'none') return false;   // nobody to reach yet: nothing charged
  S.cash -= cost; S.adverts = (S.adverts || 0) + 1;
  return { ...got, cost };
}
export function hire(S, key) { S.staff[key] = true; return true; }
export function fire(S, key) { S.staff[key] = false; return true; }
export function movePremises(S, i) {
  const p = PREMISES[i];
  if (!p || S.moving || i !== (S.premises || 0) + 1 || S.cash < p.price || rep(S) < (p.rep || 0)) return false;
  // a move takes months: you pay now and work from the old premises until it's done (endMonth), and the
  // research benches are packed up, so research waits
  S.cash -= p.price; S.moving = { to: i, left: p.moveMonths || 1 }; return true;
}
export function service(S, p) {
  const cost = serviceCost(p);
  if (S.cash < cost) return false;
  S.cash -= cost; p.wear = 0; p.broken = false; return true;
}
export { STAFF };
