// Surveys: every tender is solved in the background (in a worker) as soon as it appears,
// so briefs usually open instantly. The brief the player is waiting on goes first.
import { $, toast } from './dom.js';
import { S, save } from './store.js';
import { generateSolved, GATE } from '../game/contracts.js';
import { falseAlarm, refreshPlots, settleCheck } from '../game/plots.js';
import { techOf } from '../game/economy.js';
import { TWISTS } from '../content/twists.js';
import { CALLBACKS } from '../content/town.js';
import { STAGE_TWISTS } from '../engine/stages/index.js';

// the street listens here to redraw when a survey lands
export const surveyHooks = { changed: () => {} };

// A pool of survey workers (one fewer than the cores, up to 3), so several briefs are surveyed at once. Each job
// goes to the least busy worker; the brief the player is waiting on goes first within its worker (GATE.focus).
let workers = [], jobId = 0; const pending = new Map();
export function startWorker() {
  const core = document.getElementById('core');
  const n = Math.max(1, Math.min(3, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) - 1));
  const url = core ? URL.createObjectURL(new Blob([core.textContent], { type: 'text/javascript' })) : null;
  for (let i = 0; i < n; i++) {
    try {
      const w = url ? new Worker(url) : new Worker('worker.js', { type: 'module' });   // built page, or development (src/shell.html from the repo root)
      w.load = 0;
      w.onmessage = e => { const j = pending.get(e.data.id); if (!j) return; if (e.data.done) { pending.delete(e.data.id); w.load--; j.resolve(e.data.failed ? null : e.data.contract); } else j.progress(e.data.progress, e.data.attempt); };
      // a worker that dies takes its jobs with it: they come back unsurveyed (the street draws fresh tenders)
      w.onerror = () => { workers = workers.filter(x => x !== w); for (const [id, j] of pending) if (j.w === w) { pending.delete(id); j.resolve(null); } };
      workers.push(w);
    } catch (e) { break; }
  }
}
// the brief the player is waiting on gets surveyed first
export function focusSurvey(seed) { GATE.focus = seed; for (const w of workers) w.postMessage({ focus: seed }); }
function solve(contract, onProgress) {
  if (workers.length) {
    const w = workers.reduce((a, b) => (b.load < a.load ? b : a));
    w.load++;
    return new Promise(resolve => { const id = ++jobId; pending.set(id, { resolve, progress: onProgress, w }); w.postMessage({ id, contract, unlocks: techOf(S), recent: S.recent || [] }); });
  }
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
      // a street change: the surveyor's verdict decides whether this client calls at all
      if (p.status === 'checking') {
        const how = settleCheck(S, p, sc);
        save();
        toast(how === 'coped' ? `${p.name} coped with the change. They'll remember it.` : `${p.name} is calling you back: ${(CALLBACKS[p.reason] || 'something has changed').toLowerCase()}.`, how !== 'coped');
        surveyHooks.changed();
        return how === 'coped' ? null : sc;
      }
      if (p.status === 'callback' && sc.existing && sc.par.cost === 0) {
        // the doors you fitted already cope: no job, and the maintenance fee resumes
        falseAlarm(S, p); save();
        toast(`${p.name}: false alarm. Your doors coped.`);
        surveyHooks.changed();
        return null;
      }
      // the surveyor may have switched the complaint (the doors coped with the first one)
      if (p.status === 'callback' && p.reason !== 'paradox' && sc.opts && sc.opts.callback && CALLBACKS[sc.opts.callback]) p.reason = sc.opts.callback;
      p.contract = sc; save(); surveyHooks.changed();
    }
    return sc;
  });
  surveys.set(seed, entry);
  return entry.promise;
}
export const twistLabel = t => (TWISTS[t] ? TWISTS[t].label : STAGE_TWISTS[t] ? STAGE_TWISTS[t].label : t);
