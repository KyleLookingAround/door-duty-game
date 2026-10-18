// The paternoster: a revolving door turned on its end. Open cabins loop past the landing without stopping.
// Run it faster and more cabins pass, but each one is level with the floor for less time, so more people
// hesitate, miss it, or stumble stepping on. The fastest loop is rarely the one that moves the most people.
import { StageSim } from './common.js';

const SHAFT_X = 0, LANDING_Y = 3.4, CABIN_GAP = 2.6, LEVEL = 0.35, STAIRS_SIGN_COST = 500;

class PaternosterSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    this.q = []; this.phase = 0; this.riding = []; this.climbing = [];
  }
  admit(p) {
    p.x = -3.5 + this.rng() * 1.5; p.y = LANDING_Y + 1.4; p.gone = false; p.inAt = this.t;
    const P = this.c.params;
    p.floor = P.first && this.rng() < P.first ? 1 : 1 + Math.floor(this.rng() * P.floors);
    p.tries = 0;
    this.people.push(p);
    // a "Stairs for one floor" sign: people going one floor up walk, leaving the cabins for everyone else
    if (this.d.stairs && p.floor === 1) { this.climb(p); return; }
    this.q.push(p);
  }
  climb(p) { p.stairs = this.t + p.floor * this.c.params.floorH / (p.walk * 0.22); this.climbing.push(p); }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const d = this.d, v = d.speed, per = d.wide ? 2 : 1, P = this.c.params;
    // a cabin floor comes level with the landing every CABIN_GAP / v seconds, and stays within reach for 2 * LEVEL / v
    const before = this.phase;
    this.phase = (this.phase + v * dt) % CABIN_GAP;
    // children on a school trip ride round over the top: a cabin comes past already full (an attendant stops most of it)
    const full = this.phase < before && P.joy && this.rng() < P.joy * (d.attendant ? 0.3 : 1);
    if (this.phase < before && !this.idle && !full) {
      const window = 2 * LEVEL / v;
      let used = 0, spent = 0;
      for (let k = 0; k < this.q.length && used < per; k++) {
        const p = this.q[k];
        if (Math.hypot(p.x - SHAFT_X + 0.9, p.y - LANDING_Y) > 1.2) break;   // not at the front yet
        // how long this person needs to judge it and step in; an attendant calls the moment for them
        const need = p.react * (d.attendant ? 0.6 : 1) + 0.45 + spent;
        if (need > window * 1.15) {
          // too quick for them: they wait for the next cabin, and after a couple give up and take the stairs
          if (++p.tries >= 2) { this.q.splice(k, 1); k--; this.climb(p); continue; }
          break;
        }
        if (need > window * 0.8 && this.rng() < 0.5) {
          // stepped on late: a stumble on the moving floor
          this.bump(SHAFT_X, LANDING_Y); p.flash = 1; p.tries++;
          this.stats.stops++;
          break;
        }
        this.q.splice(k, 1); k--; used++; spent += 0.5;
        p.ride = this.t + p.floor * P.floorH / v; p.x = SHAFT_X - 0.35 + used * 0.3; this.riding.push(p);
      }
    }
    for (const p of this.riding) {
      p.y = LANDING_Y - Math.min(7.5, (1 - (p.ride - this.t) * v / (p.floor * P.floorH)) * p.floor * 1.5);
      p.vx = 0; p.vy = -v;
      if (this.t >= p.ride) { this.waits.push(this.t - p.inAt); this.finish(p); }
    }
    if (this.riding.some(p => p.gone)) this.riding = this.riding.filter(p => !p.gone);
    for (const p of this.climbing) {
      this.walkTo(p, 3.6, -2 - Math.min(2, (this.t - (p.stairs - p.floor * 15)) * 0.05), dt);
      if (this.t >= p.stairs) { this.waits.push(this.t - p.inAt); this.finish(p); }
    }
    if (this.climbing.some(p => p.gone)) this.climbing = this.climbing.filter(p => !p.gone);
    for (const p of this.people) if (p.flash > 0) p.flash -= dt;
    this.q.forEach((p, j) => this.walkTo(p, SHAFT_X - 0.9 - (j % 4) * 0.5 - Math.floor(j / 4) * 0.1, LANDING_Y + Math.floor(j / 4) * 0.5, dt));
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'paternoster',
  name: 'Paternoster',
  paradox: 'The paternoster',
  about: 'A loop of open cabins that never stops. You step on as one passes, and step off at your floor.',
  waitLabel: '9 in 10 reach their floor within',
  bumpLabel: 'Stumbles stepping on',
  box: { w: 9, h: 10 },
  metric: 'p90',
  slack: 1.15,
  level(c, rng, tier) {
    const scale = 1 + 0.07 * Math.min(tier, 6);
    // the deeper puzzle (a stairs sign, and twists about who's visiting) isn't on research calls or chained levels
    const deep = !c.chained && c.opts.callback !== 'paradox';
    c.params = { floors: 5, floorH: 3.2, deep, joy: c.twists.includes('school') ? 0.35 : 0, first: c.twists.includes('wedding') ? 0.6 : 0 };
    if (c.existing && c.existing.stairs == null) c.existing.stairs = false;
    const mix = { elderly: c.twists.includes('pensioners') ? 0.45 : 0.2 };
    let rate = 0.16 * scale * (0.94 + rng() * 0.12);
    if (c.twists.includes('council')) rate *= 1.2;
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = 180; c.run = 300;
  },
  bumps: () => 2,
  twists: {
    council: { label: 'Council meeting', text: 'Full council tonight: a quarter more people heading upstairs.' },
    pensioners: { label: 'Pensioners\' day', text: 'Nearly half the visitors are older and need longer to judge the step.' },
  },
  deepTwists: {
    school: { label: 'School trip', text: 'A school trip riding round and round over the top: a lot of cabins come past already full.' },
    wedding: { label: 'Wedding day', text: 'Weddings at the register office: most visitors are only going up to the first floor.' },
  },
  twistsOf(opts) { return opts.callback === 'paradox' ? this.twists : { ...this.twists, ...this.deepTwists }; },
  options(c, tech) {
    return [
      { key: 'speed', label: 'Loop speed', kind: 'range', min: 0.15, max: 0.5, step: 0.01, fmt: v => `${(+v).toFixed(2)} m/s` },
      { key: 'wide', label: 'Two-person cabins', kind: 'toggle', note: '+£9,000 · rebuild the cabins so two can step on together' },
      { key: 'attendant', label: 'Landing attendant', kind: 'toggle', tech: 'doorman', note: '+£3,000 · calls "now" so people step on at the right moment, and stops anyone riding round' },
      ...(c.params.deep ? [{ key: 'stairs', label: '"One floor? Take the stairs"', kind: 'toggle', note: `+£${STAIRS_SIGN_COST} · people going one floor up walk, leaving the cabins for everyone else` }] : []),
    ];
  },
  explain(d) { const v = d.speed; return `A cabin every ${(CABIN_GAP / v).toFixed(1)}s, level with the floor for ${(2 * LEVEL / v).toFixed(1)}s. Most people need about a second to step on; older visitors need two.`; },
  hint(r, c) {
    if (c && c.params.joy && !r.bumps) return 'Watch the cabins coming round already full: children on the school trip are riding over the top.';
    if (c && c.params.first && !r.bumps) return 'Most people are only going up one floor. On the stairs they\'d be nearly as quick, and leave the cabins free.';
    return r.bumps ? 'People are stumbling as they step on. A slower loop gives them longer to judge it.' : 'Too few people are getting upstairs. Too slow and the cabins come rarely; too fast and people let them pass.';
  },
  defaults() { return { stage: 'paternoster', speed: 0.45, wide: false, attendant: false, stairs: false }; },
  cost(d, ex) { return (d.wide && !(ex && ex.wide) ? 9000 : 0) + (d.attendant && !(ex && ex.attendant) ? 3000 : 0) + (d.stairs && !(ex && ex.stairs) ? STAIRS_SIGN_COST : 0); },
  sig(d) { return `p${Math.round(d.speed * 100)}${d.wide ? 'W' : ''}${d.attendant ? 'A' : ''}${d.stairs ? 'S' : ''}`; },
  candidates(c, tech) {
    const out = [];
    for (const speed of [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45]) for (const wide of [false, true]) for (const attendant of tech.doorman ? [false, true] : [false]) for (const stairs of c.params.deep ? [false, true] : [false]) out.push({ stage: 'paternoster', speed, wide, attendant, stairs });
    return out;
  },
  Sim: PaternosterSim,
};
