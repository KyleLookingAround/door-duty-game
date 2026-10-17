// How a golden case is surveyed. Shared by the golden test and tools/record-golden.mjs.
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { makeContract, generateSolved } from '../src/game/contracts.js';

export const TECHS = {
  none: {}, mid: { core: 1, mouth: 1, padded: 1, curtain: 1, barriers: 1 },
  late: { core: 1, mouth: 1, padded: 1, sensor: 1, curtain: 1, vestibule: 1, wide: 1, heat: 1, heat2: 1, seals: 1, barriers: 1, pillars: 1, gates: 1, tidal: 1, doorman: 1 },
  // everything the inside jobs use
  inside: { barriers: 1, pillars: 1, stewarding: 1, escalators: 1, markings: 1, zoning: 1, paternoster: 1, travelator: 1, permits: 1 },
};
// A case: k (client), tn (tech), month, seed, and one of:
//   a door job: first (first visit), ev (event), cb (callback reason);
//   a research call: cb 'paradox', need (its twist), existing (the doors already fitted);
//   an inside job: stage, or chain (stages run as one crowd).
export async function survey(cs) {
  const tech = TECHS[cs.tn];
  const opts = { first: cs.first, tech, event: cs.ev };
  if (cs.cb) opts.callback = cs.cb;
  if (cs.need) opts.need = [cs.need];
  if (cs.existing) opts.existing = cs.existing;
  if (cs.chain) Object.assign(opts, { stage: 'chain', chain: cs.chain });
  else if (cs.stage) opts.stage = cs.stage;
  const c = makeContract(cs.k, 3, cs.month, cs.seed, opts);
  const s = await generateSolved(c, tech, []);
  return { twists: s.twists, goals: s.goals, par: s.par.sig, cost: s.par.cost, fee: s.fee, budget: s.budget, relaxed: !!s.relaxed, slots: s.slots, temp: s.outsideTemp };
}

// Survey many cases at once on worker threads (test/golden-worker.js). Each survey is deterministic per
// case, so where it runs can't change the result; it just uses every core. Landmark cases are the slowest,
// so they start first. Resolves to the results in the order of `cases`.
export function surveyAll(cases, { threads = availableParallelism(), onDone = () => {} } = {}) {
  const slow = cs => (cs.k === 'towers' || cs.k === 'station' ? 0 : 1);
  const order = cases.map((cs, i) => i).sort((a, b) => slow(cases[a]) - slow(cases[b]) || a - b);
  return new Promise((resolve, reject) => {
    const out = new Array(cases.length);
    let next = 0, done = 0;
    if (!cases.length) return resolve(out);
    const workers = Array.from({ length: Math.min(threads, cases.length) }, () => new Worker(new URL('./golden-worker.js', import.meta.url)));
    const stop = () => workers.forEach(w => w.terminate());
    const feed = w => { if (next < order.length) { w.k = order[next++]; w.postMessage(cases[w.k]); } };
    for (const w of workers) {
      w.on('message', m => {
        if (m.error) { stop(); return reject(new Error(`survey of ${JSON.stringify(cases[w.k])} failed: ${m.error}`)); }
        out[w.k] = m.result; onDone(++done, cases.length);
        if (done === cases.length) { stop(); resolve(out); } else feed(w);
      });
      w.on('error', e => { stop(); reject(e); });
      feed(w);
    }
  });
}
