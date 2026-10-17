// Which clients are talking to you, and drawing up a tender for each one that needs one.
import { makeContract } from './contracts.js';
import { BUILDING } from '../content/buildings/index.js';
import { eventOf } from '../content/events.js';
import { randomInt } from './state.js';
import { rep, needsMet, streetOpen, rivalInstall, techOf, tierOf } from './economy.js';

// Returns what changed that the player should hear about (e.g. a new street opening).
export function refreshPlots(S) {
  const notes = [];
  const r = rep(S);
  if (!S.marketOpen && streetOpen(S, 'market')) { S.marketOpen = true; notes.push('market'); }
  if (!S.riversideOpen && streetOpen(S, 'riverside')) { S.riversideOpen = true; notes.push('riverside'); }
  for (const p of S.plots) {
    if (p.status === 'locked' && r >= p.rep && needsMet(S, p)) p.status = 'open';
    if (p.status === 'rival' && S.month >= (p.rivalUntil || 0)) { p.status = 'callback'; p.reason = 'botched'; p.install = rivalInstall(p); p.contract = null; p.callStage = null; p.callChain = null; p.callTwist = null; }
    if ((p.status === 'open' || p.status === 'callback') && !p.contract) {
      const B = BUILDING[p.kind];
      let opts;
      if (p.status === 'callback') {
        // a callback about an inside job, a chained level, or the doors (with the paradox's twist, if any)
        const key = p.callChain ? 'chain:' + p.callChain.join('+') : p.callStage;
        const existing = key && p.inside && p.inside[key];
        opts = { callback: p.reason, existing: key ? existing || undefined : p.install, extra: p.callTwist ? [p.callTwist] : [] };
        if (p.callChain) Object.assign(opts, { stage: 'chain', chain: p.callChain });
        else if (p.callStage) opts.stage = p.callStage;
      } else {
        opts = p.stars === 0 && !B.jobs ? { first: true } : {};
        // a client that only has inside jobs (Riverside): pick one of its levels
        if (B.jobs) { const j = B.jobs[randomInt(S, B.jobs.length)]; Object.assign(opts, j.chain ? { stage: 'chain', chain: j.chain } : { stage: j.stage }); }
      }
      const ev = eventOf(S.month);
      p.contract = makeContract(p.kind, tierOf(S, p), S.month, 1 + randomInt(S, 1e6), { ...opts, tech: techOf(S), event: ev && !opts.first ? ev.key : null });
    }
  }
  return notes;
}
