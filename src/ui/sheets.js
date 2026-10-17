import { BUILDING, KINDS } from '../content/buildings/index.js';
import { PREMISES, STAFF } from '../content/company.js';
import { EVENTS, eventOf } from '../content/events.js';
import { BASICS, STARS, STARS_INSIDE } from '../content/guides.js';
import { BRANCHES, LESSONS, TECH } from '../content/tech.js';
import { RIVAL } from '../content/town.js';
import { TWISTS } from '../content/twists.js';
import { STAGES, stageName, stageAbout } from '../engine/stages/index.js';
import { MONTHS, candidates } from '../game/contracts.js';
import { charge, costMult, feeOf, insurance, jobsLeft, jobsPerMonth, monthlyIncome, overheads, prem, rep, rivalActive, serviceCost, techName, techOf, upkeep, loyalty } from '../game/economy.js';
import { advice, hasWork } from '../game/enquiries.js';
import { bookedText, callText, isResearchCall, jobLabel, movingText, stageTwist } from '../game/briefs.js';
import { fire, hire, movePremises, service, startResearch } from '../game/jobs.js';
import { CLAIM_EXCESS, INSPECTION_FINE, endMonth, changeWhere } from '../game/month.js';
import { CHANGE, changeText } from '../content/changes.js';
import { coach } from './coach.js';
import { $, TYPE_LABEL, closeSheet, guarded, keepScroll, sheet, toast } from './dom.js';
import { S, save, wipeSave } from './store.js';
import { renderStreet } from './street.js';
import { focusSurvey, survey, surveys, twistLabel } from './survey.js';
import { openWorkshop } from './workshop.js';
import { kmoney, money } from '../util/format.js';
// on a callback: where the doors already fitted fall short of the new brief
function beforeLine(c) {
  const b = c.before, g = c.goals;
  if (!b) return '';
  const miss = [];
  if (b.through < g.through) miss.push(`${b.through} through, ${g.through} needed`);
  if (b.bumps > g.bumps) miss.push(`${b.bumps} bumps, ${g.bumps} allowed`);
  if (g.minTemp != null && b.minTemp < g.minTemp) miss.push(`the lobby drops to ${b.minTemp}°, ${g.minTemp}° needed`);
  if (g.maxTemp != null && b.maxTemp > g.maxTemp) miss.push(`the lobby reaches ${b.maxTemp}°, ${g.maxTemp}° allowed`);
  if (g.access && b.accessFail) miss.push(`${b.accessFail} wheelchair${b.accessFail > 1 ? 's' : ''} or pram${b.accessFail > 1 ? 's' : ''} turned away`);
  if (g.laps != null && b.laps > g.laps) miss.push(`${b.laps} riding round again, ${g.laps} allowed`);
  return miss.length ? `<p class="note"><strong style="color:var(--warn)">Your doors today:</strong> ${miss.join('; ')}.</p>` : '';
}
// a client's enquiry: research they're waiting on, for the brief and the client sheet
function enquiryNote(p) {
  const e = p.enquiry;
  if (!e) return '';
  const t = TECH.find(x => x.key === e.tech);
  if (e.ready && p.status === 'callback') return `<p class="note"><strong style="color:var(--brass)">They waited for you.</strong> Having ${t.name.toLowerCase()} ready earns a ${kmoney(e.bonus)} bonus when you sign off.</p>`;
  if (e.ready) return `<p class="note"><strong style="color:var(--brass)">Enquiry:</strong> they'll call about ${t.name.toLowerCase()} once this is sorted.</p>`;
  const left = e.by - S.month, doing = S.research.find(r => r.key === e.tech);
  return `<p><strong style="color:var(--brass)">Enquiry.</strong> ${e.text} They need ${t.name} within ${left} month${left === 1 ? '' : 's'}${doing ? ` (yours finishes in ${doing.left})` : `, and it takes ${t.months} to research`}. Have it ready and the job is yours, with a ${kmoney(e.bonus)} bonus.${rivalActive(S) ? ` Leave it and they'll go to ${RIVAL}.` : ''}</p>`;
}
// a brief's buttons: Take is disabled when the crews have no jobs left this month, and says why
const takeButtons = () => `${jobsLeft(S) ? '' : `<p class="note"><span class="hot">${bookedText(S)}</span></p>`}<div style="display:flex;gap:8px"><button class="ghost" type="button" id="bClose">Not now</button><button class="go" type="button" id="bTake" ${jobsLeft(S) ? '' : 'disabled'}>Take the job</button></div>`;
export async function openBrief(i, fromWorkshop) {
  const p = S.plots[i], k = KINDS[p.kind];
  if (!p.contract.solved) {
    sheet(`<div class="eyebrow">${jobLabel(p)} · ${k.label}</div><h3>${p.name}</h3>
      <p>The surveyor is modelling the site: ${p.contract.stage ? 'trying different setups with a simulated crowd' : `trying ${candidates(p.contract, techOf(S)).length} layouts in a 40-second rush hour`} to set a fair target and price. If the best answer is one you've used recently, they'll ask the client for a new wrinkle.</p>
      <div class="progress"><i id="survey"></i></div><p class="note" id="surveyNote"></p>`);
    const entry = surveys.get(p.contract.seed);
    const bar = (f, a) => {
      const el = $('survey'); if (el) el.style.width = (f * 100) + '%';
      const note = $('surveyNote'); if (note) note.textContent = a ? 'That first version was too easy, unfair or too like your recent jobs. Asking the client for something different…' : '';
    };
    if (entry) { bar(entry.progress, entry.attempt || 0); entry.listeners.add(bar); }
    focusSurvey(p.contract.seed);
    await survey(p);
    focusSurvey(null);
    if (entry) entry.listeners.delete(bar);
    if (p.status !== 'open' && p.status !== 'callback') { closeSheet(); renderStreet(); return; }   // a false alarm
    if ($('sheetWrap').hidden) return;
  }
  const c = p.contract;
  if (c.stage) return briefStage(p, c, i, fromWorkshop);
  const g = c.goals, mix = c.crowd.mix || {};
  const guest = [];
  if (mix.elderly) guest.push(`${Math.round(mix.elderly * 100)}% older`);
  if (mix.case) guest.push(`${Math.round(mix.case * 100)}% suitcases`);
  if (mix.wheel) guest.push(`${Math.round(mix.wheel * 100)}% wheelchairs`);
  if (mix.pram) guest.push(`${Math.round(mix.pram * 100)}% prams and trolleys`);
  if (mix.bike) guest.push(`${Math.round(mix.bike * 100)}% cyclists`);
  sheet(`<div class="eyebrow">${jobLabel(p)} · ${k.label} · tier ${c.tier + 1}</div>
    <h3>${p.name}</h3>${enquiryNote(p)}
    ${p.status === 'callback' ? `<p>${!isResearchCall(p) && p.change && CHANGE[p.change] ? `<strong style="color:var(--text)">${CHANGE[p.change].label}.</strong> ` : ''}${callText(p, false)}</p>${beforeLine(c)}` : ''}
    ${BUILDING[p.kind].brief ? BUILDING[p.kind].brief(c) : ''}
    ${c.opts && c.opts.callback === 'botched' ? '<p class="note"><strong style="color:var(--brass)">Rescue job.</strong> Put right what Brassworks fitted, and the client pays 30% more margin.</p>' : ''}
    ${c.event ? (() => { const ev = Object.values(EVENTS).find(e => e.key === c.event); return `<p><strong style="color:var(--brass)">${ev.label}.</strong> ${ev.text} Seasonal work: 25% more margin.</p>`; })() : ''}
    ${c.twists.length ? c.twists.map(t => `<p><strong style="color:var(--text)">${twistLabel(t)}.</strong> ${TWISTS[t] ? TWISTS[t].text : ''}</p>`).join('') : '<p>A straightforward job.</p>'}
    ${c.specialist ? '<p class="note"><strong style="color:var(--brass)">Specialist job.</strong> Only firms with the right R&amp;D get offered this one, so your margin is 60% bigger.</p>' : ''}
    ${c.novelty ? '<p class="note">The surveyor added a wrinkle because your recent jobs used the same answer.</p>' : ''}
    <div class="facts">
      <div class="fact"><span>They pay you</span><b>${kmoney(feeOf(S, c))}</b></div>
      <div class="fact"><span>Door budget</span><b>${kmoney(c.budget)}</b></div>
      <div class="fact"><span>Profit at par</span><b style="color:var(--ok)">${kmoney(feeOf(S, c) - charge(S, c.par.cost))}</b></div>
      <div class="fact"><span>Outside</span><b>${c.outsideTemp}°C</b></div>
      <div class="fact"><span>In / out a min</span><b>${(c.crowd.in * 60).toFixed(0)} / ${(c.crowd.out * 60).toFixed(0)}</b></div>
      <div class="fact"><span>Frontage</span><b>${c.slots} bay${c.slots > 1 ? 's' : ''}</b></div>
    </div>
    ${guest.length ? `<p>Crowd: ${guest.join(', ')}.</p>` : ''}
    <h4>To pass</h4>
    <ul class="list">
      <li><span>Through in a 40s rush</span><span>≥ ${g.through}</span></li>
      <li><span>Bumps</span><span>≤ ${g.bumps}</span></li>
      ${g.minTemp != null ? `<li><span>Lobby never below</span><span>${g.minTemp}°C</span></li>` : ''}
      ${g.maxTemp != null ? `<li><span>Lobby never above</span><span>${g.maxTemp}°C</span></li>` : ''}
      ${g.wait != null ? `<li><span>9 in 10 commuters through within</span><span>${g.wait}s</span></li>` : ''}
      ${g.access ? `<li><span>Wheelchairs and prams turned away</span><span>0</span></li>` : ''}
      ${g.bikes ? `<li><span>Cyclists turned away</span><span>0</span></li>` : ''}
      ${c.site && c.site.rampBays ? `<li><span>Step-free access only at</span><span>bay ${c.site.rampBays.map(i => i + 1).join(', ')}</span></li>` : ''}
      ${g.laps != null ? `<li><span>People riding round again</span><span>≤ ${g.laps}</span></li>` : ''}
      ${c.drill ? `<li><span>Fire drill at ${c.drill.at}s: ${c.drill.n} people, lobby clear within</span><span>${g.evac}s</span></li>` : ''}
      ${c.rules && c.rules.forbid && !c.landmark ? `<li><span>Not allowed</span><span>${c.rules.forbid.map(t => TYPE_LABEL[t].toLowerCase() + ' doors').join(', ')}</span></li>` : ''}
      ${c.rules && c.rules.fixed ? `<li><span>Fixed by the client</span><span>bay ${(+Object.keys(c.rules.fixed)[0]) + 1}</span></li>` : ''}
      <li><span>Surveyor's par: the cheapest pass they found</span><span>${money(c.par.cost)}</span></li>
    </ul>
    <p class="note">${STARS}.${costMult(S) < 1 ? ` Prices shown are list prices; you pay ${Math.round(costMult(S) * 100)}% of them.` : ''}</p>
    <div class="legend"><span><i style="background:var(--frost)"></i>arriving</span><span><i style="background:var(--rose)"></i>leaving</span><span><i style="background:#fff;border:3px solid var(--frost);box-sizing:border-box"></i>older</span><span><i style="background:var(--frost);border-radius:3px"></i>wheelchair</span><span><i style="background:#b48cf0"></i>pram</span><span><i style="background:#d4a94f;border-radius:2px;height:3px;width:14px;vertical-align:3px"></i>bike</span><span><i style="background:#9b7a4a;border-radius:2px"></i>suitcase</span><span><i style="background:#6b7280"></i>standing still</span></div>
    ${fromWorkshop ? '<button class="go" type="button" id="bBack">Back to the workshop</button>'
      : takeButtons()}`);
  if (fromWorkshop) { $('bBack').onclick = closeSheet; return; }
  setTimeout(() => coach('brief', () => $('bTake')), 250);
  $('bClose').onclick = closeSheet;
  $('bTake').onclick = () => { closeSheet(); openWorkshop(i); };
}

// the brief for an inside job: what the stage is, what's already there, the targets, and the paradox at stake
function briefStage(p, c, i, fromWorkshop) {
  const k = KINDS[p.kind], g = c.goals, st = STAGES[c.stage];
  const parts = c.chain ? STAGES.chain.partsOf(c) : [{ st, sub: c }];
  const mix = c.crowd.mix || {};
  sheet(`<div class="eyebrow">${jobLabel(p)} · ${k.label} · inside job · tier ${c.tier + 1}</div>
    <h3>${p.name}</h3>${enquiryNote(p)}
    ${p.status === 'callback' ? `<p>${callText(p, true)}</p>` : ''}
    ${c.chain ? `<p><strong style="color:var(--brass)">${c.chain.length} stages, one crowd.</strong> Everyone goes through ${parts.map(x => stageName(c, x.st.key).toLowerCase()).join(', then ')}. Speed up one stage and the queue moves on to the next.</p>` : ''}
    ${parts.map(({ st: ps }) => `<p><strong style="color:var(--text)">${stageName(c, ps.key)}.</strong> ${stageAbout(c, ps.key)}</p>`).join('')}
    ${c.event ? (() => { const ev = Object.values(EVENTS).find(e => e.key === c.event); return `<p><strong style="color:var(--brass)">${ev.label}.</strong> A busier day than usual. Seasonal work: 25% more margin.</p>`; })() : ''}
    ${c.twists.map(t => { const tw = stageTwist(c, t); return `<p><strong style="color:var(--text)">${tw.label}.</strong> ${tw.text}</p>`; }).join('')}
    ${beforeLineStage(c)}
    <div class="facts">
      <div class="fact"><span>They pay you</span><b>${kmoney(feeOf(S, c))}</b></div>
      <div class="fact"><span>Budget</span><b>${kmoney(c.budget)}</b></div>
      <div class="fact"><span>Profit at par</span><b style="color:var(--ok)">${kmoney(feeOf(S, c) - charge(S, c.par.cost))}</b></div>
      <div class="fact"><span>Arriving</span><b>${Math.round(c.crowd.rate * 60)}/min</b></div>
      <div class="fact"><span>For</span><b>${c.arrive}s</b></div>
      <div class="fact"><span>Older guests</span><b>${Math.round((mix.elderly || 0) * 100)}%</b></div>
    </div>
    <h4>To pass</h4>
    <ul class="list">
      <li><span>${st.throughLabel || 'People through'}</span><span>≥ ${g.through}</span></li>
      <li><span>${st.waitLabel}</span><span>${g.wait}s</span></li>
      ${st.bumps ? `<li><span>${st.bumpLabel || 'Bumps'}</span><span>≤ ${g.bumps}</span></li>` : ''}
      <li><span>Surveyor's par: the cheapest pass they found</span><span>${money(c.par.cost)}</span></li>
    </ul>
    <p class="note">${STARS_INSIDE}.</p>
    ${fromWorkshop ? '<button class="go" type="button" id="bBack">Back to the job</button>'
      : takeButtons()}`);
  if (fromWorkshop) { $('bBack').onclick = closeSheet; return; }
  $('bClose').onclick = closeSheet;
  $('bTake').onclick = () => { closeSheet(); openWorkshop(i); };
}
function beforeLineStage(c) {
  const b = c.before, g = c.goals;
  if (!b) return '';
  const miss = [];
  if (b.through < g.through) miss.push(`${b.through} through, ${g.through} needed`);
  if (b.wait > g.wait) miss.push(`9 in 10 take up to ${b.wait.toFixed(0)}s, ${g.wait}s wanted`);
  if (b.bumps > g.bumps) miss.push(`${b.bumps} bumps, ${g.bumps} allowed`);
  return miss.length ? `<p class="note"><strong style="color:var(--warn)">As it stands:</strong> ${miss.join('; ')}.</p>` : '';
}
export function openLesson(key, back) {
  const b = BASICS.find(x => x[0] === key), l = LESSONS[key];
  sheet(`<div class="eyebrow">${b ? 'Guide' : 'How to use it'}</div><h3>${b ? b[1] : l[0]}</h3>
    <p>${b ? b[2] : l[1]}</p>
    ${l ? `<p><strong style="color:var(--text)">Where:</strong> ${l[2]}</p><p class="note"><strong style="color:var(--brass)">Tip.</strong> ${l[3]}</p>` : ''}
    <button class="go" type="button" id="lsBack">${back ? 'Back' : 'Got it'}</button>`);
  $('lsBack').onclick = () => back ? back() : closeSheet();
}

let coTab = 'research';
export function openCompany(tab) {
  if (tab) coTab = tab;
  const P = prem(S), broke = S.cash < 0;
  const tabs = `<div class="seg cotabs">${[['research', 'Research'], ['staff', 'Staff'], ['premises', 'Premises'], ['guide', 'Guide']].map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${coTab === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (coTab === 'research') {
    const busy = S.research.length, free = P.labs - busy;
    body = `${S.moving ? `<p class="note"><span class="hot">${movingText(S)}</span></p>` : ''}<p>${busy ? `Researching ${S.research.map(r => `<b style="color:var(--text)">${techName(r.key)}</b> (${r.left} month${r.left > 1 ? 's' : ''} left)`).join(', ')}. ` : ''}${free > 0 ? `${free} bench${free > 1 ? 'es' : ''} free.` : 'All benches busy.'} Projects finish at the end of the month, and each one opens the next in its branch.</p>` +
      BRANCHES.map(([b, label]) => { const nodes = TECH.filter(t => t.branch === b).map(t => {
        const owned = S.unlocks[t.key], doing = S.research.find(r => r.key === t.key);
        const missing = (t.req || []).filter(r => !S.unlocks[r]);
        const tierOk = t.tier <= P.tier;
        let state, action = '';
        if (owned) state = LESSONS[t.key] ? `<button class="ghost small" type="button" data-lesson="${t.key}">How to use</button>` : '<span class="pill done">Owned</span>';
        else if (doing) state = `<span class="pill open">${doing.left} mo</span>`;
        else if (!tierOk) state = `<span class="pill lock">Tier ${t.tier}</span>`;
        else if (missing.length) state = `<span class="pill lock">Locked</span>`;
        else {
          // say why a project can't start rather than just greying the button
          const block = broke ? 'Overdrawn' : S.moving ? 'Moving' : free <= 0 ? 'Benches busy' : S.cash < t.price ? `Need ${kmoney(t.price - S.cash)} more` : '';
          action = `<div style="display:grid;gap:4px;justify-items:end"><button class="go" type="button" data-k="${t.key}" ${block ? 'disabled' : ''}>${kmoney(t.price)} · ${t.months} mo</button>${block ? `<span class="why">${block}</span>` : ''}</div>`;
        }
        const why = !owned && !doing ? (!tierOk ? `Needs ${PREMISES[t.tier - 1].name.toLowerCase()} premises. ` : missing.length ? `Needs ${missing.map(techName).join(', ')}. ` : '') : '';
        const html = `<div class="node ${owned ? 'owned' : doing ? 'doing' : action ? 'avail' : 'locked'}"><div><b>${t.name}</b><p>${why}${t.text}${t.opens ? `<br><span class="opens">Opens specialist jobs: ${t.opens}</span>` : ''}${(() => { const a = !owned && S.plots.find(p => p.enquiry && p.enquiry.tech === t.key && !p.enquiry.ready); return a ? `<br><span class="opens" style="color:var(--brass)">${a.name} wants this within ${a.enquiry.by - S.month} month${a.enquiry.by - S.month === 1 ? '' : 's'}: ${kmoney(a.enquiry.bonus)} bonus</span>` : ''; })()}</p></div>${state || action}</div>`;
        return { html, later: !owned && !doing && !action };
      });
      const now = nodes.filter(n => !n.later), later = nodes.filter(n => n.later);
      return `<div class="branch"><div class="eyebrow">${label}</div>${now.map(n => n.html).join('')}${later.length ? `<details class="more"><summary>${later.length} more ${later.length > 1 ? 'need' : 'needs'} bigger premises or earlier research ›</summary><div>${later.map(n => n.html).join('')}</div></details>` : ''}</div>`;
      }).join('');
  } else if (coTab === 'guide') {
    const owned = TECH.filter(t => S.unlocks[t.key] && LESSONS[t.key]);
    body = `<p>Everything the game has taught you, any time you need it.</p>
      <div class="branch"><div class="eyebrow">The basics</div>${BASICS.map(([k, t]) => `<button class="lessonrow" type="button" data-lesson="${k}"><b>${t}</b><span>›</span></button>`).join('')}</div>
      <div class="branch"><div class="eyebrow">Your research</div>${owned.length ? owned.map(t => `<button class="lessonrow" type="button" data-lesson="${t.key}"><b>${t.name}</b><span>›</span></button>`).join('') : '<p class="note">Lessons for new kit appear here as your research finishes.</p>'}</div>
      <button class="ghost" type="button" id="tutReplay">Replay the walk-through</button>
      <div class="branch"><div class="eyebrow">Start again</div><p class="note">Wipes this firm: cash, clients, research and staff.</p><button class="ghost" type="button" id="coNew">Start a new firm</button></div>`;
  } else if (coTab === 'staff') {
    const hired = STAFF.filter(s => S.staff[s.key]).length;
    body = `<p>Wages come out at the end of every month. Your ${P.name.toLowerCase()} has room for ${P.staff} hire${P.staff > 1 ? 's' : ''}; ${hired} taken.</p>` +
      STAFF.map(s => {
        const on = S.staff[s.key], needs = s.req && !S.unlocks[s.req];
        const btn = on ? `<button class="ghost" type="button" data-fire="${s.key}">Let go</button>`
          : needs ? `<span class="pill lock">Research first</span>`
          : (() => { const block = broke ? 'Overdrawn' : hired >= P.staff ? 'No room: move premises' : ''; return `<div style="display:grid;gap:4px;justify-items:end"><button class="go" type="button" data-hire="${s.key}" ${block ? 'disabled' : ''}>Hire</button>${block ? `<span class="why">${block}</span>` : ''}</div>`; })();
        return `<div class="node ${on ? 'owned' : needs ? 'locked' : 'avail'}"><div><b>${s.name} · ${money(s.wage)}/mo</b><p>${needs ? `Needs ${techName(s.req)}. ` : ''}${s.text}</p></div>${btn}</div>`;
      }).join('');
  } else {
    body = `${S.moving ? `<p class="note"><span class="hot">${movingText(S)}</span></p>` : ''}<p>Rent is due every month. A move takes ${PREMISES.filter(p => p.moveMonths).map(p => `${p.moveMonths} month${p.moveMonths > 1 ? 's' : ''} to the ${p.name.toLowerCase()}`).join(', ')}, and research waits until you're in. Bigger premises unlock higher research tiers, room for more staff and more jobs a month. Right now your crews can take ${jobsPerMonth(S)} jobs a month.</p>` +
      PREMISES.map((p, i) => {
        const cur = i === (S.premises || 0), past = i < (S.premises || 0), next = i === (S.premises || 0) + 1;
        const repOk = rep(S) >= (p.rep || 0);
        const btn = cur ? '<span class="pill done">Current</span>' : past ? '<span class="pill lock">Outgrown</span>'
          : S.moving && S.moving.to === i ? `<span class="pill open">Moving · ${S.moving.left} mo</span>`
          : next ? (repOk ? `<div style="display:grid;gap:4px;justify-items:end"><button class="go" type="button" data-move="${i}" ${broke || S.moving || S.cash < p.price ? 'disabled' : ''}>Move · ${kmoney(p.price)} · ${p.moveMonths} mo</button>${S.cash < p.price ? `<span class="why">Need ${kmoney(p.price - S.cash)} more</span>` : ''}</div>` : `<span class="pill lock">${p.rep}★ rep</span>`)
          : '<span class="pill lock">Later</span>';
        return `<div class="node ${cur ? 'owned' : next && repOk ? 'avail' : 'locked'}"><div><b>${p.name} · ${money(p.rent)}/mo rent</b><p>${p.text} Research tier ${p.tier}, ${p.labs} bench${p.labs > 1 ? 'es' : ''}, ${p.staff} staff, ${p.jobs} jobs a month.</p></div>${btn}</div>`;
      }).join('');
  }
  sheet(`<div class="eyebrow">Company</div><h3>${P.name}</h3>
    <div class="facts"><div class="fact"><span>Cash</span><b class="${broke ? 'neg' : ''}">${kmoney(S.cash)}</b></div><div class="fact"><span>In / month</span><b>${kmoney(monthlyIncome(S))}</b></div><div class="fact"><span>Out / month</span><b>${kmoney(overheads(S))}</b></div></div>
    ${broke ? '<p class="note"><span class="hot">You\'re overdrawn.</span> You can\'t start research, hire or move until you\'re back in the black.</p>' : ''}
    ${tabs}${body}
    <button class="ghost" type="button" id="coClose">Back to the street</button>`);
  const sh = $('sheet');
  sh.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { const top = sh.scrollTop; openCompany(b.dataset.tab); sh.scrollTop = 0; });
  sh.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const t = TECH.find(x => x.key === b.dataset.k);
    if (!startResearch(S, t.key)) return;
    save(); renderStreet(); keepScroll(() => openCompany()); toast(`Started ${t.name} · ready in ${t.months} month${t.months > 1 ? 's' : ''}`);
  });
  sh.querySelectorAll('[data-hire]').forEach(b => b.onclick = () => { hire(S, b.dataset.hire); save(); renderStreet(); keepScroll(() => openCompany()); toast(`${STAFF.find(s => s.key === b.dataset.hire).name} hired`); });
  sh.querySelectorAll('[data-fire]').forEach(b => b.onclick = () => { fire(S, b.dataset.fire); save(); renderStreet(); keepScroll(() => openCompany()); });
  sh.querySelectorAll('[data-move]').forEach(b => b.onclick = () => {
    const i = +b.dataset.move, p = PREMISES[i];
    if (!movePremises(S, i)) return;
    save(); renderStreet(); keepScroll(() => openCompany()); toast(`Moving to the ${p.name.toLowerCase()}: ${p.moveMonths} month${p.moveMonths > 1 ? 's' : ''}`);
  });
  $('coClose').onclick = closeSheet;
  sh.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => openLesson(b.dataset.lesson, () => openCompany()));
  if ($('tutReplay')) $('tutReplay').onclick = () => { S.tut = { done: {} }; save(); closeSheet(); toast('Walk-through on: it picks up as you play'); setTimeout(renderStreet, 300); };
  // starting over wipes the save, so it takes two taps
  if ($('coNew')) $('coNew').onclick = () => {
    const btn = $('coNew');
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed'); btn.textContent = 'Tap again: lose everything';
      clearTimeout(btn._t); btn._t = setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = 'Start a new firm'; } }, 3000);
      return;
    }
    wipeSave();
    location.reload();
  };
}
// a fitted client: what they pay, how worn the doors are, their safety record
export function openClient(i) {
  const p = S.plots[i], k = KINDS[p.kind], wear = Math.round((p.wear || 0) * 100), cost = serviceCost(p);
  const bar = `<div class="wear"><i style="width:${wear}%;background:${p.broken ? 'var(--warn)' : wear >= 70 ? 'var(--warn)' : wear >= 50 ? 'var(--brass)' : 'var(--ok)'}"></i></div>`;
  sheet(`<div class="eyebrow">Client · ${k.label}</div><h3>${p.name}</h3>${enquiryNote(p)}
    <div class="facts"><div class="fact"><span>Stars</span><b style="color:var(--brass)">${'★'.repeat(p.stars)}</b></div><div class="fact"><span>Pays / month</span><b>${kmoney(upkeep(S, p))}</b></div>${p.install ? `<div class="fact"><span>Doors</span><b>${p.install.filter(s => s.type !== 'wall').length}</b></div>` : `<div class="fact"><span>Inside jobs</span><b>${Object.keys(p.inside || {}).length}</b></div>`}</div>
    <p><strong style="color:var(--text)">${p.broken ? 'Broken down.' : `Wear ${wear}%.`}</strong> ${p.broken ? 'The client pays nothing until you send someone.' : wear >= 50 ? 'Worn doors stick and slow down: the client is paying less, and more likely to complain.' : 'In good order.'} ${S.staff.engineer ? 'Your service engineer halves the wear.' : ''}</p>
    ${bar}
    <ul class="list">
      ${Object.keys(p.inside || {}).length ? `<li><span>Inside work you've done</span><span style="font-family:inherit">${Object.keys(p.inside).map(k => k.startsWith('chain:') ? k.slice(6).split('+').map(x => stageName({ tunes: BUILDING[p.kind].tune }, x)).join(' → ') : stageName({ tunes: BUILDING[p.kind].tune }, k)).join(', ')}</span></li>` : ''}
      <li><span>Safety record at sign-off</span><span>${p.bumpRec || 0} bump${p.bumpRec === 1 ? '' : 's'} · ${p.stopRec || 0} stop${p.stopRec === 1 ? '' : 's'}</span></li>
      <li><span>Adds to your insurance</span><span>${money(45 * (p.bumpRec || 0) + 25 * (p.stopRec || 0))}/mo</span></li>
      <li class="${p.coped ? 'pass' : ''}"><span>Street changes their doors coped with</span><span>${p.coped ? `${p.coped} · +${Math.round((loyalty(p) - 1) * 100)}% fee` : 'none yet'}</span></li>
      <li class="${p.green ? 'pass' : ''}"><span>Green star · lobby kept snug</span><span>${p.green ? '+15% fee' : 'no'}</span></li>
      <li class="${p.cert ? 'pass' : ''}"><span>Inspection certificate</span><span>${p.cert ? '+10% fee' : 'not yet'}</span></li>
    </ul>
    <div style="display:flex;gap:8px"><button class="ghost" type="button" id="clClose" style="flex:1">Close</button><button class="go" type="button" id="clServ" ${!wear && !p.broken ? 'disabled' : ''} ${S.cash < cost ? 'disabled' : ''}>Service · ${kmoney(cost)}</button></div>`);
  $('clClose').onclick = closeSheet;
  $('clServ').onclick = () => { if (!service(S, p)) return; save(); renderStreet(); closeSheet(); toast(`${p.name} serviced · good as new`); };
}
// DOM wiring, called once at boot
export function initSheets() {
  $('rdBtn').onclick = guarded(() => openCompany());
  $('monthBtn').onclick = guarded(() => {
  const { moved, moving, inc, rent, premName, ins, wages, claims, broke, insp, done, walked, winter, calls, lost, evNow, net, paradox, changes, enquiry } = endMonth(S);
  save();
  renderStreet();
  sheet(`<div class="eyebrow">${MONTHS[S.month % 12]} ${S.year}</div><h3>${net >= 0 ? 'Up ' + money(net) : 'Down ' + money(-net)} this month</h3>
    <ul class="list">
      <li class="pass"><span>Maintenance fees</span><span>+${money(inc)}</span></li>
      <li><span>Rent · ${premName.toLowerCase()}</span><span>−${money(rent)}</span></li>
      ${wages.map(s => `<li><span>${s.name}</span><span>−${money(s.wage)}</span></li>`).join('')}
      ${ins ? `<li><span>Insurance${ins > 60 ? ' · loaded for bumps on your record' : ''}</span><span>−${money(ins)}</span></li>` : ''}
      ${claims.map(p => `<li class="fail"><span>Claim: someone clipped at ${p.name}</span><span>−${money(CLAIM_EXCESS)}</span></li>`).join('')}
      ${insp && !insp.pass ? `<li class="fail"><span>Inspection fine · ${insp.p.name}</span><span>−${money(INSPECTION_FINE)}</span></li>` : ''}
      <li><span><b>Cash now</b></span><span class="${S.cash < 0 ? 'neg' : ''}">${money(S.cash)}</span></li>
    </ul>
    ${insp ? `<p><strong style="color:${insp.pass ? 'var(--ok)' : 'var(--warn)'}">Inspection at ${insp.p.name}:</strong> ${insp.pass ? 'passed. They get a certificate of compliance, and pay you 10% more maintenance.' : !insp.access ? 'failed. There is no step-free way in. You have a callback to fix it.' : `failed on safety: ${insp.bumps} people clipped, the limit is ${insp.limit}. You have a callback to fix it.`}</p>` : ''}
    ${lost.length ? `<p><span class="hot">${RIVAL} won ${lost.map(p => p.name).join(' and ')}.</span> Tenders you leave sitting are fair game. Their work rarely lasts: expect the client back.</p>` : ''}
    ${broke.length ? `<p><span class="hot">Broken down:</span> ${broke.map(p => p.name).join(', ')}. No maintenance fee until you send someone. Tap the building on the street to service it.</p>` : ''}
    ${moved ? `<p><strong style="color:var(--brass)">You've moved into the ${moved.toLowerCase()}.</strong> Research picks up again this month.</p>` : moving ? `<p><span class="hot">${movingText(S)}</span></p>` : ''}
    ${done.length ? `<p><strong style="color:var(--brass)">Research complete:</strong> ${done.map(techName).join(', ')}.${done.some(k => TECH.find(t => t.key === k).opens) ? ' New specialist tenders may appear.' : ''}</p>
      <div class="learn">${done.filter(k => LESSONS[k]).map(k => `<button class="ghost small" type="button" data-lesson="${k}">How to use ${techName(k)}</button>`).join('')}</div>` : ''}
    ${walked.length ? `<p><span class="hot">Your staff walked out</span> over unpaid wages: ${walked.join(', ')}.</p>` : S.cash < 0 ? '<p><span class="hot">You\'re overdrawn.</span> Win jobs or let staff go. Below −£15k your crew will walk out.</p>' : ''}
    ${paradox.length ? `<p><strong style="color:var(--brass)">Your research has clients calling:</strong></p><ul class="list">${paradox.map(p => `<li style="display:block"><span style="font-family:inherit;color:var(--text);font-weight:600">${p.name}</span><br><span style="font-family:inherit;color:var(--mute)">${p.callText} They keep paying while you quote.${p.enquiry && p.enquiry.ready ? ` <b style="color:var(--brass)">They waited for you: ${kmoney(p.enquiry.bonus)} bonus on sign-off.</b>` : ''}</span></li>`).join('')}</ul>` : ''}
    ${enquiry.lapsed.map(x => `<p><span class="hot">${x.p.name} stopped waiting</span> for ${techName(x.tech)}. ${x.rival ? `They've gone to ${RIVAL}. Expect them back when it goes wrong.` : 'They\'re a little less loyal for it.'}</p>`).join('')}
    ${enquiry.fresh ? (() => { const p = enquiry.fresh, e = p.enquiry, t = TECH.find(x => x.key === e.tech); return `<p><strong style="color:var(--brass)">Enquiry from ${p.name}.</strong> ${e.text} They need ${t.name} within ${e.by - S.month} months (${t.months} to research, ${kmoney(t.price)}). Have it ready and the job is yours, with a ${kmoney(e.bonus)} bonus.</p><div class="learn"><button class="ghost small" type="button" data-co="research">Open research</button></div>`; })() : ''}
    ${changes.map(ch => `<p><strong style="color:var(--text)">${CHANGE[ch.key].label}.</strong> ${changeText(ch, changeWhere(S, ch))} ${ch.checked.length ? `The surveyor is checking how your doors cope at ${ch.checked.map(p => p.name).join(', ')}. Only those that fall short will call.` : 'None of your clients is affected.'}</p>`).join('')}
    ${(() => { if (hasWork(S)) return calls.length ? '' : `<p>${inc ? 'Every fitted client is happy.' : 'Win a tender to start earning maintenance fees.'}</p>`; if (enquiry.fresh) return ''; const a = advice(S); return `<p><strong style="color:var(--text)">Nothing on the table.</strong> ${a ? a.text : 'Every fitted client is happy.'}</p>${a && a.tab ? `<div class="learn"><button class="ghost small" type="button" data-co="${a.tab}">Open ${a.tab}</button></div>` : ''}`; })()}
    ${evNow ? `<p><strong style="color:var(--brass)">${evNow.label} this month.</strong> ${evNow.text} Tenders pay 25% more margin.</p>` : ''}
    ${(() => { const nx = eventOf(S.month + 1); return nx ? `<p class="note">Next month: ${nx.label}.</p>` : ''; })()}
    ${(() => { const nx = (S.changes || []).find(x => x.month > S.month); return nx ? `<p class="note">Coming up in ${MONTHS[nx.month % 12]}: ${CHANGE[nx.key].label.toLowerCase()}, ${changeWhere(S, nx)}.</p>` : ''; })()}
    ${winter ? '<p class="note">Winter: colder tenders.</p>' : ''}
    <button class="go" type="button" id="mClose">Back to the street</button>`);
  $('mClose').onclick = closeSheet;
  const monthHTML = $('sheet').innerHTML;
  const rewire = () => { $('sheet').querySelectorAll('[data-co]').forEach(b => b.onclick = () => openCompany(b.dataset.co)); $('sheet').querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => openLesson(b.dataset.lesson, () => { $('sheet').innerHTML = monthHTML; $('mClose').onclick = closeSheet; rewire(); })); };
  rewire();
});
}
