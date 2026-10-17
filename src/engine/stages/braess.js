// Braess's paradox: two routes out of the shopping centre, each a long mall plus a pinch point that slows down
// the busier it gets. A footbridge between them looks like a shortcut, so everyone takes both pinch points and
// it gets slower for all. Closing the shortcut speeds everyone up. Each shopper only picks what's quickest for them.
import { StageSim } from './common.js';

// the plan: S (entrance, left) to T (exit, right). Upper route S-A-T, lower route S-B-T, bridge A-B.
const N = { S: [-6.2, 0], A: [-2.6, -2.4], B: [2.6, 2.4], T: [6.2, 0], AT: [6.2, -2.4], SB: [-6.2, 2.4] };
const EDGES = {
  SA: { path: [N.S, [-6.2, -2.4], N.A], busy: true },          // escalators up to the upper mall
  AT: { path: [N.A, [5.2, -2.4], N.T], busy: false },          // the upper mall
  SB: { path: [N.S, [-5.2, 2.4], N.B], busy: false },          // the lower mall
  BT: { path: [N.B, [6.2, 2.4], N.T], busy: true },            // the stairs out to the tram stop
  AB: { path: [N.A, [0, -2.4], [0, 2.4], N.B], busy: false },  // the footbridge
};
// widening a pinch point: a second escalator costs more than wider stairs
const WIDEN = { esc: 14000, stairs: 9000 };
const along = (path, f) => {
  const seg = []; let tot = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); tot += d; }
  let r = f * tot;
  for (let i = 0; i < seg.length; i++) { if (r <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, r / seg[i]) : 1; return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]; } r -= seg[i]; }
  return path[path.length - 1];
};

class BraessSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    this.flow = { SA: 0, BT: 0 };   // people per second recently entering each pinch point
  }
  // how long an edge takes right now: the malls are fixed; pinch points slow with the flow through them
  edgeTime(e, p) {
    const P = this.c.params;
    if (e === 'AT' || e === 'SB') return P.mall * (1.3 / p.walk);
    if (e === 'AB') return P.bridge * (1.3 / p.walk);
    const wide = e === 'SA' ? this.d.wideEsc : this.d.wideStairs;
    return P.a + P.b * ((e === 'BT' ? P.stairs : P.esc) || 1) * (wide ? 0.5 : 1) * this.flow[e];
  }
  // a shopper counts towards a pinch point's crowd as soon as they choose a route through it,
  // the way everyone can see where the crowd is heading
  commit(e) { this.flow[e] += 1 / this.c.params.window; }
  enter(p, e) { p.edge = e; p.t0 = this.t; p.dur = this.edgeTime(e, p); }
  admit(p) {
    p.gone = false; p.inAt = this.t; p.x = N.S[0]; p.y = N.S[1];
    // each shopper takes what looks quickest from here, judged by how busy things are right now
    const open = this.d.bridge === 'open', noise = 1 + (this.rng() - 0.5) * 0.12;
    const up = this.edgeTime('SA', p) + Math.min(this.edgeTime('AT', p), open ? this.edgeTime('AB', p) + this.edgeTime('BT', p) : Infinity);
    const down = this.edgeTime('SB', p) + this.edgeTime('BT', p);
    if (up * noise < down) { this.commit('SA'); this.enter(p, 'SA'); } else { this.commit('BT'); this.enter(p, 'SB'); }
    this.people.push(p);
  }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const decay = Math.exp(-dt / this.c.params.window);
    this.flow.SA *= decay; this.flow.BT *= decay;
    for (const p of this.people) {
      const f = Math.min(1, (this.t - p.t0) / p.dur);
      [p.x, p.y] = along(EDGES[p.edge].path, f);
      p.vx = 1; p.vy = 0;
      if (f < 1) continue;
      if (p.edge === 'SA') { const cross = this.d.bridge === 'open' && this.edgeTime('AB', p) + this.edgeTime('BT', p) < this.edgeTime('AT', p); if (cross) this.commit('BT'); this.enter(p, cross ? 'AB' : 'AT'); }
      else if (p.edge === 'SB' || p.edge === 'AB') this.enter(p, 'BT');
      else { this.waits.push(this.t - p.inAt); this.finish(p); }
    }
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'braess',
  name: 'Shopping centre exits',
  paradox: "Braess's paradox",
  about: 'Shoppers head for the tram stop by one of two routes: escalators then the upper mall, or the lower mall then the stairs. Each picks whatever looks quickest.',
  waitLabel: '9 in 10 reach the tram stop within',
  box: { w: 16, h: 7 },
  metric: 'p90',
  slack: 1.03,
  // targets come from what the client can do without rebuilding anything; where the malls are long, the bridge
  // really is a shortcut, so the target is what one widened pinch point can do
  reference(ok, c) { return c.params.layout === 'long' ? ok.filter(x => !(x.slots.wideEsc && x.slots.wideStairs)) : ok.filter(x => !x.slots.wideEsc && !x.slots.wideStairs); },
  level(c, rng, tier) {
    const scale = 1 + 0.06 * Math.min(tier, 6);
    let rate = 1.0 * scale * (0.95 + rng() * 0.1);
    if (c.twists.includes('sale')) rate *= 1.2;
    if (c.twists.includes('late')) rate *= 0.8;
    // Most levels: the malls are just long enough that the bridge always looks like a shortcut, even when it's
    // packed, so closing it is the answer. Some levels have long malls: there the bridge is a real shortcut,
    // closing it makes things worse, and the answer is to widen a pinch point. A research call is always the paradox.
    const a = 6, b = 30, bridge = 3;
    // Pushchairs walk the malls slowly and set the slowest times whichever way the crowd goes, so closing the
    // bridge can't help them: a level with pushchairs has long malls, and a research call has none.
    const paradox = c.opts.callback === 'paradox';
    if (paradox) c.twists = c.twists.filter(t => t !== 'pushchairs');
    const layout = !paradox && (rng() < 0.4 || c.twists.includes('pushchairs')) ? 'long' : 'shortcut';
    c.params = { a, b, bridge, layout, mall: Math.round(layout === 'long' ? bridge + a + 2 * b * rate + 10 : bridge + a + b * rate + 5), window: 12, stairs: c.twists.includes('roadworks') ? 1.4 : 1, esc: c.twists.includes('repairs') ? 1.5 : 1 };
    const mix = {};
    if (c.twists.includes('pushchairs')) mix.pram = 0.12;
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = c.twists.includes('late') ? 190 : 150; c.run = 300;
  },
  twists: {
    sale: { label: 'Closing-down sale', text: 'A fifth more shoppers heading home at once.' },
    pushchairs: { label: 'Pushchairs', text: 'Lots of pushchairs, who walk the long malls more slowly.' },
    roadworks: { label: 'Roadworks', text: 'Roadworks by the tram stop narrow the stairs out.' },
    repairs: { label: 'Escalator repairs', text: 'One escalator is out for repairs, so the way up is slower.' },
    late: { label: 'Late opening', text: 'Late-night opening: fewer shoppers, leaving over a longer stretch.' },
  },
  options() {
    return [
      { key: 'bridge', label: 'Footbridge', kind: 'seg', choices: [['open', 'Open'], ['closed', 'Closed', 'permits']] },
      { key: 'wideEsc', label: 'Widen the escalators', kind: 'toggle', note: `+£${WIDEN.esc.toLocaleString('en-GB')} · twice the capacity` },
      { key: 'wideStairs', label: 'Widen the stairs', kind: 'toggle', note: `+£${WIDEN.stairs.toLocaleString('en-GB')} · twice the capacity` },
    ];
  },
  explain(d, c) { return `Each mall takes about ${c.params.mall}s to walk. The escalators and the stairs take ${c.params.a}s when empty, and slow down the more people use them${c.params.stairs > 1 ? ' (the stairs more than usual)' : c.params.esc > 1 ? ' (the escalators more than usual)' : ''}. The bridge takes ${c.params.bridge}s.`; },
  hint(r, c) { return c.params.layout === 'long' ? 'Watch which way people go. Here the malls are long, so the bridge saves a real walk: it\'s the escalators and the stairs that hold everyone up.' : 'Watch which way people go. If almost everyone squeezes through both the escalators and the stairs, the "shortcut" is costing them.'; },
  defaults() { return { stage: 'braess', bridge: 'open', wideEsc: false, wideStairs: false }; },
  cost(d, ex) { return (d.bridge === 'closed' && !(ex && ex.bridge === 'closed') ? 1500 : 0) + (d.wideEsc && !(ex && ex.wideEsc) ? WIDEN.esc : 0) + (d.wideStairs && !(ex && ex.wideStairs) ? WIDEN.stairs : 0); },
  sig(d) { return `b${d.bridge === 'open' ? 'O' : 'C'}${d.wideEsc ? 'E' : ''}${d.wideStairs ? 'S' : ''}`; },
  candidates(c, tech) {
    const out = [];
    for (const bridge of tech.permits ? ['open', 'closed'] : ['open']) for (const wideEsc of [false, true]) for (const wideStairs of [false, true]) out.push({ stage: 'braess', bridge, wideEsc, wideStairs });
    return out;
  },
  Sim: BraessSim,
};
