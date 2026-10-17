// Moving walkways: the fast middle helps, but people pile up at the ends. Step off a walkway into the back of
// a queue and the people behind you have nowhere to go: the belt has to stop. Put the walkway where there's
// room to step off, and it speeds everyone up; run it right to the passport desks and it jams.
import { StageSim } from './common.js';

const BELT_V = 1.0, BELT_GAP = 0.6, SPACING = 0.55;

class WalkwaySim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    const L = c.params.length;
    this.len = L;
    // where the belt runs, along the pier
    this.belt = d.belt > 0 ? (d.place === 'end' ? [L - d.belt, L] : d.place === 'middle' ? [(L - d.belt) / 2, (L + d.belt) / 2] : [0, d.belt]) : null;
    this.queue = []; this.deskReady = 0; this.stopT = 0;
  }
  // pier position s (metres from the gate) to a point on the drawing: the pier folds into two lanes of the box
  admit(p) {
    p.s = 0; p.lane = this.rng() < 0.5 ? -0.35 : 0.35; p.gone = false; p.inAt = this.t; p.queued = false;
    // people with bags or slow legs stand on the belt; a third of everyone else does too
    p.stands = p.type !== 'normal' || this.rng() < 0.35;
    this.people.push(p); this.place(p);
  }
  place(p) { const L = this.len; p.x = -6.5 + 13 * Math.min(1, p.s / L); p.y = p.lane; }
  onBelt(s) { return this.belt && s >= this.belt[0] && s < this.belt[1]; }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const L = this.len, P = this.c.params;
    if (this.stopT > 0) this.stopT -= dt;
    const beltV = this.stopT > 0 ? 0 : BELT_V;
    // the passport desks: one person at a time, at the desks' pace
    this.deskReady -= dt;
    if (this.queue.length && this.deskReady <= 0 && this.queue[0].queued) { const p = this.queue.shift(); this.waits.push(this.t - p.inAt); this.finish(p); this.deskReady = P.desk; }
    const tail = L - SPACING * this.queue.length;
    // a belt that ends at the back of the queue has nowhere to put people: it stops, and people stumble
    if (this.belt && this.belt[1] > tail - 1.2 && this.stopT <= 0 && this.people.some(p => !p.queued && this.onBelt(p.s) && p.s > this.belt[1] - 1.5)) {
      this.stopT = 4; this.stats.stops++; this.bump(-6.5 + 13 * this.belt[1] / L, 0);
    }
    // walking along the pier: on the belt standers keep right and walkers pass on the left, single file in each
    const moving = this.people.filter(p => !p.queued).sort((a, b) => b.s - a.s);
    const ahead = { r: [Infinity, false], l: [Infinity, false] };
    for (const p of moving) {
      const belt = this.onBelt(p.s), side = p.stands || !beltV ? 'r' : 'l';
      const [aheadS, aheadBelt] = ahead[side];
      // on a stopped belt everyone walks, carefully
      let v = belt ? (beltV ? beltV + (p.stands ? 0 : p.walk * 0.8) : p.walk * 0.6) : p.walk;
      if (belt && aheadBelt && aheadS - p.s < BELT_GAP + 0.2) v = Math.min(v, Math.max(0, (aheadS - p.s - BELT_GAP) / dt));
      let s = Math.min(p.s + v * dt, belt && aheadBelt ? aheadS - BELT_GAP : Infinity);
      if (s >= tail - 0.2) { s = tail; p.queued = true; this.queue.push(p); }
      p.vx = v; p.vy = 0; p.s = Math.max(p.s, s);
      ahead[side] = [p.s, this.onBelt(p.s)];
      this.place(p);
      if (this.onBelt(p.s)) p.y = side === 'r' ? 0.35 : -0.35;
    }
    this.queue.forEach((p, j) => { p.s = L - SPACING * j; this.place(p); p.y = 0; });
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'walkway',
  name: 'Pier walkway',
  paradox: 'Moving walkways',
  about: 'Passengers walk the long pier from the gate to the passport desks, where they queue.',
  waitLabel: '9 in 10 through passport control within',
  bumpLabel: 'Walkway pile-ups',
  box: { w: 15, h: 4 },
  metric: 'p90',
  slack: 1.1,
  level(c, rng, tier) {
    const scale = 1 + 0.07 * Math.min(tier, 6);
    // a busier airport staffs more passport desks, so the desks keep pace and the pier is what matters
    c.params = { length: 70, desk: (c.twists.includes('egates') ? 0.58 : 0.66) / scale / (c.twists.includes('jumbo') ? 1.2 : 1) };
    StageSim.tune(c, 0, 1);
    const mix = { case: 0.35 };
    if (c.twists.includes('holiday')) mix.elderly = 0.2;
    c.crowd = { rate: +(1.55 * scale * (c.twists.includes('jumbo') ? 1.25 : 1) * (0.95 + rng() * 0.1)).toFixed(3), mix };
    c.arrive = 100; c.run = 300;
  },
  bumps: () => 0,
  twists: {
    jumbo: { label: 'Jumbo jet', text: 'A full jumbo: a quarter more passengers off one plane.' },
    holiday: { label: 'Holiday charter', text: 'Families and older travellers who\'ll stand on the belt.' },
    egates: { label: 'E-gates', text: 'New e-gates at passport control clear the queue faster.' },
  },
  options() {
    return [
      { key: 'belt', label: 'Walkway', kind: 'seg', choices: [[0, 'None'], [20, '20 m'], [40, '40 m'], [70, 'Whole pier']] },
      { key: 'place', label: 'Where', kind: 'seg', choices: [['start', 'From the gate'], ['middle', 'Middle'], ['end', 'To the desks']] },
    ];
  },
  explain(d, c) { return `The pier is ${c.params.length} m. A walkway costs £14,000 per 20 m. People walking on it go twice as fast; anyone with bags, older passengers and a third of everyone else stand and ride at 1 m/s.`; },
  hint(r) { return r.stops ? 'The walkway keeps stopping: it ends where the queue for passport control backs up, so people can\'t step off.' : 'People are taking too long down the pier.'; },
  defaults() { return { stage: 'walkway', belt: 0, place: 'start' }; },
  cost(d, ex) { return Math.max(0, Math.ceil(d.belt / 20) - Math.ceil((ex ? ex.belt : 0) / 20)) * 14000 + (ex && ex.belt && d.place !== ex.place ? 6000 : 0); },
  sig(d) { return `w${d.belt}${d.belt ? d.place[0] : ''}`; },
  candidates() {
    const out = [{ stage: 'walkway', belt: 0, place: 'start' }, { stage: 'walkway', belt: 70, place: 'start' }];
    for (const belt of [20, 40]) for (const place of ['start', 'middle', 'end']) out.push({ stage: 'walkway', belt, place });
    return out;
  },
  Sim: WalkwaySim,
};
