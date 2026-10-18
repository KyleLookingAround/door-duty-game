// Airport security: the scanner isn't the bottleneck, the trays are.
// Each lane has an X-ray scanner that could take a tray every few seconds, but people unload their bags into trays
// one at a time at the head of the lane, so the scanner mostly waits. A smart lane (several people unloading at
// once, trays sent along automatically) moves far more people through the same scanner than a whole new lane;
// then the bench where people repack fills up, and a full bench stops the belt. A new lane is the dear answer.
import { StageSim } from './common.js';

const LANE_COST = 30000, SMART_COST = 5000, BENCH_COST = 1000, SEARCHER_COST = 3000;
const DIVEST_Y = 2.0, ARCH_Y = 0.2, BENCH_Y0 = -0.9, SEC_EXIT_Y = -4.4, SEC_HEAD_Y = 3.1, SEC_DOOR = [0, 4.4];

class SecuritySim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    const n = d.lanes, gap = Math.min(2.6, 13 / n);
    this.lanes = Array.from({ length: n }, (_, i) => ({
      i, x: (i - (n - 1) / 2) * gap,
      divest: Array.from({ length: d.smart ? 3 : 1 }, () => null),   // who is unloading at each place
      belt: [], scanT: 0,                                           // trays waiting for the scanner, time left on this one
      bench: [], cap: d.bench ? 10 : 4,                               // trays out of the scanner waiting to be repacked
      archUntil: 0,
    }));
    this.searchers = Array.from({ length: d.searchers }, () => ({ until: 0 }));
    this.searchQ = [];   // trays pulled for a hand search, and people pulled for a pat-down
    this.queue = [];
  }
  admit(p) {
    p.x = SEC_DOOR[0] + (this.rng() - 0.5) * 1.2; p.y = SEC_DOOR[1]; p.gone = false; p.inAt = this.t; p.state = 'queue';
    const P = this.c.params, old = p.type === 'elderly';
    p.trays = Math.min(4, 1 + Math.floor(this.rng() * P.trays) + (p.type === 'case' ? 1 : 0));
    p.divestT = (P.unload + P.perTray * p.trays) * (old ? 1.4 : 1) * (0.7 + this.rng() * 0.6);
    p.repackT = (4 + 3.5 * p.trays) * (old ? 1.4 : 1) * (0.7 + this.rng() * 0.6);
    this.queue.push(p); this.people.push(p);
  }
  freeSearcher() { return this.searchers.find(s => s.until <= this.t); }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const P = this.c.params;
    // the head of the queue goes to the first free unloading place
    for (const ln of this.lanes) for (let k = 0; k < ln.divest.length && this.queue.length; k++) {
      if (ln.divest[k]) continue;
      const p = this.queue.shift(); ln.divest[k] = p; p.lane = ln; p.slot = k; p.state = 'walk';
    }
    for (const ln of this.lanes) {
      // the scanner takes the next tray, unless the bench beyond it is full (the belt stops)
      if (ln.scanT > 0) ln.scanT -= dt;
      if (ln.scanT <= 0 && ln.belt.length && ln.cur == null) { ln.cur = ln.belt.shift(); ln.scanT = P.scan; }
      if (ln.cur != null && ln.scanT <= 0) {
        if (ln.bench.length < ln.cap) {
          const tray = ln.cur; ln.cur = null;
          if (this.rng() < P.flag) { tray.held = true; this.searchQ.push({ tray, ln }); this.note('slow', ln.x, BENCH_Y0); }
          ln.bench.push(tray);
        } else if (!ln.stopNoted) { ln.stopNoted = true; this.stats.stops++; this.note('stop', ln.x, ARCH_Y - 0.6); }
      }
      if (ln.bench.length < ln.cap) ln.stopNoted = false;
    }
    // searchers: pat-downs and bag searches, first come first served
    while (this.searchQ.length) {
      const s = this.freeSearcher(); if (!s) break;
      const job = this.searchQ.shift();
      if (job.tray) { s.until = this.t + P.search; job.tray.until = s.until; }
      else { s.until = this.t + P.patdown; job.p.until = s.until; }
    }
    for (const p of this.people) {
      const ln = p.lane;
      if (p.state === 'queue') {
        const j = this.queue.indexOf(p), row = Math.floor(j / 12), k = j % 12;
        this.walkTo(p, (row % 2 ? 1 : -1) * (3.3 - k * 0.6), SEC_HEAD_Y + row * 0.45, dt);
      } else if (p.state === 'walk') {
        if (this.walkTo(p, ln.x - 0.5 + (p.slot - (ln.divest.length - 1) / 2) * 0.55, DIVEST_Y, dt, p.walk * 1.3)) { p.state = 'divest'; p.until = this.t + p.divestT * (this.d.smart ? 0.85 : 1); }
      } else if (p.state === 'divest') {
        if (this.t >= p.until) {
          // trays onto the belt; then through the arch, one at a time
          p.mine = Array.from({ length: p.trays }, () => ({ p })); ln.belt.push(...p.mine);
          ln.divest[p.slot] = null; p.state = 'arch';
        }
      } else if (p.state === 'arch') {
        if (ln.archUntil > this.t) continue;
        if (this.walkTo(p, ln.x + 0.75, ARCH_Y, dt)) {
          ln.archUntil = this.t + 1.5;
          if (this.rng() < P.alarm) { p.state = 'patdown'; p.until = Infinity; this.searchQ.push({ p }); this.note('slow', p.x, p.y); }
          else p.state = 'collect';
        }
      } else if (p.state === 'patdown') {
        if (this.t >= p.until) p.state = 'collect';
      } else if (p.state === 'collect') {
        // wait at the bench for every tray: through the scanner, and back from a search if it was pulled
        this.walkTo(p, ln.x + 0.75, BENCH_Y0 - 0.6, dt);
        if (p.mine.every(tr => ln.bench.includes(tr) && (!tr.held || (tr.until != null && this.t >= tr.until)))) { p.state = 'repack'; p.until = this.t + p.repackT; }
      } else if (p.state === 'repack') {
        if (this.t >= p.until) {
          ln.bench = ln.bench.filter(tr => tr.p !== p);
          this.waits.push(this.t - p.inAt); p.state = 'leave';
          if (this.out) this.finish(p); else this.stats.through++;
        }
      } else if (p.state === 'leave') {
        if (this.walkTo(p, ln.x + 0.75, SEC_EXIT_Y, dt, p.walk * 1.2)) p.gone = true;
      }
    }
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'security',
  name: 'Security',
  paradox: 'The trays, not the scanner',
  about: 'Passengers unload their bags into trays, walk through the arch, then repack on the far side. Each lane has an X-ray scanner.',
  waitLabel: '9 in 10 through security within',
  box: { w: 15, h: 9.4 },
  metric: 'p90',
  slack: 1.1,
  // targets: what the client could do without a second new lane (a research call: without a new lane at all)
  reference(ok, c) { return ok.filter(x => x.slots.lanes <= c.existing.lanes + (c.paradox ? 0 : 1)); },
  level(c, rng, tier) {
    const scale = 1 + 0.08 * Math.min(tier, 6);
    if (c.existing) for (const [k, v] of Object.entries({ smart: false, bench: false, searchers: c.existing.lanes || 2 })) if (c.existing[k] == null) c.existing[k] = v;
    c.params = { lanes0: c.existing ? c.existing.lanes : 2, max: 5, trays: 3, unload: 7, perTray: 5, scan: 3.2, flag: 0.06, search: 35, alarm: 0.08, patdown: 18 };
    let rate = 0.23 * scale * (0.92 + rng() * 0.16);
    const mix = { case: 0.15 };
    if (c.twists.includes('earlies')) rate *= 1.3;
    if (c.twists.includes('halfterm')) { c.params.trays = 4; mix.elderly = 0.15; }
    if (c.twists.includes('business')) { c.params.trays = 2; c.params.perTray = 3.5; mix.case = 0.3; rate *= 1.3; }
    if (c.twists.includes('liquids')) c.params.flag = 0.18;
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = 120; c.run = 420;
  },
  twists: {
    earlies: { label: 'Early flights', text: 'The first wave of morning flights: a third more passengers at once.' },
    halfterm: { label: 'Half term', text: 'Families off on holiday: more bags each, and grandparents who take their time.' },
    business: { label: 'Business travellers', text: 'The early business flights: more passengers, but one small bag each, quick to unload.' },
    liquids: { label: 'Liquids check', text: 'A crackdown on liquids: three times as many bags pulled for a search.' },
  },
  options(c) {
    return [
      { key: 'lanes', label: 'Lanes', kind: 'stepper', min: 1, max: c.params.max, note: `£${LANE_COST.toLocaleString('en-GB')} a lane beyond the ${c.params.lanes0} already there: a scanner, an arch and a belt` },
      { key: 'smart', label: 'Smart lanes', kind: 'toggle', note: `+£${SMART_COST.toLocaleString('en-GB')} a lane · three people unload at once and the trays go along by themselves` },
      { key: 'bench', label: 'Longer repacking benches', kind: 'toggle', note: `+£${BENCH_COST.toLocaleString('en-GB')} a lane · room for twice the trays, so the belt rarely stops` },
      { key: 'searchers', label: 'Search staff', kind: 'stepper', min: 1, max: c.params.max + 2, note: `£${SEARCHER_COST.toLocaleString('en-GB')} each beyond those already there · they search pulled bags and pat people down` },
    ];
  },
  explain(d, c) { return `${d.lanes} lane${d.lanes > 1 ? 's' : ''}, ${d.smart ? 'three' : 'one'} unloading place${d.smart ? 's' : ''} each. A scanner takes a tray every ${c.params.scan}s; most people have one to three trays.`; },
  hint(r, c) { return r.stops ? 'The belts keep stopping: the repacking benches are full, so trays can\'t leave the scanner.' : 'Watch the scanners: are they busy, or waiting for people to finish unloading?'; },
  defaults() { return { stage: 'security', lanes: 2, smart: false, bench: false, searchers: 2 }; },
  cost(d, ex) {
    const had = ex ? ex.lanes : 0;
    return Math.max(0, d.lanes - had) * LANE_COST
      + (d.smart ? (ex && ex.smart ? Math.max(0, d.lanes - had) : d.lanes) * SMART_COST : 0)
      + (d.bench ? (ex && ex.bench ? Math.max(0, d.lanes - had) : d.lanes) * BENCH_COST : 0)
      + Math.max(0, d.searchers - (ex ? ex.searchers || 0 : 0)) * SEARCHER_COST;
  },
  sig(d) { return `s${d.lanes}${d.smart ? 'M' : ''}${d.bench ? 'B' : ''}x${d.searchers}`; },
  candidates(c) {
    const out = [], s0 = (c.existing && c.existing.searchers) || 2;
    for (let lanes = Math.max(1, c.params.lanes0); lanes <= c.params.max; lanes++) for (const smart of [false, true]) for (const bench of [false, true])
      for (const searchers of [s0, s0 + 1, s0 + 2]) out.push({ stage: 'security', lanes, smart, bench, searchers });
    return out;
  },
  Sim: SecuritySim,
};
