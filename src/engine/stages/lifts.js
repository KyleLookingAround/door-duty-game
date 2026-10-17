// Lift zoning: in the morning rush every lift stopping at every floor spends most of its trip opening doors.
// Split the lifts so some serve only the low floors and the rest run express to the high ones, and each trip
// makes fewer stops, so the same lifts carry more people: often as many as an extra lift would.
import { StageSim } from './common.js';

const LOBBY_Y = 4.2, FLOOR_H = 0.42, CAP = 12;

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
    p.floor = 1 + Math.floor(this.rng() * F);
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
        while (car.load.length < CAP && g.q.length && g.q[0].ready) { const p = g.q.shift(); car.load.push(p); p.car = car; }
        if (car.load.length) car.dwell += dt;
        if (car.load.length >= CAP || car.dwell >= P.dwell) {
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
            for (const p of car.load) if (p.floor === s.f && !p.gone) { this.waits.push(this.t + P.stop * 0.5 - p.inAt); this.finish(p); }
          }
          prevT = s.t; prevF = s.f; car.at = s.f;
        }
        if (this.t >= car.plan[car.plan.length - 1].t) { car.state = 'lobby'; car.at = 0; car.load = []; }
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
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = 150; c.run = 330;
  },
  twists: {
    ninesharp: { label: 'Nine sharp', text: 'A big meeting at nine: a fifth more people in the rush.' },
    visitors: { label: 'Visitors', text: 'Visitors with bags take up room in the cars.' },
  },
  options(c, tech) {
    return [
      { key: 'mode', label: 'Dispatch', kind: 'seg', choices: [['all', 'Every lift, every floor'], ['zoned', 'Low and high zones', 'zoning']] },
      { key: 'count', label: 'Lifts', kind: 'stepper', min: 2, max: c.existing.count + 2, note: `£40,000 for each lift beyond the ${c.existing.count} already there` },
    ];
  },
  explain(d, c) { return d.mode === 'zoned' ? `About half the lifts serve floors 1 to ${Math.floor(c.params.floors / 2)}; the rest run express to floors ${Math.floor(c.params.floors / 2) + 1} to ${c.params.floors}.` : `Each lift takes whoever is next, for any of the ${c.params.floors} floors.`; },
  hint() { return 'People are waiting too long in the lift lobby. Count the stops each lift makes on the way up.'; },
  defaults() { return { stage: 'lifts', count: 4, mode: 'all' }; },
  cost(d, ex) { return Math.max(0, d.count - (ex ? ex.count : 4)) * 40000 + (d.mode === 'zoned' && !(ex && ex.mode === 'zoned') ? 4000 : 0); },
  sig(d) { return `l${d.count}${d.mode === 'zoned' ? 'Z' : 'A'}`; },
  candidates(c, tech) {
    const out = [];
    for (let n = c.existing.count; n <= c.existing.count + 2; n++) for (const mode of tech.zoning ? ['all', 'zoned'] : ['all']) out.push({ stage: 'lifts', count: n, mode });
    return out;
  },
  Sim: LiftSim,
};
