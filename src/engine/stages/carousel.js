// The carousel line: everyone crowds the belt to be ready for their bag, so the people behind can't see theirs
// coming or reach it, and bags go round again. A painted line a step back from the belt keeps the edge clear:
// people wait behind it, step forward when they spot their bag, and everyone gets theirs sooner.
// Two more levers (not on research calls or chained levels, which stay about the line):
//  - Belt speed: a fast belt brings each bag round sooner, but it's harder to grab, so more go round again,
//    above all for older travellers.
//  - Extra baggage handlers: the bags reach the belt sooner. Worth most when they're held up airside.
import { StageSim } from './common.js';

const RX = 4.6, RY = 2.0, EDGE = 0.45, HANDLER_COST = 4000, BELT_SPEED_COST = 1000;
// belt speed (m/s), how grabbable a bag is, and how grabbable for an older traveller
export const BELT_SPEEDS = { std: [0.42, 1, 0.7], fast: [0.6, 0.96, 0.4] };

class CarouselSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    this.belts = d.belts;
    // the belt is an oval; s runs round it from the chute at s = 0
    this.per = 2 * Math.PI * Math.sqrt((RX * RX + RY * RY) / 2);
    this.bags = [];
    this.flight = 0;
  }
  pos(s, off, b) {
    const a = (s / this.per) * 2 * Math.PI, cx = this.belts > 1 ? (b ? 2.9 : -2.9) : 0, sx = this.belts > 1 ? 0.55 : 1;
    const rx = RX * sx + off, ry = RY + off;
    return [cx + Math.cos(a) * rx, Math.sin(a) * ry];
  }
  admit(p) {
    p.gone = false; p.inAt = this.t; p.belt = this.belts > 1 ? (this.rng() < 0.5 ? 1 : 0) : 0;
    // everyone wants to stand near where the bags come out
    p.spot = (-Math.log(1 - this.rng() * 0.95) * this.c.params.crowdTo) % this.per;
    p.depth = 0; p.state = 'wait'; p.misses = 0;
    // the bag comes out a little while after its owner gets here, in the order they were loaded
    const bag = { owner: p, s: 0, out: this.t + this.c.params.bagDelay * (this.d.handlers ? 0.6 : 1) * (0.4 + this.rng()), belt: p.belt, on: false };
    p.bag = bag; this.bags.push(bag);
    const [x, y] = this.pos(p.spot, 1.6, p.belt); p.x = x; p.y = y + 3;
    this.people.push(p);
  }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const P = this.c.params, [v, grab, grabOld] = BELT_SPEEDS[this.d.speed] || BELT_SPEEDS.std, line = this.d.line;
    // how deep the crowd is at each part of the belt: everyone at the edge, or (with a line) only those stepping in
    const atEdge = this.people.filter(p => p.state === 'wait' && !line || p.state === 'reach');
    for (const p of this.people) {
      if (p.state === 'leave') { if (this.walkTo(p, p.x < 0 ? -7 : 7, 4.3, dt)) { this.waits.push(this.t - p.inAt); this.finish(p); } continue; }
      // rows: how many people are between you and the belt
      if (p.state === 'wait') {
        let rowAhead = 0;
        if (!line) for (const q of atEdge) if (q !== p && q.belt === p.belt && q.inAt < p.inAt && Math.abs(((q.spot - p.spot + this.per * 1.5) % this.per) - this.per / 2) < 0.55) rowAhead++;
        p.depth = rowAhead;
        const off = line ? 1.25 + 0.0 : EDGE + rowAhead * 0.42;
        const [x, y] = this.pos(p.spot, off, p.belt);
        this.walkTo(p, x, y, dt);
      }
      if (p.state === 'reach') { const [x, y] = this.pos(p.spot, EDGE, p.belt); this.walkTo(p, x, y, dt, p.walk * 1.2); }
    }
    for (const b of this.bags) {
      if (b.taken) continue;
      if (!b.on) { if (this.t >= b.out) b.on = true; else continue; }
      const prev = b.s; b.s += v * dt;
      const p = b.owner, d = (p.spot - prev + this.per * 2) % this.per;
      // the owner spots it coming: easily from the edge or from behind a clear line; hardly at all from the third row
      if (p.state === 'wait' && d < 3.5 && d > 0.5 && !b.seenLap) {
        b.seenLap = true;
        const sees = line ? 0.95 : [0.95, 0.75, 0.5, 0.3][Math.min(3, p.depth)];
        if (this.rng() < sees) p.state = 'reach';
      }
      // it passes their spot: grab it, push through to it, or watch it go round again
      if (d <= v * dt + 1e-6 || (prev <= p.spot && b.s >= p.spot)) {
        b.seenLap = false;
        let got = false;
        if (p.state === 'reach' || (!line && p.depth === 0)) {
          const crowd = line ? 0 : p.depth;
          got = this.rng() < (line ? 0.95 : 0.92 / (1 + crowd * 0.5)) * (p.type === 'elderly' ? grabOld : grab);
          // pushing through a crowd to reach a bag: someone gets an elbow
          if (!line && crowd > 1 && this.rng() < 0.06 * crowd) this.bump(p.x, p.y);
        }
        if (got) { b.taken = true; p.state = 'leave'; p.vx = 0; }
        else { p.misses++; if (p.state === 'reach') p.state = 'wait'; }
      }
      if (b.s >= this.per) b.s -= this.per;
    }
    if (this.bags.some(b => b.taken)) this.bags = this.bags.filter(b => !b.taken);
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'carousel',
  name: 'Baggage reclaim',
  paradox: 'The carousel line',
  about: 'Passengers wait at the belt for their bags. Where they stand decides whether they can see and reach them.',
  waitLabel: '9 in 10 leave with their bags within',
  bumpLabel: 'Elbows at the belt',
  box: { w: 14, h: 9 },
  metric: 'p90',
  // no slack: the target is the best the client would pay for, so the line alone doesn't always do
  slack: 1.0,
  // the client expects extra handlers only when the bags are held up airside
  reference(ok, c) { return c.twists.includes('heldup') ? ok : ok.filter(x => !x.slots.handlers); },
  level(c, rng, tier) {
    const scale = 1 + 0.07 * Math.min(tier, 6);
    c.params = { speed: 0.42, bagDelay: c.twists.includes('heldup') ? 110 : 70, crowdTo: c.twists.includes('chute') ? 3.5 : 6 };
    c.params.deep = !c.chained && c.opts.callback !== 'paradox';
    if (c.existing) for (const [k, v] of Object.entries({ speed: 'std', handlers: false })) if (c.existing[k] == null) c.existing[k] = v;
    StageSim.tune(c, 0, 1);
    const mix = { case: 0.1 };
    if (c.twists.includes('families')) mix.pram = 0.08;
    if (c.twists.includes('coach')) mix.elderly = 0.3;
    c.crowd = { rate: +(1.2 * scale * (c.twists.includes('twoflights') ? 1.3 : 1) * (0.95 + rng() * 0.1)).toFixed(3), mix };
    c.arrive = 90; c.run = 400;
  },
  bumps: c => 6,
  twists: {
    twoflights: { label: 'Two flights', text: 'Two flights share the belt: a third more people waiting.' },
    chute: { label: 'Everyone at the chute', text: 'Word has gone round that bags come out first by the chute, so people pack in there.' },
    families: { label: 'Families', text: 'Families with buggies take up room at the belt.' },
  },
  deepTwists: {
    heldup: { label: 'Bags held up', text: 'The bags are held up airside: the first ones are late onto the belt.' },
    coach: { label: 'Coach party', text: 'A coach party of older travellers, slow to lift a bag off a moving belt.' },
  },
  twistsOf(opts) { return opts.callback === 'paradox' ? this.twists : { ...this.twists, ...this.deepTwists }; },
  options(c) {
    return [
      { key: 'line', label: 'Stand-back line', kind: 'toggle', tech: 'markings', note: '+£600 · a painted line a step back from the belt' },
      { key: 'belts', label: 'Belts', kind: 'stepper', min: 1, max: 2, note: '£45,000 for a second carousel' },
      ...(c.params.deep ? [
        { key: 'speed', label: 'Belt speed', kind: 'seg', choices: [['std', 'Standard'], ['fast', 'Fast']], note: `£${BELT_SPEED_COST.toLocaleString('en-GB')} to change · a fast belt brings bags round sooner, but they're harder to grab, above all for older travellers` },
        { key: 'handlers', label: 'Extra baggage handlers', kind: 'toggle', note: `+£${HANDLER_COST.toLocaleString('en-GB')} · the bags reach the belt sooner` },
      ] : []),
    ];
  },
  hint(r) { return r.bumps > 2 ? 'People are pushing through the crowd at the belt to reach their bags.' : 'Bags are going round again because their owners can\'t see or reach them.'; },
  defaults() { return { stage: 'carousel', line: false, belts: 1, speed: 'std', handlers: false }; },
  cost(d, ex) {
    return (d.line && !(ex && ex.line) ? 600 : 0) + Math.max(0, d.belts - (ex ? ex.belts : 1)) * 45000
      + ((d.speed || 'std') !== ((ex && ex.speed) || 'std') ? BELT_SPEED_COST : 0) + (d.handlers && !(ex && ex.handlers) ? HANDLER_COST : 0);
  },
  sig(d) { return `c${d.belts}${d.line ? 'L' : ''}${d.speed && d.speed !== 'std' ? d.speed[0] : ''}${d.handlers ? 'H' : ''}`; },
  candidates(c, tech) {
    const out = [];
    for (const belts of [1, 2]) for (const line of tech.markings ? [false, true] : [false])
      for (const speed of c.params.deep && belts === 1 ? ['std', 'fast'] : ['std']) for (const handlers of c.params.deep && belts === 1 ? [false, true] : [false]) out.push({ stage: 'carousel', belts, line, speed, handlers });
    return out;
  },
  Sim: CarouselSim,
};
