// Brief wording that depends on the job, kept out of the page so tests can check every case.
import { CALLBACKS } from '../content/town.js';
import { STAGE_TWISTS } from '../engine/stages/index.js';
import { PREMISES } from '../content/company.js';
import { TECH } from '../content/tech.js';
import { jobsLeft, jobsPerMonth } from './economy.js';

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

// The crews' month. jobsLine: what the street says; bookedText: why a job can't be taken right now, and
// what would give the firm more jobs a month (bigger premises, or research it could start).
export function jobsLine(S) {
  const left = jobsLeft(S), cap = jobsPerMonth(S);
  return left ? `${left} of ${cap} job${cap === 1 ? '' : 's'} left this month` : 'crews booked up until next month';
}
export function bookedText(S) {
  const cap = jobsPerMonth(S), ways = [];
  const next = PREMISES[(S.premises || 0) + 1];
  if (next) ways.push(`move to the ${next.name.toLowerCase()}`);
  const t = TECH.find(x => x.jobs && !S.unlocks[x.key] && (x.req || []).every(k => S.unlocks[k]));
  if (t) ways.push(`research ${t.name}`);
  return `Your crews are booked up: ${cap} of ${cap} jobs this month. End the month to take this one${ways.length ? `, or ${ways.join(' or ')} to take more each month` : ''}.`;
}

// A move in progress, for the company sheet and the month report.
export function movingText(S) {
  if (!S.moving) return '';
  const to = PREMISES[S.moving.to].name.toLowerCase(), n = S.moving.left;
  return `Moving to the ${to}: ${n} month${n === 1 ? '' : 's'} to go. You work from your old premises until then, and research waits until you're in.`;
}
