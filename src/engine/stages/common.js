// Shared machinery for inside jobs (stages): what happens to the crowd after it is through the doors.
// A stage sim is a small agent model with its own layout. Every stage sim has the same surface:
//   new Sim(contract, design, tech), step(dt), t, people[], events[], stats{through,bumps,...}, result()
// so the surveyor, the in-game test and the drawing code can treat them alike. No DOM.
//
// Stages chain: a chained level (see chain.js) sets sim.fed = true so a stage takes its people from the
// stage before (admit), and sets sim.out so people who finish are handed on instead of counted.
import { makeRng } from '../world.js';

// guests inside: how fast they walk and how quickly they react (seconds)
export const INSIDE = {
  normal:  { walk: [1.15, 1.45], react: [0.5, 1.0] },
  elderly: { walk: [0.6, 0.85], react: [1.3, 2.2] },
  case:    { walk: [0.95, 1.15], react: [0.7, 1.2] },
  wheel:   { walk: [0.8, 1.0], react: [0.8, 1.4] },
  pram:    { walk: [0.85, 1.05], react: [0.8, 1.3] },
  bike:    { walk: [1.0, 1.2], react: [0.6, 1.0] },
};

export class StageSim {
  constructor(contract, design, tech) {
    this.c = contract; this.d = design; this.tech = tech || {};
    this.rng = makeRng((contract.seed || 1) * 31 + 7);
    this.t = 0; this.people = []; this.events = []; this.waits = [];
    this.stats = { through: 0, bumps: 0, stops: 0, laps: 0, spawned: 0 };
    this.acc = this.rng();
    this.idle = !!contract.preview;   // the design-mode preview has no crowd
    this.nextId = 1;
    this.fed = false;    // true when people come from the stage before, not the street
    this.out = null;     // a chained stage hands finished people on: out(p)
  }
  // arrivals per second right now: a flat rate, or phases [{until, rate}]
  // a client's own version of a stage (e.g. the arena's bag check is quicker than a bank counter)
  static tune(c, rate, scale) {
    const t = c.tune || {};
    if (t.params) Object.assign(c.params, t.params);
    return t.rate ? t.rate * scale : rate;
  }
  rate() {
    const cr = this.c.crowd;
    if (cr.phases) { const ph = cr.phases.find(f => this.t < f.until) || cr.phases[cr.phases.length - 1]; return ph.rate; }
    return cr.rate;
  }
  // call from step(): spawns people at the stage's rate during the arrivals window
  arrivals(dt) {
    if (this.fed || this.idle || this.t >= this.c.arrive) return;
    this.acc += this.rate() * dt;
    while (this.acc >= 1) {
      this.acc -= 1 + (this.rng() - 0.5) * 0.6;
      const type = this.guestType();
      this.admit(this.person(type, 0, 0)); this.stats.spawned++;
    }
  }
  // someone leaves this stage: on to the next one in a chain, or counted as through
  finish(p) {
    p.gone = true;
    if (this.out) { this.people = this.people.filter(q => q !== p); this.out(p); return; }
    this.stats.through++;
  }
  guestType() {
    const m = this.c.crowd.mix || {}, u = this.rng();
    let a = 0;
    for (const k of ['elderly', 'case', 'wheel', 'pram', 'bike']) { a += m[k] || 0; if (u < a) return k; }
    return 'normal';
  }
  lerp(range) { return range[0] + (range[1] - range[0]) * this.rng(); }
  person(type, x, y) {
    const g = INSIDE[type] || INSIDE.normal;
    // r, dir, vx, vy and flash are what the job screen's person drawing reads
    return { id: this.nextId++, type, x, y, walk: this.lerp(g.walk), react: this.lerp(g.react), born: this.t, r: type === 'case' ? 0.24 : type === 'wheel' ? 0.33 : 0.2, dir: 1, vx: 0, vy: -0.01, flash: 0 };
  }
  // walk p toward (tx, ty); returns true once there
  walkTo(p, tx, ty, dt, speed = p.walk) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), s = speed * dt;
    if (d > 1e-3) { p.vx = dx / d * speed; p.vy = dy / d * speed; }
    if (d <= s) { p.x = tx; p.y = ty; return true; }
    p.x += dx / d * s; p.y += dy / d * s; return false;
  }
  bump(x, y) { this.stats.bumps++; this.events.push({ type: 'bump', x, y, t: this.t }); if (this.events.length > 80) this.events.splice(0, this.events.length - 80); }
  note(type, x, y) { this.events.push({ type, x, y, t: this.t }); if (this.events.length > 80) this.events.splice(0, this.events.length - 80); }
  sweep() { if (this.people.some(p => p.gone)) this.people = this.people.filter(p => !p.gone); }
  waitP90() {
    const w = this.waits.slice().sort((a, b) => a - b);
    return w.length ? w[Math.min(w.length - 1, Math.floor(w.length * 0.9))] : 0;
  }
  waitMean() { return this.waits.length ? this.waits.reduce((a, b) => a + b, 0) / this.waits.length : 0; }
  result() { return { ...this.stats, wait: this.c.metric === 'mean' ? this.waitMean() : this.waitP90(), minTemp: 21, maxTemp: 21, accessFail: 0, bikeFail: 0, evac: null }; }
}
