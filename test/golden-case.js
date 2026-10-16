// How a golden case is surveyed. Shared by the golden test and tools/record-golden.mjs.
import { makeContract, generateSolved } from '../src/game/contracts.js';

export const TECHS = {
  none: {}, mid: { core: 1, mouth: 1, padded: 1, curtain: 1, barriers: 1 },
  late: { core: 1, mouth: 1, padded: 1, sensor: 1, curtain: 1, vestibule: 1, wide: 1, heat: 1, heat2: 1, seals: 1, barriers: 1, pillars: 1, gates: 1, tidal: 1, doorman: 1 },
};
export async function survey(cs) {
  const tech = TECHS[cs.tn];
  const opts = { first: cs.first, tech, event: cs.ev };
  if (cs.cb) opts.callback = cs.cb;
  const c = makeContract(cs.k, 3, cs.month, cs.seed, opts);
  const s = await generateSolved(c, tech, []);
  return { twists: s.twists, goals: s.goals, par: s.par.sig, cost: s.par.cost, fee: s.fee, budget: s.budget, relaxed: !!s.relaxed, slots: s.slots, temp: s.outsideTemp };
}
