// ---------- workshop ----------
import { BUILDING } from '../content/buildings/index.js';
import { EVENTS } from '../content/events.js';
import { REV_R, SLOT_W, TAU, V_SAFE, World } from '../engine/world.js';
import { PRICE, SIM_DT, TEST_SECONDS, designCost, runSeconds, slotCost, testOver, worldCfg } from '../game/contracts.js';
import { charge, feeOf, techOf } from '../game/economy.js';
import { grade, signOff } from '../game/jobs.js';
import { cv, cw, scale, sizeCanvas } from './canvas.js';
import { coach, coachDone, coachEl } from './coach.js';
import { $, TYPE_LABEL, closeSheet, guard, guarded, sheet, toast } from './dom.js';
import { openBrief } from './sheets.js';
import { S, save } from './store.js';
import { renderStreet } from './street.js';
import { twistLabel } from './survey.js';
import { kmoney, money } from '../util/format.js';
export let W = null; // { plot, contract, design, sel, world, mode:'design'|'test'|'result', passed, lastResult }
export function defaultSlot(type) {
  if (type === 'revolve') return { type, wings: 4, mouth: 40, core: 0.15, rpm: 4, padded: false, flow: 'both' };
  if (type === 'swing') return { type, curtain: false, flow: 'both' };
  if (type === 'slider') return { type, curtain: false, flow: 'both', button: false };
  if (type === 'gates') return { type, flow: 'both', wide: false };
  return { type: 'wall' };
}
export function openWorkshop(i) {
  guard();
  const p = S.plots[i], c = p.contract;
  const design = (c.existing ? c.existing.map(s => ({ ...s })) : Array.from({ length: c.slots }, () => defaultSlot('wall')));
  W = { plot: p, contract: c, design, start: design.map(s => ({ ...s })), sel: Math.floor((c.slots - 1) / 2), mode: 'design', passed: false };
  disarmReset();
  showSpeed();
  $('streetView').hidden = true; $('dockStreet').hidden = true;
  $('workshop').hidden = false; $('dockWs').hidden = false;
  $('wsTitle').textContent = p.name;
  renderStrip();
  setTimeout(() => coach('bays', () => $('slots')), 450);
  window.scrollTo(0, 0);
  resetPreview(); sizeCanvas(); renderEditor(); updateHud();
}
// the job's twists and rules, always visible above the plan; tap for the full brief
function renderStrip() {
  const c = W.contract, g = c.goals, mix = c.crowd.mix || {}, chips = [];
  if (c.event) chips.push([Object.values(EVENTS).find(e => e.key === c.event).label, 'brass']);
  if (c.specialist) chips.push(['Specialist', 'brass']);
  for (const t of c.twists) chips.push([twistLabel(t), t === 'cold' || t === 'wind' ? 'cold' : t === 'fragile' ? 'hot' : '']);
  if (c.rules && c.rules.forbid && !c.landmark) chips.push(['No ' + c.rules.forbid.map(t => TYPE_LABEL[t].toLowerCase()).join(' or ') + ' doors', 'hot']);
  if (c.rules && c.rules.fixed) chips.push([`Bay ${(+Object.keys(c.rules.fixed)[0]) + 1} is listed`, '']);
  if (mix.elderly) chips.push([`${Math.round(mix.elderly * 100)}% older`, '']);
  if (mix.wheel) chips.push(['Wheelchairs & prams', '']);
  if (mix.bike) chips.push(['Cyclists', '']);
  if (c.site && c.site.rampBays) chips.push([`Ramp at bay ${c.site.rampBays.map(i => i + 1).join(', ')}`, '']);
  if (mix.case) chips.push([`${Math.round(mix.case * 100)}% suitcases`, '']);
  if (g.minTemp != null) chips.push([`Lobby ≥ ${g.minTemp}°C`, 'cold']);
  if (g.maxTemp != null) chips.push([`Lobby ≤ ${g.maxTemp}°C`, 'hot']);
  if (g.wait != null) chips.push([`9 in 10 through ≤ ${g.wait}s`, 'hot']);
  const B = BUILDING[c.kind];
  if (B.chips) chips.unshift(...B.chips(c));
  if (g.laps != null) chips.push([`Go-rounds ≤ ${g.laps}`, '']);
  if (c.drill) chips.push([`Clear lobby ≤ ${g.evac}s`, 'hot']);
  $('wsStrip').innerHTML = chips.map(([t, cls]) => `<span class="tag ${cls}">${t}</span>`).join('') + '<span class="tag more">Full brief ›</span>';
}
export function closeWorkshop() {
  guard();
  W = null;
  $('workshop').hidden = true; $('dockWs').hidden = true;
  $('streetView').hidden = false; $('dockStreet').hidden = false;
  renderStreet();
}
// Reset: first tap arms it, second tap within 3s puts the frontage back how the job started
let resetTimer = null;
function disarmReset() { clearTimeout(resetTimer); resetTimer = null; const b = $('wsResetBtn'); b.textContent = 'Reset'; b.classList.remove('armed'); }
const openWsBrief = () => { if (W && W.mode !== 'test') openBrief(W.plot.i, true); };

export function resetPreview() {
  const c = W.contract;
  W.world = new World({ ...worldCfg(c, W.design, techOf(S)), crowd: { in: 0, out: 0, mix: {} }, duration: 0 });
  W.mode = 'design';
}

function designDirty() { if (W.mode === 'result') { W.mode = 'design'; } W.passed = false; resetPreview(); updateHud(); updateCost(); }
function updateCost() {
  const c = W.contract, cost = designCost(W.design, c.existing), paid = charge(S, cost);
  $('kCost').textContent = money(cost) + (paid !== cost ? ` (you pay ${kmoney(paid)})` : ''); $('kCost').className = cost > c.budget ? 'over' : '';
  $('kBudget').textContent = money(c.budget); $('kPar').textContent = money(c.par.cost); $('kFee').textContent = money(feeOf(S, c));
  const tb = $('testBtn');
  if (W.mode === 'test') tb.textContent = 'Stop test';
  else if (W.passed) tb.textContent = `Sign off · ${money(feeOf(S, c) - paid)} profit`;
  else tb.textContent = 'Run rush hour';
  tb.disabled = false;
  return cost;
}

// what a bay costs on this job: callbacks only charge for new hardware
function slotLabel(x, i) {
  const c = W.contract, rules = c.rules || {};
  if (rules.fixed && rules.fixed[i]) return 'listed';
  if (x.type === 'wall') return '—';
  const old = c.existing && c.existing[i];
  const cost = designCost([x], old ? [old] : null);
  return old && old.type === x.type ? (cost ? '+' + kmoney(cost) : 'kept') : kmoney(cost);
}
export function renderEditor() {
  const d = W.design, s = d[W.sel], u = S.unlocks, rules = W.contract.rules || {};
  const fixed = !!(rules.fixed && rules.fixed[W.sel]);
  const locked = W.mode === 'test' || fixed;
  $('slots').innerHTML = d.map((x, i) => `<button class="slotbtn" type="button" data-i="${i}" aria-pressed="${i === W.sel}"><b>${i + 1} · ${TYPE_LABEL[x.type]}</b><span>${slotLabel(x, i)}</span></button>`).join('');
  $('slots').querySelectorAll('.slotbtn').forEach(b => b.onclick = () => { W.sel = +b.dataset.i; renderEditor(); });
  const doorTypes = BUILDING[W.contract.kind].doorTypes || ['wall', 'revolve', 'swing', 'slider'];
  const banned = t => rules.forbid && rules.forbid.includes(t);
  const typeBtn = t => `<button type="button" data-t="${t}" aria-pressed="${s.type === t}" ${locked || banned(t) ? 'disabled' : ''}>${TYPE_LABEL[t]}<small>${banned(t) ? 'banned' : t === 'wall' ? '£0' : kmoney(slotCost(defaultSlot(t)))}</small></button>`;
  const flowSeg = `<div class="row"><span class="lbl">Direction</span><div class="seg three" style="grid-column:2 / span 2">${['both', 'in', 'out'].map(f => `<button type="button" data-flow="${f}" aria-pressed="${(s.flow || 'both') === f}" ${locked ? 'disabled' : ''}>${f === 'both' ? 'Both ways' : f === 'in' ? 'In only' : 'Out only'}</button>`).join('')}</div></div>`;
  // options you haven't researched are left out; one line at the end says what research would add
  const later = [];
  const opt = (id, key, label, price, what, tk = key) => {
    if (!u[tk]) { later.push(label.toLowerCase()); return ''; }
    return `<label class="toggle"><span>${label}<small>+${kmoney(price)} · ${what}</small></span><input type="checkbox" id="${id}" ${s[key] ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>`;
  };
  const staffOpt = () => {
    if (!(u.doorman && S.staff.doorman)) { later.push(u.doorman ? 'doorman (hire a crew)' : 'doorman'); return ''; }
    return `<label class="toggle"><span>Doorman<small>no hardware cost · ${s.type === 'swing' ? 'holds the door so nobody gets clipped' : 'gets riders out on time'}</small></span><input type="checkbox" id="eDm" ${s.doorman ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>`;
  };
  const range = (id, key, label, min, max, step, out, tk) => {
    if (tk && !u[tk]) { later.push(label.toLowerCase() + ' setting'); return ''; }
    return `<div class="row"><label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" ${locked ? 'disabled' : ''}><output id="${id}O">${out}</output></div>`;
  };
  const laterNote = () => later.length ? `<p class="note more">More in Company: ${later.slice(0, 3).join(', ')}${later.length > 3 ? ` and ${later.length - 3} more` : ''}.</p>` : '';
  let html = (fixed ? `<p class="note"><strong style="color:var(--brass)">Listed door.</strong> This brass revolving door is protected. Work around it with the other bays.</p>` : '') +
    `<div class="seg${doorTypes.length === 2 ? ' two' : ''}">${doorTypes.map(typeBtn).join('')}</div>`;
  if (s.type === 'revolve') {
    const w = s.rpm * TAU / 60, tip = w * (s.wide ? WIDE_R : REV_R), safe = V_SAFE + (s.padded ? 0.3 : 0);
    html += `
      <div class="row"><span class="lbl">Wings</span><div class="stepper"><button type="button" id="wm" ${locked || s.wings <= 2 ? 'disabled' : ''} aria-label="Fewer wings">−</button><div class="dots">${Array.from({ length: 6 }, (_, i) => `<i class="${i < s.wings ? 'on' : ''}"></i>`).join('')}</div><button type="button" id="wp" ${locked || s.wings >= 6 ? 'disabled' : ''} aria-label="More wings">+</button></div><output>${s.wings}</output></div>
      ${range('eRpm', 'rpm', 'Speed', 1, 10, 0.5, s.rpm.toFixed(1) + ' rpm')}
      ${range('eMouth', 'mouth', 'Mouth', 20, 70, 1, '±' + s.mouth + '°', 'mouth')}
      ${range('eCore', 'core', 'Core', 0.08, 0.55, 0.01, Math.round(s.core * 100) + '%', 'core')}
      <p class="note">Wing tips move at <span class="${tip > safe ? 'hot' : ''}">${tip.toFixed(2)} m/s</span> (v = ω·r). Safe for most guests below ${safe.toFixed(2)} m/s, older guests well below that.${u.core ? ` A core of 30% or more costs ${kmoney(PRICE.bigCore)}.` : ''}</p>
      ${opt('ePad', 'padded', 'Padded wing edges', PRICE.padded, 'impacts up to 0.3 m/s faster are fine')}
      ${opt('eSen', 'sensor', 'Presence sensor', PRICE.sensor, 'slows to a safe speed while older guests ride')}
      ${opt('eWide', 'wide', 'Wide drum', PRICE.wide, s.wings <= 3 ? 'bigger compartments; wheelchairs can ride with 3 wings' : 'bigger compartments; drop to 3 wings to take wheelchairs')}
      ${staffOpt()}
      ${opt('ePil', 'pillar', 'Pillar inside the exit', PRICE.pillar, 'takes the crowd\'s push in a fire drill', 'pillars')}
      ${flowSeg}${laterNote()}`;
  } else if (s.type === 'swing' || s.type === 'slider') {
    html += `${flowSeg}
      ${s.type === 'slider' ? `<label class="toggle"><span>Push-button only<small>Opens just for wheelchair users. Everyone else uses another door.</small></span><input type="checkbox" id="eBtn" ${s.button ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>` : ''}
      ${opt('eCur', 'curtain', 'Air curtain', PRICE.curtain, 'cuts heat loss by 70%')}
      ${opt('eVes', 'vestibule', 'Draught lobby', PRICE.vestibule, 'second set of doors; cuts heat loss by ~90%')}
      ${s.type === 'swing' ? staffOpt() : ''}
      ${opt('eLane', 'lanes', 'Lane barriers', PRICE.lanes, 'in on one side, out on the other; half-width lanes', 'barriers')}
      ${opt('ePil', 'pillar', 'Pillar inside the exit', PRICE.pillar, 'takes the crowd\'s push in a fire drill', 'pillars')}
      <p class="note">${s.type === 'swing' ? 'Cheap and fast, but every opening lets the cold in, and a door pushed from the other side swings into people. Set a direction to stop that.' : 'Step-free and gentle. Opens for anyone nearby, so the street air gets in often.'}</p>${laterNote()}`;
  } else if (s.type === 'gates') {
    const flows = [['both', 'Mixed'], ['in', 'In'], ['out', 'Out']];
    if (u.tidal) flows.push(['auto', 'Auto']); else later.push('auto (tidal-flow) lanes');
    const staff = u.doorman && S.staff.doorman;
    if (!staff) later.push(u.doorman ? 'gate-line staff (hire a doorman crew)' : 'gate-line staff');
    html += `<div class="row"><span class="lbl">Lanes</span><div class="seg ${flows.length === 4 ? '' : 'three'}" style="grid-column:2 / span 2">${flows.map(([f, l]) => `<button type="button" data-flow="${f}" aria-pressed="${(s.flow || 'both') === f}" ${locked ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>
      <label class="toggle"><span>Wide aisles<small>+${kmoney(PRICE.gatesWide - PRICE.gates)} · two wide lanes instead of three narrow ones; wheelchairs, prams and bikes fit</small></span><input type="checkbox" id="eGW" ${s.wide ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>
      ${staff ? `<label class="toggle"><span>Gate-line staff<small>no hardware cost · people get through the paddles 40% faster</small></span><input type="checkbox" id="eDm" ${s.doorman ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>` : ''}
      <p class="note">${s.flow === 'auto' ? `Auto lanes turn to face the heavier queue: in for the morning rush, out when a train empties. Costs ${kmoney(PRICE.tidal)} more.` : s.flow === 'in' || s.flow === 'out' ? `Every lane faces ${s.flow === 'in' ? 'into the station' : 'out to the street'}, all day.` : 'Mixed: the lanes alternate, in, out, in. Each lane takes one person at a time, and tapping through takes about a second.'}</p>${laterNote()}`;
  } else {
    html += `<p class="note">A plain wall. Free, warm, and nobody gets through it.</p>`;
  }
  $('editor').innerHTML = html;
  const ed = $('editor');
  ed.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { if (s.type === b.dataset.t) return; d[W.sel] = defaultSlot(b.dataset.t); designDirty(); renderEditor(); });
  ed.querySelectorAll('[data-flow]').forEach(b => b.onclick = () => { s.flow = b.dataset.flow; designDirty(); renderEditor(); });
  const bind = (id, key, num) => { const el = $(id); if (!el) return; el.oninput = () => { s[key] = num ? +el.value : el.checked; designDirty(); refreshEditorLight(); }; el.onchange = () => renderEditor(); };
  bind('eRpm', 'rpm', true); bind('eMouth', 'mouth', true); bind('eCore', 'core', true);
  bind('ePad', 'padded', false); bind('eCur', 'curtain', false); bind('eBtn', 'button', false);
  bind('eSen', 'sensor', false); bind('eWide', 'wide', false); bind('eVes', 'vestibule', false); bind('eDm', 'doorman', false);
  bind('ePil', 'pillar', false); bind('eLane', 'lanes', false); bind('eGW', 'wide', false);
  if ($('wm')) { $('wm').onclick = () => { s.wings--; designDirty(); renderEditor(); }; $('wp').onclick = () => { s.wings++; designDirty(); renderEditor(); }; }
  updateCost();
}
function refreshEditorLight() {
  // update outputs without rebuilding (keeps the slider being dragged)
  const s = W.design[W.sel];
  if (s.type === 'revolve') {
    const put = (id, t) => { const el = $(id); if (el) el.textContent = t; };
    put('eRpmO', `${s.rpm.toFixed(1)} rpm`); put('eMouthO', `±${s.mouth}°`); put('eCoreO', `${Math.round(s.core * 100)}%`);
    const tip = s.rpm * TAU / 60 * (s.wide ? WIDE_R : REV_R), safe = V_SAFE + (s.padded ? 0.3 : 0), span = $('editor').querySelector('.note span');
    if (span) { span.textContent = tip.toFixed(2) + ' m/s'; span.className = tip > safe ? 'hot' : ''; }
  }
  $('slots').querySelectorAll('.slotbtn span')[W.sel].textContent = slotLabel(s, W.sel);
}

// test speed: 1×, 3× or 8×, remembered between jobs; Skip runs the rest instantly
const SPEEDS = [1, 3, 8];
export function showSpeed() { const sp = S.speed || 3; $('ffBtn').textContent = sp + '×'; $('ffBtn').setAttribute('aria-pressed', sp > 1); $('ffBtn').setAttribute('aria-label', `Test speed ${sp} times`); $('skipBtn').hidden = !(W && W.mode === 'test'); }

export function evaluateTest() {
  const c = W.contract, g = c.goals, r = { ...W.world.stats, minTemp: W.world.minTemp, maxTemp: W.world.maxTemp, wait: W.world.waitP90() };
  if (c.drill && r.evac == null) r.evac = null;
  const { rows, pass, stars, hint, cost, green } = grade(S, c, W.design, r);
  W.mode = 'result'; W.passed = pass; W.stars = stars; W.cost = cost; W.result = r;
  sheet(`<div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('')}</div>
    <h3>${pass ? (stars === 3 ? 'Flawless install' : 'Client signs off') : 'Not good enough yet'}</h3>
    <p>${pass ? `Profit ${money(feeOf(S, c) - charge(S, cost))}${stars < 2 ? ` · the surveyor did it for ${money(c.par.cost)} (list)` : ''}.` : hint}</p>
    ${green ? '<p class="note"><strong style="color:var(--ok)">🌿 Green star.</strong> The lobby stayed snug, so the client\'s heating bills drop. They\'ll pay 15% more maintenance.</p>' : ''}
    ${pass && r.bumps ? `<p class="note">${r.bumps} bump${r.bumps > 1 ? 's' : ''} go on your insurance record: +${money(45 * r.bumps)} a month while this install stands.</p>` : ''}
    <ul class="list">${rows.map(([a, v, gl, ok]) => `<li class="${ok === true ? 'pass' : ok === false ? 'fail' : ''}"><span>${a} <span style="color:var(--mute)">${gl}</span></span><span>${v}</span></li>`).join('')}</ul>
    <div style="display:flex;gap:8px"><button class="ghost" type="button" id="rEdit">Keep tweaking</button>${pass ? `<button class="go" type="button" id="rSign">Sign off</button>` : ''}</div>`);
  $('rEdit').onclick = () => { closeSheet(); renderEditor(); };
  if (pass) $('rSign').onclick = () => { closeSheet(); signOffJob(); };
  setTimeout(() => coach('result', () => document.querySelector('#sheet .list')), 300);
  renderEditor();
}
function signOffJob() {
  const p = W.plot;
  const { profit, lockedBefore } = signOff(S, p, W.contract, W.design, W.stars, W.result);
  save();
  closeWorkshop();
  const after = S.plots.filter(x => x.status === 'locked').length;
  toast(`${p.name} signed · ${money(profit)}${lockedBefore > after ? ' · new client on the street' : ''}`);
  confetti(p.i);
}
// a burst of confetti over the street, and the building you just fitted lights up
export function confetti(i) {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  const box = document.createElement('div'); box.className = 'confetti';
  for (let k = 0; k < 46; k++) {
    const b = document.createElement('i');
    b.style.left = (Math.random() * 100) + '%'; b.style.background = ['#d4a94f', '#ef5b4c', '#6fcf97', '#9cc4ec', '#e79a86'][k % 5];
    b.style.animationDelay = (Math.random() * 0.4) + 's'; b.style.animationDuration = (1.2 + Math.random() * 0.9) + 's';
    b.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(b);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
  if (i != null) { const g = document.querySelector(`.sbld[data-i="${i}"]`); if (g) { const m = $('map'), r = g.getBBox(); m.scrollTo({ left: Math.max(0, r.x - 40), behavior: 'smooth' }); g.classList.add('justfitted'); setTimeout(() => g.classList.remove('justfitted'), 2400); } }
}

export function updateHud() {
  if (!W) return;
  const c = W.contract, g = c.goals, w = W.world, st = w.stats, testing = W.mode !== 'design';
  $('hClock').textContent = testing ? (w.alarm ? `${(w.stats.evac ?? (w.t - w.alarmT)).toFixed(0)}/${g.evac}s` : `${Math.max(0, Math.ceil(TEST_SECONDS - w.t))}s`) : '40s';
  $('cClock').querySelector('span').textContent = testing && w.alarm ? 'Evacuating' : 'Clock';
  $('cClock').className = 'chip' + (testing && w.alarm ? ((w.stats.evac ?? (w.t - w.alarmT)) > g.evac ? ' bad' : w.stats.evac != null ? ' good' : '') : '');
  $('hThru').textContent = `${st.through}/${g.through}`;
  $('cThru').className = 'chip' + (testing && st.through >= g.through ? ' good' : '');
  $('hBump').textContent = `${st.bumps}/${g.bumps}`;
  $('cBump').className = 'chip' + (st.bumps > g.bumps ? ' bad' : '');
  const hot = g.maxTemp != null;
  $('hTemp').textContent = BUILDING[c.kind].concourse && testing ? String(w.people.filter(p => p.state === 'approach').length) : testing ? `${(hot ? w.maxTemp : w.minTemp).toFixed(1)}°` : `${c.outsideTemp}°C`;
  $('cTemp').className = 'chip' + (testing && (g.minTemp != null && w.minTemp < g.minTemp || hot && w.maxTemp > g.maxTemp) ? ' bad' : '');
  if (g.laps != null) {
    $('cAcc').querySelector('span').textContent = 'Go-rounds';
    $('hAcc').textContent = `${st.laps}/${g.laps}`;
    $('cAcc').className = 'chip' + (st.laps > g.laps ? ' bad' : '');
  } else {
    $('cAcc').querySelector('span').textContent = 'Away';
    $('hAcc').textContent = st.turnedAway;
    $('cAcc').className = 'chip' + (st.accessFail || st.bikeFail ? ' bad' : '');
  }
  $('cTemp').querySelector('span').textContent = BUILDING[c.kind].concourse && testing ? 'Queuing' : testing ? (hot ? 'Lobby max' : 'Lobby min') : 'Street';
}


// DOM wiring, called once at boot
export function initWorkshop() {
  $('wsBack').onclick = closeWorkshop;
  $('wsResetBtn').onclick = () => {
    if (!W || W.mode === 'test') return;
    const b = $('wsResetBtn');
    if (!resetTimer) { b.textContent = 'Confirm?'; b.classList.add('armed'); resetTimer = setTimeout(disarmReset, 3000); return; }
    disarmReset();
    W.design = W.start.map(s => ({ ...s }));
    W.sel = Math.floor((W.contract.slots - 1) / 2);
    designDirty(); renderEditor();
    toast(W.contract.existing ? 'Back to the doors already fitted' : 'Back to a bare frontage');
  };
  $('wsBriefBtn').onclick = openWsBrief;
  $('wsStrip').onclick = openWsBrief;
  cv.addEventListener('click', e => {
    if (!W || W.mode === 'test') return;
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left - cw / 2) / scale;
    const i = Math.floor((x + W.contract.slots * SLOT_W / 2) / SLOT_W);
    if (i >= 0 && i < W.contract.slots) { W.sel = i; renderEditor(); }
  });
  $('ffBtn').onclick = () => { const sp = S.speed || 3; S.speed = SPEEDS[(SPEEDS.indexOf(sp) + 1) % SPEEDS.length]; save(); showSpeed(); };
  $('skipBtn').onclick = () => {
    if (!W || W.mode !== 'test') return;
    const total = Math.round(runSeconds(W.contract) / SIM_DT);
    while (W.steps < total && !testOver(W.contract, W.world)) { W.world.step(SIM_DT); W.steps++; }
    W.lastEvT = W.world.t; evaluateTest(); updateHud(); showSpeed();
  };
  $('testBtn').onclick = guarded(() => {
    if (!W) return;
    const c = W.contract;
    if (W.mode === 'test') { resetPreview(); renderEditor(); updateHud(); showSpeed(); return; }
    if (W.passed) return signOffJob();
    if (W.design.every(s => s.type === 'wall')) { toast('Add at least one door', true); return; }
    W.world = new World(worldCfg(c, W.design, techOf(S)));
    W.mode = 'test'; W.fx = []; W.lastEvT = -1; W.steps = 0;
    if (coachEl.id === 'run') coachDone();
    renderEditor(); updateHud(); showSpeed();
  });
}
