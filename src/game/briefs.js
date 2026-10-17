// Brief wording that depends on the job, kept out of the page so tests can check every case.
import { CALLBACKS, RIVAL } from '../content/town.js';
import { JOURNAL, HEADLINES } from '../content/journal.js';
import { STAGE_TWISTS } from '../engine/stages/index.js';
import { PREMISES } from '../content/company.js';
import { TECH } from '../content/tech.js';
import { jobsLeft, jobsPerMonth, techName } from './economy.js';

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

// The local paper's headline for the month report: the biggest story of the month, if there was one.
// rpt: endMonth's report. Returns { head, text } or null. Picks by the month (no dice), so a month replays.
export function headline(S, rpt) {
  const pick = (kind, n) => { const hs = HEADLINES[kind]; return hs[S.month % hs.length](n); };
  const name = i => (S.plots[i] || {}).name || '';
  const news = rpt.news || [];
  const lm = news.find(n => n.kind === 'landmark');
  if (lm) return { head: pick('landmark', { name: name(lm.i) }), text: `${name(lm.i)} is open, and the crowds are moving. Your firm fitted it.` };
  const st = news.find(n => n.kind === 'street');
  if (st) { const nm = st.key === 'market' ? 'Market Square' : 'Riverside'; return { head: pick('street', { name: nm }), text: `${nm} is open to your firm: new clients want to talk.` }; }
  const ms = news.find(n => n.kind === 'mastered');
  if (ms && JOURNAL[ms.key]) return { head: pick('mastered', { what: techName(ms.key), lesson: JOURNAL[ms.key][0] }), text: `${JOURNAL[ms.key][1]} It's in your journal (Company › Guide).` };
  if (rpt.lost && rpt.lost.length) return { head: pick('rival', { rival: RIVAL, name: rpt.lost[0].name }), text: `Tenders left sitting go to ${RIVAL}.` };
  if (rpt.insp && !rpt.insp.pass) return { head: pick('inspectFail', { name: rpt.insp.p.name }), text: '' };
  if (rpt.claims && rpt.claims.length) return { head: pick('claim', { name: rpt.claims[0].name }), text: '' };
  if (rpt.insp && rpt.insp.pass) return { head: pick('inspectPass', { name: rpt.insp.p.name }), text: '' };
  if (rpt.done && rpt.done.length) return { head: pick('research', { what: techName(rpt.done[0]) }), text: '' };
  if (rpt.evNow) return { head: pick('event', { what: rpt.evNow.label }), text: '' };
  return null;
}
// the paradox journal: every mastered tech's lesson, in the order they were mastered
export const journal = S => Object.keys(S.mastered || {}).filter(k => JOURNAL[k] && S.unlocks[k]).map(k => ({ key: k, title: JOURNAL[k][0], text: JOURNAL[k][1], tech: techName(k) }));

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
