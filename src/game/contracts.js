// Contracts: generating a job, pricing hardware, and the surveyor that solves it.
// Pure: no DOM. The surveyor runs headless simulations of candidate designs to set a fair target and price.
import { World, makeRng, SLOT_W } from '../engine/world.js';
import { BUILDING, KINDS, buildSite } from '../content/buildings/index.js';
import { EVENTS, xmasBays } from '../content/events.js';
import { TWIST_POOL, TWIST_REQ, CONFLICTS, clashes, isSpecialist } from '../content/twists.js';
import { makeStageContract, newStageSim, runStage, solveStage, stageCost, stageSig } from './stagejobs.js';
import { LESSON_GOALS } from '../content/tech.js';
// Each building's first contract is a hand-picked "hook" that breaks the stock answers.
// Later contracts draw twists from the same pool, and a novelty check stops repeats.
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SEASON_T = [3, 4, 7, 10, 14, 17, 19, 18, 15, 11, 7, 4];
export const TEST_SECONDS = 40;
export const SIM_DT = 1 / 60;                  // shared by the surveyor and the in-game test
export const RUN_SECONDS = TEST_SECONDS + 6;   // arrivals stop at 40s; the last people get 6s to clear the door
export const PRICE = { revolve: 12000, wingExtra: 1500, bigCore: 2000, padded: 1500, sensor: 2000, wide: 8000, swing: 2500, slider: 6000, curtain: 3500, vestibule: 5000, pillar: 1500, lanes: 800, gates: 7000, gatesWide: 9000, tidal: 2500, closer: 600, autoSwing: 2000, tele: 3500 };

export function slotCost(s) {
  if (!s || s.type === 'wall') return 0;
  const extras = (s.pillar ? PRICE.pillar : 0);
  if (s.type === 'gates') return (s.wide ? PRICE.gatesWide : PRICE.gates) + (s.flow === 'auto' ? PRICE.tidal : 0);
  if (s.type === 'revolve') return extras + PRICE.revolve + (s.wide ? PRICE.wide : 0) + Math.max(0, s.wings - 3) * PRICE.wingExtra + (s.core >= 0.3 ? PRICE.bigCore : 0) + (s.padded ? PRICE.padded : 0) + (s.sensor ? PRICE.sensor : 0);
  return extras + (s.type === 'swing' ? PRICE.swing : PRICE.slider) + (s.curtain ? PRICE.curtain : 0) + (s.vestibule ? PRICE.vestibule : 0) + (s.lanes ? PRICE.lanes : 0)
    + (s.closer ? PRICE.closer : 0) + (s.auto ? PRICE.autoSwing : 0) + (s.tele ? PRICE.tele : 0);
}
export function designCost(slots, existing) {
  if (!Array.isArray(slots)) return stageCost(slots, existing);   // an inside job's setup
  let c = 0;
  slots.forEach((s, i) => {
    const old = existing && existing[i];
    if (!old || old.type !== s.type || ((s.type === 'revolve' || s.type === 'gates') && !!s.wide !== !!old.wide)) { c += slotCost(s) - (s.pillar && old && old.pillar ? PRICE.pillar : 0); return; }
    if (s.pillar && !old.pillar) c += PRICE.pillar;
    if (s.type === 'gates') { if (s.flow === 'auto' && old.flow !== 'auto') c += PRICE.tidal; return; }
    if (s.type === 'revolve') {
      c += Math.max(0, s.wings - old.wings) * PRICE.wingExtra;
      if (s.core >= 0.3 && old.core < 0.3) c += PRICE.bigCore;
      if (s.padded && !old.padded) c += PRICE.padded;
      if (s.sensor && !old.sensor) c += PRICE.sensor;
    } else {
      if (s.curtain && !old.curtain) c += PRICE.curtain;
      if (s.vestibule && !old.vestibule) c += PRICE.vestibule;
      if (s.lanes && !old.lanes) c += PRICE.lanes;
      if (s.closer && !old.closer) c += PRICE.closer;
      if (s.auto && !old.auto) c += PRICE.autoSwing;
      if (s.tele && !old.tele) c += PRICE.tele;
    }
  });
  return c;
}
// a position-free fingerprint of a design, for the novelty check
// one letter per door type: swing and sliding doors both start with s, so sliders are l
const SIG_CODE = { revolve: 'r', swing: 's', slider: 'l', gates: 'g' };
export function designSig(slots) {
  if (!Array.isArray(slots)) return stageSig(slots);
  return slots.filter(s => s.type !== 'wall').map(s => {
    let t = SIG_CODE[s.type] || s.type[0];
    if (s.flow && s.flow !== 'both') t += s.flow[0];
    if (s.type === 'gates') t += s.wide ? 'W' : '';
    if (s.type === 'revolve') t += (s.wide ? 'W' : '') + s.wings + (s.core >= 0.3 ? 'C' : '') + (s.mouth <= 32 ? 'N' : '') + (s.rpm <= 3.5 ? 'S' : '') + (s.sensor ? 'P' : '');
    if (s.button) t += 'B';
    if (s.closer) t += 'K';
    if (s.auto) t += 'A';
    if (s.tele) t += 'T';
    if (s.vestibule) t += 'V';
    if (s.doorman) t += 'D';
    if (s.pillar) t += 'X';
    if (s.lanes) t += 'L';
    return t;
  }).sort().join(',');
}
export function violatesRules(contract, slots) {
  if (!Array.isArray(slots)) return false;
  const r = contract.rules || {};
  if (r.forbid && slots.some(s => r.forbid.includes(s.type))) return true;
  if (r.fixed) for (const [i, f] of Object.entries(r.fixed)) if (slots[i].type !== f.type) return true;
  return false;
}

export function makeContract(kindKey, tier, month, seed, opts = {}) {
  if (opts.stage) return makeStageContract(kindKey, tier, month, seed, opts);   // an inside job
  const k = KINDS[kindKey], rng = makeRng(seed * 7919 + 13), tech = opts.tech || {};
  const first = !!opts.first;
  const scale = first ? 1 : (1 + 0.1 * Math.min(tier, 6)) * (0.88 + rng() * 0.24);
  // a first visit uses its hand-picked conditions, but in the warm months it's warm (unless the hook is about cold),
  // so a new firm starting in spring isn't fighting lobby temperatures from day one
  const warm = SEASON_T[month % 12] >= 12 && !(k.hook.twists || []).includes('cold');
  let temp = first && k.hook.temp != null ? (warm ? Math.max(k.hook.temp, SEASON_T[month % 12]) : k.hook.temp) : SEASON_T[month % 12] + Math.round(rng() * 5 - 3);
  let slots = k.slots;
  const mix = { ...k.mix };
  // a research call's twist too strong for any door (a surge no frontage can move): the retry calms the crowd
  // footfall from the buildings that feed this one (game/footfall.js); a first visit is the client's usual day
  const calm = Math.pow(0.8, opts.calm || 0) * (first ? 1 : opts.footfall || 1);
  let crowdIn = k.in * scale * calm, crowdOut = k.out * scale * calm;
  const c = { kind: kindKey, tier, month, seed, first, rules: {}, wind: 0, budgetCap: null, solved: false };
  const goals = { bumps: 0, minTemp: null, access: false, laps: null };
  const need = opts.first ? [] : opts.need || [];
  // a research call teaches its research (see lessonGoal), on the kind of door the client already has
  const lesson = !first && opts.lesson && LESSON_GOALS[opts.lesson] ? opts.lesson : null;
  const kept = ['revolve', 'swing', 'slider'].filter(t => !(lesson && (LESSON_GOALS[lesson].forbid || []).includes(t)));

  // pick twists: the hook for a first visit, otherwise the callback reason plus random draws
  let twists = [];
  if (first) twists = [...k.hook.twists];
  else {
    const CB = { busier: 'surge', older: 'fragile', cold: 'cold', safety: 'fragile', access: 'stepfree' };
    // (a failed inspection replays the inspector's day: only a step-free failure adds its access goal)
    if (opts.callback && CB[opts.callback] && !opts.check && !(opts.inspection && opts.callback !== 'access') && !(k.station && opts.callback === 'cold')) twists.push(CB[opts.callback]);
    // a research call's own problem (opts.need) comes before any random draw, so the draws fit around it
    for (const t of need) if (!twists.includes(t)) twists.push(t);
    const n = tier >= 3 ? 2 : 1;
    // a new firm's first warm months stay warm: no cold snaps or gales until the autumn
    const firstSummer = month < 12 && SEASON_T[month % 12] >= 12;
    const pool = (BUILDING[kindKey].twistPool || TWIST_POOL).filter(t => !twists.includes(t) && (!TWIST_REQ[t] || TWIST_REQ[t](tech)) && !(firstSummer && (t === 'cold' || t === 'wind')));
    while (twists.length < n + (opts.callback ? 1 : 0) && pool.length) {
      const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      if (!clashes(twists, t, tech)) twists.push(t);
    }
    // firms with the right tech get offered specialist jobs that others can't take on
    const special = CONFLICTS.filter(([a, b, ok]) => ok && ok(tech) && !(opts.existing && [a, b].some(x => x === 'narrow' || x === 'listed')));
    // once you own pillars, fire officers start calling
    if (tech.pillars && !k.station && !k.towers && !twists.includes('drill') && rng() < 0.2) twists.push('drill');
    if (special.length && !k.station && !k.towers && rng() < 0.25) {
      const [a, b] = special[Math.floor(rng() * special.length)];
      if (!need.some(t => clashes([a, b], t, tech))) {
        twists = twists.filter(t => !clashes([a, b], t, tech) && t !== a && t !== b);
        twists.push(a, b);
      }
    }
  }
  for (const t of (opts.extra || [])) if (!twists.includes(t) && !clashes(twists, t, tech)) twists.push(t);
  // existing hardware on a callback can't conflict with a listed-door rule
  if (opts.existing) twists = twists.filter(t => t !== 'listed' && t !== 'narrow' && !(t === 'tight' && opts.existing.some(s => s.type === 'revolve')));
  // cyclists need an open door: buildings that insist on a very warm lobby can't take them without draught lobbies
  if (k.comfort >= 18 && !tech.vestibule) twists = twists.filter(t => t !== 'bikes');
  // last-resort plain job: just the callback reason and what a research call is about, nothing extra
  if (opts.plain) twists = [...new Set([...(opts.callback && !opts.check && !(opts.inspection && opts.callback !== 'access') ? twists.slice(0, 1) : []), ...need])];
  // twists that can't be met with the door the client keeps: tight and listed rule revolving doors out or in,
  // no-fire rules out swing doors, and cyclists can't ride a revolving door
  if (lesson) twists = twists.filter(t => need.includes(t) || !((t === 'tight' && !kept.some(x => x !== 'revolve')) || (t === 'listed' && !kept.includes('revolve')) || (t === 'nofire' && !kept.some(x => x !== 'swing')) || (t === 'bikes' && !kept.some(x => x !== 'revolve')) || (t === 'stepfree' && !kept.includes('slider') && !(tech.wide && kept.includes('revolve')) && !(tech.autoswing && kept.includes('swing')))));
  // narrow + listed or narrow + stepfree is impossible on one bay
  if (twists.includes('narrow') && (twists.includes('listed') || twists.includes('stepfree')) ) twists = twists.filter(t => t !== 'narrow');

  if (twists.length > 3) {
    const keep = [...need];
    if (opts.callback) keep.push(twists[0]);
    for (const [a, b, ok] of CONFLICTS) if (ok && twists.includes(a) && twists.includes(b) && keep.length <= 1) keep.push(a, b);
    for (const t of twists) if (keep.length < 3 && !keep.includes(t)) keep.push(t);
    twists = [...new Set(keep)].slice(0, 3);
  }
  for (const t of twists) {
    if (t === 'tight') { c.budgetCap = 8000 + Math.min(tier, 6) * 1000 + (twists.includes('cold') ? 6000 : 0); c.rules.forbid = [...(c.rules.forbid || []), 'revolve']; }
    if (t === 'fragile') { mix.elderly = Math.max(mix.elderly || 0, 0.5); goals.bumpsCap = 0; }
    if (t === 'narrow') slots = Math.max(1, slots - 1);
    if (t === 'wind') { c.wind = 3; if (!(first && warm)) temp = Math.min(temp, 4); }
    if (t === 'surge') { crowdIn *= 1.6; crowdOut *= 0.4; goals.laps = 1; }
    if (t === 'listed') { const mid = Math.floor((slots - 1) / 2); c.rules.fixed = { [mid]: { type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 4, flow: 'both' } }; }
    if (t === 'stepfree') { mix.wheel = Math.max(mix.wheel || 0, 0.06); mix.pram = Math.max(mix.pram || 0, 0.05); goals.access = true; }
    if (t === 'kids') mix.kid = Math.max(mix.kid || 0, 0.15);
    if (t === 'tourists') mix.tourist = Math.max(mix.tourist || 0, 0.25);
    if (t === 'bikes') { mix.bike = Math.max(mix.bike || 0, 0.08); goals.bikes = true; }
    if (t === 'rain') c.rain = true;
    if (t === 'drill') c.drill = { at: TEST_SECONDS, n: 42 + Math.min(tier, 6) * 3 };
    if (t === 'nofire') c.rules.forbid = [...(c.rules.forbid || []), 'swing'];
    // a cold snap; on a door-closer or air-curtain call it's a raw day rather than a hard frost (they're the cheap
    // fixes for a chill, and a frost pushes through a curtain)
    if (t === 'cold') { const frost = -3 - Math.round(rng() * 4); temp = Math.min(temp, lesson === 'closer' || lesson === 'curtain' ? 5 : frost); }
  }
  // the month's event: first visits keep their hand-picked hook
  const ev = !first && opts.event ? Object.values(EVENTS).find(e => e.key === opts.event) : null;
  if (ev) {
    c.event = ev.key;
    if (ev.key === 'sales') { crowdIn *= 1.25; crowdOut *= 1.25; mix.case = Math.max(mix.case || 0, 0.3); }
    if (ev.key === 'storm') { c.rain = true; if (tech.mouth) c.wind = Math.max(c.wind, 2); temp = Math.min(temp, 6); }
    if (ev.key === 'marathon') { crowdOut *= 1.8; crowdIn *= 0.8; mix.pram = Math.max(mix.pram || 0, 0.12); }
    if (ev.key === 'heatwave') { temp = 29 + Math.round(rng() * 3); c.heat = true; twists = twists.filter(t => t !== 'cold'); }
    if (ev.key === 'blackfriday') { crowdIn *= 1.5; crowdOut *= 1.2; }
    if (ev.key === 'xmas') temp = Math.min(temp, 4);
  }
  if (first && k.hook.budgetCap) c.budgetCap = k.hook.budgetCap;
  // a callback the installed doors already cope with is no callback at all: the surveyor re-asks at a higher
  // severity (opts.severity 1-3), and the client's change gets stronger until the old doors genuinely fall short
  const sev = opts.callback ? Math.min(3, opts.severity || 0) : 0;
  if (sev) {
    const why = opts.callback;
    if (why === 'busier') { crowdIn *= 1 + 0.22 * sev; crowdOut *= 1 + 0.12 * sev; }
    if (why === 'cold') temp -= 3 * sev;
    if (why === 'older' || why === 'safety') mix.elderly = Math.min(0.85, Math.max(mix.elderly || 0, 0.5) + 0.12 * sev);
    if (why === 'access') { mix.wheel = Math.max(mix.wheel || 0, 0.06) + 0.03 * sev; mix.pram = Math.max(mix.pram || 0, 0.05) + 0.02 * sev; }
    if (why === 'hot') { temp = Math.max(temp, 28 + 2 * sev); c.heat = true; }
  }
  // a street change is a moderate shift in the client's normal day, not a full twist: doors with room to
  // spare should ride it out
  if (opts.check) {
    const why = opts.callback;
    if (why === 'busier') { crowdIn *= 1.25; crowdOut *= 1.15; }
    if (why === 'older') mix.elderly = Math.min(0.6, (mix.elderly || 0) + 0.25);
    if (why === 'cold') temp = Math.min(temp, SEASON_T[month % 12] - 7);
    if (why === 'hot') { temp = Math.max(temp, 28); c.heat = true; }
    if (why === 'access') { mix.wheel = Math.max(mix.wheel || 0, 0.05); mix.pram = Math.max(mix.pram || 0, 0.04); c.checkAccess = true; }
  }
  if (opts.existing) slots = opts.existing.length;   // a callback keeps the frontage you built
  if (k.station) slots = Math.max(slots, twists.includes('narrow') ? 2 : 3);
  c.slots = slots;
  c.site = buildSite(kindKey, slots);
  if (c.event === 'xmas' && !k.station) {
    // a small crowd stands in front of each window display, just beyond the doors' reach
    const HW = slots * SLOT_W / 2, cx = i => -HW + SLOT_W / 2 + i * SLOT_W;
    for (const i of xmasBays(slots)) {
      c.site.decos.push({ kind: 'window', x0: cx(i) - 1.2, x1: cx(i) + 1.2 });
      for (const dx of [-0.5, 0, 0.5]) c.site.obstacles.push({ kind: 'person', x: cx(i) + dx, y: -1.75 + (dx ? 0.08 : -0.06), r: 0.2, gazer: true });
      c.site.labels.push({ x: cx(i), y: -2.2, text: 'Window display' });
    }
  }
  c.outsideTemp = temp;
  c.crowd = { in: +crowdIn.toFixed(2), out: +crowdOut.toFixed(2), mix };
  if (k.cinema) {
    // the film ends at 22s and the whole audience pours out at once
    const house = Math.round(30 * scale * (twists.includes('surge') ? 1.3 : 1));
    c.crowd.phases = [{ until: 22, in: +crowdIn.toFixed(2), out: 0.15 }, { until: 30, in: 0.2, out: +(house / 8).toFixed(2) }, { until: 1e9, in: +crowdIn.toFixed(2), out: 0.3 }];
    c.crowd.out = +(house / 40 + 0.2).toFixed(2);
  }
  if (k.towers) {
    temp = Math.min(temp, 8);
    // a tall building pulls cold air in at the doors (the stack effect), and the day comes in three waves
    c.stack = 1;
    c.crowd.phases = [{ until: 15, in: +crowdIn.toFixed(2), out: 0.2 }, { until: 26, in: +(crowdIn * 0.35).toFixed(2), out: +(crowdOut * 0.35).toFixed(2) }, { until: 1e9, in: 0.2, out: +crowdOut.toFixed(2) }];
    c.crowd.in = +(crowdIn * 0.5).toFixed(2); c.crowd.out = +(crowdOut * 0.5).toFixed(2);
    c.landmark = 'towers';
    goals.laps = null;
  }
  if (k.station) {
    // morning: commuters pour in. Evening: trains empty out up the escalators every few seconds.
    const busy = twists.includes('surge') ? 1.25 : 1;
    c.crowd.phases = [{ until: TEST_SECONDS / 2, in: +(crowdIn * busy).toFixed(2), out: 0.3 }, { until: 1e9, in: 0.4, out: +crowdOut.toFixed(2) }];
    c.crowd.in = +((crowdIn * busy + 0.4) / 2).toFixed(2); c.crowd.out = +((0.3 + crowdOut) / 2 + 0.6).toFixed(2);
    c.site.trains = { ...c.site.trains, n: Math.round(16 * scale * busy * (slots === 2 ? 0.7 : 1)) };
    if (slots === 2) c.crowd.phases[0].in = +(c.crowd.phases[0].in * 0.7).toFixed(2);
    c.rules.forbid = ['revolve', 'swing', 'slider'];
    c.landmark = 'station';
  }
  const arrivals = (c.crowd.in + c.crowd.out) * TEST_SECONDS;
  goals.bumps = goals.bumpsCap != null ? goals.bumpsCap : Math.max(2, Math.round(arrivals * 0.05));
  delete goals.bumpsCap;
  goals.minTemp = k.comfort ? Math.max(k.comfort, temp < 12 ? 16 : 0) : (temp < 12 ? 16 : null);
  if (c.checkAccess) goals.access = true;
  // specialist clients are fussy: they want a properly warm lobby, which needs the new tech
  if (isSpecialist(twists)) goals.minTemp = Math.max(goals.minTemp || 0, 19);
  // a station concourse is open to the air: nobody heats it
  if (k.station) { goals.minTemp = null; goals.laps = null; c.heat = false; }
  // in a heatwave the lobby must stay cool instead
  if (c.heat) { goals.minTemp = null; goals.maxTemp = isSpecialist(twists) || k.comfort ? 22 : 23; }
  // stronger callbacks set a stricter bar: a warmer lobby in the cold, a cooler one in the heat, fewer bumps
  if (sev && opts.callback === 'cold' && goals.minTemp != null) goals.minTemp += sev;
  if (sev && opts.callback === 'hot' && goals.maxTemp != null) goals.maxTemp -= Math.min(sev, 2) * 0.5;
  c.goals = goals;
  c.twists = twists;
  c.specialist = isSpecialist(twists);
  c.opts = opts;
  if (opts.callback === 'botched') c.rescue = true;   // putting right the rival's work pays a premium
  // a research call teaches its research: the surveyor sets a goal only designs that use it can meet
  c.lesson = lesson;
  if (lesson && LESSON_GOALS[lesson].forbid) c.rules.forbid = [...new Set([...(c.rules.forbid || []), ...LESSON_GOALS[lesson].forbid])];
  if (opts.existing) c.existing = opts.existing;
  else if (c.rules.fixed) c.existing = Array.from({ length: slots }, (_, i) => c.rules.fixed[i] ? { ...c.rules.fixed[i] } : { type: 'wall' });
  return c;
}

// the thing a test runs: a World for doors, or the stage's own sim for an inside job. preview: no crowd, for design mode
export function newSim(contract, design, tech, preview) {
  if (contract.stage) return newStageSim(preview ? { ...contract, preview: true } : contract, design, tech);
  const cfg = worldCfg(contract, design, tech);
  return new World(preview ? { ...cfg, crowd: { in: 0, out: 0, mix: {} }, duration: 0 } : cfg);
}
export function worldCfg(contract, slots, tech) {
  const t = tech || {};
  return { slots, crowd: contract.crowd, outsideTemp: contract.outsideTemp, duration: TEST_SECONDS, seed: contract.seed,
    heater: t.heat >= 3 ? 3 : t.heat2 || t.heat >= 2 ? 2.4 : t.heat ? 1.6 : 1, wind: contract.wind || 0, stack: contract.stack || 0, seals: +t.seals || 0, rain: !!contract.rain, site: contract.site, drill: contract.drill || null };
}
// how long a test runs: the 40s rush plus time for the last people to clear, or a fire drill's evacuation window
export const runSeconds = contract => contract.stage ? contract.run : contract.drill ? contract.drill.at + 35 : RUN_SECONDS;
// shared by the surveyor and the in-game test, so both stop at exactly the same step
export const testOver = (contract, w) => contract.stage ? w.over() : !!contract.drill && w.stats.evac != null;
export function runHeadless(contract, slots, unlocks, dt = SIM_DT) {
  if (contract.stage) return runStage(contract, slots, unlocks);
  const w = new World(worldCfg(contract, slots, unlocks));
  const n = Math.round(runSeconds(contract) / dt);
  for (let i = 0; i < n && !testOver(contract, w); i++) w.step(dt);
  return { ...w.stats, wait: w.waitP90(), minTemp: w.minTemp, maxTemp: w.maxTemp, evac: w.stats.evac == null ? (contract.drill ? 99 : null) : w.stats.evac };
}
export function meetsSoft(contract, r) {
  const g = contract.goals;
  return r.bumps <= g.bumps && (g.minTemp == null || r.minTemp >= g.minTemp) && (g.maxTemp == null || r.maxTemp <= g.maxTemp) && (g.wait == null || r.wait <= g.wait) && (!g.access || r.accessFail === 0) && (!g.bikes || r.bikeFail === 0) && (g.laps == null || r.laps <= g.laps)
    && (g.evac == null || r.evac <= g.evac);
}

export function candidates(contract, unlocks) {
  if (BUILDING[contract.kind].candidates) return BUILDING[contract.kind].candidates(contract, unlocks);   // e.g. the station's gate lines
  const n = contract.slots, out = [], tw = contract.twists || [];
  const wall = { type: 'wall' };
  const cold = contract.goals.minTemp != null || contract.goals.maxTemp != null;   // either way, leaky doors need help
  // core and mouth stay at the factory setting until you research the adjusters
  const rev = (o) => {
    const r = { type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 4.5, flow: 'both', ...o };
    if (!unlocks.core) r.core = 0.15;
    if (!unlocks.mouth) r.mouth = 40;
    return r;
  };
  const P = [rev({ wings: 3, mouth: 35, rpm: 4 }), rev({})];
  const windy = tw.includes('wind') || contract.wind > 0;
  if (windy) P.push(rev({ mouth: 28 }), rev({ wings: 5, mouth: 30, rpm: 4 }));
  if (tw.includes('fragile')) P.push(rev({ rpm: 3 }), rev({ rpm: 3.5, mouth: 45, core: 0.3 }));
  if (tw.includes('surge')) P.push(rev({ rpm: 6, core: 0.35 }), rev({ rpm: 6, core: 0.35, mouth: 45 }), rev({ rpm: 6 }));
  if (unlocks.padded) P.push(rev({ mouth: 45, core: 0.3, rpm: 6.5, padded: true }));
  if (unlocks.padded && tw.includes('fragile')) P.push(rev({ rpm: 4, padded: true }), rev({ rpm: 4.5, mouth: 45, padded: true }), rev({ rpm: 5, core: 0.3, padded: true }));
  if (unlocks.sensor && tw.includes('fragile')) P.push(rev({ rpm: 5, sensor: true }), rev({ rpm: 5.5, core: 0.3, sensor: true }), rev({ rpm: 6, mouth: 45, sensor: true }));
  if (unlocks.sensor && tw.includes('kids')) P.push(rev({ rpm: 5.5, sensor: true }), rev({ rpm: 6.5, mouth: 45, sensor: true }));
  if (unlocks.doorman && (tw.includes('surge') || tw.includes('tourists') || contract.goals.laps != null)) P.push(rev({ rpm: 6, doorman: true }), rev({ rpm: 5, doorman: true }), rev({ rpm: 6.5, mouth: 45, doorman: true }));
  if (unlocks.seals && windy) P.push(rev({ mouth: 45, rpm: 5 }));
  { const seen = new Set(); for (let i = P.length - 1; i >= 0; i--) { const k = JSON.stringify(P[i]); if (seen.has(k)) P.splice(i, 1); else seen.add(k); } }
  const wideP = unlocks.wide ? [rev({ wide: true, wings: 3, mouth: 32, rpm: 3.5 }), rev({ wide: true, wings: 3, mouth: 30, rpm: 4 })] : [];
  // open doors get an air curtain (and swing doors a closer) whenever the lobby's temperature matters
  const gap = (t, o = {}) => ({ type: t, curtain: !!(cold && unlocks.curtain), ...(t === 'swing' && cold && unlocks.closer ? { closer: true } : {}), flow: 'both', ...o });
  const place = (items) => {
    const s = Array.from({ length: n }, () => ({ ...wall }));
    if (items.length > n) return null;
    const idx = items.length === 1 ? [Math.floor((n - 1) / 2)] : items.map((_, i) => Math.round(i * (n - 1) / (items.length - 1)));
    items.forEach((it, i) => { s[idx[i]] = { ...it }; });
    return s;
  };
  const access = contract.goals.access;
  for (let k = 1; k <= Math.min(n, 3); k++) for (const p of P) {
    const items = Array.from({ length: k }, () => p);
    if (access) { if (k < n) items.splice(Math.floor(k / 2), 0, gap('slider', { button: true })); else continue; }
    out.push(place(items));
  }
  for (let k = 1; k <= Math.min(n, 3); k++) for (const p of wideP) {
    out.push(place(Array.from({ length: k }, () => p)));
    if (k < n) out.push(place([...Array.from({ length: k }, () => p), P[1]]));
  }
  const vest = cold && unlocks.vestibule ? [false, true] : [false];
  for (const v of vest) {
    const g2 = (t, o = {}) => gap(t, { ...o, vestibule: v });
    for (let k = 1; k <= Math.min(n, 2); k++) {
      out.push(place(Array.from({ length: k }, () => g2('slider'))));
      out.push(place(Array.from({ length: k }, () => g2('swing'))));
    }
    if (n >= 2) {
      out.push(place([g2('swing', { flow: 'in' }), g2('swing', { flow: 'out' })]));
      if (v) out.push(place([g2('slider', { flow: 'in' }), g2('slider', { flow: 'out' })]));
    }
    if (v && access) for (const p of P.slice(0, 2)) out.push(place([p, g2('slider', { button: true })]));
  }
  if (n >= 2) {
    out.push(place([gap('swing', { flow: 'in' }), gap('swing', { flow: 'out' })]));
    out.push(place([gap('slider', { flow: 'in' }), gap('slider', { flow: 'out' })]));
  }
  // cyclists need a door that isn't revolving
  if (tw.includes('bikes') && n >= 2) for (const p of P.slice(0, 2)) for (const t of ['slider', 'swing']) {
    out.push(place([p, gap(t)]));
    if (n >= 3) out.push(place([p, gap(t), p]));
  }
  // steps everywhere but the ramp: the step-free door has to go in a ramp bay
  const ramps = contract.site && contract.site.rampBays;
  if (access && ramps) for (const rb of ramps) for (const p of [...P.slice(0, 2), ...wideP]) {
    const s1 = Array.from({ length: n }, (_, i) => i === rb ? gap('slider', { button: !p.wide }) : { ...p });
    out.push(s1);
    if (p.wide) out.push(Array.from({ length: n }, (_, i) => i === rb ? { ...p } : { ...P[1] }));
  }
  // listed door: fill the remaining bays around the fixed revolving door
  if (contract.rules && contract.rules.fixed) {
    const fixedIdx = +Object.keys(contract.rules.fixed)[0];
    const others = [...Array(n).keys()].filter(i => i !== fixedIdx);
    const fills = [[], [gap('slider')], [gap('slider'), gap('slider')], [gap('slider', { flow: 'in' }), gap('slider', { flow: 'out' })],
      [gap('swing', { flow: 'in' }), gap('swing', { flow: 'out' })], [P[0]], [P[1]], [P[1], P[1]]];
    if (access) fills.push([gap('slider', { button: true })], [gap('slider', { button: true }), P[1]]);
    for (const f of fills) {
      const s = Array.from({ length: n }, () => ({ ...wall }));
      s[fixedIdx] = { ...contract.rules.fixed[fixedIdx] };
      f.forEach((it, i) => { if (others[i] != null) s[others[i]] = { ...it }; });
      out.push(s);
    }
  }
  // door closers: swing doors kept warm by a closer alone, or by an air curtain alone, to compare
  if (unlocks.closer && cold) {
    const sw = o => ({ type: 'swing', flow: 'both', ...o });
    out.push(place([sw({ closer: true })]));
    if (n >= 2) out.push(place([sw({ closer: true, flow: 'in' }), sw({ closer: true, flow: 'out' })]));
    if (unlocks.curtain && n >= 2) out.push(place([sw({ curtain: true, flow: 'in' }), sw({ curtain: true, flow: 'out' })]));
  }
  // automatic swing doors: step-free swing doors, one-way in pairs or split by lane barriers
  if (unlocks.autoswing) {
    const auto = o => gap('swing', { auto: true, ...o });
    if (n >= 2) out.push(place([auto({ flow: 'in' }), auto({ flow: 'out' })]));
    if (unlocks.barriers) { out.push(place([auto({ lanes: true })])); if (n >= 2) out.push(place([auto({ lanes: true }), auto({ lanes: true })])); }
    if (access) for (const p of P.slice(0, 2)) if (n >= 2) out.push(place([p, auto(unlocks.barriers ? { lanes: true } : {})]));
  }
  // telescopic sliders: one wide opening, or a wide pair
  if (unlocks.telescopic) {
    out.push(place([gap('slider', { tele: true })]));
    if (n >= 2) { out.push(place([gap('slider', { tele: true }), gap('slider', { tele: true })])); out.push(place([gap('slider', { tele: true, flow: 'in' }), gap('slider', { tele: true, flow: 'out' })])); }
  }
  // one swing door with lane barriers: cheap two-way without the clipping
  if (unlocks.barriers) {
    out.push(place([gap('swing', { lanes: true })]));
    if (n >= 2) out.push(place([gap('swing', { lanes: true }), gap('swing', { lanes: true })]));
  }
  // fire drills: try every layout with and without a pillar inside each exit
  if (contract.drill && unlocks.pillars) {
    // pillars matter where exits are few: only try them on layouts with one or two doors
    const withP = out.filter(s => s && s.filter(d => d.type !== 'wall').length <= 2).map(s => s.map(d => d.type === 'wall' ? d : { ...d, pillar: true }));
    out.push(...withP);
  }
  const seen = new Set();
  return out.filter(s => {
    if (!s) return false;
    if (contract.rules && contract.rules.fixed) for (const [i, f] of Object.entries(contract.rules.fixed)) s[i] = { ...f };
    if (violatesRules(contract, s)) return false;
    if (contract.budgetCap != null && designCost(s, contract.existing) > contract.budgetCap) return false;
    const key = JSON.stringify(s); if (seen.has(key)) return false; seen.add(key); return true;
  });
}

// A research job teaches its research. Of the passing designs (cheapest first), those that use it (F) and
// those that don't (O): the lesson's goal is set between the best of each, so every F design can meet it and
// no O design can. If they can't be told apart, or nothing uses the research, the job is flagged unfair and
// redrawn. A price lesson (no metric): the cheapest pass uses the research, and the budget is set below every
// design that doesn't.
export function lessonGoal(contract, passing) {
  const L = LESSON_GOALS[contract.lesson], uses = x => x.slots.some(L.uses);
  const F = passing.filter(uses), O = passing.filter(x => !uses(x));
  if (!F.length) { contract.relaxed = true; return passing; }
  if (!O.length) return passing;
  const m = L.metric, g = contract.goals;
  if (!m) {
    // a price lesson: the research is the cheap way through, and the budget stops short of every other way
    const cap = Math.floor((Math.min(...O.map(x => x.cost)) - 1) / 100) * 100;
    if (!uses(passing[0]) || cap < passing[0].cost) { contract.relaxed = true; return passing; }
    contract.lessonCap = cap;
    return F;
  }
  const low = m === 'laps' || m === 'bumps' || m === 'evac';
  const v = x => (x.r[m] == null ? (low ? Infinity : -Infinity) : x.r[m]);
  const bestF = low ? Math.min(...F.map(v)) : Math.max(...F.map(v)), bestO = low ? Math.min(...O.map(v)) : Math.max(...O.map(v));
  if (low ? !(bestF < bestO) : !(bestF > bestO)) { contract.relaxed = true; return passing; }
  let goal;
  if (m === 'laps' || m === 'bumps') goal = bestO - 1;                     // whole people: one fewer than the best without
  else if (m === 'through') goal = bestO + 1;                              // one more through than the best without
  else goal = +((bestF + bestO) / 2).toFixed(1);                           // halfway (seconds, degrees)
  if (m === 'laps') g.laps = goal; else if (m === 'bumps') g.bumps = goal; else if (m === 'evac') g.evac = goal; else if (m === 'through') g.through = goal; else g.minTemp = goal;
  const meets = x => low ? v(x) <= goal : v(x) >= goal;
  const kept = F.filter(meets);
  if (!kept.length) { contract.relaxed = true; return passing; }
  return kept;
}

// several surveys can run at once; the one the player is waiting on goes first
export const GATE = { focus: null, active: new Set() };
export async function yieldStep(job) {
  await new Promise(res => setTimeout(res, 0));
  while (GATE.focus != null && GATE.focus !== job && GATE.active.has(GATE.focus)) await new Promise(res => setTimeout(res, 15));
}
export async function solveContract(contract, unlocks, onProgress) {
  if (contract.stage) return solveStage(contract, unlocks, onProgress, yieldStep);
  let cands = candidates(contract, unlocks);
  // a lesson job also tries what a firm without the research would fit, so the lesson's goal is set above all of it
  if (contract.lesson) {
    const without = { ...unlocks }; delete without[contract.lesson];
    const seen = new Set(cands.map(s => JSON.stringify(s)));
    cands = [...cands, ...candidates(contract, without).filter(s => !seen.has(JSON.stringify(s)))];
  }
  const results = [];
  for (let i = 0; i < cands.length; i++) {
    const r = runHeadless(contract, cands[i], unlocks);
    results.push({ slots: cands[i], r, cost: designCost(cands[i], contract.existing) });
    if (onProgress) onProgress((i + 1) / cands.length);
    await yieldStep(contract.job);
  }
  let ok = results.filter(x => meetsSoft(contract, x.r));
  contract.relaxed = !ok.length;
  if (!ok.length) {
    const g = contract.goals;
    const best = results.slice().sort((a, b) => (a.r.bumps - b.r.bumps) || (b.r.minTemp - a.r.minTemp) || (a.r.maxTemp - b.r.maxTemp) || (b.r.through - a.r.through))[0];
    g.bumps = Math.max(g.bumps, best.r.bumps);
    if (g.minTemp != null && best.r.minTemp < g.minTemp) g.minTemp = Math.floor(best.r.minTemp);
    if (g.maxTemp != null && best.r.maxTemp > g.maxTemp) g.maxTemp = Math.ceil(best.r.maxTemp);
    if (g.laps != null && best.r.laps > g.laps) g.laps = best.r.laps;
    if (g.access && best.r.accessFail) g.access = false;
    if (g.bikes && best.r.bikeFail) g.bikes = false;
    ok = results.filter(x => meetsSoft(contract, x.r));
    if (!ok.length) ok = [best];
  }
  // fire drill: the target is a little slower than the best evacuation found among otherwise-passing designs
  if (contract.drill) {
    const evac = x => x.r.evac == null ? Infinity : x.r.evac;   // null: the lobby never cleared
    const bestEvac = Math.min(...ok.map(evac));
    if (bestEvac >= 99) contract.relaxed = true;
    contract.goals.evac = Math.ceil(Math.min(bestEvac, 34) * 1.15 + 0.5);
    const quick = ok.filter(x => evac(x) <= contract.goals.evac);
    // nothing clears the lobby in time: an unfair drill. Keep the quickest design so the job stays solvable
    // (its target is what that design manages) and flag it so it gets rerolled
    if (quick.length) ok = quick;
    else { contract.relaxed = true; ok = [ok.slice().sort((a, b) => evac(a) - evac(b))[0]]; if (evac(ok[0]) < 99) contract.goals.evac = Math.ceil(evac(ok[0]) * 1.15 + 0.5); }
  }
  const topThrough = Math.max(...ok.map(x => x.r.through));
  // a contract where even the best design moves a trickle is pointless: treat it as unfair
  const expected = (contract.crowd.in + contract.crowd.out) * TEST_SECONDS;
  if (topThrough < expected * 0.45) contract.relaxed = true;
  // a street-change check asks whether the doors still do the job, not whether they match the best layout
  // there is: doors with room to spare should cope
  const share = contract.opts && contract.opts.check ? 0.8 : contract.landmark ? 0.9 : (contract.twists || []).includes('surge') ? 0.95 : 0.88;
  contract.goals.through = Math.max(5, Math.floor(topThrough * share));
  // ...and on a check, "still does the job" means serving most of the crowd that turns up, whatever the best layout could do
  if (contract.opts && contract.opts.check) contract.goals.through = Math.min(contract.goals.through, Math.floor(expected * 0.75));
  // on a callback the doors you already have must not be enough: raise the bar above them
  // (not on a street-change check: there the question is exactly whether the doors already cope)
  if (contract.existing && contract.opts && contract.opts.callback && !contract.opts.check) {
    const r0 = runHeadless(contract, contract.existing, unlocks);
    const better = ok.filter(x => x.cost > 0).map(x => x.r.through);
    if (meetsSoft(contract, r0) && r0.through >= contract.goals.through) {
      const want = r0.through + Math.max(3, Math.round(r0.through * 0.06));
      if (better.length && Math.max(...better) >= want) contract.goals.through = want;
    }
    // how the doors you already fitted do against the new brief, for the brief to show
    contract.before = { through: r0.through, bumps: r0.bumps, minTemp: +r0.minTemp.toFixed(1), maxTemp: +r0.maxTemp.toFixed(1), accessFail: r0.accessFail, laps: r0.laps };
  }
  // a street-change check tries the client's own doors exactly as they stand: if they still pass, that's the answer
  if (contract.opts && contract.opts.check && contract.existing) {
    const r0 = runHeadless(contract, contract.existing, unlocks);
    if (meetsSoft(contract, r0)) ok = [{ slots: contract.existing, r: r0, cost: 0 }, ...ok];
  }
  let passing = ok.filter(x => x.r.through >= contract.goals.through).sort((a, b) => a.cost - b.cost);
  if (!passing.length) {
    // nothing moves enough people: an unfair contract. Keep it solvable and flag it so it gets rerolled.
    contract.relaxed = true;
    const top = ok.slice().sort((a, b) => b.r.through - a.r.through)[0];
    contract.goals.through = top.r.through;
    passing = [top];
  }
  // a station also has to keep the queues short: 9 in 10 commuters through within a time set by the best designs
  if (contract.landmark && passing.length) {
    const best = Math.min(...passing.map(x => x.r.wait));
    contract.goals.wait = Math.ceil(best * 1.4 * 2) / 2;
    passing = passing.filter(x => x.r.wait <= contract.goals.wait);
  }
  if (contract.lesson) passing = lessonGoal(contract, passing);
  const par = passing[0];
  contract.par = { cost: par.cost, slots: par.slots, through: par.r.through, sig: designSig(par.slots) };
  // how many genuinely different designs pass: a measure of how open the puzzle is
  contract.distinct = new Set(passing.map(x => designSig(x.slots))).size;
  const parCost = Math.max(par.cost, 2500);
  // fee = the par hardware cost + your margin. Bonuses (specialist, sales, HQ) only ever scale the margin.
  contract.budget = Math.min(contract.budgetCap != null ? contract.budgetCap : Math.ceil(parCost * 1.5 / 500) * 500 + 3000, contract.lessonCap ?? Infinity);
  contract.margin = Math.ceil((Math.max(3000, par.cost * 0.3) + Math.min(contract.tier, 6) * 800) * (contract.specialist ? 1.6 : 1) * (contract.event ? 1.25 : 1) * (contract.landmark ? 1.5 : 1) * (contract.rescue ? 1.3 : 1) / 500) * 500;
  contract.fee = par.cost + contract.margin;
  contract.solved = true;
  return contract;
}


// Twists that break a given answer, strongest first. Swing doors meet the fire officer (no swing doors); open
// doors alone meet a listed revolving door to work around; revolving doors meet a budget with no room for
// one, cyclists or step-free access. In a new firm's first summer there's no cold or gale to lean on.
export function answerBreakers(sig, firstSummer) {
  const types = new Set(sig.split(',').filter(Boolean).map(t => t[0]));
  const out = [];
  if (types.has('s')) out.push('nofire');
  if (!types.has('r')) out.push('listed', ...(firstSummer ? ['surge', 'stepfree', 'bikes'] : ['wind', 'cold', 'surge']));
  else out.push('tight', 'bikes', 'stepfree', 'fragile', 'surge', 'wind');
  return out;
}

// Make a contract and solve it, retrying when the result would be a bad puzzle:
//  - unfair: nothing passes without watering the goals down -> reroll the twists
//  - free: the existing doors already pass (a callback you fix for £0) -> add a counter-twist
//  - repeat: the best answer matches one the player used recently -> add a counter-twist
export async function generateSolved(contract, unlocks, recent, onProgress) {
  const job = contract.job != null ? contract.job : contract.seed;
  GATE.active.add(job);
  try { return await generateSolvedInner(contract, unlocks, recent, onProgress, job); }
  finally { GATE.active.delete(job); }
}
export async function generateSolvedInner(contract, unlocks, recent, onProgress, job) {
  contract.job = job;
  let c = contract, best = null;
  const MAX = 3;
  let severity = (contract.opts && contract.opts.severity) || 0;
  for (let attempt = 0; attempt < MAX; attempt++) {
    if (onProgress) onProgress(0, attempt);
    try { await solveContract(c, unlocks, f => onProgress && onProgress(f, attempt)); }
    catch (err) { c.relaxed = true; c.par = c.par || { cost: 0, slots: [], through: 0, sig: '' }; c.broken = true; }
    const free = c.par.cost === 0 && !!c.existing;
    // first visits count too: two new clients in a row shouldn't have the same answer either
    // (not a callback, a check or an inspection: those keep the frontage you built, so the fix is often one you've
    // used before, and redrawing the client's problem to dodge it would make it a different job)
    const own = !!(c.opts && (c.opts.check || c.opts.inspection || (c.opts.callback && c.opts.callback !== 'paradox')));
    const repeat = !own && !!recent && recent.includes(c.par.sig);
    if (!c.relaxed && (!best || best.relaxed || best.free || best.repeat)) best = c;
    c.free = free; c.repeat = repeat;
    if (!c.relaxed && !free && !repeat) return c;
    const opts = { ...(c.opts || {}) };
    // a callback the old doors already pass: turn up the client's change before trying anything else.
    // These retries don't count against MAX: severity is capped, so this loop always ends.
    // (Not a street-change check or a failed inspection: those replay a real day, and if the doors cope with it,
    // the client copes. A research call turns it up as far as it needs, since it must teach the research; a client
    // wanting more or the rival's work get one step, then the doors coping is the answer: a false alarm.)
    if (free && !c.relaxed && (opts.callback || c.stage) && !opts.check && !opts.inspection && severity < (opts.callback === 'paradox' ? 3 : 1)) {
      severity++;
      c = makeContract(c.kind, c.tier, c.month, c.seed, { ...opts, severity }); c.job = job;
      attempt--;
      continue;
    }
    // still nothing to fix even at its worst: the doors genuinely beat that problem, so the client calls
    // about a different one (a cold snap, an older crowd, a busier street) instead
    if (free && !c.relaxed && opts.callback === 'paradox' && !c.stage && (opts.switched || 0) < 2) {
      const order = ['cold', 'older', 'busier', 'access'].filter(r => r !== opts.callback);
      const next = order[(opts.switched || 0) % order.length];
      severity = 0;
      c = makeContract(c.kind, c.tier, c.month, c.seed, { ...opts, callback: next, severity: 0, switched: (opts.switched || 0) + 1 }); c.job = job;
      attempt--;
      continue;
    }
    if (attempt === MAX - 1) break;
    if ((opts.check || opts.inspection) && free) break;   // a street-change check or an inspection replay: the old setup copes, and that's the answer
    // any other callback the doors still cope with: that's the answer (a false alarm), not a redraw
    if (free && !c.relaxed && opts.callback && opts.callback !== 'paradox') return c;
    if (c.stage && !c.relaxed) { if (repeat) { opts.extra = []; c = makeContract(c.kind, c.tier, c.month, c.seed + 53 * (attempt + 1), opts); c.job = job; c.novelty = true; continue; } break; }
    // a research call whose own twist makes it unfair (a surge no frontage can move): calm the crowd and
    // try again, rather than settle for a goal of a handful of people. Doesn't count against MAX.
    if (c.relaxed && (opts.need || []).length && (opts.calm || 0) < 3) {
      c = makeContract(c.kind, c.tier, c.month, c.seed, { ...opts, calm: (opts.calm || 0) + 1 }); c.job = job;
      attempt--;
      continue;
    }
    if (c.relaxed) {
      // unfair combination: same building and callback reason, fresh random twists
      c = makeContract(c.kind, c.tier, c.month, c.seed + 101 * (attempt + 1), { ...opts, extra: [] }); c.job = job;
    } else {
      const banned = c.existing ? ['listed', 'narrow'] : [];
      // a new firm's first summer stays warm (see makeContract): no cold or gales
      const firstSummer = c.month < 12 && SEASON_T[c.month % 12] >= 12;
      const ct = (c.opts && c.opts.tech) || unlocks, allowed = t => !c.twists.includes(t) && !banned.includes(t) && !(firstSummer && (t === 'cold' || t === 'wind')) && !clashes(c.twists, t, ct) && (!TWIST_REQ[t] || TWIST_REQ[t](ct));
      // the twist that breaks this particular answer, strongest first
      // (only twists this client can have: its own pool, if it has one)
      const own = BUILDING[c.kind].twistPool, mine = t => !own || own.includes(t);
      const pool = answerBreakers(c.par.sig, firstSummer).filter(t => allowed(t) && mine(t));
      const rest = (own || TWIST_POOL).filter(allowed);
      if (!pool.length && !rest.length) break;
      opts.extra = [...(opts.extra || []), pool.length ? pool[0] : rest[Math.floor(makeRng(c.seed + attempt)() * rest.length)]];
      c = makeContract(c.kind, c.tier, c.month, c.seed, opts); c.job = job;
    }
    c.novelty = true;
  }
  if (best && !best.relaxed) return best;
  // every version was unfair: fall back to a plain job with no extra twists
  try {
    const plain = makeContract(contract.kind, contract.tier, contract.month, contract.seed + 997, { ...(contract.opts || {}), extra: [], plain: true }); plain.job = job;
    await solveContract(plain, unlocks);
    if (!plain.relaxed) return plain;
    if (!c.broken) return plain;
  } catch (err) { /* fall through */ }
  if (c.broken) throw new Error('survey failed');
  return c;
}
export { KINDS, buildSite };
