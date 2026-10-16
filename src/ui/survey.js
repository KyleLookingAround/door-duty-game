// Surveys: every tender is solved in the background (in a worker) as soon as it appears,
// so briefs usually open instantly. The brief the player is waiting on goes first.
import { $, toast } from './dom.js';
import { S, save } from './store.js';
import { generateSolved, GATE } from '../game/contracts.js';
import { refreshPlots } from '../game/plots.js';
import { techOf } from '../game/economy.js';
import { TWISTS } from '../content/twists.js';

// the street listens here to redraw when a survey lands
export const surveyHooks = { changed: () => {} };

let worker = null, jobId = 0; const pending = new Map();
export function startWorker() {
  try {
    const core = document.getElementById('core');
    worker = core
      ? new Worker(URL.createObjectURL(new Blob([core.textContent], { type: 'text/javascript' })))   // the built page
      : new Worker('worker.js', { type: 'module' });   // development: src/shell.html served from the repo root
    worker.onmessage = e => { const j = pending.get(e.data.id); if (!j) return; if (e.data.done) { pending.delete(e.data.id); j.resolve(e.data.failed ? null : e.data.contract); } else j.progress(e.data.progress, e.data.attempt); };
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }
}
// the brief the player is waiting on gets surveyed first
export function focusSurvey(seed) { GATE.focus = seed; if (worker) worker.postMessage({ focus: seed }); }
function solve(contract, onProgress) {
  if (worker) return new Promise(resolve => { const id = ++jobId; pending.set(id, { resolve, progress: onProgress }); worker.postMessage({ id, contract, unlocks: techOf(S), recent: S.recent || [] }); });
  return generateSolved(contract, techOf(S), S.recent || [], onProgress).catch(() => null);
}
export const surveys = new Map();
export function survey(p) {
  if (p.contract.solved) return Promise.resolve(p.contract);
  const seed = p.contract.seed;
  if (surveys.has(seed)) return surveys.get(seed).promise;
  const entry = { progress: 0, listeners: new Set() };
  entry.promise = solve(p.contract, (f, a) => { entry.progress = f; entry.attempt = a || 0; entry.listeners.forEach(l => l(f, a || 0)); }).then(sc => {
    surveys.delete(seed);
    if (!sc) {
      // the survey couldn't produce a fair job: draw a fresh tender for this building and survey that
      if (p.contract && p.contract.seed === seed) { p.contract = null; refreshPlots(S); save(); }
      return p.contract ? survey(p) : null;
    }
    if (p.contract && p.contract.seed === seed) {
      if (p.status === 'callback' && sc.existing && sc.par.cost === 0) {
        // the doors you fitted already cope: no job, and the maintenance fee resumes
        p.status = 'fitted'; p.contract = null; p.reason = null; save();
        toast(`${p.name}: false alarm. Your doors coped.`);
        surveyHooks.changed();
        return null;
      }
      p.contract = sc; save(); surveyHooks.changed();
    }
    return sc;
  });
  surveys.set(seed, entry);
  return entry.promise;
}
export const twistLabel = t => (TWISTS[t] ? TWISTS[t].label : t);
