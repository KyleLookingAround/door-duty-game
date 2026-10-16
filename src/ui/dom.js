// Small DOM helpers shared by every screen: lookups, the bottom sheet, toasts, and the double-tap guard.
export const $ = id => document.getElementById(id);
export const TYPE_LABEL = { wall: 'Wall', revolve: 'Revolving', swing: 'Swing', slider: 'Sliding', gates: 'Gates' };

// Every sheet gets a close button, and its last row of buttons stays pinned to the bottom while the rest scrolls.
export function sheet(html) {
  const sh = $('sheet');
  sh.innerHTML = `<button class="sheetx" type="button" aria-label="Close">×</button>` + html;
  let last = sh.lastElementChild;
  if (last && last.tagName === 'BUTTON' && last !== sh.firstElementChild) { const row = document.createElement('div'); row.style.display = 'grid'; last.replaceWith(row); row.appendChild(last); last = row; }
  if (last && last !== sh.firstElementChild && last.querySelector(':scope > button')) last.classList.add('sheetfoot');
  sh.querySelector('.sheetx').onclick = () => closeSheet();
  $('sheetWrap').hidden = false; sh.scrollTop = 0;
}
// After a sheet closes or the view changes, ignore taps briefly so a double tap
// can't land on the button that appears underneath (e.g. Sign off -> End the month).
let guardUntil = 0;
export const guard = () => { guardUntil = performance.now() + 350; };
export const guarded = fn => (...a) => { if (performance.now() < guardUntil) return; return fn(...a); };
// other screens hook in here (e.g. the street redraws to pick up surveys that finished while a sheet was open)
export const onSheetClosed = [];
export function closeSheet() {
  $('sheetWrap').hidden = true; guard();
  for (const f of onSheetClosed) f();
}
export function keepScroll(fn) { const top = $('sheet').scrollTop; fn(); $('sheet').scrollTop = top; }
let toastT;
export function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', 2200); }

export function initDom() {
  $('sheetWrap').addEventListener('click', e => { if (e.target === $('sheetWrap')) closeSheet(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheetWrap').hidden) closeSheet(); });
}
