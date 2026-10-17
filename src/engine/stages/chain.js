// Chained levels: several stages running together as one crowd. People who finish one stage walk straight
// into the next, so fixing one bottleneck moves the crush down the line (the moving bottleneck).
// The chain is itself a stage, built from the registry it's handed (see index.js), so nothing here is special
// to the surveyor or the job screen beyond "a design has parts".
import { makeRng } from '../world.js';

// someone moving on to the next stage: who they are and when they arrived, nothing the last stage set
const carry = p => ({ id: p.id, type: p.type, born: p.born, walk: p.walk, react: p.react, r: p.r, dir: 1, vx: 0, vy: -0.01, flash: 0 });
const p90 = w => { const s = w.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] : 0; };

export function makeChain(STAGES) {
  class ChainSim {
    constructor(c, d, tech) {
      this.c = c; this.t = 0; this.events = []; this.waits = [];
      this.stats = { through: 0, bumps: 0, stops: 0, laps: 0, spawned: 0 };
      const n = c.chain.length;
      this.parts = c.chain.map((k, i) => new STAGES[k].Sim({ ...c.parts[i], preview: c.preview }, d.parts[i], tech));
      this.parts.forEach((s, i) => {
        s.part = i;
        if (i > 0) s.fed = true;
        s.out = i < n - 1 ? p => this.parts[i + 1].admit(carry(p)) : p => { this.stats.through++; this.waits.push(this.t - p.born); };
      });
    }
    step(dt) {
      this.t += dt;
      for (const s of this.parts) s.step(dt);
      let bumps = 0, stops = 0;
      for (const s of this.parts) {
        bumps += s.stats.bumps; stops += s.stats.stops || 0;
        for (const e of s.events) if (!e.seen) { e.seen = true; this.events.push({ ...e, part: s.part }); }
      }
      this.stats.bumps = bumps; this.stats.stops = stops; this.stats.spawned = this.parts[0].stats.spawned;
      if (this.events.length > 120) this.events.splice(0, this.events.length - 120);
    }
    get people() { return this.parts.flatMap(s => s.people); }
    waitP90() { return p90(this.waits); }
    waitMean() { return this.waits.length ? this.waits.reduce((a, b) => a + b, 0) / this.waits.length : 0; }
    over() { return this.t >= this.c.arrive && this.parts.every(s => !s.people.length && !(s.pending && s.pending())); }
    // where the time went: each stage's own result, so the result screen can point at the bottleneck
    result() {
      return { ...this.stats, wait: p90(this.waits), minTemp: 21, maxTemp: 21, accessFail: 0, bikeFail: 0, evac: null, parts: this.parts.map(s => s.result()) };
    }
  }

  const partsOf = c => c.chain.map((k, i) => ({ st: STAGES[k], sub: c.parts[i], i }));

  return {
    key: 'chain',
    name: 'The whole route',
    waitLabel: '9 in 10 make it all the way through within',
    metric: 'p90',
    slack: 1.2,
    twistsOf: opts => Object.assign({}, ...(opts.chain || []).map(k => STAGES[k].twists)),
    defaults: opts => ({ stage: 'chain', parts: (opts.chain || []).map(k => STAGES[k].defaults(opts)) }),
    // each stage sets up its own part of the level; the crowd arrives at the first one
    level(c, rng, tier) {
      c.chain = c.opts.chain;
      c.parts = c.chain.map((k, i) => {
        const st = STAGES[k];
        const sub = { kind: c.kind, seed: c.seed * 13 + i * 101 + 7, tier, month: c.month, twists: c.twists.filter(t => st.twists[t]), existing: c.existing.parts[i], opts: c.opts, metric: st.metric || 'p90', tune: c.tunes && c.tunes[k], chained: true };
        st.level(sub, makeRng(sub.seed), tier);
        sub.goals = { bumps: st.bumps ? st.bumps(sub) : 0 };
        return sub;
      });
      c.crowd = c.parts[0].crowd;
      c.arrive = c.parts[0].arrive;
      c.run = Math.max(...c.parts.map(p => p.run)) + 45 * (c.chain.length - 1);
    },
    bumps: c => c.parts.reduce((a, p) => a + (p.goals.bumps || 0), 0),
    bumpLabel: 'Bumps and crushes',
    partsOf,
    cost: (d, ex) => d.parts.reduce((a, p, i) => a + STAGES[p.stage].cost(p, ex && ex.parts[i]), 0),
    sig: d => d.parts.map(p => STAGES[p.stage].sig(p)).join('|'),
    // the surveyor can't try every combination, so it improves the route a step at a time: each round it
    // tries every option at every stage and keeps the change that buys the most time per pound.
    // run(design) -> result. Returns every design it tried, for setting targets and par.
    async explore(c, tech, run, onProgress) {
      const parts = partsOf(c), tried = new Map();
      const key = d => JSON.stringify(d.parts);
      const score = r => r.wait + r.bumps * 20 + Math.max(0, (c.arrivals || 0) - r.through) * 3;
      const evaluate = async d => {
        const k = key(d);
        if (!tried.has(k)) tried.set(k, { slots: d, r: await run(d), cost: this.cost(d, c.existing) });
        return tried.get(k);
      };
      let cur = await evaluate({ stage: 'chain', parts: c.existing.parts.map(p => ({ ...p })) });
      const opts = parts.map(({ st, sub }) => st.candidates(sub, tech));
      const total = 7 * opts.reduce((a, o) => a + o.length, 0);
      let done = 0;
      for (let round = 0; round < 7; round++) {
        let best = null, bestGain = 0;
        for (const { i } of parts) for (const cand of opts[i]) {
          const d = { stage: 'chain', parts: cur.slots.parts.map((p, j) => j === i ? { ...cand } : p) };
          const res = await evaluate(d);
          done++; if (onProgress) onProgress(Math.min(0.99, done / total));
          const gain = (score(cur.r) - score(res.r)) / Math.max(1, (res.cost - cur.cost) / 2000);
          if (res.cost >= cur.cost - 1 && gain > bestGain) { bestGain = gain; best = res; }
        }
        if (!best || bestGain < 0.05) break;
        cur = best;
      }
      return [...tried.values()];
    },
    Sim: ChainSim,
  };
}
