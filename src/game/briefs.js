// Brief wording that depends on the job, kept out of the page so tests can check every case.
import { CALLBACKS } from '../content/town.js';
import { STAGE_TWISTS } from '../engine/stages/index.js';

// a research call: a client you fitted heard about your new research and has work for it
export const isResearchCall = p => p.status === 'callback' && p.reason === 'paradox';
// what the brief's eyebrow calls the job (the street says the same)
export const jobLabel = p => isResearchCall(p) ? 'New work' : p.status === 'callback' ? 'Callback' : 'Tender';

// Why a client called, as the brief's opening sentences. A research call says what they want;
// anything else names its cause. inside: an inside job (what's kept is the setup, not the doors).
export function callText(p, inside) {
  if (p.reason === 'paradox') {
    const want = p.callText || 'They\'ve heard about your new research and want it put to work.';
    return inside ? want : `${want} Your existing doors stay; you only pay for new hardware.`;
  }
  const why = CALLBACKS[p.reason] || 'Something has changed';
  return `${why}. ${inside ? 'What you set up last time stays; you only pay for changes.' : 'Your existing doors stay; you only pay for new hardware.'}`;
}

// An inside job's twist, in this client's words: a building can reword a stage's twists in its tune
// (the arena's bag check uses the bank's queue, but nobody there is paying in a cheque).
export function stageTwist(c, t) {
  for (const k of c.chain || [c.stage]) {
    const own = c.tunes && c.tunes[k] && c.tunes[k].twists && c.tunes[k].twists[t];
    if (own) return own;
  }
  return STAGE_TWISTS[t] || { label: t, text: '' };
}
