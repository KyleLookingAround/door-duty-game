// The first-game walk-through: small tips that point at the real buttons, once each.
// Tips are triggered from the screens (coach('brief', ...)); the text lives in content/guides.js.
import { $, onSheetClosed } from './dom.js';
import { S, save } from './store.js';
import { COACH, NEXT } from '../content/guides.js';

// ctx: what the screen knows that a tip's text can use (the workshop sets the job's banned doors)
export const coachEl = { id: null, target: null, ctx: {} };
export function tutOn() { S.tut = S.tut || { done: {} }; return !S.tut.off; }
// target: an element, or a function that finds it (so the tip survives the page redrawing)
export function coach(id, target) {
  if (!S.seenIntro || !tutOn() || S.tut.done[id] || coachEl.id === id) return;
  const find = typeof target === 'function' ? target : () => target;
  const el = find();
  if (!el || !el.getClientRects().length) return;
  coachEl.id = id; coachEl.target = el; coachEl.find = find;
  const text = COACH[id][1];
  $('coachTitle').textContent = COACH[id][0]; $('coachText').textContent = typeof text === 'function' ? text(coachEl.ctx) : text;
  $('coach').hidden = false; placeCoach();
}
export function coachDone(skipAll) {
  if (!coachEl.id) return;
  const id = coachEl.id; S.tut.done[id] = true; if (skipAll) S.tut.off = true; save();
  coachEl.id = null; coachEl.target = null; $('coach').hidden = true;
  const nx = NEXT[id]; if (nx && !skipAll) setTimeout(() => coach(nx, COACH_TARGET[nx]), 120);
}
const COACH_TARGET = { doors: () => document.querySelector('#editor .seg'), run: () => $('testBtn'), company: () => $('rdBtn') };
export function placeCoach() {
  let el = coachEl.target; if (!el) return;
  if (!tutOn()) { coachEl.id = null; coachEl.target = null; $('coach').hidden = true; return; }
  if (!el.isConnected && coachEl.find) { const again = coachEl.find(); if (again) el = coachEl.target = again; }
  if (!el.isConnected || !el.getClientRects().length) { $('coach').hidden = true; return; }
  $('coach').hidden = false;
  const r = el.getBoundingClientRect(), ring = $('coachRing'), bub = $('coachBubble'), pad = 6;
  ring.style.left = (r.left - pad) + 'px'; ring.style.top = (r.top - pad) + 'px'; ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
  const bw = Math.min(320, innerWidth - 24), bh = bub.offsetHeight || 120;
  const below = r.bottom + 14 + bh < innerHeight - 8;
  bub.style.width = bw + 'px';
  bub.style.left = Math.max(12, Math.min(innerWidth - bw - 12, r.left + r.width / 2 - bw / 2)) + 'px';
  bub.style.top = (below ? r.bottom + 14 : Math.max(8, r.top - 14 - bh)) + 'px';
}

export function initCoach() {
  $('coachOk').onclick = () => coachDone();
  $('coachSkip').onclick = () => coachDone(true);
  addEventListener('resize', () => coachEl.id && placeCoach());
  // tips about a sheet go when the sheet does
  onSheetClosed.push(() => { if (coachEl.id === 'brief' || coachEl.id === 'result') { coachEl.id = null; coachEl.target = null; $('coach').hidden = true; } });
}
