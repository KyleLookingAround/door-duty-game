// The save: what a firm is, how a new one starts, and how old saves are brought up to date.
import { PLOTS } from '../content/buildings/index.js';

export const SAVE_KEY = 'doorduty-tycoon-v2';
export const SAVE_VERSION = 3;

const newPlot = (p, i) => ({ ...p, i, status: 'locked', contract: null, install: null, stars: 0, fee: 0, tier: 0 });

export function freshState(seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) {
  return {
    version: SAVE_VERSION, upg: 1, seed: seed || 1, rng: seed || 1,
    cash: 20000, month: 9, year: 2026, jobs: 0, unlocks: {}, log: [], recent: [], premises: 0, research: [], staff: {},
    plots: PLOTS.map(newPlot),
  };
}

// Bring any older save up to the current version. Each step is safe to run on an already-current save.
export function migrate(S) {
  if (!S || !S.plots) return freshState();
  // v1: saves from before the company screen existed
  S.premises = S.premises || 0; S.research = S.research || []; S.staff = S.staff || {}; S.unlocks = S.unlocks || {};
  // v2: core and mouth became research; firms that already played keep the settings they used
  if (!S.upg) { if (S.jobs > 0) { S.unlocks.core = true; S.unlocks.mouth = true; } S.upg = 1; }
  // new buildings appended to the town
  for (let i = S.plots.length; i < PLOTS.length; i++) S.plots.push(newPlot(PLOTS[i], i));
  // v3: a seeded random stream, so the same save plays out the same way
  if (!S.seed) { S.seed = (Date.now() >>> 0) || 1; S.rng = S.seed; }
  S.version = SAVE_VERSION;
  return S;
}

// The firm's own random stream (xorshift32), stored in the save so months replay identically.
export function random(S) {
  let s = (S.rng >>> 0) || 1;
  s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
  S.rng = s;
  return s / 4294967296;
}
export const randomInt = (S, n) => Math.floor(random(S) * n);
