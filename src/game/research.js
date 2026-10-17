// Research: benches, the queue, paying as you go, the market study and mastery. Pure rules over the save.
//  - Research never stops: a month can't end with a free bench (benchesFilled). endMonth puts a market study
//    on any bench still free, as a safety net (an old save, a headless run).
//  - A queue: line up the next projects; when one finishes, the next starts on the free bench.
//  - Paid monthly: a project costs its price spread over its months, paid at each month end. Overdrawn at a
//    month end, a paid project waits at the front of the queue (keeping its progress) and the bench does a
//    market study instead.
//  - The market study is always there: free, one month, any bench. It brings in work.
//  - Owned, then mastered: signing off the job that teaches a tech masters it (see economy.js).
import { TECH, STUDY } from '../content/tech.js';
import { PARADOX_CALLS, callFits } from '../content/paradoxes.js';
import { prem, needsMastery } from './economy.js';
import { random, randomInt } from './state.js';

export const techOrStudy = key => key === STUDY.key ? STUDY : TECH.find(t => t.key === key);
// what a project costs each month it runs
export const instalment = t => t.price ? Math.ceil(t.price / t.months / 500) * 500 : 0;
export const benches = S => prem(S).labs;
// this month's research bill: every running paid project's instalment
export const researchOut = S => S.moving ? 0 : S.research.reduce((a, r) => a + (r.owe > 0 ? instalment(techOrStudy(r.key)) : 0), 0);
// a free bench: one not running a project (while moving, the benches are packed up: none is free, none idle)
export const freeBenches = S => S.moving ? 0 : Math.max(0, benches(S) - S.research.length);
export const benchesFilled = S => freeBenches(S) === 0;
const inHand = (S, key) => S.research.some(r => r.key === key) || (S.queue || []).some(q => q.key === key);
// research the firm could take on: not owned, not already running or queued, what it needs owned, within the premises' tier
export const canResearch = (S, t) => !S.unlocks[t.key] && !inHand(S, t.key) && (t.req || []).every(k => S.unlocks[k]) && t.tier <= prem(S).tier;
export const researchingOrQueued = (S, key) => inHand(S, key);

// Start a project on a free bench, or put it in the queue. Returns 'started', 'queued' or false.
export function startResearch(S, key) {
  const t = techOrStudy(key);
  if (!t) return false;
  if (key !== STUDY.key && !canResearch(S, t)) return false;
  const job = { key, left: t.months, owe: t.price ? t.months : 0 };
  if (freeBenches(S) > 0) { S.research.push(job); return 'started'; }
  if (key === STUDY.key) return false;   // a study only ever fills a free bench
  S.queue = [...(S.queue || []), job];
  return 'queued';
}
export function unqueue(S, key) { const n = (S.queue || []).length; S.queue = (S.queue || []).filter(q => q.key !== key); return S.queue.length < n; }
// free benches take the next projects from the queue, then (if told to) a market study
export function fillBenches(S, study) {
  while (freeBenches(S) > 0 && (S.queue || []).length) S.research.push(S.queue.shift());
  if (study) while (freeBenches(S) > 0) S.research.push({ key: STUDY.key, left: 1, owe: 0 });
}

// A month of research, at the month end. Returns { done, cost, paused, studies } for the report.
export function researchMonth(S) {
  const out = { done: [], cost: 0, paused: [], studies: [] };
  if (S.moving) return out;   // mid-move, research waits
  fillBenches(S, true);       // the safety net: no bench sits idle
  const keep = [];
  for (const r of S.research) {
    // overdrawn: a paid project waits (progress kept) and the bench does a market study instead
    if (r.owe > 0 && S.cash - out.cost < 0) { out.paused.push(r.key); S.queue = [r, ...(S.queue || [])]; r.wait = true; keep.push({ key: STUDY.key, left: 0, owe: 0, sub: true }); continue; }
    if (r.owe > 0) { out.cost += instalment(techOrStudy(r.key)); r.owe--; }
    r.left--;
    if (r.left > 0) { keep.push(r); continue; }
    if (r.key === STUDY.key) out.studies.push(studyResult(S));
    else { S.unlocks[r.key] = true; out.done.push(r.key); if (!needsMastery(r.key)) S.mastered = { ...(S.mastered || {}), [r.key]: true }; }
  }
  // a stand-in study finishes this month too: it was the bench's work while the project waited
  for (const r of keep.filter(x => x.sub)) out.studies.push(studyResult(S));
  S.research = keep.filter(x => !x.sub);
  S.cash -= out.cost;
  for (const q of S.queue || []) delete q.wait;
  // the queue moves up onto benches that came free (paused projects wait for the money)
  if (S.cash >= 0) fillBenches(S, false);
  return out;
}

// What a market study brings in: a client asking for research (an enquiry), or a fitted client wanting more
// (a callback at a higher tier, while they keep paying). Returns { kind, p } or { kind: 'none' }.
export function studyResult(S) {
  const fitted = S.plots.filter(p => p.status === 'fitted' && !p.broken && !p.enquiry);
  // an enquiry: a fitted client who'd want research the firm could take on
  const asks = [];
  for (const t of TECH) {
    if (!canResearch(S, t) || S.plots.some(p => p.enquiry && p.enquiry.tech === t.key)) continue;
    (PARADOX_CALLS[t.key] || []).forEach((def, j) => { for (const p of fitted) if (callFits(def, p)) asks.push({ t, j, def, p }); });
  }
  if (asks.length && random(S) < 0.5) {
    const a = asks[randomInt(S, asks.length)];
    a.p.enquiry = { tech: a.t.key, j: a.j, by: S.month + a.t.months + 3, text: a.def.text, bonus: Math.round(a.t.price * 0.3 / 500) * 500 };
    return { kind: 'enquiry', p: a.p };
  }
  if (fitted.length) {
    const p = fitted[randomInt(S, fitted.length)];
    p.status = 'callback'; p.reason = 'study'; p.contract = null; p.tier = (p.tier || 0) + 1;
    p.callStage = null; p.callChain = null; p.callTwist = null;
    return { kind: 'more', p };
  }
  return { kind: 'none' };
}

// Signing off a job that teaches a tech masters it: a research call (door, inside or chained), or a tender
// carrying the lesson. Returns the key mastered, or null.
export function masterFrom(S, p, c) {
  const key = p.callTech;
  if (!key || !(c.lesson === key || c.paradox || p.reason === 'paradox' || p.lessonTender)) return null;
  if (!S.unlocks[key] || (S.mastered || {})[key]) return null;
  S.mastered = { ...(S.mastered || {}), [key]: true };
  return key;
}
