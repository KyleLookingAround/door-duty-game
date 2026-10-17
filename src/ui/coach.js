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
  // the bubble goes wherever there's room without covering the target: below, above, or beside it; if
  // nothing fits (a tall target on a phone), the side with more room, kept on screen
  const bw = Math.min(320, innerWidth - 24); bub.style.width = bw + 'px';
  const bh = bub.offsetHeight || 120, gap = 14;
  const room = { below: innerHeight - r.bottom - gap - 8, above: r.top - gap - 8, right: innerWidth - r.right - gap - 8, left: r.left - gap - 8 };
  const clampX = x => Math.max(12, Math.min(innerWidth - bw - 12, x)), clampY = y => Math.max(8, Math.min(innerHeight - bh - 8, y));
  let x = clampX(r.left + r.width / 2 - bw / 2), y;
  if (room.below >= bh) y = r.bottom + gap;
  else if (room.above >= bh) y = r.top - gap - bh;
  else if (room.right >= bw) { x = r.right + gap; y = clampY(r.top + r.height / 2 - bh / 2); }
  else if (room.left >= bw) { x = r.left - gap - bw; y = clampY(r.top + r.height / 2 - bh / 2); }
  else y = clampY(room.below >= room.above ? r.bottom + gap : r.top - gap - bh);
  bub.style.left = x + 'px'; bub.style.top = y + 'px';
}

export function initCoach() {
  $('coachOk').onclick = () => coachDone();
  $('coachSkip').onclick = () => coachDone(true);
  addEventListener('resize', () => coachEl.id && placeCoach());
  // tips about a sheet go when the sheet does
  onSheetClosed.push(() => { if (coachEl.id === 'brief' || coachEl.id === 'result') { coachEl.id = null; coachEl.target = null; $('coach').hidden = true; } });
}
