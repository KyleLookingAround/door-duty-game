import { BUILDING, KINDS } from '../content/buildings/index.js';
import { PREMISES, STAFF } from '../content/company.js';
import { EVENTS, eventOf } from '../content/events.js';
import { BASICS, STARS, STARS_INSIDE } from '../content/guides.js';
import { BRANCHES, LESSONS, TECH } from '../content/tech.js';
import { RIVAL, STREETS } from '../content/town.js';
import { STREET_GATES } from '../content/balance.js';
import { TWISTS } from '../content/twists.js';
import { STAGES, stageName, stageAbout } from '../engine/stages/index.js';
import { MONTHS, candidates } from '../game/contracts.js';
import { townDay } from '../game/townday.js';
import { playTownDay, replayTownDay, townDayOutcome } from './townday.js';
import { footfallLine, footfallOf, footfallReport } from '../game/footfall.js';
import { advertCost, charge, costMult, feeOf, insurance, isMastered, jobsLeft, jobsPerMonth, monthlyIncome, overheads, prem, rep, rivalActive, serviceCost, techName, techOf, upkeep, loyalty, gateText, streetOpen, yardToBuy } from '../game/economy.js';
import { advice, hasWork } from '../game/enquiries.js';
import { bookedText, callText, isResearchCall, jobLabel, journal, leadline, movingText, stageTwist } from '../game/briefs.js';
import { advertise, buyYard, fire, hire, movePremises, service } from '../game/jobs.js';
import { benches, reqMet, freeBenches, benchesFilled, instalment, levelOf, nextLevel, researchOut, startResearch, techOrStudy, unqueue } from '../game/research.js';
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
  if (mix.kid) guest.push(`${Math.round(mix.kid * 100)}% children racing ahead`);
  sheet(`<div class="eyebrow">${jobLabel(p)} · ${k.label} · tier ${c.tier + 1}</div>
    <h3>${p.name}</h3>${enquiryNote(p)}
    ${p.status === 'callback' ? `<p>${!isResearchCall(p) && p.change && CHANGE[p.change] ? `<strong style="color:var(--text)">${CHANGE[p.change].label}.</strong> ` : ''}${callText(p, false)}</p>${beforeLine(c)}` : ''}
    ${BUILDING[p.kind].brief ? BUILDING[p.kind].brief(c) : ''}
    ${c.opts && c.opts.callback === 'botched' ? '<p class="note"><strong style="color:var(--brass)">Rescue job.</strong> Put right what Brassworks fitted, and the client pays 30% more margin.</p>' : ''}
    ${c.event ? (() => { const ev = Object.values(EVENTS).find(e => e.key === c.event); return `<p><strong style="color:var(--brass)">${ev.label}.</strong> ${ev.text} Seasonal work: 25% more margin.</p>`; })() : ''}
    ${c.twists.length ? c.twists.map(t => `<p><strong style="color:var(--text)">${twistLabel(t)}.</strong> ${TWISTS[t] ? TWISTS[t].text : ''}</p>`).join('') : '<p>A straightforward job.</p>'}${footNote(p, c)}
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
    <div class="legend"><span><i style="background:var(--frost)"></i>arriving</span><span><i style="background:var(--rose)"></i>leaving</span><span><i style="background:#fff;border:3px solid var(--frost);box-sizing:border-box"></i>older</span><span><i style="background:var(--frost);border-radius:3px"></i>wheelchair</span><span><i style="background:#b48cf0"></i>pram</span><span><i style="background:#d4a94f;border-radius:2px;height:3px;width:14px;vertical-align:3px"></i>bike</span><span><i style="background:#9b7a4a;border-radius:2px"></i>suitcase</span>${(c.crowd.mix || {}).kid ? '<span><i style="background:#6fcf97;width:8px;height:8px"></i>child</span>' : ''}<span><i style="background:#6b7280"></i>standing still</span></div>
    ${fromWorkshop ? '<button class="go" type="button" id="bBack">Back to the workshop</button>'
      : takeButtons()}`);
  if (fromWorkshop) { $('bBack').onclick = closeSheet; return; }
  setTimeout(() => coach('brief', () => $('bTake')), 250);
  $('bClose').onclick = closeSheet;
  $('bTake').onclick = () => { closeSheet(); openWorkshop(i); };
}

// footfall the job was drawn with (game/footfall.js): busier or quieter than the client's usual day
const footNote = (p, c) => { const f = c.opts && c.opts.footfall, line = f && !c.first ? footfallLine(S, p, f) : null; return line ? `<p><strong style="color:var(--text)">${f > 1 ? 'Busier than usual' : 'Quieter than usual'}.</strong> ${line}</p>` : ''; };

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
    ${c.twists.map(t => { const tw = stageTwist(c, t); return `<p><strong style="color:var(--text)">${tw.label}.</strong> ${tw.text}</p>`; }).join('')}${footNote(p, c)}
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
      <li><span>${(c.tune && c.tune.waitLabel) || st.waitLabel}</span><span>${g.wait}s</span></li>
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
    // the benches: what each is doing, then the queue, then the tree
    const benchRows = S.moving ? `<p class="note"><span class="hot">${movingText(S)}</span></p>`
      : Array.from({ length: benches(S) }, (_, i) => {
        const r = S.research[i];
        if (!r) return `<div class="node avail"><div><b>Bench ${i + 1} · free</b><p>Research never stops: pick a project below, or run a market study (free, one month) to bring in work.</p></div><button class="go" type="button" data-k="study">Market study</button></div>`;
        const t = techOrStudy(r.key), per = r.owe > 0 ? r.per ?? instalment(t) : 0;
        return `<div class="node doing"><div><b>Bench ${i + 1} · ${t.name}</b><p>${r.left} month${r.left > 1 ? 's' : ''} left${per ? ` · ${kmoney(per)} a month` : r.key === 'study' ? ' · free' : ' · paid'}.</p></div><span class="pill open">${r.left} mo</span></div>`;
      }).join('');
    const queue = S.queue || [];
    const queueRows = queue.length ? `<div class="branch"><div class="eyebrow">Next up</div>${queue.map(q => { const t = techOrStudy(q.key); return `<div class="node"><div><b>${t.name}${t.kind === 'refine' ? ` level ${levelOf(S, t.key) + 1}` : ''}</b><p>${q.left} month${q.left > 1 ? 's' : ''} to go · ${kmoney(q.per ?? instalment(t))} a month. Starts when a bench comes free.</p></div><button class="ghost small" type="button" data-unq="${q.key}">Remove</button></div>`; }).join('')}</div>` : '';
    const wanted = TECH.filter(t => !S.unlocks[t.key] && S.plots.some(p => p.enquiry && p.enquiry.tech === t.key && !p.enquiry.ready));
    body = `<p>Research never stops: every bench needs a project before the month can end. Projects are paid month by month, and finish at a month end. A finished tech is <b>owned</b>; sign off the job that teaches it and it's <b>mastered</b>, which earns a ★ and is what landmarks ask for.${broke ? ' <span class="hot">Overdrawn: paid projects wait, and the bench runs a market study.</span>' : ''}</p>
      <div class="branch"><div class="eyebrow">Benches</div>${benchRows}</div>${queueRows}
      <div class="branch"><div class="eyebrow">Bring in work now</div><div class="node avail"><div><b>Advertise</b><p>An advert in the local paper: a client wanting more, or one asking for new research, this month. Each advert this month costs more${S.unlocks.network ? '; your sales network makes them cheaper' : ''}.</p></div><div style="display:grid;gap:4px;justify-items:end"><button class="go" type="button" id="coAd" ${S.cash < advertCost(S) ? 'disabled' : ''}>${kmoney(advertCost(S))}</button>${S.cash < advertCost(S) ? `<span class="why">Need ${kmoney(advertCost(S) - S.cash)} more</span>` : ''}</div></div></div>
      ${wanted.length ? `<p class="note"><b>Wanted:</b> ${wanted.map(t => t.name).join(', ')}.</p>` : ''}` +
      BRANCHES.map(([b, label]) => { const nodes = TECH.filter(t => t.branch === b).map(t => {
        // a refinement shows its level and offers the next one; it reads as owned only at the top level
        const refine = t.kind === 'refine', lv = levelOf(S, t.key), step = nextLevel(S, t);
        const owned = refine ? !step : S.unlocks[t.key], doing = S.research.find(r => r.key === t.key), queued = queue.some(q => q.key === t.key);
        const mastered = owned && isMastered(S, t.key);
        const missing = (t.req || []).filter(r => !S.unlocks[r]);
        const unmastered = (t.req || []).filter(r => S.unlocks[r] && !reqMet(S, t, r));
        const tierOk = t.tier <= P.tier;
        let state, action = '';
        const how = LESSONS[t.key] ? `<button class="ghost small" type="button" data-lesson="${t.key}">How to use</button>` : '';
        if (owned) state = `<div style="display:grid;gap:4px;justify-items:end"><span class="pill done">${refine ? 'Top level' : mastered ? 'Mastered ★' : 'Owned'}</span>${how}</div>`;
        else if (doing) state = `<span class="pill open">${doing.left} mo</span>`;
        else if (queued) state = '<span class="pill open">Queued</span>';
        else if (!tierOk) state = `<span class="pill lock">Tier ${t.tier}</span>`;
        else if (missing.length || unmastered.length) state = `<span class="pill lock">Locked</span>`;
        else if ((S.studiesDone || 0) < (t.studies || 0)) state = `<span class="pill lock">${S.studiesDone || 0}/${t.studies} studies</span>`;
        else action = `<div style="display:grid;gap:4px;justify-items:end"><button class="go" type="button" data-k="${t.key}">${refine && lv ? `Level ${lv + 1}` : freeBenches(S) > 0 ? 'Start' : 'Queue'} · ${kmoney(instalment(t, S))}/mo</button><span class="why">${step.months} month${step.months > 1 ? 's' : ''}, ${kmoney(step.price)} in all</span></div>`;
        const why = !owned && !doing && !queued ? (!tierOk ? `Needs ${PREMISES[t.tier - 1].name.toLowerCase()} premises. ` : missing.length ? `Needs ${missing.map(techName).join(', ')}. ` : unmastered.length ? `Needs ${unmastered.map(techName).join(', ')} mastered. ` : (S.studiesDone || 0) < (t.studies || 0) ? `Needs ${t.studies} market studies behind it. ` : '') : '';
        const levelText = refine ? `<br><span class="opens">${lv ? `Level ${lv} of ${t.levels.length}: ${t.levels[lv - 1].text}` : ''}${step ? `${lv ? ' ' : ''}Next: ${step.text}` : ''}</span>` : '';
        const learn = !refine && owned && !mastered ? '<br><span class="opens">Master it: sign off the job a client calls you with about it.</span>' : '';
        const html = `<div class="node ${owned ? 'owned' : doing || queued ? 'doing' : action ? 'avail' : 'locked'}"><div><b>${t.name}</b><p>${why}${t.text}${levelText}${t.opens ? `<br><span class="opens">Opens specialist jobs: ${t.opens}</span>` : ''}${learn}${(() => { const a = !owned && S.plots.find(p => p.enquiry && p.enquiry.tech === t.key && !p.enquiry.ready); return a ? `<br><span class="opens" style="color:var(--brass)">${a.name} wants this within ${a.enquiry.by - S.month} month${a.enquiry.by - S.month === 1 ? '' : 's'}: ${kmoney(a.enquiry.bonus)} bonus</span>` : ''; })()}</p></div>${state || action}</div>`;
        return { html, later: !owned && !doing && !queued && !action };
      });
      const now = nodes.filter(n => !n.later), later = nodes.filter(n => n.later);
      return `<div class="branch"><div class="eyebrow">${label}</div>${now.map(n => n.html).join('')}${later.length ? `<details class="more"><summary>${later.length} more ${later.length > 1 ? 'need' : 'needs'} bigger premises or earlier research ›</summary><div>${later.map(n => n.html).join('')}</div></details>` : ''}</div>`;
      }).join('');
  } else if (coTab === 'guide') {
    const owned = TECH.filter(t => S.unlocks[t.key] && LESSONS[t.key]);
    body = `<p>Everything the game has taught you, any time you need it.</p>
      <div class="branch"><div class="eyebrow">The basics</div>${BASICS.map(([k, t]) => `<button class="lessonrow" type="button" data-lesson="${k}"><b>${t}</b><span>›</span></button>`).join('')}</div>
      <div class="branch"><div class="eyebrow">Paradox journal</div>${(() => { const j = journal(S); return j.length ? j.map(e => `<div class="node owned"><div><b>${e.title}</b><p>${e.text}<br><span class="opens">${e.tech}, mastered</span></p></div></div>`).join('') : '<p class="note">Master a piece of research (sign off the job a client calls you with about it) and what it taught you is kept here.</p>'; })()}</div>
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
      }).join('') +
      // yards: a street you buy into (the Docks), once you've earned it
      STREETS.filter(st => (STREET_GATES[st.key] || {}).buy).map(st => {
        const g = STREET_GATES[st.key], have = (S.yards || {})[st.key] != null || streetOpen(S, st.key), can = yardToBuy(S) && yardToBuy(S).key === st.key;
        const btn = have ? '<span class="pill done">Yours</span>' : can ? `<div style="display:grid;gap:4px;justify-items:end"><button class="go" type="button" data-yard="${st.key}" ${broke || S.cash < g.buy ? 'disabled' : ''}>Buy · ${kmoney(g.buy)}</button>${S.cash < g.buy ? `<span class="why">Need ${kmoney(g.buy - S.cash)} more</span>` : ''}</div>` : '<span class="pill lock">Not yet</span>';
        return `<div class="node ${have ? 'owned' : can ? 'avail' : 'locked'}"><div><b>${g.yard.charAt(0).toUpperCase() + g.yard.slice(1)} · ${money(g.rent)}/mo rent</b><p>${g.text}${have ? '' : ' ' + gateText(S, st.key)}</p></div>${btn}</div>`;
      }).join('');
  }
  sheet(`<div class="eyebrow">Company</div><h3>${P.name}</h3>
    <div class="facts"><div class="fact"><span>Cash</span><b class="${broke ? 'neg' : ''}">${kmoney(S.cash)}</b></div><div class="fact"><span>In / month</span><b>${kmoney(monthlyIncome(S))}</b></div><div class="fact"><span>Out / month</span><b>${kmoney(overheads(S) + researchOut(S))}</b></div></div>
    ${broke ? '<p class="note"><span class="hot">You\'re overdrawn.</span> Paid research waits, and you can\'t hire or move until you\'re back in the black.</p>' : ''}
    ${tabs}${body}
    <button class="ghost" type="button" id="coClose">Back to the street</button>`);
  const sh = $('sheet');
  sh.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { const top = sh.scrollTop; openCompany(b.dataset.tab); sh.scrollTop = 0; });
  sh.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const t = techOrStudy(b.dataset.k), how = startResearch(S, t.key);
    if (!how) return;
    save(); renderStreet(); keepScroll(() => openCompany());
    toast(how === 'queued' ? `${t.name} queued: it starts when a bench comes free` : `Started ${t.name} · ready in ${t.months} month${t.months > 1 ? 's' : ''}`);
  });
  if ($('coAd')) $('coAd').onclick = () => {
    const got = advertise(S);
    if (!got) { toast('Nobody to reach yet: fit a few clients first', true); return; }
    save(); renderStreet(); keepScroll(() => openCompany());
    toast(got.kind === 'enquiry' ? `${got.p.name} answered your advert: they want ${techName(got.p.enquiry.tech)}` : `${got.p.name} answered your advert: they want more`);
  };
  sh.querySelectorAll('[data-unq]').forEach(b => b.onclick = () => { unqueue(S, b.dataset.unq); save(); keepScroll(() => openCompany()); });
  sh.querySelectorAll('[data-hire]').forEach(b => b.onclick = () => { hire(S, b.dataset.hire); save(); renderStreet(); keepScroll(() => openCompany()); toast(`${STAFF.find(s => s.key === b.dataset.hire).name} hired`); });
  sh.querySelectorAll('[data-fire]').forEach(b => b.onclick = () => { fire(S, b.dataset.fire); save(); renderStreet(); keepScroll(() => openCompany()); });
  sh.querySelectorAll('[data-yard]').forEach(b => b.onclick = () => { if (buyYard(S, b.dataset.yard)) { save(); renderStreet(); openCompany('premises'); } });
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
      ${footfallLine(S, p) ? `<li class="${footfallOf(S, p) > 1 ? 'pass' : ''}"><span>${footfallLine(S, p)}</span><span>${footfallOf(S, p) > 1 ? '+' : '−'}${Math.round(Math.abs(footfallOf(S, p) - 1) * 50)}% fee</span></li>` : ''}
      <li class="${p.green ? 'pass' : ''}"><span>Green star · lobby kept snug</span><span>${p.green ? '+15% fee' : 'no'}</span></li>
      <li class="${p.cert ? 'pass' : ''}"><span>Inspection certificate</span><span>${p.cert ? '+10% fee' : 'not yet'}</span></li>
    </ul>
    <div style="display:flex;gap:8px"><button class="ghost" type="button" id="clClose" style="flex:1">Close</button><button class="go" type="button" id="clServ" ${!wear && !p.broken ? 'disabled' : ''} ${S.cash < cost ? 'disabled' : ''}>Service · ${kmoney(cost)}</button></div>`);
  $('clClose').onclick = closeSheet;
  $('clServ').onclick = () => { if (!service(S, p)) return; save(); renderStreet(); closeSheet(); toast(`${p.name} serviced · good as new`); };
}
// The surveyor's out: while the player reads the month report, the new month's tenders and callbacks are being
// surveyed (they start as the street redraws). Show each one's progress, so the wait between months is visible
// and mostly over by the time the player is back on the street. Unfinished ones carry on in the background.
const surveying = () => S.plots.filter(p => (p.status === 'open' || p.status === 'callback' || p.status === 'checking') && p.contract && !p.contract.solved);
function surveyorPanel(list) {
  if (!list.length) return '';
  return `<div class="surveyor" id="svPanel"><div class="eyebrow" id="svHead">The surveyor is out · ${list.length} job${list.length > 1 ? 's' : ''} to look at</div>
    ${list.map(p => `<div class="svrow"><span>${p.name}${p.status === 'checking' ? ' · checking your doors' : ''}</span><span class="svst" id="svs${p.i}">surveying</span><div class="progress"><i id="svb${p.i}"></i></div></div>`).join('')}</div>`;
}
function wireSurveyor(list) {
  let left = list.length;
  const head = () => { const h = $('svHead'); if (h) h.textContent = left ? `The surveyor is out · ${left} still to look at` : 'The surveyor is back · everything is ready on the street'; };
  for (const p of list) {
    const entry = surveys.get(p.contract.seed), was = p.status;
    const bar = f => { const el = $('svb' + p.i); if (el) el.style.width = Math.round(f * 100) + '%'; };
    if (entry) { bar(entry.progress); entry.listeners.add(bar); }
    survey(p).then(() => {
      if (entry) entry.listeners.delete(bar);
      left--;
      const st = $('svs' + p.i), el = $('svb' + p.i);
      if (el) el.style.width = '100%';
      if (was === 'checking') townDayOutcome(p.i, p.status === 'fitted');
      if (st) st.textContent = p.status === 'fitted' ? (was === 'checking' ? 'they coped: no job' : 'false alarm: no job') : was === 'checking' ? 'calling you back' : 'ready';
      head();
    });
  }
}

// DOM wiring, called once at boot
export function initSheets() {
  $('rdBtn').onclick = guarded(() => openCompany());
  $('monthBtn').onclick = guarded(() => {
  // research never stops: a free bench has to be given a project (or a market study) first
  if (!benchesFilled(S)) { openCompany('research'); toast('A bench is free: choose research, or run a market study', true); return; }
  const rpt = endMonth(S);
  const { research, lessonTenders, moved, moving, inc, rent, yards, premName, ins, wages, claims, broke, insp, done, walked, winter, calls, lost, evNow, net, paradox, changes, enquiry, footfall, booked } = rpt;
  save();
  renderStreet();   // starts surveying the month's new work in the background
  const surveyingNow = surveying();
  const lead = leadline(S, rpt), jobsIn = booked.filter(b => b.kind === 'job').reduce((a, b) => a + b.amount, 0);
  const moneyIn = jobsIn + inc, moneyOut = moneyIn - net;
  // the news, as short articles: a kicker in bold, then the story
  const art = (kick, body, cls = '') => `<article class="${cls}"><p><b>${kick}</b> ${body}</p></article>`;
  const news = [
    insp ? art(`Inspection at ${insp.p.name}.`, insp.pass ? 'Passed. They get a certificate of compliance, and pay you 10% more maintenance.' : !insp.access ? 'Failed: there is no step-free way in. You have a callback to fix it.' : `Failed on safety: ${insp.bumps} people clipped, the limit is ${insp.limit}. You have a callback to fix it.`, insp.pass ? '' : 'bad') : '',
    lost.length ? art(`${RIVAL} won ${lost.map(p => p.name).join(' and ')}.`, 'Tenders you leave sitting are fair game. Their work rarely lasts: expect the client back.', 'bad') : '',
    broke.length ? art('Broken down.', `${broke.map(p => p.name).join(', ')}. No maintenance fee until you send someone. Tap the building on the street to service it.`, 'bad') : '',
    moved ? art(`Into the ${moved.toLowerCase()}.`, 'Research picks up again this month.') : moving ? art('On the move.', movingText(S)) : '',
    done.length ? art('Research complete.', `${done.map(techName).join(', ')}.${done.some(k => TECH.find(t => t.key === k).opens) ? ' New specialist tenders may appear.' : ''}`) + `<div class="learn">${done.filter(k => LESSONS[k]).map(k => `<button class="ghost small" type="button" data-lesson="${k}">How to use ${techName(k)}</button>`).join('')}</div>` : '',
    research.paused.length ? art('Research waiting.', `You were overdrawn, so ${research.paused.map(techName).join(', ')} waits (keeping its progress) and the bench ran a market study instead.`, 'bad') : '',
    ...research.studies.map(x => x.kind === 'enquiry' ? '' : x.kind === 'more' ? art('Market study.', `${x.p.name} want more: a bigger, busier entrance. They keep paying while you quote.`) : art('Market study.', 'Nothing new this month. Fit more clients and studies find more work.')),
    ...lessonTenders.map(p => art(`${p.name} have heard about your ${techName(p.callTech)}.`, `${p.callText} Sign it off to master it.`)),
    walked.length ? art('Staff walk out.', `Over unpaid wages: ${walked.join(', ')}.`, 'bad') : S.cash < 0 ? art('Overdrawn.', 'Win jobs or let staff go. Below −£15k your crew will walk out.', 'bad') : '',
    ...paradox.map(p => art(`${p.name} call about your research.`, `${p.callText} They keep paying while you quote.${p.enquiry && p.enquiry.ready ? ` They waited for you: ${kmoney(p.enquiry.bonus)} bonus on sign-off.` : ''}`)),
    ...enquiry.lapsed.map(x => art(`${x.p.name} stopped waiting`, `for ${techName(x.tech)}. ${x.rival ? `They've gone to ${RIVAL}. Expect them back when it goes wrong.` : 'They\'re a little less loyal for it.'}`, 'bad')),
    enquiry.fresh ? (() => { const p = enquiry.fresh, e = p.enquiry, t = TECH.find(x => x.key === e.tech); return art(`Enquiry from ${p.name}.`, `${e.text} They need ${t.name} within ${e.by - S.month} months (${t.months} to research, ${kmoney(t.price)}). Have it ready and the job is yours, with a ${kmoney(e.bonus)} bonus.`) + '<div class="learn"><button class="ghost small" type="button" data-co="research">Open research</button></div>'; })() : '',
    ...changes.map(ch => art(`${CHANGE[ch.key].label}.`, `${changeText(ch, changeWhere(S, ch))} ${ch.checked.length ? `The surveyor is checking how your doors cope at ${ch.checked.map(p => p.name).join(', ')}. Only those that fall short will call.` : 'None of your clients is affected.'}`)),
    (() => { const t = footfallReport(S, footfall); return t ? art('Around town.', t) : ''; })(),
    (() => { if (hasWork(S)) return calls.length ? '' : art('All quiet.', inc ? 'Every fitted client is happy.' : 'Win a tender to start earning maintenance fees.'); if (enquiry.fresh) return ''; const a = advice(S); return art('Nothing on the table.', a ? a.text : 'Every fitted client is happy.') + (a && a.tab ? `<div class="learn"><button class="ghost small" type="button" data-co="${a.tab}">Open ${a.tab}</button></div>` : ''); })(),
    evNow ? art(`${evNow.label} this month.`, `${evNow.text} Tenders pay 25% more margin.`) : '',
  ].filter(Boolean);
  const ahead = [
    (() => { const nx = eventOf(S.month + 1); return nx ? `<li>Next month: ${nx.label}.</li>` : ''; })(),
    (() => { const nx = (S.changes || []).find(x => x.month > S.month); return nx ? `<li>${MONTHS[nx.month % 12]}: ${CHANGE[nx.key].label.toLowerCase()}, ${changeWhere(S, nx)}.</li>` : ''; })(),
    winter ? '<li>Winter: colder tenders.</li>' : '',
  ].filter(Boolean);
  sheet(`<div class="herald">
    <header class="mast"><h2>The ${S.marketOpen ? 'Town' : 'High Street'} Herald</h2><div class="dateline"><span>${MONTHS[S.month % 12]} ${S.year}</span><span>Price 10p</span></div></header>
    <section class="lead"><h3>${lead.head}</h3>${lead.text ? `<p class="stand">${lead.text}</p>` : ''}</section>
    <figure class="townday"><canvas id="tdCanvas" aria-label="A day on the street, sped up"></canvas><figcaption>A day on the street, as the surveyor saw it. <button class="ghost small" type="button" id="tdAgain">Watch again</button></figcaption></figure>
    <div class="cols">
      <section class="books"><h4>Your books</h4>
        <div class="big ${net >= 0 ? 'up' : 'down'}">${net >= 0 ? 'Up ' + money(net) : 'Down ' + money(-net)}</div>
        <div class="totals"><div><span>In</span><b>${money(moneyIn)}</b></div><div><span>Out</span><b>${money(moneyOut)}</b></div><div><span>Cash now</span><b class="${S.cash < 0 ? 'neg' : ''}">${money(S.cash)}</b></div></div>
        <details><summary>Every line</summary><ul class="list">
          ${booked.filter(b => b.kind === 'job').map(b => `<li class="pass"><span>Job signed off · ${b.label}</span><span>${b.amount < 0 ? '−' : '+'}${money(Math.abs(b.amount))}</span></li>`).join('')}
          <li class="pass"><span>Maintenance fees</span><span>+${money(inc)}</span></li>
          ${booked.filter(b => b.kind === 'spend').map(b => `<li><span>${b.label}</span><span>−${money(-b.amount)}</span></li>`).join('')}
          <li><span>Rent · ${premName.toLowerCase()}</span><span>−${money(rent)}</span></li>
          ${yards ? `<li><span>Yard rent</span><span>−${money(yards)}</span></li>` : ''}
          ${wages.map(s => `<li><span>${s.name}</span><span>−${money(s.wage)}</span></li>`).join('')}
          ${research.cost ? `<li><span>Research</span><span>−${money(research.cost)}</span></li>` : ''}
          ${ins ? `<li><span>Insurance${ins > 60 ? ' · loaded for bumps on your record' : ''}</span><span>−${money(ins)}</span></li>` : ''}
          ${claims.map(p => `<li class="fail"><span>Claim: someone clipped at ${p.name}</span><span>−${money(CLAIM_EXCESS)}</span></li>`).join('')}
          ${insp && !insp.pass ? `<li class="fail"><span>Inspection fine · ${insp.p.name}</span><span>−${money(INSPECTION_FINE)}</span></li>` : ''}
        </ul></details>
      </section>
      ${surveyorPanel(surveyingNow)}
      ${news.length ? `<section class="news"><h4>News</h4>${news.join('')}</section>` : ''}
      ${ahead.length ? `<section class="ahead"><h4>Coming up</h4><ul>${ahead.join('')}</ul></section>` : ''}
    </div>
  </div>
  <button class="go" type="button" id="mClose">Back to the street</button>`);
  $('mClose').onclick = closeSheet;
  playTownDay($('tdCanvas'), townDay(S, rpt));
  wireSurveyor(surveyingNow);
  const monthHTML = $('sheet').innerHTML;
  const rewire = () => { $('mClose').onclick = closeSheet; $('tdAgain').onclick = () => replayTownDay($('tdCanvas')); $('sheet').querySelectorAll('[data-co]').forEach(b => b.onclick = () => openCompany(b.dataset.co)); $('sheet').querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => openLesson(b.dataset.lesson, () => { $('sheet').innerHTML = monthHTML; $('mClose').onclick = closeSheet; rewire(); replayTownDay($('tdCanvas')); })); };
  rewire();
});
}
