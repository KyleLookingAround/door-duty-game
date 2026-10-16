// Which clients are talking to you, and drawing up a tender for each one that needs one.
import { makeContract } from './contracts.js';
import { eventOf } from '../content/events.js';
import { randomInt } from './state.js';
import { rep, needsMet, streetOpen, rivalInstall, techOf, tierOf } from './economy.js';

// Returns what changed that the player should hear about (e.g. a new street opening).
export function refreshPlots(S) {
  const notes = [];
  const r = rep(S);
  if (!S.marketOpen && streetOpen(S, 'market')) { S.marketOpen = true; notes.push('market'); }
  for (const p of S.plots) {
    if (p.status === 'locked' && r >= p.rep && needsMet(S, p)) p.status = 'open';
    if (p.status === 'rival' && S.month >= (p.rivalUntil || 0)) { p.status = 'callback'; p.reason = 'botched'; p.install = rivalInstall(p); p.contract = null; }
    if ((p.status === 'open' || p.status === 'callback') && !p.contract) {
      const opts = p.status === 'callback' ? { callback: p.reason, existing: p.install } : (p.stars === 0 ? { first: true } : {});
      const ev = eventOf(S.month);
      p.contract = makeContract(p.kind, tierOf(S, p), S.month, 1 + randomInt(S, 1e6), { ...opts, tech: techOf(S), event: ev && !opts.first ? ev.key : null });
    }
  }
  return notes;
}
