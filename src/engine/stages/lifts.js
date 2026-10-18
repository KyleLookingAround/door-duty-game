// Lift zoning: in the morning rush every lift stopping at every floor spends most of its trip opening doors.
// Split the lifts so some serve only the low floors and the rest run express to the high ones, and each trip
// makes fewer stops, so the same lifts carry more people: often as many as an extra lift would.
// Two more levers, as real lift banks are run (not on research calls, which stay about zoning):
//  - Destination keypads: you key in your floor and the lift group puts people going to nearby floors in the
//    same car, so trips are short. Visitors who don't use the keypad get in the wrong car and ride back down.
//  - Door time: how long a car waits in the lobby before it goes. Short sends half-empty cars sooner; long
//    fills them but keeps everyone waiting.
import { StageSim } from './common.js';

const LOBBY_Y = 4.2, FLOOR_H = 0.42, CAP = 12, DEST_COST = 12000, DWELL_COST = 500;
export const DWELLS = { short: 4, standard: 7, long: 11 };

class LiftSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    const n = d.count, F = c.params.floors;
    const lowN = d.mode === 'zoned' ? Math.max(1, Math.round(n * 0.45)) : n, split = Math.floor(F / 2);
    this.groups = d.mode === 'zoned'
      ? [{ from: 1, to: split, q: [] }, { from: split + 1, to: F, q: [] }]
      : [{ from: 1, to: F, q: [] }];
    this.cars = Array.from({ length: n }, (_, i) => {
      const g = d.mode === 'zoned' ? (i < lowN ? 0 : 1) : 0;
      return { i, x: (i - (n - 1) / 2) * 1.1, g, at: 0, load: [], state: 'lobby', dwell: 0, plan: [], t0: 0 };
    });
  }
  admit(p) {
    const F = this.c.params.floors;
    // the canteen on the top floor: half the rush goes all the way up
    p.floor = this.c.params.canteen && this.rng() < 0.5 ? F : 1 + Math.floor(this.rng() * F);
    // with destination keypads, a visitor who doesn't key in their floor gets in whichever car is open
    p.lost = this.d.mode === 'dest' && this.rng() < this.c.params.lost;
    p.gi = this.groups.findIndex(g => p.floor >= g.from && p.floor <= g.to);
    p.x = (this.rng() - 0.5) * 3; p.y = LOBBY_Y + 1.6; p.gone = false; p.inAt = this.t;
    this.groups[p.gi].q.push(p);
    this.people.push(p);
  }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const P = this.c.params;
    for (const car of this.cars) {
      const g = this.groups[car.g];
      if (car.state === 'lobby') {
        // board whoever is waiting for this lift's floors, then go when full or the doors time out
        if (this.d.mode === 'dest') {
          // destination dispatch: the first in line, then whoever is going within two floors of them (and
          // anyone lost, who just gets in)
          const near = f => !car.load.length || Math.abs(f - car.load[0].floor) <= 2;
          for (let j = 0; j < g.q.length && car.load.length < CAP;) { const p = g.q[j]; if (p.ready && (p.lost || near(p.floor))) { g.q.splice(j, 1); car.load.push(p); p.car = car; } else j++; }
        } else while (car.load.length < CAP && g.q.length && g.q[0].ready) { const p = g.q.shift(); car.load.push(p); p.car = car; }
        if (car.load.length) car.dwell += dt;
        if (car.load.length >= CAP || car.dwell >= (DWELLS[this.d.dwell] || P.dwell)) {
          // the trip: up through each requested floor in order, a stop at each, then express back down
          const stops = [...new Set(car.load.map(p => p.floor))].sort((a, b) => a - b);
          let t = this.t, at = 0;
          car.plan = [];
          for (const f of stops) { t += (f - at) * P.perFloor; car.plan.push({ t, f, stop: true }); t += P.stop; car.plan.push({ t, f }); at = f; }
          t += at * P.perFloor * 0.6; car.plan.push({ t, f: 0 });
          car.state = 'trip'; car.dwell = 0; car.t0 = this.t; car.from = 0;
          for (const p of car.load) p.hidden = true;
        }
      } else {
        // where the car is now, and who gets out
        let prevT = car.t0, prevF = 0;
        for (const s of car.plan) {
          if (this.t < s.t) { car.at = prevF + (s.f - prevF) * Math.max(0, Math.min(1, (this.t - prevT) / Math.max(0.01, s.t - prevT))); break; }
          if (s.stop && !s.seen) {
            s.seen = true;
            for (const p of car.load) if (p.floor === s.f && !p.gone && !p.lost) { this.waits.push(this.t + P.stop * 0.5 - p.inAt); this.finish(p); }
          }
          prevT = s.t; prevF = s.f; car.at = s.f;
        }
        if (this.t >= car.plan[car.plan.length - 1].t) {
          // the lost ride back down, find a keypad and queue again (now they know)
          for (const p of car.load) if (p.lost && !p.gone) { p.lost = false; p.hidden = false; p.ready = false; p.x = car.x; p.y = LOBBY_Y; this.groups[p.gi].q.push(p); }
          car.state = 'lobby'; car.at = 0; car.load = [];
        }
      }
    }
    // waiting in the lift lobby: each zone has its own queue
    this.groups.forEach((g, gi) => g.q.forEach((p, j) => { if (this.walkTo(p, (this.groups.length > 1 ? (gi ? 2.4 : -2.4) : 0) + ((j % 6) - 2.5) * 0.45, LOBBY_Y + 1.0 + Math.floor(j / 6) * 0.45, dt)) p.ready = true; }));
    // people in a lift walk into the car before it leaves
    for (const car of this.cars) if (car.state === 'lobby') for (const p of car.load) this.walkTo(p, car.x, LOBBY_Y - 0.1, dt);
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'lifts',
  name: 'Lift lobby',
  paradox: 'Lift zoning',
  about: 'The morning rush heads for the lifts. Every floor a lift stops at costs seconds of doors opening and closing.',
  waitLabel: '9 in 10 reach their floor within',
  box: { w: 11, h: 12 },
  metric: 'p90',
  slack: 1.15,
  // targets come from what one extra lift could do at most: the client won't knock through for two
  reference(ok, c) { return ok.filter(x => x.slots.count <= c.existing.count + 1); },
  level(c, rng, tier) {
    const towers = c.kind === 'towers' || c.twists.includes('tall');
    const F = towers ? 18 : 12;
    const scale = 1 + 0.07 * Math.min(tier, 6);
    c.params = { floors: F, perFloor: 1.5, stop: 7, dwell: 7 };
    let rate = (towers ? 0.95 : 0.6) * scale * (0.94 + rng() * 0.12);
    if (c.twists.includes('ninesharp')) rate *= 1.2;
    const mix = {};
    if (c.twists.includes('visitors')) mix.case = 0.15;
    c.params.canteen = c.twists.includes('canteen');
    c.params.lost = c.twists.includes('visitors') ? 0.25 : 0.04;   // who doesn't use the keypads
    c.params.deep = c.opts.callback !== 'paradox';
    if (c.existing) for (const [k, v] of Object.entries({ dwell: 'standard' })) if (c.existing[k] == null) c.existing[k] = v;
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = 150; c.run = 330;
  },
  twists: {
    ninesharp: { label: 'Nine sharp', text: 'A big meeting at nine: a fifth more people in the rush.' },
    visitors: { label: 'Visitors', text: 'Visitors with bags take up room in the cars, and a quarter of them won\'t know how to use a keypad.' },
  },
  // only where the keypads and door times are on offer (not on a research call)
  deepTwists: { canteen: { label: 'Canteen', text: 'The new canteen on the top floor: half the rush is going all the way up.' } },
  twistsOf(opts) { return opts.callback === 'paradox' ? this.twists : { ...this.twists, ...this.deepTwists }; },
  options(c, tech) {
    return [
      { key: 'mode', label: 'Dispatch', kind: 'seg', choices: [['all', 'Every lift, every floor'], ['zoned', 'Low and high zones', 'zoning'], ...(c.params.deep ? [['dest', 'Destination keypads', 'zoning']] : [])] },
      { key: 'count', label: 'Lifts', kind: 'stepper', min: 2, max: c.existing.count + 2, note: `£40,000 for each lift beyond the ${c.existing.count} already there${c.params.deep ? `; destination keypads £${DEST_COST.toLocaleString('en-GB')}` : ''}` },
      ...(c.params.deep ? [{ key: 'dwell', label: 'Door time', kind: 'seg', choices: [['short', 'Short'], ['standard', 'Standard'], ['long', 'Long']], note: `£${DWELL_COST} to reprogram · how long a car waits in the lobby before it goes: short sends half-empty cars sooner, long fills them but keeps people waiting` }] : []),
    ];
  },
  explain(d, c) { return d.mode === 'dest' ? `Each person keys in their floor; a car takes people going to floors close together. About ${Math.round(c.params.lost * 100)}% won't use the keypad and ride the wrong car.` : d.mode === 'zoned' ? `About half the lifts serve floors 1 to ${Math.floor(c.params.floors / 2)}; the rest run express to floors ${Math.floor(c.params.floors / 2) + 1} to ${c.params.floors}.` : `Each lift takes whoever is next, for any of the ${c.params.floors} floors.`; },
  hint() { return 'People are waiting too long in the lift lobby. Count the stops each lift makes on the way up.'; },
  defaults() { return { stage: 'lifts', count: 4, mode: 'all', dwell: 'standard' }; },
  cost(d, ex) {
    return Math.max(0, d.count - (ex ? ex.count : 4)) * 40000 + (d.mode === 'zoned' && !(ex && ex.mode === 'zoned') ? 4000 : 0)
      + (d.mode === 'dest' && !(ex && ex.mode === 'dest') ? DEST_COST : 0) + ((d.dwell || 'standard') !== ((ex && ex.dwell) || 'standard') ? DWELL_COST : 0);
  },
  sig(d) { return `l${d.count}${d.mode === 'zoned' ? 'Z' : d.mode === 'dest' ? 'D' : 'A'}${d.dwell && d.dwell !== 'standard' ? d.dwell[0] : ''}`; },
  candidates(c, tech) {
    const out = [];
    const modes = tech.zoning ? ['all', 'zoned', ...(c.params.deep ? ['dest'] : [])] : ['all'];
    for (let n = c.existing.count; n <= c.existing.count + 2; n++) for (const mode of modes) for (const dwell of c.params.deep && n <= c.existing.count + 1 ? ['short', 'standard', 'long'] : ['standard']) out.push({ stage: 'lifts', count: n, mode, dwell });
    return out;
  },
  Sim: LiftSim,
};
