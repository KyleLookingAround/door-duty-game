// The concourse: the last stretch to the seats, through a few openings into the arena. Let everyone in at once
// and the concourse packs solid: people shuffle, the openings jam, and fewer get through than if you'd held some
// back. Stewards who meter the crowd (only let more in when there's room) get everyone seated sooner.
// In a chained level this is where the moving bottleneck ends up: speed up the stages before and the crush lands here.
// One more lever on the arena's own concourse jobs (not research calls or chained levels): double-width
// openings. Each one takes people faster, but a wide opening jams worse when the crowd packs in, so they pay off
// with metering and do nothing without it. (Tighter metering was tried: it always starved the openings.)
import { StageSim } from './common.js';

const LEN = 16, WIDTH = 4.5, X0 = -7.5, WIDE_COST = 1500;

class ConcourseSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    this.outside = []; this.inside = []; this.ready = Array(d.openings).fill(0); this.crushT = 0;
  }
  density() { return this.inside.length / (LEN * WIDTH); }
  admit(p) {
    p.gone = false; p.inAt = this.t; p.s = 0; p.lane = (this.rng() - 0.5) * (WIDTH - 0.8);
    this.outside.push(p); this.people.push(p);
    p.x = X0 - 0.8; p.y = p.lane;
  }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const P = this.c.params;
    // stewards at the entrance only let people on when the concourse has room
    const hold = this.d.metering ? P.meterAt : Infinity;
    while (this.outside.length && this.density() < hold) { const p = this.outside.shift(); this.inside.push(p); }
    const rho = this.density();
    // the denser it gets, the slower everyone shuffles, and the more the openings jam
    const speed = Math.max(0.12, 1 - rho / P.jam);
    // a double-width opening is quicker, but jams sooner and harder as the concourse packs
    const wide = !!this.d.wide, ok = wide ? P.ok * 0.75 : P.ok;
    const jam = rho < ok ? 1 : Math.max(wide ? 0.22 : 0.35, 1 - (rho - ok) / (P.jam - ok) * (wide ? 1.4 : 1));
    if (rho > P.crush) { this.crushT += dt * Math.min(0.6, (rho - P.crush) * 1.5); while (this.crushT >= 1) { this.crushT -= 1; this.bump(X0 + LEN - 2 - this.rng() * 6, (this.rng() - 0.5) * WIDTH); } }
    // walk down the concourse; at the end, through whichever opening is free
    const n = this.d.openings;
    for (const p of this.inside) {
      p.s = Math.min(LEN, p.s + p.walk * speed * dt);
      if (p.s >= LEN) {
        const k = this.ready.findIndex(r => r <= this.t);
        if (k >= 0) { this.ready[k] = this.t + P.through * (wide ? 0.6 : 1) / jam; p.done = true; this.waits.push(this.t - p.inAt); this.finish(p); }
      }
      // spread across the width towards the openings near the end
      const target = ((Math.floor(p.id % n) + 0.5) / n - 0.5) * (WIDTH - 0.8);
      p.lane += (target - p.lane) * Math.min(1, dt * 0.3 * (p.s / LEN));
      p.x = X0 + p.s; p.y = p.lane; p.vx = 1; p.vy = 0;
    }
    if (this.inside.some(p => p.done)) this.inside = this.inside.filter(p => !p.done);
    this.outside.forEach((p, j) => { p.x = X0 - 0.6 - Math.floor(j / 8) * 0.45; p.y = ((j % 8) - 3.5) * 0.6; });
    this.peak = Math.max(this.peak || 0, rho);
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'bottleneck',
  name: 'Concourse',
  paradox: 'The moving bottleneck',
  about: 'The last stretch: a concourse to a row of openings into the arena. A packed concourse moves slowly and jams the openings.',
  waitLabel: '9 in 10 reach their seats within',
  bumpLabel: 'Crush incidents',
  box: { w: 19, h: 8 },
  metric: 'p90',
  slack: 1.12,
  reference(ok, c) { return ok.filter(x => x.slots.openings <= c.existing.openings + 1); },
  level(c, rng, tier) {
    const scale = 1 + 0.07 * Math.min(tier, 6);
    c.params = { through: 1.4, ok: 0.7, jam: 2.6, crush: 1.6, meterAt: 0.6 };
    c.params.deep = !c.chained && c.opts.callback !== 'paradox';
    if (c.existing) for (const [k, v] of Object.entries({ wide: false })) if (c.existing[k] == null) c.existing[k] = v;
    let rate = 3.0 * scale * (0.95 + rng() * 0.1);
    if (c.twists.includes('soldout')) rate *= 1.2;
    const mix = {};
    if (c.twists.includes('matinee')) mix.elderly = 0.2;
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    // a last-minute crowd: half of everyone in the final half-minute
    if (c.twists.includes('lastminute')) c.crowd.phases = [{ until: 60, rate: +(rate * 0.5).toFixed(3) }, { until: 1e9, rate: +(rate * 2).toFixed(3) }];
    c.arrive = 90; c.run = 260;
  },
  bumps: () => 2,
  twists: {
    soldout: { label: 'Sold out', text: 'Every seat sold: a fifth more people arriving at once.' },
    matinee: { label: 'Matinee', text: 'An afternoon show with plenty of older fans, who don\'t like a crush.' },
  },
  deepTwists: { lastminute: { label: 'Last-minute crowd', text: 'Half the crowd turns up in the final half-minute before the show.' } },
  twistsOf(opts) { return opts.callback === 'paradox' ? this.twists : { ...this.twists, ...this.deepTwists }; },
  options(c) {
    return [
      { key: 'openings', label: 'Openings', kind: 'stepper', min: 2, max: c.existing.openings + 3, note: `£8,000 for each opening beyond the ${c.existing.openings} already there` },
      { key: 'metering', label: 'Stewards metering the crowd', kind: 'toggle', tech: 'stewarding', note: '+£2,500 · hold people back at the entrance when the concourse is filling up' },
      ...(c.params.deep ? [
        { key: 'wide', label: 'Double-width openings', kind: 'toggle', note: `+£${WIDE_COST.toLocaleString('en-GB')} an opening · quicker, but they jam worse when the concourse packs` },
      ] : []),
    ];
  },
  hint(r) { return r.bumps ? 'The concourse is packing solid and people are getting crushed at the openings. Letting fewer in at once can get everyone through faster.' : 'Too slow to the seats.'; },
  defaults() { return { stage: 'bottleneck', openings: 4, metering: false, wide: false }; },
  cost(d, ex) {
    return Math.max(0, d.openings - (ex ? ex.openings : 4)) * 8000 + (d.metering && !(ex && ex.metering) ? 2500 : 0)
      + (d.wide && !(ex && ex.wide) ? WIDE_COST * d.openings : 0);
  },
  sig(d) { return `o${d.openings}${d.metering ? 'M' : ''}${d.wide ? 'W' : ''}`; },
  candidates(c, tech) {
    const out = [];
    for (let n = c.existing.openings; n <= c.existing.openings + 3; n++) for (const metering of tech.stewarding ? [false, true] : [false])
      for (const wide of c.params.deep ? [false, true] : [false]) out.push({ stage: 'bottleneck', openings: n, metering, wide });
    return out;
  },
  Sim: ConcourseSim,
};
