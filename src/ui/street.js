// The street screen: the header, calendar, street tabs, the painted scene (see scene.js) and the ledger view.
import { KINDS, PLOTS } from '../content/buildings/index.js';
import { eventOf } from '../content/events.js';
import { CHANGE } from '../content/changes.js';
import { changeWhere } from '../game/month.js';
import { CALLBACKS, RIVAL, STREETS } from '../content/town.js';
import { MONTHS } from '../game/contracts.js';
import { feeOf, monthlyIncome, needsMet, needsText, rep, rivalActive, rivalInstall, streetOf, streetOpen, techName, upkeep } from '../game/economy.js';
import { advice } from '../game/enquiries.js';
import { refreshPlots } from '../game/plots.js';
import { coach, coachDone, coachEl } from './coach.js';
import { $, guarded, toast } from './dom.js';
import { streetSVG } from './scene.js';
import { openBrief, openClient, openCompany } from './sheets.js';
import { S, save } from './store.js';
import { survey, twistLabel } from './survey.js';
import { W } from './workshop.js';
import { kmoney, money } from '../util/format.js';
export function frontHTML(slots, n) {
  const cls = { revolve: 'r', swing: 's', slider: 'l', gates: 'g', wall: '' };
  const count = slots ? slots.length : n;
  return `<div class="front" aria-hidden="true">${Array.from({ length: count }, (_, i) => `<i class="${slots && slots[i] ? cls[slots[i].type] : 'empty'}"></i>`).join('')}</div>`;
}
// "Lark Café · Café" says the same thing twice; only show the kind when it adds something
const sameWord = (name, label) => name.toLowerCase().includes(label.toLowerCase().split(' ')[0]);
// clients who won't talk to you yet: one compact line each, the nearest first
function laterList(list) {
  const r = rep(S);
  const sorted = [...list].sort((a, b) => a.rep - b.rep);
  const nextAt = sorted.find(p => p.rep > r);
  return `<div class="later">${sorted.map(p => {
    const research = r >= p.rep && !needsMet(S, p);
    const req = research ? `Research ${needsText(S, p)}` : `${p.rep}★`;
    const k = KINDS[p.kind];
    return `<div><span><b>${p.name}</b>${sameWord(p.name, k.label) ? '' : ` · ${k.label}`}${streetOf(p) === 'market' ? ' · Market Square' : streetOf(p) === 'riverside' ? ' · Riverside' : ''}</span><span class="req${research || p === nextAt ? ' next' : ''}${research ? ' wide' : ''}">${req}</span></div>`;
  }).join('')}</div>`;
}
export function renderStreet() {
  const notes = refreshPlots(S);
  if (notes.includes('market')) setTimeout(() => toast('Market Square is open: five new clients, and a rival firm'), 600);
  if (notes.includes('riverside')) setTimeout(() => toast('Riverside is open: three new clients, all inside work'), 600);
  $('sCash').textContent = kmoney(S.cash);
  $('sRep').textContent = rep(S) + '★';
  $('sMonth').textContent = `${MONTHS[S.month % 12]} ${String(S.year).slice(2)}`;
  const inc = monthlyIncome(S);
  $('incomeLine').textContent = inc ? `${money(inc)} a month in maintenance` : S.plots.some(p => p.status === 'fitted') ? 'No maintenance coming in' : 'No contracts fitted yet';
  $('cal').innerHTML = [0, 1, 2].map(k => {
    const m = S.month + k, ev = eventOf(m), ch = (S.changes || []).find(x => x.month === m);
    // a street change coming: what, and where (the clients there will have their doors checked)
    const chLine = ch ? `<small class="calch">${CHANGE[ch.key].label} · ${changeWhere(S, ch)}</small>` : '';
    return `<div class="calm${k === 0 ? ' now' : ''}${ev ? ' ev' : ''}${ch ? ' ch' : ''}"><span>${k === 0 ? 'Now · ' : ''}${MONTHS[m % 12]}</span><b>${ev ? ev.label : ch ? '' : 'Quiet month'}</b>${chLine}</div>`;
  }).join('');
  const tabs = $('streetTabs');
  tabs.hidden = !S.marketOpen;
  tabs.style.gridTemplateColumns = `repeat(${STREETS.length}, 1fr)`;
  tabs.innerHTML = STREETS.map(st => `<button type="button" data-st="${st.key}" aria-pressed="${(S.street || 'high') === st.key}" ${streetOpen(S, st.key) ? '' : 'disabled'}>${st.name}${streetOpen(S, st.key) ? '' : ` · ${st.rep}★`}</button>`).join('');
  tabs.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { if (S.street === b.dataset.st) return; S.street = b.dataset.st; delete $('map').dataset.ready; save(); renderStreet(); });
  $('streetTitle').textContent = (STREETS.find(x => x.key === (S.street || 'high')) || STREETS[0]).name;
  const box = $('map'), keepX = box.dataset.ready ? box.scrollLeft : null;
  const sc = streetSVG();
  if (box._svg !== sc.svg) { box.innerHTML = sc.svg; box._svg = sc.svg; }   // unchanged scenes keep their animation running
  // first visit: scroll to the first job on the table; after that, stay where the player left it
  if (keepX != null) box.scrollLeft = keepX;
  else { const here = S.plots.filter(p => streetOf(p) === (S.street || 'high')); const fi = here.findIndex(p => p.status === 'open' || p.status === 'callback'); box.scrollLeft = fi > 0 ? Math.max(0, sc.placed[fi] - 40) : 0; box.dataset.ready = '1'; }
  box.querySelectorAll('.sbld').forEach(g => {
    if (g._wired) return; g._wired = true;
    if (g.dataset.firm) { const go = guarded(() => openCompany()); g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); return; }
    const p = S.plots[+g.dataset.i];
    const act = () => {
      if (coachEl.id === 'tender') coachDone();
      if (p.status === 'open' || p.status === 'callback') return openBrief(p.i);
      if (p.status === 'fitted' || p.status === 'checking') return openClient(p.i);
      if (p.status === 'rival') return toast(`${RIVAL} fitted ${p.name}. The client will be back.`);
      toast(rep(S) >= p.rep && !needsMet(S, p) ? `${p.name}: research ${needsText(S, p)} first` : `${p.name} wants ${p.rep}★ reputation`);
    };
    g.addEventListener('click', guarded(act));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); guarded(act)(); } });
  });
  // two views of the same street: the painting, or a ledger with what's on the table first
  const live = S.plots.filter(p => p.status === 'open' || p.status === 'callback');
  const view = S.view || 'street';
  $('viewTabs').innerHTML = `<button type="button" data-view="street" aria-pressed="${view === 'street'}">Street</button><button type="button" data-view="list" aria-pressed="${view === 'list'}">On the table${live.length ? ' · ' + live.length : ''}</button>`;
  $('viewTabs').querySelectorAll('[data-view]').forEach(b => b.onclick = () => { if (S.view === b.dataset.view) return; S.view = b.dataset.view; delete $('map').dataset.ready; save(); renderStreet(); });
  $('map').hidden = view !== 'street'; $('streetHint').hidden = view !== 'street';
  $('ledger').hidden = view !== 'list';
  const row = p => {
    const k = KINDS[p.kind];
    let pill, line;
    if (p.status === 'locked' && rep(S) >= p.rep && !needsMet(S, p)) { pill = `<span class="pill lock">Research</span>`; line = `${PLOTS[p.i].why}. Research ${needsText(S, p)} in Company to quote`; }
    else if (p.status === 'locked') { pill = `<span class="pill lock">${p.rep}★ rep</span>`; line = 'Will only talk to firms with a reputation'; }
    else if (p.status === 'open') { pill = `<span class="pill open">Tender</span>`; const tw = [p.contract.event ? (eventOf(S.month) || {}).label : null, ...p.contract.twists.map(twistLabel)].filter(Boolean).join(' · ') || 'Standard job'; line = p.contract.solved ? `${p.contract.specialist ? '<b style="color:var(--brass)">Specialist</b> · ' : ''}Fee <b>${money(feeOf(S, p.contract))}</b> · ${tw}${rivalActive(S) && !p.contract.first && !p.contract.landmark ? ` · <span style="color:var(--warn)">${RIVAL} is bidding</span>` : ''}` : `${tw} · <i>surveying…</i>`; }
    else if (p.status === 'checking') { pill = `<span class="pill lock">Checking</span>`; line = `${CHANGE[p.change] ? CHANGE[p.change].label : 'A change on the street'}: the surveyor is checking your doors. Still paying <b>${money(upkeep(S, p))}</b>/month`; }
    else if (p.status === 'callback' && p.reason === 'paradox') { pill = `<span class="pill open">New work</span>`; line = `${p.callText} Fee <b>${p.contract && p.contract.solved ? money(feeOf(S, p.contract)) : '…'}</b>`; }
    else if (p.status === 'callback') { pill = `<span class="pill call">${p.reason === 'botched' ? 'Rescue' : 'Callback'}</span>`; line = `${p.change && CHANGE[p.change] ? CHANGE[p.change].label + ': ' + (CALLBACKS[p.reason] || '').charAt(0).toLowerCase() + (CALLBACKS[p.reason] || '').slice(1) : CALLBACKS[p.reason] || 'Something has changed'}. No maintenance fee until fixed.`; }
    else if (p.status === 'rival') { pill = `<span class="pill lock">${RIVAL}</span>`; line = `Fitted by the rival firm · back in ${Math.max(1, (p.rivalUntil || 0) - S.month)} mo`; }
    else { pill = `<span class="pill done">${'★'.repeat(p.stars)}</span>`; line = p.broken ? '<span style="color:var(--warn)">Broken down</span> · tap to service' : `Fitted · <b>${money(upkeep(S, p))}</b>/month${(p.wear || 0) >= 0.5 ? ` · wear ${Math.round(p.wear * 100)}%` : ''}${p.green ? ' · 🌿' : ''}${p.cert ? ' · certified' : ''}`; if (p.enquiry && !p.enquiry.ready) { pill = `<span class="pill open">Enquiry</span>`; line += ` · <b style="color:var(--brass)">wants ${techName(p.enquiry.tech)} within ${p.enquiry.by - S.month} mo</b>`; } }
    const where = streetOf(p) === 'market' ? ' · Market Square' : streetOf(p) === 'riverside' ? ' · Riverside' : '';
    return `<button class="plot${p.status === 'locked' || p.status === 'rival' ? ' locked' : ''}" type="button" data-i="${p.i}" ${p.status === 'locked' || p.status === 'rival' ? 'disabled' : ''}>
      ${frontHTML(p.status === 'rival' ? rivalInstall(p) : p.install, p.contract ? p.contract.slots : k.slots)}
      <span><span class="name">${p.name}</span>${(() => { const bits = [sameWord(p.name, k.label) ? '' : k.label, where ? where.slice(3) : ''].filter(Boolean); return bits.length ? ` <span class="kind">· ${bits.join(' · ')}</span>` : ''; })()}<span class="stline" style="display:block">${line}</span></span>
      ${pill}</button>`;
  };
  const fitted = S.plots.filter(p => p.status === 'fitted' || p.status === 'checking' || p.status === 'rival');
  const later = S.plots.filter(p => p.status === 'locked' && (streetOf(p) === 'high' || streetOpen(S, 'market') || p.rep <= rep(S) + 4));
  $('streetHead').textContent = live.length ? `On the table · ${live.length}` : 'Nothing on the table this month';
  const tip = live.length ? null : advice(S);
  $('street').innerHTML = live.map(row).join('') + (tip ? `<p class="note ledtip">${tip.text}${tip.tab ? ` <button class="ghost small" type="button" data-co="${tip.tab}">Open ${tip.tab}</button>` : ''}</p>` : '');
  $('street').querySelectorAll('[data-co]').forEach(b => b.onclick = guarded(() => openCompany(b.dataset.co)));
  $('ledgerRest').innerHTML = (fitted.length ? `<div class="eyebrow ledhead">Your clients · ${fitted.filter(p => p.status === 'fitted').length}</div>${fitted.map(row).join('')}` : '')
    + (later.length ? `<div class="eyebrow ledhead">Not yet · you have ${rep(S)}★</div>${laterList(later)}` : '');
  $('ledger').querySelectorAll('.plot').forEach(b => b.addEventListener('click', guarded(() => { const p = S.plots[+b.dataset.i]; if (p.status === 'fitted' || p.status === 'checking') openClient(p.i); else if (p.status === 'open' || p.status === 'callback') openBrief(p.i); })));
  save();
  for (const p of S.plots) if ((p.status === 'open' || p.status === 'callback' || p.status === 'checking') && p.contract && !p.contract.solved) survey(p);
  // walk-through: first the tender, then (after a job) the month and the company
  if (!W && $('sheetWrap').hidden) {
    if (S.jobs === 0) setTimeout(() => coach('tender', () => (S.view || 'street') === 'street' ? document.querySelector('.sbld.open > g:last-of-type') || document.querySelector('.sbld.open') : document.querySelector('#street .plot')), 350);
    else setTimeout(() => coach('month', () => $('monthBtn')), 350);
  }
}
