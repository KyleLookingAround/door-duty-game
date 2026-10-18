// Which clients are talking to you, and drawing up a tender for each one that needs one.
import { makeContract } from './contracts.js';
import { BUILDING } from '../content/buildings/index.js';
import { eventOf } from '../content/events.js';
import { randomInt } from './state.js';
import { rep, needsMet, streetOf, streetOpen, rivalInstall, techOf, tierOf } from './economy.js';

// A street-change check has been surveyed: if the client's setup still passes, it coped (and the client
// remembers it); if not, they call you back with the job the surveyor drew up. Returns 'coped' or 'call'.
export function settleCheck(S, p, sc) {
  if (sc.existing && sc.par.cost === 0) {
    p.status = 'fitted'; p.contract = null; p.reason = null; p.coped = (p.coped || 0) + 1;
    p.copedWith = [...(p.copedWith || []), p.change].slice(-6); p.change = null;
    return 'coped';
  }
  p.status = 'callback'; p.tier = (p.tier || 0) + 1; p.contract = sc;
  return 'call';
}

// A callback whose doors already cope: no job, and the maintenance fee resumes. If it was a research call, the
// call goes back on the list for another client, so the research still gets its lesson job.
export function falseAlarm(S, p) {
  if (p.reason === 'paradox' && p.callTech) S.pendingCalls = [...(S.pendingCalls || []), [p.callTech, p.callIdx || 0, S.month - 2]];
  p.status = 'fitted'; p.contract = null; p.reason = null;
  p.callTech = null; p.callStage = null; p.callChain = null; p.callTwist = null; p.lessonTender = false;
}

// Returns what changed that the player should hear about (e.g. a new street opening).
export function refreshPlots(S) {
  const notes = [];
  const r = rep(S);
  if (!S.marketOpen && streetOpen(S, 'market')) { S.marketOpen = true; S.marketOpenedAt = S.month; notes.push('market'); }
  if (!S.riversideOpen && streetOpen(S, 'riverside')) { S.riversideOpen = true; S.riversideOpenedAt = S.month; notes.push('riverside'); }
  for (const k of notes) S.news = [...(S.news || []), { kind: 'street', key: k }];
  for (const p of S.plots) {
    if (p.status === 'locked' && r >= p.rep && needsMet(S, p) && streetOpen(S, streetOf(p))) p.status = 'open';
    if (p.status === 'rival' && S.month >= (p.rivalUntil || 0)) { p.status = 'callback'; p.reason = 'botched'; p.install = rivalInstall(p); p.contract = null; p.callStage = null; p.callChain = null; p.callTwist = null; }
    if ((p.status === 'open' || p.status === 'callback' || p.status === 'checking') && !p.contract) {
      const B = BUILDING[p.kind];
      let opts;
      if (p.status === 'callback' || p.status === 'checking') {
        // a callback about an inside job, a chained level, or the doors (with the paradox's twist, if any)
        const key = p.callChain ? 'chain:' + p.callChain.join('+') : p.callStage;
        const existing = key && p.inside && p.inside[key];
        opts = { callback: p.reason, existing: key ? existing || undefined : p.install, need: p.callTwist ? [p.callTwist] : [] };
        if (p.reason === 'paradox' && !key && p.callTech) opts.lesson = p.callTech;   // a research call teaches its research
        // a street change being checked: no escalating it until the old setup fails; the check is honest
        if (p.status === 'checking') { opts.check = true; opts.plain = true; }
        if (p.callChain) Object.assign(opts, { stage: 'chain', chain: p.callChain });
        else if (p.callStage) opts.stage = p.callStage;
      } else {
        opts = p.stars === 0 && !B.jobs && !p.lessonTender ? { first: true } : {};
        // a client that only has inside jobs (Riverside): pick one of its levels
        // a tender carrying a research lesson (no fitted client could call about it): the lesson's problem, graded
        if (p.lessonTender) Object.assign(opts, p.callChain ? { stage: 'chain', chain: p.callChain } : p.callStage ? { stage: p.callStage } : { need: p.callTwist ? [p.callTwist] : [], lesson: p.callTech });
        // (some levels need research first: Skyport's security and departures need Security lanes)
        else if (B.jobs) { const js = B.jobs.filter(j => !j.needs || S.unlocks[j.needs]), j = js[randomInt(S, js.length)]; Object.assign(opts, j.chain ? { stage: 'chain', chain: j.chain } : { stage: j.stage }); }
      }
      const ev = eventOf(S.month);
      p.contract = makeContract(p.kind, tierOf(S, p), S.month, 1 + randomInt(S, 1e6), { ...opts, tech: techOf(S), event: ev && !opts.first ? ev.key : null });
    }
  }
  return notes;
}
