// Moving walkways: the fast middle helps, but people pile up at the ends. Step off a walkway into the back of
// a queue and the people behind you have nowhere to go: the belt has to stop. Put the walkway where there's
// room to step off, and it speeds everyone up; run it right to the passport desks and it jams.
// Two more levers (not on research calls or chained levels, which stay about placement):
//  - A fast belt: half as fast again, but anyone with bags or unsteady legs can stumble stepping off it.
//  - "Please walk" signs: fewer people stand on the belt, so the walking lane carries more of the crowd. People
//    with bags and older passengers stand whatever the signs say.
import { StageSim } from './common.js';

const BELT_V = 1.0, FAST_V = 1.5, BELT_GAP = 0.6, SPACING = 0.55, FAST_COST = 8000, SIGN_COST = 500;

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
    p.stands = p.type !== 'normal' || this.rng() < (this.d.signs ? 0.12 : this.c.params.standers);
    this.people.push(p); this.place(p);
  }
  place(p) { const L = this.len; p.x = -6.5 + 13 * Math.min(1, p.s / L); p.y = p.lane; }
  onBelt(s) { return this.belt && s >= this.belt[0] && s < this.belt[1]; }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const L = this.len, P = this.c.params;
    if (this.stopT > 0) this.stopT -= dt;
    const beltV = this.stopT > 0 ? 0 : this.d.speed === 'fast' ? FAST_V : BELT_V;
    // the passport desks: one person at a time, at the desks' pace
    this.deskReady -= dt;
    if (this.queue.length && this.deskReady <= 0 && this.queue[0].queued) { const p = this.queue.shift(); this.waits.push(this.t - p.inAt); this.finish(p); this.deskReady = P.desk; }
    const tail = L - SPACING * this.queue.length;
    // a belt that ends at the back of the queue has nowhere to put people: it stops, and people stumble
    if (this.belt && this.belt[1] > tail - 1.2 && this.stopT <= 0 && this.people.some(p => !p.queued && this.onBelt(p.s) && p.s > this.belt[1] - 1.5)) {
      this.stopT = 4; this.stats.stops++; this.note('stop', -6.5 + 13 * this.belt[1] / L, 0);   // a safety stop, not a bump
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
      // stepping off a fast belt: someone with bags or unsteady legs can stumble
      if (belt && !this.onBelt(s) && beltV > BELT_V && !p.stumbled && this.rng() < (p.type === 'elderly' ? 0.08 : p.type === 'case' ? 0.03 : 0)) { p.stumbled = true; this.bump(-6.5 + 13 * Math.min(1, s / L), 0); }
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
  bumpLabel: 'Stumbles stepping off',
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
    // a tight connection: hardly anyone stands, and they've only cabin bags
    c.params.standers = c.twists.includes('connecting') ? 0.08 : 0.35;
    if (c.twists.includes('connecting')) mix.case = 0.12;
    c.params.deep = !c.chained && c.opts.callback !== 'paradox';
    if (c.existing) for (const [k, v] of Object.entries({ speed: 'std', signs: false })) if (c.existing[k] == null) c.existing[k] = v;
    c.crowd = { rate: +(1.55 * scale * (c.twists.includes('jumbo') ? 1.25 : 1) * (0.95 + rng() * 0.1)).toFixed(3), mix };
    c.arrive = 100; c.run = 300;
  },
  bumps: () => 2,   // stumbles stepping off a fast belt
  twists: {
    jumbo: { label: 'Jumbo jet', text: 'A full jumbo: a quarter more passengers off one plane.' },
    holiday: { label: 'Holiday charter', text: 'Families and older travellers who\'ll stand on the belt.' },
    egates: { label: 'E-gates', text: 'New e-gates at passport control clear the queue faster.' },
  },
  deepTwists: { connecting: { label: 'Tight connections', text: 'Passengers racing for connecting flights with only cabin bags: hardly anyone stands on the belt.' } },
  twistsOf(opts) { return opts.callback === 'paradox' ? this.twists : { ...this.twists, ...this.deepTwists }; },
  options(c) {
    return [
      { key: 'belt', label: 'Walkway', kind: 'seg', choices: [[0, 'None'], [20, '20 m'], [40, '40 m'], [70, 'Whole pier']] },
      { key: 'place', label: 'Where', kind: 'seg', choices: [['start', 'From the gate'], ['middle', 'Middle'], ['end', 'To the desks']] },
      ...(c.params.deep ? [
        { key: 'speed', label: 'Belt speed', kind: 'seg', choices: [['std', '1 m/s'], ['fast', '1.5 m/s']], note: `+£${FAST_COST.toLocaleString('en-GB')} · a fast belt carries everyone sooner, but people with bags or unsteady legs can stumble stepping off it` },
        { key: 'signs', label: '"Please walk" signs', kind: 'toggle', note: `+£${SIGN_COST} · fewer people stand on the belt; bags and older passengers stand anyway` },
      ] : []),
    ];
  },
  explain(d, c) { return `The pier is ${c.params.length} m. A walkway costs £14,000 per 20 m. People walking on it go twice as fast; anyone with bags, older passengers and a third of everyone else stand and ride at 1 m/s.`; },
  hint(r) { return r.bumps > 2 ? 'People are stumbling stepping off the walkway: a fast belt is too much for people with bags or unsteady legs.' : r.stops ? 'The walkway keeps stopping: it ends where the queue for passport control backs up, so people can\'t step off.' : 'People are taking too long down the pier.'; },
  defaults() { return { stage: 'walkway', belt: 0, place: 'start', speed: 'std', signs: false }; },
  cost(d, ex) {
    return Math.max(0, Math.ceil(d.belt / 20) - Math.ceil((ex ? ex.belt : 0) / 20)) * 14000 + (ex && ex.belt && d.place !== ex.place ? 6000 : 0)
      + (d.belt && d.speed === 'fast' && !(ex && ex.speed === 'fast') ? FAST_COST : 0) + (d.belt && d.signs && !(ex && ex.signs) ? SIGN_COST : 0);
  },
  sig(d) { return `w${d.belt}${d.belt ? d.place[0] : ''}${d.belt && d.speed === 'fast' ? 'F' : ''}${d.belt && d.signs ? 'W' : ''}`; },
  candidates(c) {
    const base = [{ belt: 0, place: 'start' }, { belt: 70, place: 'start' }];
    for (const belt of [20, 40]) for (const place of ['start', 'middle', 'end']) base.push({ belt, place });
    const out = [];
    for (const b of base) for (const speed of c.params.deep && b.belt ? ['std', 'fast'] : ['std']) for (const signs of c.params.deep && b.belt ? [false, true] : [false]) out.push({ stage: 'walkway', ...b, speed, signs });
    return out;
  },
  Sim: WalkwaySim,
};
