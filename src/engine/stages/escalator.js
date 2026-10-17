// Escalator standing: "stand on the right, walk on the left" feels efficient, but on a tall escalator few
// people walk, so the walking lane runs half empty while the standing queue backs up. Standing on both sides
// moves more people. On a short escalator plenty of people walk and the walking lane earns its keep.
import { StageSim } from './common.js';

const FOOT_Y = 3.4, TOP_Y = -3.2, LANE = 0.32, STEP_V = 0.5;

class EscalatorSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    const n = d.count;
    this.escs = Array.from({ length: n }, (_, i) => {
      const x = (i - (n - 1) / 2) * 2.2;
      // lane 0 is the left (walking, under the walk rule), lane 1 the right
      return { i, x, lanes: [0, 1].map(k => ({ k, x: x + (k ? LANE : -LANE), q: [], ready: 0, on: [] })) };
    });
    this.trainT = c.params.burst ? c.params.burst.every - 4 : 0;
    this.pendingN = 0;
  }
  walksUp(p) {
    // fewer people bother walking the taller the escalator; older guests and suitcases never do
    if (this.d.rule !== 'walk' || p.type === 'elderly' || p.type === 'case' || p.type === 'pram') return false;
    return this.rng() < this.c.params.walkers;
  }
  admit(p) {
    p.x = (this.rng() - 0.5) * 6; p.y = FOOT_Y + 1.2 + this.rng() * 0.4; p.gone = false; p.inAt = this.t;
    p.walking = this.walksUp(p);
    // pick the escalator and lane with the shortest queue that suits you
    let best = null, bs = 1e9;
    for (const e of this.escs) for (const l of e.lanes) {
      if (this.d.rule === 'walk' && (l.k === 0) !== p.walking) continue;
      const s = l.q.length + Math.abs(l.x - p.x) * 0.15 + this.rng() * 0.3;
      if (s < bs) { bs = s; best = l; }
    }
    p.lane = best; best.q.push(p); p.on = false;
    this.people.push(p);
  }
  pending() { return this.pendingN > 0; }
  step(dt) {
    this.t += dt;
    const P = this.c.params;
    if (P.burst && !this.fed && !this.idle) {
      // a train pulls in and everyone heads for the escalators at once
      if (this.t < this.c.arrive) { this.trainT += dt; if (this.trainT >= P.burst.every) { this.trainT -= P.burst.every; this.pendingN += P.burst.n; this.note('train', 0, FOOT_Y + 1.5); } }
      if (this.pendingN > 0) { this.cool = (this.cool || 0) - dt; if (this.cool <= 0) { this.admit(this.person(this.guestType(), 0, 0)); this.stats.spawned++; this.pendingN--; this.cool = 0.12; } }
    } else this.arrivals(dt);
    const len = P.length;
    let waiting = 0;
    for (const e of this.escs) for (const l of e.lanes) {
      waiting += l.q.length;
      l.ready -= dt;
      // the head of the queue steps on when there's room: standers fill every other step, walkers keep a gap
      const head = l.q[0];
      if (head && l.ready <= 0 && Math.hypot(head.x - l.x, head.y - FOOT_Y) < 0.5) {
        l.q.shift(); head.on = true; head.pos = 0; head.lane = l; l.on.push(head);
        l.ready = head.walking ? P.walkGap : P.standGap;
      }
      for (const p of l.on) {
        const v = STEP_V + (p.walking ? p.walk * 0.55 : 0);
        p.pos += v * dt;
        p.x = l.x; p.y = FOOT_Y - (FOOT_Y - TOP_Y) * Math.min(1, p.pos / len); p.vx = 0; p.vy = -v;
        if (p.pos >= len) { p.done = true; this.waits.push(this.t - p.inAt); this.finish(p); }
      }
      if (l.on.some(p => p.done)) l.on = l.on.filter(p => !p.done);
      // walk up to the foot of your lane, behind the person in front
      l.q.forEach((p, j) => this.walkTo(p, l.x + (j > 0 ? ((j % 3) - 1) * 0.25 : 0), FOOT_Y + 0.25 + j * 0.42, dt));
    }
    // a crowd packed at the foot of the escalators is a crush risk
    if (waiting > P.crush) { this.crushT = (this.crushT || 0) + dt * Math.min(0.5, (waiting - P.crush) / 40); if (this.crushT >= 1) { this.crushT -= 1; this.bump((this.rng() - 0.5) * 4, FOOT_Y + 1.4); } }
    this.peak = Math.max(this.peak || 0, waiting);
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length && !this.pendingN; }
}

export default {
  key: 'escalator',
  name: 'Escalators',
  paradox: 'Escalator standing',
  about: 'People queue at the foot of the escalators. The rule on the steps decides how fast the queue goes.',
  waitLabel: 'Time from the foot to the top',
  bumpLabel: 'Crush at the foot',
  box: { w: 11, h: 9 },
  metric: 'mean',
  slack: 1.12,
  // targets come from the escalators already there: the lesson is the rule, not buying another
  reference(ok, c) { return ok.filter(x => x.slots.count <= c.existing.count); },
  level(c, rng, tier) {
    const tall = c.kind === 'station' || c.kind === 'arena' || c.twists.includes('deep');
    const len = tall ? 34 : 10;
    const scale = 1 + 0.08 * Math.min(tier, 6);
    c.params = { length: len, walkers: tall ? 0.18 : 0.5, standGap: 0.9, walkGap: 1.8, crush: tall ? 70 : 40 };
    StageSim.tune(c, 0, 1);
    const mix = {};
    if (c.twists.includes('shoppers')) mix.case = 0.15;
    if (c.twists.includes('seniors')) mix.elderly = 0.25;
    if (tall) {
      c.params.burst = { every: 40, n: Math.round(105 * scale * (c.twists.includes('rush') ? 1.25 : 1)) };
      c.crowd = { rate: +(c.params.burst.n / c.params.burst.every).toFixed(3), mix };
    } else c.crowd = { rate: +(0.95 * scale * (c.twists.includes('rush') ? 1.25 : 1) * (0.94 + rng() * 0.12)).toFixed(3), mix };
    c.arrive = tall ? 120 : 75; c.run = c.arrive + (tall ? 150 : 60);
    // on the deep escalator what matters is the worst of the queue; on a short one, everyone's average
    c.metric = tall ? 'p90' : 'mean';
  },
  bumps: c => 1,
  twists: {
    rush: { label: 'Rush', text: 'A quarter more people than usual.' },
    seniors: { label: 'Older travellers', text: 'A quarter of the crowd won\'t walk up whatever the rule says.' },
    shoppers: { label: 'Laden shoppers', text: 'People with bags and cases stand still on the steps.' },
  },
  options(c, tech) {
    return [
      { key: 'rule', label: 'The rule', kind: 'seg', choices: [['walk', 'Stand right, walk left'], ['stand', 'Stand on both sides', 'escalators']] },
      { key: 'count', label: 'Escalators up', kind: 'stepper', min: 1, max: 4, note: `£30,000 for each escalator beyond the ${c.existing.count} already there` },
    ];
  },
  explain(d, c) { return `${Math.round(c.params.length)} m of escalator: ${(c.params.length / STEP_V).toFixed(0)}s standing, about ${(c.params.length / (STEP_V + 0.7)).toFixed(0)}s walking. On this one roughly ${Math.round(c.params.walkers * 100)}% of people would walk.`; },
  hint(r, c) { return 'The queue at the foot is too long. Count who actually walks: if it\'s only a few, the walking lane is wasted space.'; },
  defaults() { return { stage: 'escalator', count: 1, rule: 'walk' }; },
  cost(d, ex) { return Math.max(0, d.count - (ex ? ex.count : 1)) * 30000 + (d.rule !== (ex ? ex.rule : 'walk') ? 1500 : 0); },
  sig(d) { return `e${d.count}${d.rule === 'stand' ? 'S' : 'W'}`; },
  candidates(c, tech) {
    const out = [], base = c.existing.count;
    for (let n = base; n <= Math.min(4, base + 2); n++) for (const rule of tech.escalators ? ['walk', 'stand'] : ['walk']) out.push({ stage: 'escalator', count: n, rule });
    return out;
  },
  Sim: EscalatorSim,
};
