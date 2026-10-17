// Escalators. Three levers, each with a catch, after how real ones are run:
//  - The rule. "Stand on the right, walk on the left" feels efficient, but on a tall escalator few people walk,
//    so the walking lane runs half empty while the standing queue backs up. Standing on both sides moves more
//    people (London Underground's Holborn trials). On a short escalator plenty walk and the lane earns its keep.
//  - Direction. Each escalator runs up or down, and stations turn them round for the peaks. Anyone without an
//    escalator going their way takes the stairs: fine for a fit shopper on one floor, slow for anyone with a
//    case or a pushchair, and a long, slow climb on a deep one.
//  - Speed. A faster escalator gets riders up sooner, but people hesitate before stepping on, so fewer board
//    each minute, and older passengers and people with luggage can stumble. Faster isn't more capacity.
import { StageSim } from './common.js';

const FOOT_Y = 3.4, TOP_Y = -3.2, LANE = 0.32, STAIRS_X = 5.0;
export const ESC_SPEED = { std: 0.5, fast: 0.65 };
const slowType = p => p.type === 'elderly' || p.type === 'case' || p.type === 'pram';

class EscalatorSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    const n = d.count, down = Math.min(n, d.down || 0);
    this.v = ESC_SPEED[d.speed] || ESC_SPEED.std;
    // the down escalators are on the right, nearest the stairs
    this.escs = Array.from({ length: n }, (_, i) => {
      const x = (i - (n - 1) / 2) * 2.2, dir = i >= n - down ? 'down' : 'up';
      // lane 0 is the left (walking, under the walk rule), lane 1 the right
      return { i, x, dir, lanes: [0, 1].map(k => ({ k, x: x + (k ? LANE : -LANE), q: [], ready: 0, on: [], dir })) };
    });
    this.stairs = [];
    this.trainT = c.params.burst ? c.params.burst.every - 4 : 0;
    this.pendingN = 0; this.accDown = this.rng();
  }
  walks(p) {
    // fewer people bother walking the taller the escalator; older guests and suitcases never do
    if (this.d.rule !== 'walk' || slowType(p)) return false;
    return this.rng() < this.c.params.walkers;
  }
  gap(p) { return (p.walking ? this.c.params.walkGap : this.c.params.standGap) * (this.v > ESC_SPEED.std ? 1.3 : 1); }
  ride(p) { return this.c.params.length / (this.v + (p.walking ? p.walk * 0.55 : 0)); }
  stairSpeed(p, dir) { return (dir === 'up' ? 0.35 : 0.5) * (slowType(p) ? 0.45 : 1) * (this.c.params.length > 20 ? 0.7 : 1); }
  // someone arrives: at the foot to go up, or on the upper floor to go down
  admit(p, dir = 'up') {
    p.dir = dir; p.gone = false; p.inAt = this.t; p.on = false;
    p.x = (this.rng() - 0.5) * 6; p.y = dir === 'up' ? FOOT_Y + 1.2 + this.rng() * 0.4 : TOP_Y - 0.6 - this.rng() * 0.3;
    p.walking = this.walks(p);
    // the lane with the quickest-looking queue that suits you, or the stairs if they look quicker (anyone fit
    // judges that; everyone takes the stairs when no escalator goes their way)
    let best = null, bs = 1e9;
    for (const e of this.escs) for (const l of e.lanes) {
      if (l.dir !== dir || (this.d.rule === 'walk' && (l.k === 0) !== p.walking)) continue;
      const s = l.q.length * this.gap(p) + this.ride(p) + Math.abs(l.x - p.x) * 0.15 + this.rng() * 0.3;
      if (s < bs) { bs = s; best = l; }
    }
    const stairT = this.c.params.length / this.stairSpeed(p, dir) * (0.9 + this.rng() * 0.2);
    if (!best || (!slowType(p) && stairT < bs)) { p.stairs = true; p.pos = 0; this.stairs.push(p); }
    else { p.lane = best; best.q.push(p); }
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
    // people heading down, arriving on the upper floor
    if (P.down && !this.fed && !this.idle && this.t < this.c.arrive) {
      this.accDown += P.down * dt;
      while (this.accDown >= 1) { this.accDown -= 1 + (this.rng() - 0.5) * 0.6; this.admit(this.person(this.guestType(), 0, 0), 'down'); this.stats.spawned++; }
    }
    const len = P.length, crowd = { up: 0, down: 0 };
    for (const e of this.escs) for (const l of e.lanes) {
      const up = l.dir === 'up', board = up ? FOOT_Y : TOP_Y, land = up ? TOP_Y : FOOT_Y;
      crowd[l.dir] += l.q.length;
      l.ready -= dt;
      // the head of the queue steps on when there's room: standers fill every other step, walkers keep a gap
      const head = l.q[0];
      if (head && l.ready <= 0 && Math.hypot(head.x - l.x, head.y - board) < 0.5) {
        l.q.shift(); head.on = true; head.pos = 0; l.on.push(head);
        l.ready = this.gap(head);
        // on a fast escalator, an older passenger or someone with luggage can lose their footing stepping on
        if (this.v > ESC_SPEED.std && slowType(head) && this.rng() < 0.05) { this.bump(l.x, board); this.note('stumble', l.x, board); }
      }
      for (const p of l.on) {
        const v = this.v + (p.walking ? p.walk * 0.55 : 0);
        p.pos += v * dt;
        p.x = l.x; p.y = board + (land - board) * Math.min(1, p.pos / len); p.vx = 0; p.vy = up ? -v : v;
        if (p.pos >= len) { p.done = true; this.waits.push(this.t - p.inAt); this.finish(p); }
      }
      if (l.on.some(p => p.done)) l.on = l.on.filter(p => !p.done);
      // walk up to the end of your lane, behind the person in front
      // (the upper floor is shallow: a queue to go down spreads sideways rather than back)
      l.q.forEach((p, j) => this.walkTo(p, up ? l.x + (j > 0 ? ((j % 3) - 1) * 0.25 : 0) : l.x + (j > 0 ? ((j % 5) - 2) * 0.22 : 0), up ? FOOT_Y + 0.25 + j * 0.42 : TOP_Y - 0.25 - Math.min(0.7, Math.floor(j / 5) * 0.18), dt));
    }
    // the stairs: walk to them, then climb or go down at your own pace
    for (const p of this.stairs) {
      const up = p.dir === 'up', from = up ? FOOT_Y : TOP_Y, to = up ? TOP_Y : FOOT_Y;
      if (!p.on) { if (this.walkTo(p, STAIRS_X, from, dt)) p.on = true; continue; }
      const v = this.stairSpeed(p, p.dir);
      p.pos += v * dt; p.x = STAIRS_X; p.y = from + (to - from) * Math.min(1, p.pos / len); p.vx = 0; p.vy = up ? -v : v;
      if (p.pos >= len) { p.done = true; this.waits.push(this.t - p.inAt); this.finish(p); }
    }
    if (this.stairs.some(p => p.done)) this.stairs = this.stairs.filter(p => !p.done);
    // a crowd packed at the foot, or at the top of the down escalators, is a crush risk
    for (const [k, y] of [['up', FOOT_Y + 1.4], ['down', TOP_Y - 1.0]]) {
      const n = crowd[k], key = 'crush_' + k;
      if (n > P.crush) { this[key] = (this[key] || 0) + dt * Math.min(0.5, (n - P.crush) / 40); if (this[key] >= 1) { this[key] -= 1; this.bump((this.rng() - 0.5) * 4, y); } }
    }
    this.peak = Math.max(this.peak || 0, crowd.up + crowd.down);
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length && !this.pendingN; }
}

const LIFT_COST = 30000, TURN_COST = 500, SPEED_COST = 2000;
export default {
  key: 'escalator',
  name: 'Escalators',
  paradox: 'Escalator standing',
  about: 'People queue at the escalators, going up from the foot and down from the upper floor. The rule on the steps, which way each one runs and how fast decide how quickly everyone gets through. Without an escalator going their way, people take the stairs.',
  waitLabel: 'Time from one floor to the other',
  bumpLabel: 'Crushes and stumbles',
  box: { w: 12, h: 9 },
  metric: 'mean',
  slack: 1.12,
  // targets come from the escalators already there: the lesson is how they're run, not buying another
  reference(ok, c) { return ok.filter(x => x.slots.count <= c.existing.count); },
  level(c, rng, tier) {
    // a setup saved before escalators could be turned round or re-geared: all up, at the standard speed
    if (c.existing) for (const [k, v] of Object.entries({ down: 0, speed: 'std' })) if (c.existing[k] == null) c.existing[k] = v;
    const tall = c.kind === 'station' || c.kind === 'arena' || c.twists.includes('deep');
    const len = tall ? 34 : 10;
    const scale = 1 + 0.08 * Math.min(tier, 6);
    c.params = { length: len, walkers: tall ? 0.18 : 0.5, standGap: 0.9, walkGap: 1.8, crush: tall ? 70 : 40, down: 0 };
    StageSim.tune(c, 0, 1);
    const mix = {};
    if (c.twists.includes('shoppers')) mix.case = 0.15;
    if (c.twists.includes('seniors')) mix.elderly = 0.25;
    if (c.twists.includes('prams')) mix.pram = 0.1;
    const rush = c.twists.includes('rush') ? 1.25 : 1, evening = c.twists.includes('evening');
    // a research call is about the rule, and a chained level is a one-way crowd: only they have nobody going down
    const twoWay = !c.chained && c.opts.callback !== 'paradox';
    if (tall) {
      // morning: trains empty up the escalators; evening: the crowd pours down to the platforms
      c.params.burst = { every: 40, n: Math.round(105 * scale * rush * (evening ? 0.45 : 1)) };
      c.crowd = { rate: +(c.params.burst.n / c.params.burst.every).toFixed(3), mix };
      if (twoWay) c.params.down = +((evening ? 2.1 : 0.45) * scale * (0.94 + rng() * 0.12)).toFixed(3);
    } else {
      // a shop: shoppers up to the sales floor, and others on their way out; at closing time it turns round
      const closing = c.twists.includes('closing');
      c.crowd = { rate: +(0.95 * scale * rush * (closing ? 0.35 : 1) * (0.94 + rng() * 0.12)).toFixed(3), mix };
      if (twoWay) c.params.down = +((closing ? 1.2 : 0.45) * scale * (0.94 + rng() * 0.12)).toFixed(3);
    }
    c.arrive = tall ? 120 : 75; c.run = c.arrive + (tall ? 150 : 60);
    // on the deep escalator what matters is the worst of the queue; on a short one, everyone's average
    c.metric = tall ? 'p90' : 'mean';
  },
  bumps: c => 1,
  twists: {
    rush: { label: 'Rush', text: 'A quarter more people than usual.' },
    seniors: { label: 'Older travellers', text: 'A quarter of the crowd won\'t walk up whatever the rule says, and they\'re unsteady on a fast escalator.' },
    shoppers: { label: 'Laden shoppers', text: 'People with bags and cases stand still on the steps.' },
    prams: { label: 'Pushchairs', text: 'Parents with pushchairs: the stairs are hard work for them.' },
  },
  // twists about which way the crowd is going, where there's a crowd both ways: home time at a station,
  // closing time at a shop (not on a research call, which is about the rule, nor on a chained level)
  turnTwists: {
    evening: { label: 'Evening peak', text: 'Home time: most people are heading down to the platforms.' },
    closing: { label: 'Closing time', text: 'The shop is closing: most people are heading down and out.' },
  },
  twistsOf(opts, kind) {
    if (opts.callback === 'paradox') return this.twists;
    const t = kind === 'station' ? 'evening' : 'closing';
    return { ...this.twists, [t]: this.turnTwists[t] };
  },
  options(c, tech) {
    const out = [
      { key: 'rule', label: 'The rule', kind: 'seg', choices: [['walk', 'Stand right, walk left'], ['stand', 'Stand on both sides', 'escalators']] },
      { key: 'count', label: 'Escalators', kind: 'stepper', min: 1, max: 4, note: `£${(LIFT_COST / 1000).toFixed(0)},000 for each escalator beyond the ${c.existing.count} already there` },
    ];
    if (c.params.down) out.push({ key: 'down', label: 'Running down', kind: 'stepper', min: 0, max: 4, maxOf: d => d.count, note: `Turning an escalator round: £${TURN_COST} each. The rest run up; anyone with no escalator their way takes the stairs.` });
    if (c.opts.callback !== 'paradox') out.push({ key: 'speed', label: 'Speed', kind: 'seg', choices: [['std', '0.5 m/s'], ['fast', '0.65 m/s']], note: `Re-gearing: £${SPEED_COST.toLocaleString('en-GB')}. Faster rides, but people hesitate before stepping on, and the unsteady can stumble.` });
    return out;
  },
  explain(d, c) {
    const v = ESC_SPEED[d.speed] || ESC_SPEED.std, P = c.params;
    const flows = P.down ? ` About ${Math.round((c.crowd.rate) * 60)} a minute are going up and ${Math.round(P.down * 60)} a minute down.` : '';
    return `${Math.round(P.length)} m of escalator: ${(P.length / v).toFixed(0)}s standing, about ${(P.length / (v + 0.7)).toFixed(0)}s walking. On this one roughly ${Math.round(P.walkers * 100)}% of people would walk.${flows}`;
  },
  hint(r, c) {
    return c.params.down
      ? 'Too slow. Count who actually walks: if it\'s only a few, the walking lane is wasted space. And look at the stairs: if a crowd is trudging them, an escalator is pointing the wrong way for this rush.'
      : 'The queue at the foot is too long. Count who actually walks: if it\'s only a few, the walking lane is wasted space.';
  },
  defaults() { return { stage: 'escalator', count: 1, rule: 'walk', down: 0, speed: 'std' }; },
  cost(d, ex) {
    const was = ex || { count: 1, rule: 'walk' };
    return Math.max(0, d.count - was.count) * LIFT_COST + (d.rule !== was.rule ? 1500 : 0)
      + Math.abs(Math.min(d.count, d.down || 0) - Math.min(was.count, was.down || 0)) * TURN_COST
      + ((d.speed || 'std') !== (was.speed || 'std') ? SPEED_COST : 0);
  },
  sig(d) { return `e${d.count}${d.down ? 'd' + d.down : ''}${d.rule === 'stand' ? 'S' : 'W'}${d.speed === 'fast' ? 'F' : ''}`; },
  candidates(c, tech) {
    // a deep escalator costs too much to try two more; speed is tried on what's there and one more
    const out = [], base = c.existing.count, more = c.params.length > 20 && c.params.down ? 1 : 2;
    for (let n = base; n <= Math.min(4, base + more); n++) for (let down = 0; down <= (c.params.down ? n : 0); down++) for (const rule of tech.escalators ? ['walk', 'stand'] : ['walk'])
      for (const speed of c.opts.callback !== 'paradox' && n <= base + 1 ? ['std', 'fast'] : ['std']) out.push({ stage: 'escalator', count: n, down, rule, speed });
    return out;
  },
  Sim: EscalatorSim,
};
