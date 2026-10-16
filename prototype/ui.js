(() => {
const $ = id => document.getElementById(id);
const money = n => (n < 0 ? '−£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const kmoney = n => Math.abs(n) >= 10000 ? (n < 0 ? '−£' : '£') + (Math.abs(n) / 1000).toFixed(Math.abs(n) % 1000 ? 1 : 0) + 'k' : money(n);
const TYPE_LABEL = { wall: 'Wall', revolve: 'Revolving', swing: 'Swing', slider: 'Sliding', gates: 'Gates' };

const PLOTS = [
  { name: 'Lark Café', kind: 'cafe', rep: 0 },
  { name: 'Corner Pharmacy', kind: 'pharmacy', rep: 0 },
  { name: 'Mercer & Sons Bank', kind: 'bank', rep: 2, needs: 'mouth', why: 'Their corner is a wind tunnel' },
  { name: 'Atlas House', kind: 'office', rep: 4 },
  { name: 'The Wren Hotel', kind: 'hotel', rep: 6 },
  { name: 'Carnegie Library', kind: 'library', rep: 8 },
  { name: "Halden's", kind: 'store', rep: 11 },
  { name: 'Town Hall', kind: 'townhall', rep: 14 },
  // the first landmark: a combination lock of research from two branches
  { name: 'Station Quarter', kind: 'station', rep: 16, needs: ['gates', 'tidal', 'doorman'], why: 'The station only talks to firms that can run a gate line' },
  // Market Square, the second street: opens at 18★
  { name: 'Corn Exchange Museum', kind: 'museum', rep: 18, street: 'market' },
  { name: 'The Roxy', kind: 'cinema', rep: 18, street: 'market' },
  { name: 'Ironworks Gym', kind: 'gym', rep: 19, street: 'market' },
  { name: 'Market Health Centre', kind: 'clinic', rep: 20, street: 'market' },
  { name: 'Office Towers', kind: 'towers', rep: 24, street: 'market', needs: ['vestibule', 'wide', 'heat2'], why: 'The towers only talk to firms that can beat the stack effect' },
];
const STREETS = [{ key: 'high', name: 'High Street', rep: 0 }, { key: 'market', name: 'Market Square', rep: 18 }];
const streetOf = p => (PLOTS[p.i] || {}).street || 'high';
const streetOpen = k => rep() >= (STREETS.find(x => x.key === k) || {}).rep;
// a rival firm starts bidding once the town is big enough to share
const RIVAL = 'Brassworks Ltd';
const rivalActive = () => streetOpen('market');
// what Brassworks leaves behind: cheap swing doors in every bay, both ways
const rivalInstall = p => Array.from({ length: KINDS[p.kind].slots }, (_, i) => i % 2 === 0 ? { type: 'swing', curtain: false, flow: 'both' } : { type: 'wall' });
// ---------- company: research, staff, premises ----------
const BRANCHES = [['rev', 'Revolving doors'], ['open', 'Open doors'], ['crowd', 'Crowd science'], ['bld', 'Building & staff']];
const TECH = [
  { key: 'core', branch: 'rev', tier: 1, price: 6000, months: 1, name: 'Big-core drums', text: 'Unlocks the Core setting. The floor near the centre barely moves (v = ω·r), so people dawdle there and go round again. A bigger centre post keeps them out at the fast edge. Cores of 30% or more cost +£2k per door.' },
  { key: 'mouth', branch: 'rev', tier: 1, price: 5000, months: 1, name: 'Mouth adjusters', text: 'Unlocks the Mouth setting: move the curved walls in to keep wind out, or out to let people in faster.', opens: 'Windy-corner jobs, including Mercer & Sons Bank' },
  { key: 'padded', branch: 'rev', tier: 1, price: 6000, months: 1, name: 'Padded wing edges', text: 'Soft wing edges. People shrug off impacts 0.3 m/s faster. +£1.5k per door.' },
  { key: 'seals', branch: 'rev', tier: 1, price: 9000, months: 2, req: ['mouth'], name: 'Brush seals', text: 'Seal the drum against wind. On windy corners you can keep wide mouths without the gale getting in.' },
  { key: 'sensor', branch: 'rev', tier: 2, price: 22000, months: 3, req: ['padded'], name: 'Presence sensors', text: 'The door slows itself to a safe speed whenever an older guest is inside, then speeds back up. +£2k per door.' },
  { key: 'wide', branch: 'rev', tier: 3, price: 60000, months: 5, req: ['sensor'], name: 'Wide-drum revolving', text: 'A bigger drum. With 3 wings or fewer, wheelchair users can ride it. +£8k per door.', opens: 'Step-free jobs in the cold or on windy corners' },
  { key: 'curtain', branch: 'open', tier: 1, price: 8000, months: 1, name: 'Air curtains', text: 'A sheet of warm air across swing and sliding doors. Cuts their heat loss by 70%. +£3.5k per door.' },
  { key: 'vestibule', branch: 'open', tier: 2, price: 28000, months: 3, req: ['curtain'], name: 'Draught lobbies', text: 'A second set of doors behind the first. Cuts heat loss by almost 90% but slows people a little. +£5k per door.', opens: 'Cheap jobs and step-free jobs in the cold' },
  { key: 'heat', branch: 'bld', tier: 1, price: 12000, months: 2, name: 'Heat recovery', text: 'Lobbies you fit reheat 60% faster after a draft.' },
  { key: 'doorman', branch: 'bld', tier: 2, price: 20000, months: 3, name: 'Door staff training', text: 'Lets you hire a doorman crew. A doorman gets riders out on time, so fewer go round again, and holds swing doors so they don\'t clip anyone.' },
  { key: 'heat2', branch: 'bld', tier: 3, price: 45000, months: 4, req: ['heat'], name: 'Heat pumps', text: 'Lobbies reheat 2.4× faster than standard.' },
  { key: 'supplier', branch: 'bld', tier: 3, price: 70000, months: 4, name: 'Supplier contract', text: 'Bulk deal with a door manufacturer. All hardware costs you 8% less.' },
  { key: 'barriers', branch: 'crowd', tier: 1, price: 10000, months: 2, name: 'Queue barriers', text: 'Posts and tape through the middle of a swing or sliding door: in on one side, out on the other. Nobody gets a door swung into them, but each lane is half as wide. +£800 per door.' },
  { key: 'gates', branch: 'crowd', tier: 2, price: 22000, months: 3, req: ['barriers'], name: 'Ticket gates', text: 'Gate lines for stations: lanes with paddles, one person at a time, a second or so to tap through. Wide-aisle gates take wheelchairs, prams and bikes.', opens: 'Station Quarter, with Tidal-flow gates and Door staff training' },
  { key: 'tidal', branch: 'crowd', tier: 3, price: 35000, months: 3, req: ['gates'], name: 'Tidal-flow gates', text: 'Gate lanes set to Auto turn to face whichever way the queue is heavier: in for the morning rush, out when a train empties. +£2.5k per bay.', opens: 'Station Quarter, with Ticket gates and Door staff training' },
  { key: 'pillars', branch: 'crowd', tier: 2, price: 18000, months: 2, req: ['barriers'], name: 'Pillars', text: 'A slim column just inside an exit. In a crush it takes the push of the crowd behind, so the doorway jams less and big crowds get out faster. +£1.5k per door.', opens: 'Fire-drill jobs' },
];
const PREMISES = [
  { name: 'Lock-up garage', rent: 500, tier: 1, labs: 1, staff: 1, text: 'One bench, one project at a time.' },
  { name: 'Workshop', price: 25000, rep: 6, rent: 1500, tier: 2, labs: 1, staff: 3, text: 'Room for a crew and tier 2 research.' },
  { name: 'Headquarters', price: 60000, rep: 14, rent: 3500, tier: 3, labs: 2, staff: 4, fee: 0.2, text: 'Two research projects at once, tier 3 research, and the name adds 20% to your margins.' },
];
const STAFF = [
  { key: 'fitter', name: 'Fitting crew', wage: 1500, text: 'Your own fitters. Hardware costs you 10% less.' },
  { key: 'doorman', name: 'Doorman crew', wage: 1200, req: 'doorman', text: 'Station a doorman at any door you fit, at no hardware cost.' },
  { key: 'engineer', name: 'Service engineer', wage: 1800, text: 'Sells servicing plans. Every fitted building pays 40% more maintenance.' },
  { key: 'sales', name: 'Sales manager', wage: 2200, text: 'Negotiates harder. Your margin on every job is 30% bigger.' },
];
const prem = () => PREMISES[S.premises || 0];
const tech = () => ({ ...S.unlocks, doorman: !!(S.unlocks.doorman && S.staff.doorman) });
const costMult = () => (S.staff.fitter ? 0.9 : 1) * (S.unlocks.supplier ? 0.92 : 1);
const feeMult = () => (1 + (S.staff.sales ? 0.3 : 0) + (prem().fee || 0));
const charge = c => Math.round(c * costMult() / 50) * 50;            // what hardware actually costs you
const feeOf = c => c.par.cost + Math.round((c.margin != null ? c.margin : c.fee - c.par.cost) * feeMult() / 500) * 500;   // bonuses scale your margin
const overheads = () => prem().rent + STAFF.reduce((a, s) => a + (S.staff[s.key] ? s.wage : 0), 0) + insurance();
const techName = k => (TECH.find(t => t.key === k) || {}).name || k;
const CALLBACKS = {
  cold: 'A cold snap has the lobby freezing',
  hot: 'The heatwave has the lobby sweltering',
  busier: 'Footfall is up and the queue spills down the street',
  older: 'A new clinic upstairs brings an older crowd',
  botched: `${RIVAL} fitted cheap swing doors and the client regrets it`,
  safety: 'An inspector failed the entrance on safety: too many people clipped',
  access: 'An inspector failed the entrance: no step-free way in',
};

// ---------- persistent state ----------
const KEY = 'doorduty-tycoon-v2';
function fresh() {
  return { upg: 1, cash: 20000, month: 9, year: 2026, jobs: 0, unlocks: {}, log: [], recent: [], premises: 0, research: [], staff: {},
    plots: PLOTS.map((p, i) => ({ ...p, i, status: 'locked', contract: null, install: null, stars: 0, fee: 0, tier: 0 })) };
}
let S;
try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
if (!S || !S.plots) S = fresh();
// saves from before the company screen existed
S.premises = S.premises || 0; S.research = S.research || []; S.staff = S.staff || {}; S.unlocks = S.unlocks || {};
// saves from before core and mouth were research: keep the settings those firms already used
if (!S.upg) { if (S.jobs > 0) { S.unlocks.core = true; S.unlocks.mouth = true; } S.upg = 1; }
// research a client insists on before it will take bids (a landmark needs several at once)
const plotNeeds = p => { const n = (PLOTS[p.i] || {}).needs; return n ? [].concat(n) : []; };
const missingNeeds = p => plotNeeds(p).filter(k => !S.unlocks[k]);
const needsMet = p => missingNeeds(p).length === 0;
const needsText = p => missingNeeds(p).map(techName).join(', ');
// saves from before a building was added to the street
for (let i = S.plots.length; i < PLOTS.length; i++) S.plots.push({ ...PLOTS[i], i, status: 'locked', contract: null, install: null, stars: 0, fee: 0, tier: 0 });
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const rep = () => S.plots.reduce((a, p) => a + p.stars, 0);
function refreshPlots() {
  const r = rep();
  if (!S.marketOpen && streetOpen('market')) { S.marketOpen = true; setTimeout(() => toast('Market Square is open: five new clients, and a rival firm'), 600); }
  for (const p of S.plots) {
    if (p.status === 'locked' && r >= p.rep && needsMet(p)) p.status = 'open';
    if (p.status === 'rival' && S.month >= (p.rivalUntil || 0)) { p.status = 'callback'; p.reason = 'botched'; p.install = rivalInstall(p); p.contract = null; }
    if ((p.status === 'open' || p.status === 'callback') && !p.contract) {
      const tier = Math.min(7, Math.floor(S.jobs / 3) + p.tier);
      const opts = p.status === 'callback' ? { callback: p.reason, existing: p.install } : (p.stars === 0 ? { first: true } : {});
      const ev = eventOf(S.month);
      p.contract = makeContract(p.kind, tier, S.month, 1 + Math.floor(Math.random() * 1e6), { ...opts, tech: tech(), event: ev && !opts.first ? ev.key : null });
    }
  }
}

// ---------- solver worker ----------
let worker = null, jobId = 0; const pending = new Map();
try {
  const src = $('core').textContent + `
self.onmessage = async (e) => {
  if (e.data.focus !== undefined) { GATE.focus = e.data.focus; return; }
  const { id, contract, unlocks, recent } = e.data;
  try {
    const solved = await generateSolved(contract, unlocks, recent, (f, attempt) => self.postMessage({ id, progress: f, attempt }));
    self.postMessage({ id, done: true, contract: solved });
  } catch (err) { self.postMessage({ id, done: true, failed: true }); }
};`;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  worker.onmessage = e => { const j = pending.get(e.data.id); if (!j) return; if (e.data.done) { pending.delete(e.data.id); j.resolve(e.data.failed ? null : e.data.contract); } else j.progress(e.data.progress, e.data.attempt); };
  worker.onerror = () => { worker = null; };
} catch (e) { worker = null; }
// the brief the player is waiting on gets surveyed first
function focusSurvey(seed) { GATE.focus = seed; if (worker) worker.postMessage({ focus: seed }); }
function solve(contract, onProgress) {
  if (worker) return new Promise(resolve => { const id = ++jobId; pending.set(id, { resolve, progress: onProgress }); worker.postMessage({ id, contract, unlocks: tech(), recent: S.recent || [] }); });
  return generateSolved(contract, tech(), S.recent || [], onProgress).catch(() => null);
}
// surveys run in the background as soon as a tender appears, so briefs usually open instantly
const surveys = new Map();
function survey(p) {
  if (p.contract.solved) return Promise.resolve(p.contract);
  const seed = p.contract.seed;
  if (surveys.has(seed)) return surveys.get(seed).promise;
  const entry = { progress: 0, listeners: new Set() };
  entry.promise = solve(p.contract, (f, a) => { entry.progress = f; entry.attempt = a || 0; entry.listeners.forEach(l => l(f, a || 0)); }).then(sc => {
    surveys.delete(seed);
    if (!sc) {
      // the survey couldn't produce a fair job: draw a fresh tender for this building and survey that
      if (p.contract && p.contract.seed === seed) { p.contract = null; refreshPlots(); save(); }
      return p.contract ? survey(p) : null;
    }
    if (p.contract && p.contract.seed === seed) {
      if (p.status === 'callback' && sc.existing && sc.par.cost === 0) {
        // the doors you fitted already cope: no job, and the maintenance fee resumes
        p.status = 'fitted'; p.contract = null; p.reason = null; save();
        toast(`${p.name}: false alarm. Your doors coped.`);
        if (!W && $('sheetWrap').hidden) renderStreet();
        return null;
      }
      p.contract = sc; save(); if (!W && $('sheetWrap').hidden) renderStreet();
    }
    return sc;
  });
  surveys.set(seed, entry);
  return entry.promise;
}
const twistLabel = t => (TWISTS[t] ? TWISTS[t].label : t);

// ---------- street ----------
function frontHTML(slots, n) {
  const cls = { revolve: 'r', swing: 's', slider: 'l', gates: 'g', wall: '' };
  const count = slots ? slots.length : n;
  return `<div class="front" aria-hidden="true">${Array.from({ length: count }, (_, i) => `<i class="${slots && slots[i] ? cls[slots[i].type] : 'empty'}"></i>`).join('')}</div>`;
}
function renderStreet() {
  refreshPlots();
  $('sCash').textContent = kmoney(S.cash);
  $('sRep').textContent = rep() + '★';
  $('sMonth').textContent = `${MONTHS[S.month % 12]} ${String(S.year).slice(2)}`;
  const inc = monthlyIncome();
  $('incomeLine').textContent = inc ? `${money(inc)} a month in maintenance` : S.plots.some(p => p.status === 'fitted') ? 'No maintenance coming in' : 'No contracts fitted yet';
  $('cal').innerHTML = [0, 1, 2].map(k => {
    const m = S.month + k, ev = eventOf(m);
    return `<div class="calm${k === 0 ? ' now' : ''}${ev ? ' ev' : ''}"><span>${k === 0 ? 'Now · ' : ''}${MONTHS[m % 12]}</span><b>${ev ? ev.label : 'Quiet month'}</b></div>`;
  }).join('');
  const tabs = $('streetTabs');
  tabs.hidden = !S.marketOpen;
  tabs.innerHTML = STREETS.map(st => `<button type="button" data-st="${st.key}" aria-pressed="${(S.street || 'high') === st.key}" ${streetOpen(st.key) ? '' : 'disabled'}>${st.name}${streetOpen(st.key) ? '' : ` · ${st.rep}★`}</button>`).join('');
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
      if (p.status === 'fitted') return openClient(p.i);
      if (p.status === 'rival') return toast(`${RIVAL} fitted ${p.name}. The client will be back.`);
      toast(rep() >= p.rep && !needsMet(p) ? `${p.name}: research ${needsText(p)} first` : `${p.name} wants ${p.rep}★ reputation`);
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
    if (p.status === 'locked' && rep() >= p.rep && !needsMet(p)) { pill = `<span class="pill lock">Research</span>`; line = `${PLOTS[p.i].why}. Research ${needsText(p)} in Company to quote`; }
    else if (p.status === 'locked') { pill = `<span class="pill lock">${p.rep}★ rep</span>`; line = 'Will only talk to firms with a reputation'; }
    else if (p.status === 'open') { pill = `<span class="pill open">Tender</span>`; const tw = [p.contract.event ? (eventOf(S.month) || {}).label : null, ...p.contract.twists.map(twistLabel)].filter(Boolean).join(' · ') || 'Standard job'; line = p.contract.solved ? `${p.contract.specialist ? '<b style="color:var(--brass)">Specialist</b> · ' : ''}Fee <b>${money(feeOf(p.contract))}</b> · ${tw}${rivalActive() && !p.contract.first && !p.contract.landmark ? ` · <span style="color:var(--warn)">${RIVAL} is bidding</span>` : ''}` : `${tw} · <i>surveying…</i>`; }
    else if (p.status === 'callback') { pill = `<span class="pill call">${p.reason === 'botched' ? 'Rescue' : 'Callback'}</span>`; line = `${CALLBACKS[p.reason] || 'Something has changed'}. No maintenance fee until fixed.`; }
    else if (p.status === 'rival') { pill = `<span class="pill lock">${RIVAL}</span>`; line = `Fitted by the rival firm · back in ${Math.max(1, (p.rivalUntil || 0) - S.month)} mo`; }
    else { pill = `<span class="pill done">${'★'.repeat(p.stars)}</span>`; line = p.broken ? '<span style="color:var(--warn)">Broken down</span> · tap to service' : `Fitted · <b>${money(upkeep(p))}</b>/month${(p.wear || 0) >= 0.5 ? ` · wear ${Math.round(p.wear * 100)}%` : ''}${p.green ? ' · 🌿' : ''}${p.cert ? ' · certified' : ''}`; }
    const where = streetOf(p) === 'market' ? ' · Market Square' : '';
    return `<button class="plot${p.status === 'locked' || p.status === 'rival' ? ' locked' : ''}" type="button" data-i="${p.i}" ${p.status === 'locked' || p.status === 'rival' ? 'disabled' : ''}>
      ${frontHTML(p.status === 'rival' ? rivalInstall(p) : p.install, p.contract ? p.contract.slots : k.slots)}
      <span><span class="name">${p.name}</span> <span class="kind">· ${k.label}${where}</span><span class="stline" style="display:block">${line}</span></span>
      ${pill}</button>`;
  };
  const fitted = S.plots.filter(p => p.status === 'fitted' || p.status === 'rival');
  const later = S.plots.filter(p => p.status === 'locked' && (streetOf(p) === 'high' || streetOpen('market') || p.rep <= rep() + 4));
  $('streetHead').textContent = live.length ? `On the table · ${live.length}` : 'Nothing on the table this month';
  $('street').innerHTML = live.map(row).join('');
  $('ledgerRest').innerHTML = (fitted.length ? `<div class="eyebrow ledhead">Your clients · ${fitted.filter(p => p.status === 'fitted').length}</div>${fitted.map(row).join('')}` : '')
    + (later.length ? `<div class="eyebrow ledhead">Not yet</div>${later.map(row).join('')}` : '');
  $('ledger').querySelectorAll('.plot').forEach(b => b.addEventListener('click', guarded(() => { const p = S.plots[+b.dataset.i]; if (p.status === 'fitted') openClient(p.i); else if (p.status === 'open' || p.status === 'callback') openBrief(p.i); })));
  save();
  for (const p of S.plots) if ((p.status === 'open' || p.status === 'callback') && p.contract && !p.contract.solved) survey(p);
  // walk-through: first the tender, then (after a job) the month and the company
  if (!W && $('sheetWrap').hidden) {
    if (S.jobs === 0) setTimeout(() => coach('tender', () => (S.view || 'street') === 'street' ? document.querySelector('.sbld.open > g:last-of-type') || document.querySelector('.sbld.open') : document.querySelector('#street .plot')), 350);
    else setTimeout(() => coach('month', () => $('monthBtn')), 350);
  }
}
// ---------- the street scene ----------
// A side-on painting of the High Street at dusk. Each client has its own building; your doors appear on its
// ground floor once fitted. The month sets the sky, the trees and the dressing; events leave their mark.
const SC_H = 330, G = 252;                       // scene height, ground line (top of the pavement)
const BLD = {
  cafe:     { w: 150, h: 118, base: '#7a4a3a', trim: '#e8d9bf', sign: 'LARK CAFÉ' },
  pharmacy: { w: 140, h: 138, base: '#2f5a5a', trim: '#cfe3dc', sign: 'PHARMACY' },
  bank:     { w: 186, h: 168, base: '#8d8471', trim: '#ece2c8', sign: 'MERCER & SONS' },
  office:   { w: 190, h: 226, base: '#2c3a4c', trim: '#9cc4ec', sign: 'ATLAS HOUSE' },
  hotel:    { w: 200, h: 196, base: '#5a3646', trim: '#ead6c0', sign: 'THE WREN' },
  library:  { w: 206, h: 160, base: '#a08a62', trim: '#f0e4c4', sign: 'PUBLIC LIBRARY' },
  store:    { w: 250, h: 178, base: '#6b4a32', trim: '#e9c98a', sign: "HALDEN'S" },
  townhall: { w: 214, h: 170, base: '#8a7f6a', trim: '#efe6d0', sign: 'TOWN HALL' },
  station:  { w: 252, h: 150, base: '#3a4250', trim: '#ece6d8', sign: 'STATION' },
  museum:   { w: 224, h: 168, base: '#9a8f78', trim: '#efe6d0', sign: 'CORN EXCHANGE MUSEUM' },
  cinema:   { w: 176, h: 150, base: '#2a1f33', trim: '#f3c56b', sign: 'THE ROXY' },
  gym:      { w: 176, h: 128, base: '#2c3a4c', trim: '#6fcf97', sign: 'IRONWORKS GYM' },
  clinic:   { w: 176, h: 122, base: '#cfc8b8', trim: '#3d5a7a', sign: 'HEALTH CENTRE' },
  towers:   { w: 232, h: 222, base: '#25303e', trim: '#9cc4ec', sign: 'OFFICE TOWERS' },
};
const SKY = {   // dusk palettes: top, horizon, distant rooftops
  winter: ['#151d2b', '#3d4a63', '#232c3b'], spring: ['#2a2742', '#8a6f8f', '#2f2c43'],
  summer: ['#1d2f4f', '#c98b5b', '#2b3048'], autumn: ['#2a1f2a', '#c46f3e', '#33242a'],
  heatwave: ['#3a2430', '#f0a050', '#3f2a2c'], storm: ['#12161d', '#3a4350', '#1a1f27'],
};
function scSeason(m) { m = ((m % 12) + 12) % 12; return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }
const scEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const RND = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// one bay of the ground floor: whatever you fitted there, or the old frontage
function bayArt(s, x, w, state) {
  const y = G - 50, h = 50, o = [];
  if (state === 'locked') {   // shutters down
    o.push(`<rect x="${x + 3}" y="${y + 4}" width="${w - 6}" height="${h - 4}" fill="#3b3f47"/>`);
    for (let k = y + 8; k < G; k += 5) o.push(`<line x1="${x + 3}" y1="${k}" x2="${x + w - 3}" y2="${k}" stroke="#2a2d33" stroke-width="1.5"/>`);
    return o.join('');
  }
  if (!s) {   // not yet fitted: the space you'll fill, marked out
    o.push(`<rect x="${x + 4}" y="${y + 6}" width="${w - 8}" height="${h - 6}" fill="rgba(18,21,27,.55)" stroke="${state === 'callback' ? '#ef5b4c' : '#d4a94f'}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    return o.join('');
  }
  const glass = 'rgba(156,196,236,.28)', lit = 'rgba(243,197,107,.55)';
  if (s.type === 'gates') {
    const k = s.wide ? 2 : 3, lw2 = (w - 8) / k;
    o.push(`<rect x="${x + 3}" y="${y + 6}" width="${w - 6}" height="${h - 6}" fill="rgba(243,197,107,.22)"/>`);
    for (let j = 0; j <= k; j++) o.push(`<rect x="${x + 4 + j * lw2 - 3}" y="${G - 22}" width="6" height="22" rx="1.5" fill="#5a626e"/><rect x="${x + 4 + j * lw2 - 3}" y="${G - 22}" width="6" height="3" fill="${s.flow === 'auto' ? '#d4a94f' : '#6fcf97'}"/>`);
    for (let j = 0; j < k; j++) o.push(`<line x1="${x + 4 + j * lw2 + 4}" y1="${G - 12}" x2="${x + 4 + (j + 1) * lw2 - 4}" y2="${G - 12}" stroke="#d4a94f" stroke-width="2"/>`);
    return o.join('');
  }
  if (s.type === 'wall') {    // a lit shop window
    o.push(`<rect x="${x + 5}" y="${y + 8}" width="${w - 10}" height="${h - 14}" fill="${lit}" stroke="#1d1a17" stroke-width="2"/>`);
    o.push(`<rect x="${x + 5}" y="${G - 6}" width="${w - 10}" height="6" fill="#1d1a17"/>`);
  } else if (s.type === 'revolve') {
    const cx = x + w / 2, rw = Math.min(w - 8, 44);
    o.push(`<path d="M${cx - rw / 2 - 4} ${y + 6} Q${cx} ${y - 6} ${cx + rw / 2 + 4} ${y + 6} Z" fill="#d4a94f"/>`);
    o.push(`<rect x="${cx - rw / 2}" y="${y + 6}" width="${rw}" height="${h - 6}" rx="3" fill="${lit}" stroke="#d4a94f" stroke-width="2"/>`);
    o.push(`<g class="wing" style="transform-origin:${cx}px ${y + 30}px"><line x1="${cx}" y1="${y + 8}" x2="${cx}" y2="${G - 2}" stroke="#d4a94f" stroke-width="1.6"/><line x1="${cx - rw / 4}" y1="${y + 8}" x2="${cx - rw / 4}" y2="${G - 2}" stroke="rgba(212,169,79,.5)" stroke-width="1.2"/><line x1="${cx + rw / 4}" y1="${y + 8}" x2="${cx + rw / 4}" y2="${G - 2}" stroke="rgba(212,169,79,.5)" stroke-width="1.2"/></g>`);
  } else if (s.type === 'swing') {
    const dw = Math.min(w - 10, 38), x0 = x + (w - dw) / 2;
    o.push(`<rect x="${x0}" y="${y + 6}" width="${dw}" height="${h - 6}" fill="#3a2a22" stroke="#1d1a17" stroke-width="2"/>`);
    o.push(`<rect x="${x0 + 3}" y="${y + 10}" width="${dw / 2 - 5}" height="${h - 22}" fill="${lit}"/><rect x="${x0 + dw / 2 + 2}" y="${y + 10}" width="${dw / 2 - 5}" height="${h - 22}" fill="${lit}"/>`);
    o.push(`<line x1="${x0 + dw / 2}" y1="${y + 6}" x2="${x0 + dw / 2}" y2="${G}" stroke="#1d1a17" stroke-width="2"/><line x1="${x0 + dw / 2 - 5}" y1="${y + 30}" x2="${x0 + dw / 2 - 5}" y2="${y + 38}" stroke="#e79a86" stroke-width="2"/><line x1="${x0 + dw / 2 + 5}" y1="${y + 30}" x2="${x0 + dw / 2 + 5}" y2="${y + 38}" stroke="#e79a86" stroke-width="2"/>`);
    if (s.flow && s.flow !== 'both') o.push(`<text x="${x0 + dw / 2}" y="${G - 3}" text-anchor="middle" class="sc-small">${s.flow === 'in' ? 'IN' : 'OUT'}</text>`);
  } else {   // slider
    const dw = Math.min(w - 8, 46), x0 = x + (w - dw) / 2;
    o.push(`<rect x="${x0}" y="${y + 6}" width="${dw}" height="${h - 6}" fill="${glass}" stroke="#9cc4ec" stroke-width="1.6"/>`);
    o.push(`<rect x="${x0 + 2}" y="${y + 8}" width="${dw / 2 - 5}" height="${h - 10}" fill="${lit}" opacity=".7" class="slide-l"/><rect x="${x0 + dw / 2 + 3}" y="${y + 8}" width="${dw / 2 - 5}" height="${h - 10}" fill="${lit}" opacity=".7" class="slide-r"/>`);
  }
  if (s.vestibule) o.push(`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 2}" fill="none" stroke="rgba(236,230,216,.35)" stroke-width="1"/>`);
  return o.join('');
}

function buildingArt(p, x) {
  const b = BLD[p.kind], st = p.status, locked = st === 'locked', fitted = st === 'fitted';
  const { w, h, base, trim } = b, top = G - h, o = [];
  const winLit = fitted ? 'rgba(243,197,107,.8)' : locked ? '#2a2f38' : 'rgba(243,197,107,.35)';
  const win = (wx, wy, ww, wh) => o.push(`<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="${winLit}" stroke="${trim}" stroke-width="1.5"/>`);
  // body
  o.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${base}"/>`);
  o.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#brick)" opacity=".5"/>`);
  o.push(`<rect x="${x - 3}" y="${top - 6}" width="${w + 6}" height="8" fill="${trim}" opacity=".85"/>`);   // cornice
  // kind-specific architecture above the shopfront
  const upTop = top + 14, upBot = G - 72;
  const grid = (cols, rowH, ww, wh) => { for (let yy = upTop; yy + wh <= upBot; yy += rowH) for (let c = 0; c < cols; c++) win(x + (w / cols) * c + (w / cols - ww) / 2, yy, ww, wh); };
  if (p.kind === 'cafe') { grid(3, 34, 22, 24); for (let c = 0; c < 3; c++) o.push(`<rect x="${x + (w / 3) * c + (w / 3 - 26) / 2}" y="${upTop + 25}" width="26" height="5" fill="#4f7a3f"/>`); }
  else if (p.kind === 'pharmacy') { grid(2, 34, 30, 24); o.push(`<g transform="translate(${x + w - 4} ${top + 40})"><rect x="0" y="-2" width="14" height="3" fill="#5a5a5a"/><rect x="10" y="-12" width="22" height="22" rx="3" fill="#1f3a2e"/><path d="M18 -8h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#6fcf97" class="${locked ? '' : 'glow'}" transform="translate(-3 1) scale(.9)"/></g>`); }
  else if (p.kind === 'bank') {
    o.push(`<polygon points="${x - 4},${top - 6} ${x + w / 2},${top - 40} ${x + w + 4},${top - 6}" fill="${trim}"/><polygon points="${x + 14},${top - 10} ${x + w / 2},${top - 32} ${x + w - 14},${top - 10}" fill="${base}"/>`);
    for (let c = 0; c < 5; c++) o.push(`<rect x="${x + 12 + c * (w - 32) / 4}" y="${top + 6}" width="8" height="${upBot - top - 2}" fill="${trim}" opacity=".9"/>`);
    for (let c = 0; c < 4; c++) win(x + 26 + c * (w - 32) / 4, upTop + 10, 18, 40);
  }
  else if (p.kind === 'office') { for (let yy = upTop; yy + 14 <= upBot; yy += 18) for (let c = 0; c < 7; c++) o.push(`<rect x="${x + 8 + c * 25.5}" y="${yy}" width="21" height="14" fill="${fitted ? (RND(c, yy) > 0.35 ? 'rgba(156,196,236,.55)' : 'rgba(243,197,107,.7)') : locked ? '#232a35' : 'rgba(156,196,236,.25)'}"/>`); }
  else if (p.kind === 'hotel') {
    grid(4, 32, 22, 22);
    for (let yy = upTop + 24; yy < upBot; yy += 32) o.push(`<rect x="${x + 6}" y="${yy}" width="${w - 12}" height="3" fill="${trim}" opacity=".6"/>`);
    for (const fx of [x + 16, x + w - 16]) o.push(`<line x1="${fx}" y1="${top - 6}" x2="${fx}" y2="${top - 40}" stroke="#ccc" stroke-width="1.5"/><path d="M${fx} ${top - 40} l18 4 l-18 5z" fill="#d4a94f" class="flag"/>`);
    o.push(`<rect x="${x + w / 2 - 50}" y="${G - 66}" width="100" height="10" fill="#2a1820"/><rect x="${x + w / 2 - 50}" y="${G - 58}" width="2" height="58" fill="#d4a94f"/><rect x="${x + w / 2 + 48}" y="${G - 58}" width="2" height="58" fill="#d4a94f"/>`);
  }
  else if (p.kind === 'library') {
    o.push(`<path d="M${x + w / 2 - 44} ${top - 4} A44 40 0 0 1 ${x + w / 2 + 44} ${top - 4} Z" fill="#6f8a7a"/><rect x="${x + w / 2 - 5}" y="${top - 58}" width="10" height="14" fill="${trim}"/><circle cx="${x + w / 2}" cy="${top - 60}" r="4" fill="#d4a94f"/>`);
    for (let c = 0; c < 5; c++) win(x + 14 + c * (w - 28) / 5 + 4, upTop + 6, 24, 38);
  }
  else if (p.kind === 'store') {
    for (let c = 0; c < 4; c++) win(x + 12 + c * (w - 24) / 4, upTop + 4, (w - 24) / 4 - 10, 40);
    for (let c = 0; c < 4; c++) win(x + 12 + c * (w - 24) / 4, upTop + 54, (w - 24) / 4 - 10, 24);
    o.push(`<circle cx="${x + w / 2}" cy="${top - 14}" r="16" fill="${trim}" stroke="#3a2a1a" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 14}" x2="${x + w / 2}" y2="${top - 25}" stroke="#2a1f14" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 14}" x2="${x + w / 2 + 7}" y2="${top - 12}" stroke="#2a1f14" stroke-width="2"/>`);
  }
  else if (p.kind === 'museum') {
    o.push(`<polygon points="${x - 6},${top - 6} ${x + w / 2},${top - 44} ${x + w + 6},${top - 6}" fill="${trim}"/><polygon points="${x + 16},${top - 10} ${x + w / 2},${top - 36} ${x + w - 16},${top - 10}" fill="${base}"/>`);
    for (let c = 0; c < 6; c++) o.push(`<rect x="${x + 10 + c * (w - 28) / 5}" y="${top + 4}" width="8" height="${upBot - top}" fill="${trim}"/>`);
    for (const [bx2, col] of [[x + 40, '#b8483a'], [x + w - 56, '#3d5a7a']]) o.push(`<rect x="${bx2}" y="${upTop + 4}" width="16" height="56" fill="${col}"/><polygon points="${bx2},${upTop + 60} ${bx2 + 8},${upTop + 52} ${bx2 + 16},${upTop + 60}" fill="${base}"/>`);
  }
  else if (p.kind === 'cinema') {
    // the marquee: a lit board of bulbs over the doors, and a blade sign up the front
    o.push(`<rect x="${x - 6}" y="${G - 100}" width="${w + 12}" height="30" fill="#14171d" stroke="${trim}" stroke-width="2"/><text x="${x + w / 2}" y="${G - 80}" text-anchor="middle" class="sc-sign" style="fill:#f3c56b">NOW SHOWING</text>`);
    for (let k = 0; k < 22; k++) o.push(`<circle cx="${x - 2 + k * (w + 4) / 21}" cy="${G - 102}" r="2" fill="#f3c56b" class="${locked ? '' : 'twinkle'}" style="animation-delay:${(k % 5) * 0.2}s"/>`);
    o.push(`<rect x="${x + w / 2 - 14}" y="${top - 30}" width="28" height="${G - 104 - top + 30}" fill="#3a2440" stroke="${trim}" stroke-width="1.5"/>${'ROXY'.split('').map((ch, k) => `<text x="${x + w / 2}" y="${top - 12 + k * 17}" text-anchor="middle" class="sc-sign" style="fill:#ef5b4c;font-size:14px">${ch}</text>`).join('')}`);
  }
  else if (p.kind === 'gym') {
    for (let c = 0; c < 2; c++) o.push(`<rect x="${x + 10 + c * (w - 20) / 2}" y="${upTop}" width="${(w - 20) / 2 - 8}" height="${upBot - upTop - 6}" fill="${fitted ? 'rgba(156,196,236,.45)' : locked ? '#232a35' : 'rgba(156,196,236,.2)'}" stroke="${trim}" stroke-width="1.5"/>`);
    if (!locked) for (let k = 0; k < 4; k++) o.push(`<g transform="translate(${x + 28 + k * 36} ${upBot - 10})"><circle cx="0" cy="-14" r="3.5" fill="#1d2129"/><rect x="-3" y="-11" width="6" height="11" fill="#1d2129"/><circle cx="-6" cy="2" r="4" fill="none" stroke="#1d2129" stroke-width="1.5"/><circle cx="6" cy="2" r="4" fill="none" stroke="#1d2129" stroke-width="1.5"/></g>`);
    o.push(`<rect x="${x}" y="${upBot - 2}" width="${w}" height="5" fill="${trim}"/>`);
  }
  else if (p.kind === 'clinic') {
    grid(3, 30, 26, 18);
    o.push(`<rect x="${x}" y="${top + 4}" width="${w}" height="6" fill="${trim}"/><g transform="translate(${x + w - 26} ${top + 26})"><rect x="-12" y="-12" width="24" height="24" rx="4" fill="${trim}"/><path d="M-3 -8h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#ece6d8"/></g>`);
  }
  else if (p.kind === 'towers') {
    for (let yy = upTop; yy + 10 <= upBot; yy += 13) for (let c = 0; c < 9; c++) o.push(`<rect x="${x + 8 + c * 24.5}" y="${yy}" width="20" height="10" fill="${locked ? '#1d2430' : RND(c, yy) > (fitted ? 0.3 : 0.7) ? 'rgba(243,197,107,.6)' : 'rgba(156,196,236,.3)'}"/>`);
    o.push(`<rect x="${x + w / 2 - 30}" y="${top - 20}" width="60" height="20" fill="${base}"/><line x1="${x + w / 2}" y1="${top - 20}" x2="${x + w / 2}" y2="${top - 44}" stroke="#ccc" stroke-width="2"/><circle cx="${x + w / 2}" cy="${top - 45}" r="3" fill="#ef5b4c" class="twinkle"/>`);
  }
  else if (p.kind === 'station') {
    // the train shed: a great arched roof, a clock, and tall arched windows
    o.push(`<path d="M${x - 8} ${top + 4} Q${x + w / 2} ${top - 80} ${x + w + 8} ${top + 4} Z" fill="#4b5560"/><path d="M${x + 6} ${top + 2} Q${x + w / 2} ${top - 64} ${x + w - 6} ${top + 2} Z" fill="${locked ? '#2a2f38' : 'rgba(243,197,107,.28)'}"/>`);
    for (let k = 1; k < 8; k++) o.push(`<line x1="${x + w * k / 8}" y1="${top}" x2="${x + w / 2}" y2="${top - 52}" stroke="#4b5560" stroke-width="1.5"/>`);
    o.push(`<circle cx="${x + w / 2}" cy="${top - 30}" r="13" fill="${trim}" stroke="#2a2f38" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 30}" x2="${x + w / 2}" y2="${top - 39}" stroke="#222" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 30}" x2="${x + w / 2 + 6}" y2="${top - 28}" stroke="#222" stroke-width="2"/>`);
    for (let c = 0; c < 4; c++) { const wx = x + 18 + c * (w - 36) / 4 + 6, ww = (w - 36) / 4 - 12; o.push(`<path d="M${wx} ${upBot} V${upTop + 18} a${ww / 2} ${ww / 2} 0 0 1 ${ww} 0 V${upBot} Z" fill="${winLit}" stroke="${trim}" stroke-width="1.5"/>`); }
  }
  else if (p.kind === 'townhall') {
    const tw = 46, tx = x + w / 2 - tw / 2;
    o.push(`<rect x="${tx}" y="${top - 70}" width="${tw}" height="70" fill="${base}"/><polygon points="${tx - 4},${top - 70} ${x + w / 2},${top - 112} ${tx + tw + 4},${top - 70}" fill="#4b5560"/>`);
    o.push(`<circle cx="${x + w / 2}" cy="${top - 40}" r="14" fill="${trim}" stroke="#3a3328" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 40}" x2="${x + w / 2}" y2="${top - 50}" stroke="#2a241c" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 40}" x2="${x + w / 2 + 6}" y2="${top - 37}" stroke="#2a241c" stroke-width="2"/>`);
    o.push(`<line x1="${x + w / 2}" y1="${top - 112}" x2="${x + w / 2}" y2="${top - 132}" stroke="#ccc" stroke-width="1.5"/><path d="M${x + w / 2} ${top - 132} l16 4 l-16 5z" fill="#ef5b4c" class="flag"/>`);
    grid(5, 40, 20, 30);
  }
  // fascia with the name, and the shopfront bays below it
  o.push(`<rect x="${x + 4}" y="${G - 70}" width="${w - 8}" height="16" fill="#14171d"/><text x="${x + w / 2}" y="${G - 58.5}" text-anchor="middle" class="sc-sign" style="fill:${trim}">${scEsc(b.sign)}</text>`);
  if (p.kind === 'cafe') {   // striped awning over the shopfront
    const n = 10; for (let k = 0; k < n; k++) o.push(`<polygon points="${x + 2 + k * (w - 4) / n},${G - 54} ${x + 2 + (k + 1) * (w - 4) / n},${G - 54} ${x + 2 + (k + 1) * (w - 4) / n + 2},${G - 42} ${x + 2 + k * (w - 4) / n + 2},${G - 42}" fill="${k % 2 ? '#e8d9bf' : '#b8483a'}"/>`);
  }
  const inst = st === 'rival' ? rivalInstall(p) : p.install;
  const n = inst ? inst.length : (p.contract ? p.contract.slots : KINDS[p.kind].slots);
  const fx0 = x + 6, bw = (w - 12) / n;
  for (let i = 0; i < n; i++) o.push(bayArt(inst ? inst[i] : null, fx0 + i * bw, bw, st === 'rival' ? 'fitted' : st));
  if ((p.kind === 'station' || p.kind === 'towers') && locked && plotNeeds(p).length) {
    const needs = plotNeeds(p);
    o.push(`<rect x="${x - 4}" y="${G - 70}" width="${w + 8}" height="70" fill="#5a4a36"/><rect x="${x}" y="${G - 66}" width="${w}" height="62" fill="none" stroke="#3a2f22" stroke-width="2"/>`);
    o.push(`<text x="${x + 12}" y="${G - 52}" class="sc-small" style="fill:#f3c56b">${p.kind === 'station' ? 'TO BID FOR THE GATE LINE, YOU NEED' : 'TO BID FOR THE TOWERS, YOU NEED'}</text>`);
    needs.forEach((k, j) => { const ok = !!S.unlocks[k]; o.push(`<text x="${x + 12}" y="${G - 38 + j * 13}" class="sc-need" style="fill:${ok ? '#6fcf97' : '#ece6d8'}">${ok ? '✓' : '○'} ${scEsc(techName(k))}</text>`); });
    o.push(`<text x="${x + w - 12}" y="${G - 12}" text-anchor="end" class="sc-need" style="fill:${rep() >= p.rep ? '#6fcf97' : '#ece6d8'}">${rep() >= p.rep ? '✓' : '○'} ${p.rep}★</text>`);
  }
  if (p.kind === 'library') for (let k = 0; k < 3; k++) o.push(`<rect x="${x - 6 + k * 4}" y="${G + k * 4}" width="${w + 12 - k * 8}" height="4" fill="#b7a27a" opacity="${0.9 - k * 0.2}"/>`);
  return { svg: o.join(''), w, top: p.kind === 'towers' ? top - 46 : p.kind === 'museum' ? top - 44 : p.kind === 'cinema' ? top - 32 : p.kind === 'station' ? top - 60 : p.kind === 'townhall' ? top - 132 : p.kind === 'library' ? top - 64 : p.kind === 'bank' ? top - 40 : p.kind === 'store' ? top - 32 : p.kind === 'hotel' ? top - 40 : top - 8 };
}

function firmArt(x, w) {
  const o = [], pr = S.premises || 0, st = S.staff || {}, u = S.unlocks || {};
  const greens = S.plots.filter(p => p.status === 'fitted' && p.green).length;
  const certs = S.plots.filter(p => p.status === 'fitted' && p.cert).length;
  const landmark = S.plots.some(p => p.status === 'fitted' && PLOTS[p.i] && PLOTS[p.i].needs && p.kind !== 'bank');
  const techs = Object.keys(u).filter(k => u[k]).length;
  const h = [72, 112, 186][pr], top = G - h;
  o.push(`<g class="sbld firm" data-firm="1" role="button" tabindex="0" aria-label="Your firm: open the Company sheet">`);
  if (pr === 0) {
    // a lock-up garage: roller shutter half up, a hand-painted sign
    o.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="#4a4f58"/><rect x="${x - 3}" y="${top - 5}" width="${w + 6}" height="7" fill="#3a3f48"/>`);
    o.push(`<rect x="${x + 12}" y="${G - 52}" width="${w - 24}" height="52" fill="#2a2f38"/>`);
    for (let k = G - 52; k < G - 30; k += 4) o.push(`<line x1="${x + 12}" y1="${k}" x2="${x + w - 12}" y2="${k}" stroke="#5a606a" stroke-width="1.6"/>`);
    o.push(`<rect x="${x + 12}" y="${G - 30}" width="${w - 24}" height="30" fill="rgba(243,197,107,.35)"/>`);
    o.push(`<rect x="${x + 16}" y="${top + 6}" width="${w - 32}" height="14" fill="#d4a94f" transform="rotate(-2 ${x + w / 2} ${top + 13})"/><text x="${x + w / 2}" y="${top + 17}" text-anchor="middle" class="sc-sign" style="fill:#1d1608" transform="rotate(-2 ${x + w / 2} ${top + 13})">DOOR DUTY</text>`);
    o.push(`<line x1="${x + w - 8}" y1="${G}" x2="${x + w - 22}" y2="${G - 46}" stroke="#8d93a0" stroke-width="2"/><line x1="${x + w - 2}" y1="${G}" x2="${x + w - 16}" y2="${G - 46}" stroke="#8d93a0" stroke-width="2"/>`);
    for (let k = 1; k < 5; k++) o.push(`<line x1="${x + w - 8 - k * 2.8}" y1="${G - k * 9.2}" x2="${x + w - 2 - k * 2.8}" y2="${G - k * 9.2}" stroke="#8d93a0" stroke-width="1.5"/>`);
  } else if (pr === 1) {
    // a brick workshop: big double doors, skylights, the bench lit inside
    o.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="#7a4a3a"/><rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#brick)" opacity=".5"/>`);
    o.push(`<polygon points="${x - 4},${top} ${x + w / 2},${top - 26} ${x + w + 4},${top}" fill="#4b5560"/>`);
    for (let k = 0; k < 3; k++) o.push(`<rect x="${x + 30 + k * 40}" y="${top - 16 + Math.abs(k - 1) * 6}" width="22" height="8" fill="rgba(156,196,236,.5)" transform="rotate(${k < 1 ? -14 : k > 1 ? 14 : 0} ${x + 41 + k * 40} ${top - 12})"/>`);
    o.push(`<rect x="${x + 6}" y="${top + 10}" width="${w - 12}" height="18" fill="#14171d"/><text x="${x + w / 2}" y="${top + 23}" text-anchor="middle" class="sc-sign" style="fill:#d4a94f">DOOR DUTY · WORKSHOP</text>`);
    o.push(`<rect x="${x + 16}" y="${top + 38}" width="${w / 2 - 24}" height="26" fill="rgba(243,197,107,.6)" stroke="#e8d9bf" stroke-width="1.5"/><rect x="${x + w / 2 + 8}" y="${top + 38}" width="${w / 2 - 24}" height="26" fill="rgba(243,197,107,.6)" stroke="#e8d9bf" stroke-width="1.5"/>`);
    o.push(`<rect x="${x + w / 2 - 26}" y="${G - 44}" width="52" height="44" fill="#3a2a22" stroke="#1d1a17" stroke-width="2"/><line x1="${x + w / 2}" y1="${G - 44}" x2="${x + w / 2}" y2="${G}" stroke="#1d1a17" stroke-width="2"/>`);
  } else {
    // headquarters: stone and glass, our name in brass, and our own revolving door
    o.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="#3d3a46"/><rect x="${x - 4}" y="${top - 7}" width="${w + 8}" height="9" fill="#d4a94f"/>`);
    for (let yy = top + 16; yy + 22 <= G - 72; yy += 30) for (let c = 0; c < 5; c++) o.push(`<rect x="${x + 12 + c * (w - 24) / 5 + 4}" y="${yy}" width="${(w - 24) / 5 - 8}" height="22" fill="rgba(243,197,107,.7)" stroke="#e8d9bf" stroke-width="1.2"/>`);
    o.push(`<rect x="${x + 4}" y="${G - 70}" width="${w - 8}" height="18" fill="#14171d"/><text x="${x + w / 2}" y="${G - 57}" text-anchor="middle" class="sc-sign" style="fill:#d4a94f;font-size:11px">DOOR DUTY CONTRACTORS</text>`);
    const cx = x + w / 2;
    o.push(`<path d="M${cx - 30} ${G - 44} Q${cx} ${G - 58} ${cx + 30} ${G - 44} Z" fill="#d4a94f"/><rect x="${cx - 26}" y="${G - 44}" width="52" height="44" rx="3" fill="rgba(243,197,107,.55)" stroke="#d4a94f" stroke-width="2.5"/>`);
    o.push(`<g class="wing" style="transform-origin:${cx}px ${G - 22}px"><line x1="${cx}" y1="${G - 42}" x2="${cx}" y2="${G - 2}" stroke="#d4a94f" stroke-width="2"/><line x1="${cx - 13}" y1="${G - 42}" x2="${cx - 13}" y2="${G - 2}" stroke="rgba(212,169,79,.5)" stroke-width="1.4"/><line x1="${cx + 13}" y1="${G - 42}" x2="${cx + 13}" y2="${G - 2}" stroke="rgba(212,169,79,.5)" stroke-width="1.4"/></g>`);
    o.push(`<line x1="${x + w - 18}" y1="${top - 7}" x2="${x + w - 18}" y2="${top - 52}" stroke="#ccc" stroke-width="1.5"/><path d="M${x + w - 18} ${top - 52} l20 5 l-20 6z" fill="#d4a94f" class="flag"/>`);
  }
  const roof = pr === 1 ? top - 26 : top - (pr === 2 ? 7 : 5);
  // research: an aerial on the roof, blinking while a project runs; a brass plaque for every tech you own
  if (techs) {
    o.push(`<line x1="${x + 18}" y1="${roof}" x2="${x + 18}" y2="${roof - 26}" stroke="#8d93a0" stroke-width="1.5"/><line x1="${x + 10}" y1="${roof - 18}" x2="${x + 26}" y2="${roof - 18}" stroke="#8d93a0" stroke-width="1.5"/><line x1="${x + 12}" y1="${roof - 24}" x2="${x + 24}" y2="${roof - 24}" stroke="#8d93a0" stroke-width="1.5"/>`);
    o.push(`<circle cx="${x + 18}" cy="${roof - 28}" r="3" fill="${(S.research || []).length ? '#ef5b4c' : '#5a606a'}" class="${(S.research || []).length ? 'twinkle' : ''}"/>`);
    for (let k = 0; k < Math.min(techs, 12); k++) o.push(`<rect x="${x + 6 + (k % 6) * 7}" y="${G - (pr === 0 ? 62 : pr === 1 ? 40 : 82) + Math.floor(k / 6) * 7}" width="5" height="5" fill="#d4a94f" opacity=".85"/>`);
  }
  // green stars: solar panels, then a roof garden
  if (greens >= 1) for (let k = 0; k < Math.min(3, greens + 1); k++) o.push(`<rect x="${x + w - 30 - k * 20}" y="${roof - 10}" width="16" height="9" fill="#2c4a6a" stroke="#9cc4ec" stroke-width="1" transform="skewX(-20)"/>`);
  if (greens >= 3) for (let k = 0; k < 4; k++) o.push(`<circle cx="${x + 40 + k * 12}" cy="${roof - 5}" r="6" fill="#4f8f57"/>`);
  // inspection certificates framed beside the door
  for (let k = 0; k < Math.min(certs, 4); k++) o.push(`<rect x="${x + w - 16}" y="${G - 46 + k * 10}" width="9" height="8" fill="#ece6d8" stroke="#d4a94f" stroke-width="1"/>`);
  // a landmark on the books: a banner
  if (landmark) o.push(`<rect x="${x + 8}" y="${top + 4}" width="16" height="${Math.min(60, h - 30)}" fill="#b8483a"/><text x="${x + 16}" y="${top + 16}" text-anchor="middle" class="sc-small" style="fill:#f3c56b">★</text>`);
  // staff: the sales manager's neon, the doorman, the van, the engineer's scooter
  if (st.sales) o.push(`<g transform="translate(${x + w + 6} ${G + 2})"><polygon points="-14,0 -8,-30 8,-30 14,0" fill="#14171d" stroke="#e79a86" stroke-width="1"/><text x="0" y="-19" text-anchor="middle" class="sc-small glow" style="fill:#e79a86;font-size:6.5px">OPEN FOR</text><text x="0" y="-10" text-anchor="middle" class="sc-small glow" style="fill:#e79a86;font-size:6.5px">TENDERS</text></g>`);
  if (st.doorman) o.push(`<g transform="translate(${x + w / 2 + (pr === 2 ? 40 : 34)} ${G + 2})"><rect x="-5" y="-30" width="10" height="4" fill="#111"/><rect x="-3.5" y="-38" width="7" height="9" fill="#111"/><circle cx="0" cy="-24" r="4" fill="#e8c8a8"/><rect x="-5" y="-20" width="10" height="16" rx="2" fill="#3a2440"/><rect x="-4" y="-4" width="3" height="5" fill="#111"/><rect x="1" y="-4" width="3" height="5" fill="#111"/></g>`);
  if (st.fitter) o.push(`<g transform="translate(${x + w / 2 - 10} ${G + 46})"><rect x="-34" y="-22" width="68" height="22" rx="4" fill="#ece6d8"/><rect x="18" y="-20" width="14" height="10" rx="2" fill="#9cc4ec"/><rect x="-30" y="-14" width="44" height="8" fill="#d4a94f"/><text x="-8" y="-7.5" text-anchor="middle" class="sc-small" style="fill:#1d1608;font-size:6.5px">DOOR DUTY</text><circle cx="-20" cy="1" r="5" fill="#111"/><circle cx="20" cy="1" r="5" fill="#111"/></g>`);
  if (st.engineer) o.push(`<g transform="translate(${x + 14} ${G + 6})"><circle cx="0" cy="0" r="4" fill="#111"/><circle cx="16" cy="0" r="4" fill="#111"/><path d="M0 0 L6 -10 L14 -10 L16 0" fill="none" stroke="#6fcf97" stroke-width="3"/><rect x="2" y="-16" width="8" height="6" fill="#6fcf97"/></g>`);
  // label
  const lab = `${PREMISES[pr].name} · your firm`, tw = lab.length * 6.2 + 18, ly = Math.max(14, (pr === 1 ? top - 26 : top) - (techs ? 60 : 30));
  const lx = Math.max(x + w / 2, tw / 2 + 4);
  o.push(`<rect x="${lx - tw / 2}" y="${ly}" width="${tw}" height="19" rx="9.5" fill="#d4a94f"/><text x="${lx}" y="${ly + 13}" text-anchor="middle" class="sc-pill" style="fill:#1d1608">${scEsc(lab)}</text>`);
  o.push(`</g>`);
  return o.join('');
}
function streetSVG() {
  const m = S.month % 12, season = scSeason(m), ev = eventOf(S.month), evk = ev ? ev.key : '';
  const sky = SKY[evk === 'heatwave' ? 'heatwave' : evk === 'storm' ? 'storm' : season];
  const GAP = 46, X0 = 30;
  // lay the buildings out along the street
  const plots = S.plots.filter(p => streetOf(p) === (S.street || 'high'));
  const home = (S.street || 'high') === 'high', firmW = [130, 170, 214][S.premises || 0];
  let x = X0 + (home ? firmW + GAP : 0); const placed = plots.map(p => { const at = x; x += BLD[p.kind].w + GAP; return at; });
  const W = x + 10;
  const o = [];
  o.push(`<svg viewBox="0 0 ${W} ${SC_H}" width="${W}" height="${SC_H}" class="scene" role="group" aria-label="${(STREETS.find(x => x.key === (S.street || 'high')) || {}).name} in ${MONTHS[m]}">`);
  o.push(`<defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
    <pattern id="brick" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M0 8H12M0 4H12M6 0V4M0 4V8" stroke="rgba(0,0,0,.18)" stroke-width=".8"/></pattern>
    <radialGradient id="lampglow"><stop offset="0" stop-color="rgba(243,197,107,.55)"/><stop offset="1" stop-color="rgba(243,197,107,0)"/></radialGradient></defs>`);
  o.push(`<rect width="${W}" height="${G}" fill="url(#skyg)"/>`);
  // sun or moon, stars in winter
  if (evk === 'heatwave' || season === 'summer') o.push(`<circle cx="${W * 0.3}" cy="${G - 70}" r="${evk === 'heatwave' ? 46 : 30}" fill="#f6c76a" opacity=".85"/>`);
  else o.push(`<circle cx="${W * 0.62}" cy="48" r="13" fill="#ece6d8" opacity=".85"/>`);
  if (season === 'winter' && evk !== 'storm') for (let k = 0; k < 40; k++) o.push(`<circle cx="${RND(k, 1) * W}" cy="${RND(k, 2) * 110}" r="${RND(k, 3) > 0.8 ? 1.2 : 0.7}" fill="#ece6d8" opacity=".6"/>`);
  if (evk === 'storm') for (let k = 0; k < 8; k++) o.push(`<ellipse cx="${RND(k, 4) * W}" cy="${30 + RND(k, 5) * 50}" rx="${80 + RND(k, 6) * 80}" ry="22" fill="#0e1218" opacity=".7"/>`);
  // the town behind: a band of rooftops and chimneys
  let sx = 0, sk = 'M0 ' + G;
  while (sx < W) { const bw = 40 + RND(sx, 7) * 70, bh = 60 + RND(sx, 8) * 110; sk += ` L${sx} ${G - bh} L${sx + bw} ${G - bh}`; if (RND(sx, 9) > 0.6) sk += ` L${sx + bw - 10} ${G - bh} L${sx + bw - 10} ${G - bh - 14} L${sx + bw - 4} ${G - bh - 14} L${sx + bw - 4} ${G - bh}`; sx += bw; }
  o.push(`<path d="${sk} L${W} ${G} Z" fill="${sky[2]}" opacity=".9"/>`);
  // your own firm, first on the High Street: it grows with your premises, staff and record
  if (home) o.push(firmArt(X0, firmW));
  // buildings (clickable)
  plots.forEach((p, i) => {
    const a = buildingArt(p, placed[i]), st = p.status, bx = placed[i], bw = a.w;
    o.push(`<g class="sbld ${st}" data-i="${p.i}" ${st === 'locked' || st === 'rival' ? '' : 'role="button" tabindex="0"'} aria-label="${scEsc(p.name)}">${a.svg}`);
    // what's going on here, floating above the roofline
    const lbl = st === 'open' ? ['TENDER' + (p.contract && p.contract.solved ? ' · ' + kmoney(feeOf(p.contract)) : ''), '#d4a94f', '#1d1608']
      : st === 'callback' ? ['CALLBACK', '#ef5b4c', '#1a0a08']
      : st === 'rival' ? [`${RIVAL} · back in ${Math.max(1, (p.rivalUntil || 0) - S.month)} mo`, 'rgba(60,60,64,.9)', '#c8c2b6']
      : st === 'fitted' && p.broken ? ['BROKEN DOWN · tap to service', '#ef5b4c', '#1a0a08']
      : st === 'fitted' ? ['★'.repeat(p.stars) + (p.green ? ' 🌿' : '') + (p.cert ? ' ✓' : '') + ' · ' + kmoney(upkeep(p)) + '/mo' + ((p.wear || 0) >= 0.7 ? ' ⚠' : ''), 'rgba(20,23,29,.85)', (p.wear || 0) >= 0.7 ? '#ef8a6a' : '#d4a94f']
      : [rep() >= p.rep && !needsMet(p) ? (missingNeeds(p).length > 1 ? `Needs ${missingNeeds(p).length} more research` : 'Needs ' + needsText(p)) : p.rep + '★ to bid', 'rgba(20,23,29,.75)', '#8d93a0'];
    const tw = lbl[0].length * 6.2 + 18, ly = Math.max(14, a.top - 28);
    o.push(`<g class="${st === 'open' ? 'bob' : ''}"><rect x="${bx + bw / 2 - tw / 2}" y="${ly}" width="${tw}" height="19" rx="9.5" fill="${lbl[1]}" ${st === 'fitted' || st === 'locked' ? 'stroke="#2e3542"' : ''}/><text x="${bx + bw / 2}" y="${ly + 13}" text-anchor="middle" class="sc-pill" style="fill:${lbl[2]}">${scEsc(lbl[0])}</text></g>`);
    // broken down: hazard tape across the doors
    if (st === 'fitted' && p.broken) { const tx0 = bx + 4, tx1 = bx + bw - 4; o.push(`<line x1="${tx0}" y1="${G - 30}" x2="${tx1}" y2="${G - 22}" stroke="#d4a94f" stroke-width="6" stroke-dasharray="8 8"/><line x1="${tx0}" y1="${G - 30}" x2="${tx1}" y2="${G - 22}" stroke="#12151b" stroke-width="6" stroke-dasharray="8 8" stroke-dashoffset="8"/>`); }
    o.push(`</g>`);
    // seasonal shop dressing
    if (evk === 'sales' && ['cafe', 'pharmacy', 'store'].includes(p.kind) && st !== 'locked') o.push(`<g transform="rotate(-8 ${bx + 24} ${G - 90})"><rect x="${bx + 8}" y="${G - 100}" width="36" height="16" fill="#ef5b4c"/><text x="${bx + 26}" y="${G - 88}" text-anchor="middle" class="sc-tag">SALE</text></g>`);
    if (evk === 'xmas' && st !== 'locked') for (let k = 0; k <= 12; k++) { const t = k / 12, gx = bx + t * bw, gy = G - 72 + Math.sin(t * Math.PI * 3) * 4 + 4; o.push(`<circle cx="${gx}" cy="${gy}" r="2.2" fill="${['#ef5b4c', '#6fcf97', '#f3c56b', '#9cc4ec'][k % 4]}" class="twinkle" style="animation-delay:${(k % 4) * 0.35}s"/>`); }
  });
  // street furniture in the gaps: lamps and trees
  const leaf = { spring: ['#c98fae', '#e8b8cc'], summer: ['#3f6f45', '#55894f'], autumn: ['#b8642c', '#d89a3f'], winter: null }[season];
  placed.forEach((bx, i) => {
    const gx = bx + BLD[plots[i].kind].w + GAP / 2;
    if (i % 2 === 0) {   // tree
      o.push(`<rect x="${gx - 2}" y="${G - 48}" width="4" height="48" fill="#3a2c22"/>`);
      if (leaf) o.push(`<circle cx="${gx}" cy="${G - 58}" r="20" fill="${leaf[0]}"/><circle cx="${gx - 8}" cy="${G - 64}" r="12" fill="${leaf[1]}"/><circle cx="${gx + 9}" cy="${G - 52}" r="11" fill="${leaf[1]}" opacity=".8"/>`);
      else o.push(`<path d="M${gx} ${G - 46} l-12 -18 M${gx} ${G - 40} l13 -16 M${gx} ${G - 48} l-2 -26 M${gx - 8} ${G - 58} l-8 -6 M${gx + 9} ${G - 52} l8 -9" stroke="#7a6652" stroke-width="2.4" fill="none" stroke-linecap="round"/>${m === 11 || m === 0 ? `<path d="M${gx - 12} ${G - 64} l4 -1 M${gx + 13} ${G - 56} l-4 -1" stroke="#ece6d8" stroke-width="2.5"/>` : ''}`);
      if (season === 'autumn') for (let k = 0; k < 5; k++) o.push(`<ellipse cx="${gx - 16 + RND(k, i) * 32}" cy="${G + 3 + RND(i, k) * 8}" rx="2.5" ry="1.4" fill="#c46f3e"/>`);
    } else {             // lamp post
      o.push(`<circle cx="${gx}" cy="${G - 74}" r="26" fill="url(#lampglow)"/><rect x="${gx - 1.5}" y="${G - 74}" width="3" height="74" fill="#1d2129"/><rect x="${gx - 6}" y="${G - 82}" width="12" height="10" rx="2" fill="#f3c56b"/>`);
      if (evk === 'heatwave') o.push(`<path d="M${gx + 18} ${G - 34} q14 -14 28 0 z" fill="#ef5b4c"/><line x1="${gx + 32}" y1="${G - 34}" x2="${gx + 32}" y2="${G}" stroke="#ccc" stroke-width="1.5"/>`);
    }
  });
  // pavement, kerb, road
  o.push(`<rect x="0" y="${G}" width="${W}" height="20" fill="#3a3f48"/><rect x="0" y="${G}" width="${W}" height="20" fill="url(#brick)" opacity=".5"/>`);
  o.push(`<rect x="0" y="${G + 20}" width="${W}" height="4" fill="#5a606a"/><rect x="0" y="${G + 24}" width="${W}" height="${SC_H - G - 24}" fill="#23272e"/>`);
  if (evk !== 'marathon') o.push(`<line x1="0" y1="${G + 52}" x2="${W}" y2="${G + 52}" stroke="rgba(236,230,216,.4)" stroke-width="2" stroke-dasharray="18 16"/>`);
  if (m === 11 || m === 0) o.push(`<rect x="0" y="${G - 2}" width="${W}" height="5" fill="#dfe7ef" opacity=".7"/>`);   // snow on the kerbline
  if (evk === 'storm') for (let k = 0; k < 6; k++) o.push(`<ellipse cx="${RND(k, 10) * W}" cy="${G + 40 + RND(k, 11) * 20}" rx="${20 + RND(k, 12) * 20}" ry="4" fill="rgba(156,196,236,.18)"/>`);
  // people on the pavement
  const crowd = evk === 'blackfriday' ? 26 : evk === 'sales' ? 18 : evk === 'storm' ? 6 : 11;
  for (let k = 0; k < crowd; k++) {
    const dir = k % 2 ? 1 : -1, dur = 26 + RND(k, 13) * 22, col = ['#1a1d24', '#2a2530', '#202a30', '#2d2620'][k % 4];
    const pram = evk === 'marathon' && k % 4 === 0, umb = evk === 'storm' || (season === 'winter' && k % 3 === 0 && evk !== 'xmas');
    o.push(`<g class="walker ${dir > 0 ? 'right' : 'left'}" style="animation-duration:${dur}s;animation-delay:${-RND(k, 14) * dur}s;--sw:${W + 40}px">
      <g transform="translate(0 ${G + 4 + (k % 3) * 4})"><circle cx="0" cy="-26" r="4.2" fill="${col}"/><rect x="-4.5" y="-21" width="9" height="16" rx="3" fill="${col}"/><rect x="-3.5" y="-6" width="2.5" height="7" fill="${col}"/><rect x="1" y="-6" width="2.5" height="7" fill="${col}"/>
      ${umb ? `<path d="M-11 -30 q11 -12 22 0 z" fill="${['#ef5b4c', '#9cc4ec', '#d4a94f'][k % 3]}"/><line x1="0" y1="-30" x2="0" y2="-18" stroke="#111" stroke-width="1"/>` : ''}
      ${pram ? `<rect x="${dir * 7}" y="-12" width="10" height="7" rx="2" fill="#b48cf0"/>` : ''}</g></g>`);
  }
  if (evk === 'blackfriday') { const si = plots.findIndex(p => p.kind === 'store'); if (si >= 0) for (let k = 0; k < 9; k++) { const qx = placed[si] + 40 + k * 15; o.push(`<g transform="translate(${qx} ${G + 8})"><circle cx="0" cy="-26" r="4.2" fill="#1d2129"/><rect x="-4.5" y="-21" width="9" height="16" rx="3" fill="#1d2129"/><rect x="-4" y="-6" width="8" height="7" fill="#1d2129"/></g>`); }
    if (si >= 0) o.push(`<rect x="${placed[si] + 40}" y="${G - 112}" width="170" height="20" fill="#12151b" stroke="#d4a94f"/><text x="${placed[si] + 125}" y="${G - 98}" text-anchor="middle" class="sc-tag" style="fill:#d4a94f">BLACK FRIDAY</text>`); }
  // traffic, or runners on marathon day
  if (evk === 'marathon') {
    for (let k = 0; k < 4; k++) o.push(`<rect x="${k * W / 4 + 20}" y="${G + 26}" width="${W / 4 - 40}" height="4" fill="#d4a94f" opacity=".8"/>`);
    for (let k = 0; k < 14; k++) { const dur = 9 + RND(k, 15) * 4; o.push(`<g class="walker right" style="animation-duration:${dur}s;animation-delay:${-RND(k, 16) * dur}s;--sw:${W + 40}px"><g transform="translate(0 ${G + 50 + (k % 4) * 6})"><circle cx="0" cy="-20" r="3.6" fill="#ece6d8"/><rect x="-3.5" y="-16" width="7" height="11" rx="2" fill="${['#ef5b4c', '#9cc4ec', '#6fcf97', '#d4a94f'][k % 4]}"/><line x1="-2" y1="-5" x2="-5" y2="1" stroke="#ece6d8" stroke-width="2"/><line x1="2" y1="-5" x2="5" y2="1" stroke="#ece6d8" stroke-width="2"/></g></g>`); }
  } else {
    const cars = [['#d4a94f', 1, 34, 70], ['#9cc4ec', -1, 26, 40], ['#e79a86', -1, 26, 40], ['#6f8a7a', 1, 30, 50]];
    cars.forEach(([col, dir, cw, dur], k) => {
      const d = evk === 'blackfriday' ? dur * 2 : dur * 0.35, lane = dir > 0 ? G + 58 : G + 40;
      o.push(`<g class="walker ${dir > 0 ? 'right' : 'left'}" style="animation-duration:${d}s;animation-delay:${-RND(k, 17) * d}s;--sw:${W + 80}px"><g transform="translate(0 ${lane})">
        <rect x="${-cw / 2}" y="-10" width="${cw}" height="11" rx="4" fill="${col}"/><rect x="${-cw / 4}" y="-17" width="${cw / 2}" height="8" rx="3" fill="${col}" opacity=".85"/><rect x="${-cw / 4 + 2}" y="-15.5" width="${cw / 2 - 4}" height="5" fill="rgba(18,21,27,.5)"/>
        <circle cx="${-cw / 3}" cy="1" r="3.5" fill="#111"/><circle cx="${cw / 3}" cy="1" r="3.5" fill="#111"/><circle cx="${dir * cw / 2}" cy="-6" r="2" fill="#f3e5a0"/></g></g>`);
    });
  }
  // event set pieces
  if (evk === 'xmas') {
    const tx = placed[3] - GAP / 2;
    o.push(`<g transform="translate(${tx} ${G})"><rect x="-3" y="-14" width="6" height="14" fill="#3a2c22"/><polygon points="0,-110 26,-50 -26,-50" fill="#2f5a3a"/><polygon points="0,-80 34,-14 -34,-14" fill="#3f6f45"/><circle cx="0" cy="-112" r="5" fill="#f3c56b" class="glow"/>${[[-14, -60], [12, -70], [-20, -30], [18, -36], [0, -45], [6, -24]].map(([a, b2], k) => `<circle cx="${a}" cy="${b2}" r="2.6" fill="${['#ef5b4c', '#f3c56b', '#9cc4ec'][k % 3]}" class="twinkle" style="animation-delay:${k * 0.3}s"/>`).join('')}</g>`);
  }
  if (evk === 'marathon') o.push(`<g><rect x="${placed[2] - 20}" y="${G - 232}" width="6" height="232" fill="#ccc"/><rect x="${placed[4] - 20}" y="${G - 232}" width="6" height="232" fill="#ccc"/><rect x="${placed[2] - 20}" y="${G - 236}" width="${placed[4] - placed[2] + 6}" height="22" fill="#ef5b4c"/><text x="${(placed[2] + placed[4]) / 2 - 17}" y="${G - 220}" text-anchor="middle" class="sc-tag">TOWN MARATHON</text></g>`);
  if (evk === 'heatwave') o.push(`<g transform="translate(${placed[1] + 60} ${G + 46})"><rect x="-30" y="-30" width="60" height="30" rx="4" fill="#ece6d8"/><rect x="-26" y="-24" width="22" height="12" fill="#9cc4ec"/><text x="12" y="-12" text-anchor="middle" class="sc-small" style="fill:#c46f3e">ICES</text><circle cx="-18" cy="2" r="5" fill="#111"/><circle cx="18" cy="2" r="5" fill="#111"/></g><rect width="${W}" height="${SC_H}" fill="rgba(240,160,80,.07)" pointer-events="none"/>`);
  // weather on top
  if (m === 11 || m === 0) for (let k = 0; k < 90; k++) { const d = 7 + RND(k, 18) * 7; o.push(`<circle cx="${RND(k, 19) * W}" cy="-6" r="${1 + RND(k, 20) * 1.6}" fill="#eef3f8" opacity=".85" class="fall" style="animation-duration:${d}s;animation-delay:${-RND(k, 21) * d}s" pointer-events="none"/>`); }
  if (evk === 'storm') for (let k = 0; k < 140; k++) { const d = 0.7 + RND(k, 22) * 0.4; o.push(`<line x1="${RND(k, 23) * W}" y1="-12" x2="${RND(k, 23) * W - 6}" y2="2" stroke="rgba(170,200,230,.5)" stroke-width="1" class="pour" style="animation-duration:${d}s;animation-delay:${-RND(k, 24) * d}s" pointer-events="none"/>`); }
  if (season === 'autumn') for (let k = 0; k < 16; k++) { const d = 10 + RND(k, 25) * 8; o.push(`<ellipse cx="${RND(k, 26) * W}" cy="-6" rx="3" ry="1.6" fill="${k % 2 ? '#c46f3e' : '#d89a3f'}" class="leaf" style="animation-duration:${d}s;animation-delay:${-RND(k, 27) * d}s" pointer-events="none"/>`); }
  if (season === 'spring') for (let k = 0; k < 14; k++) { const d = 12 + RND(k, 28) * 8; o.push(`<circle cx="${RND(k, 29) * W}" cy="-6" r="1.6" fill="#f2c6d6" class="leaf" style="animation-duration:${d}s;animation-delay:${-RND(k, 30) * d}s" pointer-events="none"/>`); }
  o.push(`</svg>`);
  return { svg: o.join(''), W, placed };
}

// ---------- running the firm ----------
// what a fitted client pays each month: worn doors pay less, broken ones nothing; green stars and certificates pay more
const wearFactor = p => p.broken ? 0 : (p.wear || 0) < 0.5 ? 1 : 1 - ((p.wear || 0) - 0.5) * 0.8;
const upkeep = p => Math.round((p.fee * 0.007 * p.stars + 100) * (S.staff && S.staff.engineer ? 1.4 : 1) * (p.green ? 1.15 : 1) * (p.cert ? 1.1 : 1) * wearFactor(p) / 50) * 50;
// doors wear with traffic: revolving doors and gates fastest, swing doors slowest
const WEAR = { revolve: 0.1, slider: 0.08, swing: 0.06, gates: 0.1 };
function wearRate(p) {
  const doors = (p.install || []).filter(s => s.type !== 'wall');
  if (!doors.length) return 0;
  const base = doors.reduce((a, s) => a + (WEAR[s.type] || 0.08) * (s.wide ? 1.2 : 1), 0) / doors.length;
  return base * (1 + 0.06 * Math.min(p.tier || 0, 6)) * (S.staff.engineer ? 0.5 : 1);
}
const serviceCost = p => Math.round((300 + p.fee * 0.05 * (p.wear || 0) + (p.broken ? 800 : 0)) / 50) * 50;
// insurance: a base premium plus a loading for every bump and safety stop on your record
const insurance = () => S.plots.filter(p => p.status === 'fitted' || p.status === 'callback').reduce((a, p) => a + 45 * (p.bumpRec || 0) + 25 * (p.stopRec || 0), S.jobs ? 60 : 0);
// can a wheelchair get in? (the inspector checks this at public buildings)
function stepFreeOk(p) {
  const site = buildSite(p.kind, p.install.length);
  return p.install.some((s, i) => (s.type === 'slider' || (s.type === 'revolve' && s.wide && s.wings <= 3) || (s.type === 'gates' && s.wide)) && (!site.rampBays || site.rampBays.includes(i)));
}
// an inspector re-runs an old install against today's crowd
function inspect(p) {
  const c = makeContract(p.kind, Math.min(7, Math.floor(S.jobs / 3) + (p.tier || 0)), S.month, 1 + Math.floor(Math.random() * 1e6), { plain: true, existing: p.install, tech: tech() });
  const r = runHeadless(c, p.install, tech());
  const access = ['library', 'townhall', 'station'].includes(p.kind) ? stepFreeOk(p) : true;
  const safe = r.bumps <= c.goals.bumps && r.stops <= 3;
  return { pass: safe && access, safe, access, bumps: r.bumps, limit: c.goals.bumps };
}
const monthlyIncome = () => S.plots.filter(p => p.status === 'fitted').reduce((a, p) => a + upkeep(p), 0);

// ---------- sheets ----------
function sheet(html) { $('sheet').innerHTML = html; $('sheetWrap').hidden = false; $('sheet').scrollTop = 0; }
// After a sheet closes or the view changes, ignore taps briefly so a double tap
// can't land on the button that appears underneath (e.g. Sign off -> End the month).
let guardUntil = 0;
const guard = () => { guardUntil = performance.now() + 350; };
const guarded = fn => (...a) => { if (performance.now() < guardUntil) return; return fn(...a); };
function closeSheetCoach() { if (coachEl.id === 'brief' || coachEl.id === 'result') { coachEl.id = null; coachEl.target = null; $('coach').hidden = true; } }
function closeSheet() {
  closeSheetCoach();
  $('sheetWrap').hidden = true; guard();
  if (!W) renderStreet();   // pick up surveys that finished while the sheet was open
}
$('sheetWrap').addEventListener('click', e => { if (e.target === $('sheetWrap')) closeSheet(); });

async function openBrief(i, fromWorkshop) {
  const p = S.plots[i], k = KINDS[p.kind];
  if (!p.contract.solved) {
    sheet(`<div class="eyebrow">${p.status === 'callback' ? 'Callback' : 'Tender'} · ${k.label}</div><h3>${p.name}</h3>
      <p>The surveyor is modelling the site: trying ${candidates(p.contract, tech()).length} layouts in a 40-second rush hour to set a fair target and price. If the best answer is one you've used recently, they'll ask the client for a new wrinkle.</p>
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
  const g = c.goals, mix = c.crowd.mix || {};
  const guest = [];
  if (mix.elderly) guest.push(`${Math.round(mix.elderly * 100)}% older`);
  if (mix.case) guest.push(`${Math.round(mix.case * 100)}% suitcases`);
  if (mix.wheel) guest.push(`${Math.round(mix.wheel * 100)}% wheelchairs`);
  if (mix.pram) guest.push(`${Math.round(mix.pram * 100)}% prams and trolleys`);
  if (mix.bike) guest.push(`${Math.round(mix.bike * 100)}% cyclists`);
  sheet(`<div class="eyebrow">${p.status === 'callback' ? 'Callback' : 'Tender'} · ${k.label} · tier ${c.tier + 1}</div>
    <h3>${p.name}</h3>
    ${p.status === 'callback' ? `<p>${CALLBACKS[p.reason]}. Your existing doors stay; you only pay for new hardware.</p>` : ''}
    ${c.landmark === 'towers' ? `<p><strong style="color:var(--brass)">Landmark job.</strong> A tall building sucks cold air in at its doors (the stack effect): it holds swing doors ajar and pulls air through every opening. The day comes in three waves: 9am in off the underground, lunch both ways, 5pm out. Landmarks pay 50% more margin.</p>` : ''}
    ${KINDS[p.kind].cinema ? `<p><strong style="color:var(--text)">Showtime.</strong> At 22 seconds the film ends and the whole audience heads out at once, while the next queue is still coming in.</p>` : ''}
    ${c.opts && c.opts.callback === 'botched' ? '<p class="note"><strong style="color:var(--brass)">Rescue job.</strong> Put right what Brassworks fitted, and the client pays 30% more margin.</p>' : ''}
    ${c.landmark === 'station' ? `<p><strong style="color:var(--brass)">Landmark job.</strong> A gate line, not doors. For the first 20 seconds the morning rush pours in; then the evening starts and a train empties up the escalators every ${c.site.trains.every} seconds, ${c.site.trains.n} people at a time. Landmarks pay 50% more margin.</p>` : ''}
    ${c.event ? (() => { const ev = Object.values(EVENTS).find(e => e.key === c.event); return `<p><strong style="color:var(--brass)">${ev.label}.</strong> ${ev.text} Seasonal work: 25% more margin.</p>`; })() : ''}
    ${c.twists.length ? c.twists.map(t => `<p><strong style="color:var(--text)">${twistLabel(t)}.</strong> ${TWISTS[t] ? TWISTS[t].text : ''}</p>`).join('') : '<p>A straightforward job.</p>'}
    ${c.specialist ? '<p class="note"><strong style="color:var(--brass)">Specialist job.</strong> Only firms with the right R&amp;D get offered this one, so your margin is 60% bigger.</p>' : ''}
    ${c.novelty ? '<p class="note">The surveyor added a wrinkle because your recent jobs used the same answer.</p>' : ''}
    <div class="facts">
      <div class="fact"><span>Fee</span><b>${kmoney(feeOf(c))}</b></div>
      <div class="fact"><span>Budget</span><b>${kmoney(c.budget)}</b></div>
      <div class="fact"><span>Outside</span><b>${c.outsideTemp}°C</b></div>
      <div class="fact"><span>Arriving</span><b>${(c.crowd.in * 60).toFixed(0)}/min</b></div>
      <div class="fact"><span>Leaving</span><b>${(c.crowd.out * 60).toFixed(0)}/min</b></div>
      <div class="fact"><span>Frontage</span><b>${c.slots} bay${c.slots > 1 ? 's' : ''}</b></div>
    </div>
    ${guest.length ? `<p>Crowd: ${guest.join(', ')}.</p>` : ''}
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
      <li><span>Surveyor's par (cheapest pass found)</span><span>${money(c.par.cost)}</span></li>
    </ul>
    <p class="note">★ pass · ★★ at or under par · ★★★ under par with no bumps or safety stops.${costMult() < 1 ? ` Prices shown are list prices; you pay ${Math.round(costMult() * 100)}% of them.` : ''}</p>
    <div class="legend"><span><i style="background:var(--frost)"></i>arriving</span><span><i style="background:var(--rose)"></i>leaving</span><span><i style="background:#fff;border:3px solid var(--frost);box-sizing:border-box"></i>older</span><span><i style="background:var(--frost);border-radius:3px"></i>wheelchair</span><span><i style="background:#b48cf0"></i>pram</span><span><i style="background:#d4a94f;border-radius:2px;height:3px;width:14px;vertical-align:3px"></i>bike</span><span><i style="background:#9b7a4a;border-radius:2px"></i>suitcase</span><span><i style="background:#6b7280"></i>standing still</span></div>
    ${fromWorkshop ? '<button class="go" type="button" id="bBack">Back to the workshop</button>'
      : '<div style="display:flex;gap:8px"><button class="ghost" type="button" id="bClose">Not now</button><button class="go" type="button" id="bTake">Take the job</button></div>'}`);
  if (fromWorkshop) { $('bBack').onclick = closeSheet; return; }
  setTimeout(() => coach('brief', () => $('bTake')), 250);
  $('bClose').onclick = closeSheet;
  $('bTake').onclick = () => { closeSheet(); openWorkshop(i); };
}

// ---------- the walk-through: small tips that point at the real buttons, once each ----------
const COACH = {
  tender: ['Your first client', 'Tap their building, the one with the glowing TENDER label, to read the job.'],
  brief: ['The brief', 'Who\'s coming, the weather, and the goals. Every goal at the bottom must pass. Par is the cheapest design the surveyor found. Take the job when you\'re ready.'],
  bays: ['Your frontage', 'The shopfront is split into bays. Tap a bay up here, then choose what goes in it below.'],
  doors: ['Pick a door', 'Revolving doors keep the heat in but bump people if they spin too fast. Swing doors are cheap and quick. Sliding doors are step-free. Walls are free.'],
  run: ['Test it', 'Run a 40-second rush hour. The speed button fast-forwards; Skip jumps straight to the result.'],
  result: ['The verdict', 'Every row must pass. ★ pass · ★★ at or under par · ★★★ no bumps too. If something fails, the hint says why: tweak and run again.'],
  month: ['End the month', 'Fitted clients pay maintenance every month. End the month to collect it, and watch for clients calling you back.'],
  company: ['Your company', 'Research new kit, hire staff and move to bigger premises. Research brings new kinds of job. The Guide tab explains everything again.'],
};
const NEXT = { bays: 'doors', doors: 'run', month: 'company' };
const coachEl = { id: null, target: null };
function tutOn() { S.tut = S.tut || { done: {} }; return !S.tut.off; }
// target: an element, or a function that finds it (so the tip survives the page redrawing)
function coach(id, target) {
  if (!S.seenIntro || !tutOn() || S.tut.done[id] || coachEl.id === id) return;
  const find = typeof target === 'function' ? target : () => target;
  const el = find();
  if (!el || !el.getClientRects().length) return;
  coachEl.id = id; coachEl.target = el; coachEl.find = find;
  $('coachTitle').textContent = COACH[id][0]; $('coachText').textContent = COACH[id][1];
  $('coach').hidden = false; placeCoach();
}
function coachDone(skipAll) {
  if (!coachEl.id) return;
  const id = coachEl.id; S.tut.done[id] = true; if (skipAll) S.tut.off = true; save();
  coachEl.id = null; coachEl.target = null; $('coach').hidden = true;
  const nx = NEXT[id]; if (nx && !skipAll) setTimeout(() => coach(nx, COACH_TARGET[nx]), 120);
}
const COACH_TARGET = { doors: () => document.querySelector('#editor .seg'), run: () => $('testBtn'), company: () => $('rdBtn') };
function placeCoach() {
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
// ---------- guides: the basics, and one lesson per piece of research ----------
const BASICS = [
  ['doors', 'The three doors', 'Revolving doors seal out the weather, but their wing tips move at v = ω·r: spin them fast and the tips clip people. More wings seal better but leave smaller gaps. Swing doors are cheap and quick, leak heat with every push, and swing into people coming the other way unless you set a direction. Sliding doors are gentle and step-free, and open for anyone nearby, so the cold gets in often. A wall is free.'],
  ['brief', 'Reading a brief', 'The brief tells you who is coming (older guests, wheelchairs, suitcases, bikes), how cold or windy it is, and the goals. Every goal must pass: enough people through in 40 seconds, few enough bumps, a warm enough lobby, and any special rules. The surveyor\'s par is the cheapest design they found that passes.'],
  ['test', 'Testing and stars', 'Run rush hour to watch 40 seconds of real crowd. Speed it up with the speed button, or Skip to jump straight to the results. One star: everything passes. Two: at or under par. Three: under par with no bumps and no safety stops. If anything fails, the hint tells you why. Reset puts the frontage back how it started.'],
  ['month', 'Months, maintenance and callbacks', 'Fitted clients pay maintenance every month, more for more stars. End the month to collect it, pay rent and wages, and finish research. Clients sometimes call you back when things change: a cold snap, a busier street, an older crowd. Your old doors stay; you only pay for new hardware.'],
  ['firm', 'Running the firm', 'Doors wear every month: worn ones pay less, and broken ones pay nothing until you service them (tap the building). Insurance goes up with every bump on your record. Inspectors re-test old jobs: a pass earns a certificate, a fail a fine and a callback. A lobby kept snug in the cold earns a green star and a better fee.'],
  ['company', 'Research, staff and premises', 'Research unlocks new kit, and new kit unlocks new kinds of job. Staff cost wages but pay their way: fitters cut hardware costs, a sales manager raises margins. Bigger premises give you more benches and higher tiers of research. The Company button on the street has it all; your own building grows as you do.'],
  ['calendar', 'The calendar', 'Each month can bring an event you can see coming: January sales, storms, marathon day, a heatwave where lobbies must stay cool, Black Friday and Christmas windows. Tenders in an event month take it on, and pay 25% more.'],
];
const LESSONS = {
  core: ['Big-core drums', 'In a revolving door the floor near the centre barely moves (v = ω·r), so people standing there drift and miss their exit, riding round again. A bigger core keeps them out at the fast edge.', 'Workshop › revolving door › the new Core slider. 30% or more costs extra.', 'Try a bigger core when go-rounds are the problem, especially with a fast door or a 9am surge.'],
  mouth: ['Mouth adjusters', 'The mouth is how wide the curved walls open on each side. Narrow mouths keep wind out; wide ones let people in and out faster.', 'Workshop › revolving door › the new Mouth slider.', 'On a windy corner, narrow the mouth to about ±30°. Elsewhere, open it up for more throughput.'],
  padded: ['Padded wing edges', 'Soft edges on the wings: people shrug off impacts 0.3 m/s faster before it counts as a bump.', 'Workshop › revolving door › Padded wing edges.', 'Lets you spin a door faster for more people through, without the bumps.'],
  seals: ['Brush seals', 'Seal the drum against the wind, so a wide mouth doesn\'t let the gale in.', 'Automatic on every revolving door you fit.', 'On windy corners you can now keep a wide, fast mouth.'],
  sensor: ['Presence sensors', 'The door slows to a safe speed whenever an older guest is inside, then speeds back up.', 'Workshop › revolving door › Presence sensor.', 'The answer for older crowds that also need decent throughput.'],
  wide: ['Wide-drum revolving', 'A bigger drum. With 3 wings or fewer, wheelchair users can ride it.', 'Workshop › revolving door › Wide drum, then drop to 3 wings.', 'A step-free revolving door: warmth and access in one bay.'],
  curtain: ['Air curtains', 'A sheet of warm air across swing and sliding doors. Cuts their heat loss by 70%.', 'Workshop › swing or sliding door › Air curtain.', 'The cheap fix when an open door makes the lobby too cold, or too hot in a heatwave.'],
  vestibule: ['Draught lobbies', 'A second set of doors behind the first: heat loss down by almost 90%, people slowed a little.', 'Workshop › swing or sliding door › Draught lobby.', 'Step-free and warm at the same time, and the answer to the stack effect at Office Towers.'],
  heat: ['Heat recovery', 'Lobbies you fit reheat 60% faster after a draught.', 'Automatic on every job.', 'Lets a leakier, faster design still hit the temperature goal.'],
  doorman: ['Door staff training', 'Lets you hire a doorman crew. A doorman gets riders out of revolving doors on time and holds swing doors so nobody gets clipped.', 'Company › Staff › hire a doorman crew, then Workshop › Doorman on any door. At a gate line, they become gate-line staff.', 'No hardware cost: just their wages.'],
  heat2: ['Heat pumps', 'Lobbies reheat 2.4 times faster than standard.', 'Automatic on every job.', 'One of the three keys to Office Towers.'],
  supplier: ['Supplier contract', 'A bulk deal with a manufacturer: all hardware costs you 8% less.', 'Automatic: you pay less than list price.', 'Makes two stars (at or under par) easier, since par is set at list price.'],
  barriers: ['Queue barriers', 'Posts and tape through a swing or sliding door: in on one side, out on the other. Nobody gets a door swung into them, but each lane is half as wide.', 'Workshop › swing or sliding door › Lane barriers.', 'Cuts bumps to almost nothing on a busy two-way door, at the cost of throughput.'],
  pillars: ['Pillars', 'A slim column just inside an exit. In a crush it takes the push of the crowd behind, so the doorway jams less. Strange but true: an obstacle makes the exit faster.', 'Workshop › any door › Pillar inside the exit. Fire-drill jobs now appear.', 'Worth it for big crowds at narrow exits; small crowds don\'t need it.'],
  gates: ['Ticket gates', 'Gate lines for the station: single-file lanes with paddles, about a second to tap through. Wide aisles take wheelchairs, prams and bikes.', 'At Station Quarter, every bay can be a gate line: set its lanes to In, Out or Mixed.', 'Point more lanes the busy way. One of the keys to Station Quarter.'],
  tidal: ['Tidal-flow gates', 'Gate lanes set to Auto turn to face whichever queue is heavier: in for the morning rush, out when a train empties.', 'Station Quarter › any gate bay › Lanes › Auto.', 'Fixed splits clog one way or the other. Auto lanes follow the crowd.'],
};
function openLesson(key, back) {
  const b = BASICS.find(x => x[0] === key), l = LESSONS[key];
  sheet(`<div class="eyebrow">${b ? 'Guide' : 'How to use it'}</div><h3>${b ? b[1] : l[0]}</h3>
    <p>${b ? b[2] : l[1]}</p>
    ${l ? `<p><strong style="color:var(--text)">Where:</strong> ${l[2]}</p><p class="note"><strong style="color:var(--brass)">Tip.</strong> ${l[3]}</p>` : ''}
    <button class="go" type="button" id="lsBack">${back ? 'Back' : 'Got it'}</button>`);
  $('lsBack').onclick = () => back ? back() : closeSheet();
}

let coTab = 'research';
function openCompany(tab) {
  if (tab) coTab = tab;
  const P = prem(), broke = S.cash < 0;
  const tabs = `<div class="seg">${[['research', 'Research'], ['staff', 'Staff'], ['premises', 'Premises'], ['guide', 'Guide']].map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${coTab === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (coTab === 'research') {
    const busy = S.research.length, free = P.labs - busy;
    body = `<p>${busy ? `Researching ${S.research.map(r => `<b style="color:var(--text)">${techName(r.key)}</b> (${r.left} month${r.left > 1 ? 's' : ''} left)`).join(', ')}. ` : ''}${free > 0 ? `${free} bench${free > 1 ? 'es' : ''} free.` : 'All benches busy.'} Projects finish at the end of the month.</p>` +
      BRANCHES.map(([b, label]) => `<div class="branch"><div class="eyebrow">${label}</div>${TECH.filter(t => t.branch === b).map(t => {
        const owned = S.unlocks[t.key], doing = S.research.find(r => r.key === t.key);
        const missing = (t.req || []).filter(r => !S.unlocks[r]);
        const tierOk = t.tier <= P.tier;
        let state, action = '';
        if (owned) state = LESSONS[t.key] ? `<button class="ghost small" type="button" data-lesson="${t.key}">How to use</button>` : '<span class="pill done">Owned</span>';
        else if (doing) state = `<span class="pill open">${doing.left} mo</span>`;
        else if (!tierOk) state = `<span class="pill lock">Tier ${t.tier}</span>`;
        else if (missing.length) state = `<span class="pill lock">Locked</span>`;
        else action = `<button class="go" type="button" data-k="${t.key}" ${broke || free <= 0 || S.cash < t.price ? 'disabled' : ''}>${kmoney(t.price)} · ${t.months} mo</button>`;
        const why = !owned && !doing ? (!tierOk ? `Needs ${PREMISES[t.tier - 1].name.toLowerCase()} premises. ` : missing.length ? `Needs ${missing.map(techName).join(', ')}. ` : '') : '';
        return `<div class="node ${owned ? 'owned' : doing ? 'doing' : action ? 'avail' : 'locked'}"><div><b>${t.name}</b><p>${why}${t.text}${t.opens ? `<br><span class="opens">Opens specialist jobs: ${t.opens}</span>` : ''}</p></div>${state || action}</div>`;
      }).join('')}</div>`).join('');
  } else if (coTab === 'guide') {
    const owned = TECH.filter(t => S.unlocks[t.key] && LESSONS[t.key]);
    body = `<p>Everything the game has taught you, any time you need it.</p>
      <div class="branch"><div class="eyebrow">The basics</div>${BASICS.map(([k, t]) => `<button class="lessonrow" type="button" data-lesson="${k}"><b>${t}</b><span>›</span></button>`).join('')}</div>
      <div class="branch"><div class="eyebrow">Your research</div>${owned.length ? owned.map(t => `<button class="lessonrow" type="button" data-lesson="${t.key}"><b>${t.name}</b><span>›</span></button>`).join('') : '<p class="note">Lessons for new kit appear here as your research finishes.</p>'}</div>
      <button class="ghost" type="button" id="tutReplay">Replay the walk-through</button>`;
  } else if (coTab === 'staff') {
    const hired = STAFF.filter(s => S.staff[s.key]).length;
    body = `<p>Wages come out at the end of every month. Your ${P.name.toLowerCase()} has room for ${P.staff} hire${P.staff > 1 ? 's' : ''}; ${hired} taken.</p>` +
      STAFF.map(s => {
        const on = S.staff[s.key], needs = s.req && !S.unlocks[s.req];
        const btn = on ? `<button class="ghost" type="button" data-fire="${s.key}">Let go</button>`
          : needs ? `<span class="pill lock">Research first</span>`
          : `<button class="go" type="button" data-hire="${s.key}" ${broke || hired >= P.staff ? 'disabled' : ''}>Hire</button>`;
        return `<div class="node ${on ? 'owned' : needs ? 'locked' : 'avail'}"><div><b>${s.name} · ${money(s.wage)}/mo</b><p>${needs ? `Needs ${techName(s.req)}. ` : ''}${s.text}</p></div>${btn}</div>`;
      }).join('');
  } else {
    body = `<p>Rent is due every month. Bigger premises unlock higher research tiers and room for more staff.</p>` +
      PREMISES.map((p, i) => {
        const cur = i === (S.premises || 0), past = i < (S.premises || 0), next = i === (S.premises || 0) + 1;
        const repOk = rep() >= (p.rep || 0);
        const btn = cur ? '<span class="pill done">Current</span>' : past ? '<span class="pill lock">Outgrown</span>'
          : next ? (repOk ? `<button class="go" type="button" data-move="${i}" ${broke || S.cash < p.price ? 'disabled' : ''}>Move · ${kmoney(p.price)}</button>` : `<span class="pill lock">${p.rep}★ rep</span>`)
          : '<span class="pill lock">Later</span>';
        return `<div class="node ${cur ? 'owned' : next && repOk ? 'avail' : 'locked'}"><div><b>${p.name} · ${money(p.rent)}/mo rent</b><p>${p.text} Research tier ${p.tier}, ${p.labs} bench${p.labs > 1 ? 'es' : ''}, ${p.staff} staff.</p></div>${btn}</div>`;
      }).join('');
  }
  sheet(`<div class="eyebrow">Company</div><h3>${P.name}</h3>
    <div class="facts"><div class="fact"><span>Cash</span><b class="${broke ? 'neg' : ''}">${kmoney(S.cash)}</b></div><div class="fact"><span>In / month</span><b>${kmoney(monthlyIncome())}</b></div><div class="fact"><span>Out / month</span><b>${kmoney(overheads())}</b></div></div>
    ${broke ? '<p class="note"><span class="hot">You\'re overdrawn.</span> You can\'t start research, hire or move until you\'re back in the black.</p>' : ''}
    ${tabs}${body}
    <div style="display:flex;gap:8px"><button class="ghost" type="button" id="coNew" style="flex:1">Start a new firm</button><button class="ghost" type="button" id="coClose" style="flex:1">Close</button></div>`);
  const sh = $('sheet');
  sh.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { const top = sh.scrollTop; openCompany(b.dataset.tab); sh.scrollTop = 0; });
  sh.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const t = TECH.find(x => x.key === b.dataset.k);
    if (S.cash < t.price || S.research.length >= prem().labs) return;
    S.cash -= t.price; S.research.push({ key: t.key, left: t.months }); save(); renderStreet(); keepScroll(() => openCompany()); toast(`Started ${t.name} · ready in ${t.months} month${t.months > 1 ? 's' : ''}`);
  });
  sh.querySelectorAll('[data-hire]').forEach(b => b.onclick = () => { S.staff[b.dataset.hire] = true; save(); renderStreet(); keepScroll(() => openCompany()); toast(`${STAFF.find(s => s.key === b.dataset.hire).name} hired`); });
  sh.querySelectorAll('[data-fire]').forEach(b => b.onclick = () => { S.staff[b.dataset.fire] = false; save(); renderStreet(); keepScroll(() => openCompany()); });
  sh.querySelectorAll('[data-move]').forEach(b => b.onclick = () => {
    const i = +b.dataset.move, p = PREMISES[i];
    if (S.cash < p.price) return;
    S.cash -= p.price; S.premises = i; save(); renderStreet(); keepScroll(() => openCompany()); toast(`Moved into the ${p.name.toLowerCase()}`);
  });
  $('coClose').onclick = closeSheet;
  sh.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => openLesson(b.dataset.lesson, () => openCompany()));
  if ($('tutReplay')) $('tutReplay').onclick = () => { S.tut = { done: {} }; save(); closeSheet(); toast('Walk-through on: it picks up as you play'); setTimeout(renderStreet, 300); };
  // starting over wipes the save, so it takes two taps
  $('coNew').onclick = () => {
    const btn = $('coNew');
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed'); btn.textContent = 'Tap again: lose everything';
      clearTimeout(btn._t); btn._t = setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = 'Start a new firm'; } }, 3000);
      return;
    }
    try { localStorage.setItem(KEY, JSON.stringify(fresh())); } catch (e) {}
    location.reload();
  };
}
// a fitted client: what they pay, how worn the doors are, their safety record
function openClient(i) {
  const p = S.plots[i], k = KINDS[p.kind], wear = Math.round((p.wear || 0) * 100), cost = serviceCost(p);
  const bar = `<div class="wear"><i style="width:${wear}%;background:${p.broken ? 'var(--warn)' : wear >= 70 ? 'var(--warn)' : wear >= 50 ? 'var(--brass)' : 'var(--ok)'}"></i></div>`;
  sheet(`<div class="eyebrow">Client · ${k.label}</div><h3>${p.name}</h3>
    <div class="facts"><div class="fact"><span>Stars</span><b style="color:var(--brass)">${'★'.repeat(p.stars)}</b></div><div class="fact"><span>Pays / month</span><b>${kmoney(upkeep(p))}</b></div><div class="fact"><span>Doors</span><b>${(p.install || []).filter(s => s.type !== 'wall').length}</b></div></div>
    <p><strong style="color:var(--text)">${p.broken ? 'Broken down.' : `Wear ${wear}%.`}</strong> ${p.broken ? 'The client pays nothing until you send someone.' : wear >= 50 ? 'Worn doors stick and slow down: the client is paying less, and more likely to complain.' : 'In good order.'} ${S.staff.engineer ? 'Your service engineer halves the wear.' : ''}</p>
    ${bar}
    <ul class="list">
      <li><span>Safety record at sign-off</span><span>${p.bumpRec || 0} bump${p.bumpRec === 1 ? '' : 's'} · ${p.stopRec || 0} stop${p.stopRec === 1 ? '' : 's'}</span></li>
      <li><span>Adds to your insurance</span><span>${money(45 * (p.bumpRec || 0) + 25 * (p.stopRec || 0))}/mo</span></li>
      <li class="${p.green ? 'pass' : ''}"><span>Green star · lobby kept snug</span><span>${p.green ? '+15% fee' : 'no'}</span></li>
      <li class="${p.cert ? 'pass' : ''}"><span>Inspection certificate</span><span>${p.cert ? '+10% fee' : 'not yet'}</span></li>
    </ul>
    <div style="display:flex;gap:8px"><button class="ghost" type="button" id="clClose" style="flex:1">Close</button><button class="go" type="button" id="clServ" ${!wear && !p.broken ? 'disabled' : ''} ${S.cash < cost ? 'disabled' : ''}>Service · ${kmoney(cost)}</button></div>`);
  $('clClose').onclick = closeSheet;
  $('clServ').onclick = () => { if (S.cash < cost) return; S.cash -= cost; p.wear = 0; p.broken = false; save(); renderStreet(); closeSheet(); toast(`${p.name} serviced · good as new`); };
}
function keepScroll(fn) { const top = $('sheet').scrollTop; fn(); $('sheet').scrollTop = top; }
$('rdBtn').onclick = guarded(() => openCompany());
// full screen, where the browser allows it
$('fsBtn').onclick = () => {
  const el = document.documentElement, doc = document;
  const on = doc.fullscreenElement || doc.webkitFullscreenElement;
  try {
    const p = on ? (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc) : (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if (p && p.catch) p.catch(() => toast('Full screen isn\'t allowed here. Open the game in its own tab to use it.', true));
  } catch (e) { toast('Full screen isn\'t allowed here. Open the game in its own tab to use it.', true); }
};

$('monthBtn').onclick = guarded(() => {
  const inc = monthlyIncome(), rent = prem().rent, ins = insurance();
  const wages = STAFF.filter(s => S.staff[s.key]);
  const wageTotal = wages.reduce((a, s) => a + s.wage, 0);
  S.cash += inc - rent - wageTotal - ins;
  // claims: someone clipped by one of your doors sues; you pay the excess
  const claims = [];
  for (const p of S.plots) if (p.status === 'fitted' && p.bumpRec > 0 && Math.random() < Math.min(0.15, 0.02 * p.bumpRec)) { claims.push(p); S.cash -= 1200; }
  // wear: doors age every month, and break down at the end of their tether
  const broke = [];
  for (const p of S.plots) {
    if (p.status !== 'fitted' || p.broken) continue;
    p.wear = Math.min(1, (p.wear || 0) + wearRate(p));
    if (p.wear >= 1) { p.broken = true; broke.push(p); }
  }
  // now and then an inspector turns up at one of your old jobs
  let insp = null;
  const due = S.plots.filter(p => p.status === 'fitted' && p.install && !p.cert && (S.month - (p.inspected || -99)) >= 6);
  if (due.length && Math.random() < 0.15) {
    const p = due[Math.floor(Math.random() * due.length)];
    p.inspected = S.month + 1;
    try {
      const res = inspect(p);
      insp = { p, ...res };
      if (res.pass) p.cert = true;
      else { S.cash -= 2500; p.status = 'callback'; p.reason = res.access ? 'safety' : 'access'; p.contract = null; p.tier++; }
    } catch (e) { insp = null; }
  }
  S.month++; if (S.month % 12 === 0) S.year++;
  // research
  const done = [];
  for (const r of S.research) { r.left--; if (r.left <= 0) { S.unlocks[r.key] = true; done.push(r.key); } }
  S.research = S.research.filter(r => r.left > 0);
  // deep in the red: the crew walks
  let walked = [];
  if (S.cash < -15000) { walked = wages.map(s => s.name); S.staff = {}; }
  const winter = [10, 11, 0, 1].includes(S.month % 12);
  const calls = [];
  for (const p of S.plots) {
    if (p.status !== 'fitted' || p.broken) continue;
    const chance = (winter ? 0.32 : 0.2) + (p.wear || 0) * 0.15;   // tired doors get more complaints
    if (Math.random() < chance) {
      const opts = winter ? ['cold', 'cold', 'busier', 'older'] : ['busier', 'older', 'cold'];
      p.reason = opts[Math.floor(Math.random() * opts.length)];
      if (p.reason === 'cold' && (eventOf(S.month) || {}).key === 'heatwave') p.reason = 'hot';
      p.status = 'callback'; p.tier++; p.contract = null;
      calls.push(p);
    }
  }
  // Brassworks bids on tenders you've left sitting
  const lost = [];
  if (rivalActive()) for (const p of S.plots) {
    if (p.status !== 'open' || !p.contract || p.contract.first || p.contract.landmark || !p.contract.solved) continue;
    if (Math.random() < 0.18) { p.status = 'rival'; p.rivalUntil = S.month + 3 + Math.floor(Math.random() * 3); p.contract = null; lost.push(p); }
  }
  // stale tenders refresh with the season; new tech means new kinds of tender
  const evNow = eventOf(S.month), evKey = evNow ? evNow.key : null;
  for (const p of S.plots) {
    if (!p.contract || (p.status !== 'open' && p.status !== 'callback')) continue;
    const wantEv = p.contract.first ? null : evKey;   // a new month's event replaces last month's tenders
    if ((p.contract.event || null) !== wantEv || (p.status === 'open' && (done.length || Math.random() < 0.35))) p.contract = null;
  }
  renderStreet();
  const net = inc - rent - wageTotal - ins - claims.length * 1200 - (insp && !insp.pass ? 2500 : 0);
  sheet(`<div class="eyebrow">${MONTHS[S.month % 12]} ${S.year}</div><h3>${net >= 0 ? 'Up ' + money(net) : 'Down ' + money(-net)} this month</h3>
    <ul class="list">
      <li class="pass"><span>Maintenance fees</span><span>+${money(inc)}</span></li>
      <li><span>Rent · ${prem().name.toLowerCase()}</span><span>−${money(rent)}</span></li>
      ${wages.map(s => `<li><span>${s.name}</span><span>−${money(s.wage)}</span></li>`).join('')}
      ${ins ? `<li><span>Insurance${ins > 60 ? ' · loaded for bumps on your record' : ''}</span><span>−${money(ins)}</span></li>` : ''}
      ${claims.map(p => `<li class="fail"><span>Claim: someone clipped at ${p.name}</span><span>−${money(1200)}</span></li>`).join('')}
      ${insp && !insp.pass ? `<li class="fail"><span>Inspection fine · ${insp.p.name}</span><span>−${money(2500)}</span></li>` : ''}
      <li><span><b>Cash now</b></span><span class="${S.cash < 0 ? 'neg' : ''}">${money(S.cash)}</span></li>
    </ul>
    ${insp ? `<p><strong style="color:${insp.pass ? 'var(--ok)' : 'var(--warn)'}">Inspection at ${insp.p.name}:</strong> ${insp.pass ? 'passed. They get a certificate of compliance, and pay you 10% more maintenance.' : !insp.access ? 'failed. There is no step-free way in. You have a callback to fix it.' : `failed on safety: ${insp.bumps} people clipped, the limit is ${insp.limit}. You have a callback to fix it.`}</p>` : ''}
    ${lost.length ? `<p><span class="hot">${RIVAL} won ${lost.map(p => p.name).join(' and ')}.</span> Tenders you leave sitting are fair game. Their work rarely lasts: expect the client back.</p>` : ''}
    ${broke.length ? `<p><span class="hot">Broken down:</span> ${broke.map(p => p.name).join(', ')}. No maintenance fee until you send someone. Tap the building on the street to service it.</p>` : ''}
    ${done.length ? `<p><strong style="color:var(--brass)">Research complete:</strong> ${done.map(techName).join(', ')}.${done.some(k => TECH.find(t => t.key === k).opens) ? ' New specialist tenders may appear.' : ''}</p>
      <div class="learn">${done.filter(k => LESSONS[k]).map(k => `<button class="ghost small" type="button" data-lesson="${k}">How to use ${techName(k)}</button>`).join('')}</div>` : ''}
    ${walked.length ? `<p><span class="hot">Your staff walked out</span> over unpaid wages: ${walked.join(', ')}.</p>` : S.cash < 0 ? '<p><span class="hot">You\'re overdrawn.</span> Win jobs or let staff go. Below −£15k your crew will walk out.</p>' : ''}
    <p>${calls.length ? 'Clients on the phone:' : inc ? 'Every fitted client is happy.' : 'Win a tender to start earning maintenance fees.'}</p>
    ${calls.length ? `<ul class="list">${calls.map(p => `<li><span>${p.name}</span><span>${p.reason}</span></li>`).join('')}</ul>` : ''}
    ${evNow ? `<p><strong style="color:var(--brass)">${evNow.label} this month.</strong> ${evNow.text} Tenders pay 25% more margin.</p>` : ''}
    ${(() => { const nx = eventOf(S.month + 1); return nx ? `<p class="note">Next month: ${nx.label}.</p>` : ''; })()}
    ${winter ? '<p class="note">Winter: colder tenders and more callbacks.</p>' : ''}
    <button class="go" type="button" id="mClose">Back to the street</button>`);
  $('mClose').onclick = closeSheet;
  const monthHTML = $('sheet').innerHTML;
  const rewire = () => { $('sheet').querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => openLesson(b.dataset.lesson, () => { $('sheet').innerHTML = monthHTML; $('mClose').onclick = closeSheet; rewire(); })); };
  rewire();
});

let toastT;
function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', 2200); }

// ---------- workshop ----------
let W = null; // { plot, contract, design, sel, world, mode:'design'|'test'|'result', passed, lastResult }
const cv = $('cv'), ctx = cv.getContext('2d');
let cw = 0, ch = 0, dpr = 1, scale = 1;

function defaultSlot(type) {
  if (type === 'revolve') return { type, wings: 4, mouth: 40, core: 0.15, rpm: 4, padded: false, flow: 'both' };
  if (type === 'swing') return { type, curtain: false, flow: 'both' };
  if (type === 'slider') return { type, curtain: false, flow: 'both', button: false };
  if (type === 'gates') return { type, flow: 'both', wide: false };
  return { type: 'wall' };
}
function openWorkshop(i) {
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
  if (c.landmark === 'station') chips.unshift(['Morning in · evening out', 'brass']);
  if (c.landmark === 'towers') chips.unshift(['Stack effect · 9 to 5', 'brass']);
  if (KINDS[c.kind].cinema) chips.unshift(['Film ends at 22s', 'brass']);
  if (g.laps != null) chips.push([`Go-rounds ≤ ${g.laps}`, '']);
  if (c.drill) chips.push([`Clear lobby ≤ ${g.evac}s`, 'hot']);
  $('wsStrip').innerHTML = chips.map(([t, cls]) => `<span class="tag ${cls}">${t}</span>`).join('') + '<span class="tag more">Full brief ›</span>';
}
function closeWorkshop() {
  guard();
  W = null;
  $('workshop').hidden = true; $('dockWs').hidden = true;
  $('streetView').hidden = false; $('dockStreet').hidden = false;
  renderStreet();
}
$('wsBack').onclick = closeWorkshop;
// Reset: first tap arms it, second tap within 3s puts the frontage back how the job started
let resetTimer = null;
function disarmReset() { clearTimeout(resetTimer); resetTimer = null; const b = $('wsResetBtn'); b.textContent = 'Reset'; b.classList.remove('armed'); }
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
const openWsBrief = () => { if (W && W.mode !== 'test') openBrief(W.plot.i, true); };
$('wsBriefBtn').onclick = openWsBrief;
$('wsStrip').onclick = openWsBrief;

function resetPreview() {
  const c = W.contract;
  W.world = new World({ ...worldCfg(c, W.design, tech()), crowd: { in: 0, out: 0, mix: {} }, duration: 0 });
  W.mode = 'design';
}
function sizeCanvas() {
  if (!W) return;
  const r = $('stage').getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const n = W.contract.slots, ww = n * SLOT_W, wh = WORLD_HH * 2;
  cw = r.width;
  ch = Math.min(cw * wh / ww, window.innerHeight * 0.42);
  scale = Math.min(cw / ww, ch / wh);
  cv.style.height = ch + 'px';
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
}
window.addEventListener('resize', sizeCanvas);
cv.addEventListener('click', e => {
  if (!W || W.mode === 'test') return;
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left - cw / 2) / scale;
  const i = Math.floor((x + W.contract.slots * SLOT_W / 2) / SLOT_W);
  if (i >= 0 && i < W.contract.slots) { W.sel = i; renderEditor(); }
});

function designDirty() { if (W.mode === 'result') { W.mode = 'design'; } W.passed = false; resetPreview(); updateHud(); updateCost(); }
function updateCost() {
  const c = W.contract, cost = designCost(W.design, c.existing), paid = charge(cost);
  $('kCost').textContent = money(cost) + (paid !== cost ? ` (you pay ${kmoney(paid)})` : ''); $('kCost').className = cost > c.budget ? 'over' : '';
  $('kBudget').textContent = money(c.budget); $('kPar').textContent = money(c.par.cost); $('kFee').textContent = money(feeOf(c));
  const tb = $('testBtn');
  if (W.mode === 'test') tb.textContent = 'Stop test';
  else if (W.passed) tb.textContent = `Sign off · ${money(feeOf(c) - paid)} profit`;
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
function renderEditor() {
  const d = W.design, s = d[W.sel], u = S.unlocks, rules = W.contract.rules || {};
  const fixed = !!(rules.fixed && rules.fixed[W.sel]);
  const locked = W.mode === 'test' || fixed;
  $('slots').innerHTML = d.map((x, i) => `<button class="slotbtn" type="button" data-i="${i}" aria-pressed="${i === W.sel}"><b>${i + 1} · ${TYPE_LABEL[x.type]}</b><span>${slotLabel(x, i)}</span></button>`).join('');
  $('slots').querySelectorAll('.slotbtn').forEach(b => b.onclick = () => { W.sel = +b.dataset.i; renderEditor(); });
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
    `<div class="seg${W.contract.landmark === 'station' ? ' two' : ''}">${(W.contract.landmark === 'station' ? ['wall', 'gates'] : ['wall', 'revolve', 'swing', 'slider']).map(typeBtn).join('')}</div>`;
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
function showSpeed() { const sp = S.speed || 3; $('ffBtn').textContent = sp + '×'; $('ffBtn').setAttribute('aria-pressed', sp > 1); $('ffBtn').setAttribute('aria-label', `Test speed ${sp} times`); $('skipBtn').hidden = !(W && W.mode === 'test'); }
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
  if (W.passed) return signOff();
  if (W.design.every(s => s.type === 'wall')) { toast('Add at least one door', true); return; }
  W.world = new World(worldCfg(c, W.design, tech()));
  W.mode = 'test'; W.fx = []; W.lastEvT = -1; W.steps = 0;
  if (coachEl.id === 'run') coachDone();
  renderEditor(); updateHud(); showSpeed();
});

function evaluateTest() {
  const c = W.contract, g = c.goals, r = { ...W.world.stats, minTemp: W.world.minTemp, maxTemp: W.world.maxTemp, wait: W.world.waitP90() };
  if (c.drill && r.evac == null) r.evac = null;
  const cost = designCost(W.design, c.existing);
  const rows = [
    ['Through', r.through, `≥ ${g.through}`, r.through >= g.through],
    ['Bumps', r.bumps, `≤ ${g.bumps}`, r.bumps <= g.bumps],
  ];
  if (g.minTemp != null) rows.push(['Coldest lobby', r.minTemp.toFixed(1) + '°', `≥ ${g.minTemp}°`, r.minTemp >= g.minTemp]);
  if (g.wait != null) rows.push(['9 in 10 through within', r.wait.toFixed(1) + 's', `≤ ${g.wait}s`, r.wait <= g.wait]);
  if (g.maxTemp != null) rows.push(['Hottest lobby', r.maxTemp.toFixed(1) + '°', `≤ ${g.maxTemp}°`, r.maxTemp <= g.maxTemp]);
  if (g.access) rows.push(['Wheelchairs and prams turned away', r.accessFail, '0', r.accessFail === 0]);
  if (g.bikes) rows.push(['Cyclists turned away', r.bikeFail, '0', r.bikeFail === 0]);
  if (g.laps != null) rows.push(['Went round again', r.laps, `≤ ${g.laps}`, r.laps <= g.laps]);
  if (c.drill) rows.push(['Fire drill: lobby cleared in', r.evac == null ? 'not cleared' : r.evac.toFixed(1) + 's', `≤ ${g.evac}s`, r.evac != null && r.evac <= g.evac]);
  if (violatesRules(c, W.design)) rows.push(['Client rules', 'broken', c.rules.forbid ? 'no ' + c.rules.forbid.join(', ') + ' doors' : 'listed door', false]);
  rows.push(['Cost', money(cost), `≤ ${money(c.budget)}`, cost <= c.budget]);
  if (g.laps == null) rows.push(['Went round again', r.laps, '', null]);
  rows.push(['Safety stops', r.stops, '', null]);
  const pass = rows.every(x => x[3] !== false);
  let stars = 0;
  if (pass) { stars = 1; if (cost <= c.par.cost) { stars = 2; if (r.bumps === 0 && r.stops === 0) stars = 3; } }
  W.mode = 'result'; W.passed = pass; W.stars = stars; W.cost = cost;
  const hint = pass ? '' : !rows[0][3] ? 'Not enough got through. More doors, faster wings, or wider mouths.'
    : !rows[1][3] ? 'Too many bumps. Slow the wings so the tips stay under the safe speed, or give swing doors a direction.'
    : (g.wait != null && r.wait > g.wait) ? 'The queues at the gates are too long. Each lane takes one person at a time, so point more lanes the busy way (Auto lanes follow the rush), and gate-line staff help people tap through faster.'
    : (g.maxTemp != null && r.maxTemp > g.maxTemp) ? 'The lobby got too hot. Every open door lets the heat in, just as it lets the cold in during winter. Revolving doors seal; air curtains help.'
    : (g.minTemp != null && r.minTemp < g.minTemp) ? 'The lobby got too cold. Swing and sliding doors leak; revolving doors with enough wings seal.'
    : (g.access && r.accessFail) ? `Wheelchairs and prams need a sliding door they can reach${S.unlocks.wide ? ', or a wide drum with 3 wings or fewer' : ''}${c.site && c.site.rampBays ? ` in a bay with the ramp (bay ${c.site.rampBays.map(i => i + 1).join(', ')})` : ''}.`
    : (g.bikes && r.bikeFail) ? 'Cyclists can\'t wheel a bike through a revolving door. Give them a swing or sliding door that isn\'t push-button only.'
    : violatesRules(c, W.design) ? 'The client\'s rules forbid one of your doors. Swap it out.'
    : (c.drill && !(r.evac != null && r.evac <= g.evac)) ? 'The lobby took too long to empty. More or wider exits help, and a pillar just inside a busy exit stops the crowd jamming in the doorway.'
    : (g.laps != null && r.laps > g.laps) ? 'People near the slow hub are missing their exit and riding round again. A bigger core keeps them on the fast outer ring.' : 'Over budget.';
  sheet(`<div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('')}</div>
    <h3>${pass ? (stars === 3 ? 'Flawless install' : 'Client signs off') : 'Not good enough yet'}</h3>
    <p>${pass ? `Profit ${money(feeOf(c) - charge(cost))}${stars < 2 ? ` · the surveyor did it for ${money(c.par.cost)} (list)` : ''}.` : hint}</p>
    ${pass && ((g.minTemp != null && c.outsideTemp < 12 && r.minTemp >= 19.5) || (g.maxTemp != null && r.maxTemp <= 22.5)) ? '<p class="note"><strong style="color:var(--ok)">🌿 Green star.</strong> The lobby stayed snug, so the client\'s heating bills drop. They\'ll pay 15% more maintenance.</p>' : ''}
    ${pass && r.bumps ? `<p class="note">${r.bumps} bump${r.bumps > 1 ? 's' : ''} go on your insurance record: +${money(45 * r.bumps)} a month while this install stands.</p>` : ''}
    <ul class="list">${rows.map(([a, v, gl, ok]) => `<li class="${ok === true ? 'pass' : ok === false ? 'fail' : ''}"><span>${a} <span style="color:var(--mute)">${gl}</span></span><span>${v}</span></li>`).join('')}</ul>
    <div style="display:flex;gap:8px"><button class="ghost" type="button" id="rEdit">Keep tweaking</button>${pass ? `<button class="go" type="button" id="rSign">Sign off</button>` : ''}</div>`);
  $('rEdit').onclick = () => { closeSheet(); renderEditor(); };
  if (pass) $('rSign').onclick = () => { closeSheet(); signOff(); };
  setTimeout(() => coach('result', () => document.querySelector('#sheet .list')), 300);
  renderEditor();
}
function signOff() {
  const p = W.plot, c = W.contract, cost = designCost(W.design, c.existing), profit = feeOf(c) - charge(cost);
  S.cash += profit;
  p.install = W.design.map(s => ({ ...s }));
  p.stars = Math.max(p.stars, W.stars);
  p.fee = Math.max(p.fee, c.fee);
  p.status = 'fitted'; p.contract = null; p.reason = null;
  // a fresh install: new doors, a clean record, and a green star if the lobby stayed snug
  const wst = W.world.stats;
  p.wear = 0; p.broken = false; p.cert = false;
  p.bumpRec = wst.bumps; p.stopRec = wst.stops;
  p.green = (c.goals.minTemp != null && c.outsideTemp < 12 && W.world.minTemp >= 19.5) || (c.goals.maxTemp != null && W.world.maxTemp <= 22.5);
  S.jobs++;
  S.recent = [...(S.recent || []), designSig(p.install)].slice(-4);
  const before = S.plots.filter(x => x.status === 'locked').length;
  save();
  closeWorkshop();
  const after = S.plots.filter(x => x.status === 'locked').length;
  toast(`${p.name} signed · ${money(profit)}${before > after ? ' · new client on the street' : ''}`);
  confetti(W ? null : p.i);
}
// a burst of confetti over the street, and the building you just fitted lights up
function confetti(i) {
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

function updateHud() {
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
  $('hTemp').textContent = c.landmark === 'station' && testing ? String(w.people.filter(p => p.state === 'approach').length) : testing ? `${(hot ? w.maxTemp : w.minTemp).toFixed(1)}°` : `${c.outsideTemp}°C`;
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
  $('cTemp').querySelector('span').textContent = c.landmark === 'station' && testing ? 'Queuing' : testing ? (hot ? 'Lobby max' : 'Lobby min') : 'Street';
}

// ---------- drawing ----------
const rngTex = makeRng(11);
const specks = Array.from({ length: 220 }, () => [rngTex() * 2 - 1, rngTex(), rngTex()]);
// floors: each client's lobby gets its own material
const FLOOR = {
  cafe:     { base: '#3a2a20', kind: 'boards', line: 'rgba(0,0,0,.28)', hi: 'rgba(236,200,150,.05)' },
  pharmacy: { base: '#2b3634', kind: 'tiles', size: 0.5, line: 'rgba(236,245,240,.06)' },
  bank:     { base: '#2d2b29', kind: 'check', size: 0.75, alt: '#363330' },
  office:   { base: '#252b33', kind: 'tiles', size: 1.0, line: 'rgba(156,196,236,.07)' },
  hotel:    { base: '#3a2230', kind: 'carpet', border: 'rgba(212,169,79,.35)' },
  library:  { base: '#3a2e22', kind: 'parquet', line: 'rgba(0,0,0,.25)' },
  store:    { base: '#332c25', kind: 'tiles', size: 0.9, line: 'rgba(236,230,216,.06)' },
  townhall: { base: '#302d28', kind: 'check', size: 0.9, alt: '#38342e' },
  station:  { base: '#2c2f34', kind: 'terrazzo' },
};
function groundLayer(w) {
  const key = [W.contract.seed, W.contract.kind, cw, ch, dpr, S.month % 12].join('|');
  if (W.bg && W.bg.key === key) return W.bg.cv;
  const cv2 = document.createElement('canvas'); cv2.width = cv.width; cv2.height = cv.height;
  const c = cv2.getContext('2d'), HW = w.HW, HH = w.HH, lw = 1 / scale, R = makeRng(W.contract.seed || 3);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.translate(cw / 2, ch / 2); c.scale(scale, scale);
  // outside: paving slabs, a kerb and a strip of road
  const m = S.month % 12, wet = W.contract.rain, snowy = W.contract.outsideTemp <= 1;
  c.fillStyle = wet ? '#30353d' : '#3a3f48'; c.fillRect(-HW, -HH, HW * 2, HH);
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = lw;
  c.beginPath();
  for (let y = 0, row = 0; y > -HH + 0.45; y -= 0.6, row++) { c.moveTo(-HW, y); c.lineTo(HW, y); for (let x = -HW + (row % 2) * 0.45; x < HW; x += 0.9) { c.moveTo(x, y); c.lineTo(x, y - 0.6); } }
  c.stroke();
  for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(236,230,216,${0.02 + R() * 0.03})`; c.fillRect(-HW + R() * HW * 2, -HH + R() * HH, 0.4 + R() * 0.5, 0.3 + R() * 0.3); }
  c.fillStyle = '#23272e'; c.fillRect(-HW, -HH, HW * 2, 0.42);
  c.fillStyle = '#6a707a'; c.fillRect(-HW, -HH + 0.42, HW * 2, 0.07);
  c.strokeStyle = 'rgba(236,230,216,.35)'; c.lineWidth = 2 * lw; c.setLineDash([0.5, 0.45]); c.beginPath(); c.moveTo(-HW, -HH + 0.12); c.lineTo(HW, -HH + 0.12); c.stroke(); c.setLineDash([]);
  if (wet) for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(156,196,236,.10)'; c.beginPath(); c.ellipse(-HW + R() * HW * 2, -HH + 0.8 + R() * (HH - 1.5), 0.3 + R() * 0.4, 0.12 + R() * 0.1, 0, 0, TAU); c.fill(); }
  if (snowy) { c.fillStyle = 'rgba(235,242,250,.16)'; c.fillRect(-HW, -HH + 0.49, HW * 2, HH - 0.49); for (let i = 0; i < 16; i++) { c.fillStyle = 'rgba(240,245,250,.12)'; c.beginPath(); c.ellipse(-HW + R() * HW * 2, -HH + 0.5 + R() * (HH - 0.8), 0.15 + R() * 0.3, 0.06 + R() * 0.08, 0, 0, TAU); c.fill(); } }
  if (m >= 8 && m <= 10) for (let i = 0; i < 26; i++) { c.fillStyle = ['#b8642c', '#d89a3f', '#8a4a2a'][i % 3]; c.save(); c.translate(-HW + R() * HW * 2, -HH + 0.6 + R() * (HH - 1)); c.rotate(R() * TAU); c.beginPath(); c.ellipse(0, 0, 0.07, 0.035, 0, 0, TAU); c.fill(); c.restore(); }
  // inside: the floor
  const f = FLOOR[W.contract.kind] || FLOOR.office;
  c.fillStyle = f.base; c.fillRect(-HW, 0, HW * 2, HH);
  c.lineWidth = lw;
  if (f.kind === 'boards') { c.strokeStyle = f.line; c.beginPath(); for (let x = -HW; x < HW; x += 0.22) { c.moveTo(x, 0); c.lineTo(x, HH); } for (let x = -HW, k = 0; x < HW; x += 0.22, k++) for (let y = (k % 3) * 0.5; y < HH; y += 1.4) { c.moveTo(x, y); c.lineTo(x + 0.22, y); } c.stroke(); for (let i = 0; i < 40; i++) { c.fillStyle = f.hi; c.fillRect(-HW + Math.floor(R() * HW * 2 / 0.22) * 0.22, R() * HH, 0.22, 0.6); } }
  if (f.kind === 'tiles') { c.strokeStyle = f.line; c.beginPath(); for (let x = -HW; x <= HW; x += f.size) { c.moveTo(x, 0); c.lineTo(x, HH); } for (let y = 0; y <= HH; y += f.size) { c.moveTo(-HW, y); c.lineTo(HW, y); } c.stroke(); }
  if (f.kind === 'check') { c.fillStyle = f.alt; for (let x = -HW, i = 0; x < HW; x += f.size, i++) for (let y = 0, j = 0; y < HH; y += f.size, j++) if ((i + j) % 2) c.fillRect(x, y, f.size, f.size); }
  if (f.kind === 'carpet') { c.strokeStyle = f.border; c.lineWidth = 0.08; c.strokeRect(-HW + 0.35, 0.35, HW * 2 - 0.7, HH - 0.7); c.lineWidth = 0.03; c.strokeRect(-HW + 0.5, 0.5, HW * 2 - 1, HH - 1); for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(212,169,79,.05)'; c.beginPath(); c.arc(-HW + 0.8 + R() * (HW * 2 - 1.6), 0.8 + R() * (HH - 1.6), 0.08, 0, TAU); c.fill(); } }
  if (f.kind === 'parquet') { c.strokeStyle = f.line; c.beginPath(); for (let x = -HW, i = 0; x < HW; x += 0.5, i++) for (let y = 0, j = 0; y < HH; y += 0.5, j++) { if ((i + j) % 2) { for (let k = 0.125; k < 0.5; k += 0.125) { c.moveTo(x + k, y); c.lineTo(x + k, y + 0.5); } } else { for (let k = 0.125; k < 0.5; k += 0.125) { c.moveTo(x, y + k); c.lineTo(x + 0.5, y + k); } } } c.stroke(); }
  if (f.kind === 'terrazzo') for (let i = 0; i < 500; i++) { c.fillStyle = ['rgba(236,230,216,.10)', 'rgba(212,169,79,.10)', 'rgba(0,0,0,.18)'][i % 3]; c.fillRect(-HW + R() * HW * 2, R() * HH, 0.04 + R() * 0.04, 0.04 + R() * 0.04); }
  // a soft shadow under the facade on both sides
  let gr = c.createLinearGradient(0, 0, 0, 0.6); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-HW, 0, HW * 2, 0.6);
  gr = c.createLinearGradient(0, 0, 0, -0.5); gr.addColorStop(0, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-HW, -0.5, HW * 2, 0.5);
  W.bg = { key, cv: cv2 };
  return cv2;
}
function draw(t) {
  if (!W || !cv.width || !cv.height) return;   // not laid out yet
  const c = ctx, w = W.world, HW = w.HW, HH = w.HH;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cw, ch);
  c.save(); c.translate(cw / 2, ch / 2); c.scale(scale, scale);
  const lw = 1 / scale;
  // the painted ground: pavement and kerb outside, the building's own floor inside (cached)
  const bg = groundLayer(w);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bg, 0, 0); c.restore();
  if (W.contract.outsideTemp <= 1) {
    c.fillStyle = 'rgba(220,235,250,0.5)';
    for (let i = 0; i < 30; i++) { const s = specks[i]; const yy = -HH + ((s[1] * HH + t * (0.3 + s[2] * 0.4)) % HH); c.beginPath(); c.arc(s[0] * HW + Math.sin(t + i) * 0.1, Math.min(yy, -0.05), 0.03, 0, TAU); c.fill(); }
  }
  if (W.contract.rain) {
    c.strokeStyle = 'rgba(156,196,236,0.35)'; c.lineWidth = 1.2 / scale;
    for (let i = 0; i < 40; i++) { const s = specks[i + 40]; const yy = -HH + ((s[1] * HH + t * 3.2 * (0.7 + s[2] * 0.4)) % HH); const xx = s[0] * HW; c.beginPath(); c.moveTo(xx, Math.min(yy, -0.1)); c.lineTo(xx - 0.05, Math.min(yy + 0.22, -0.02)); c.stroke(); }
  }
  if (W.contract.heat) {   // heatwave: hot pavement and a lobby that warms as heat leaks in
    c.fillStyle = 'rgba(239,140,76,0.16)'; c.fillRect(-HW, -HH, HW * 2, HH);
    const over = Math.max(0, Math.min(1, (w.temp - 21) / 6));
    if (over > 0) { c.fillStyle = `rgba(239,91,76,${0.12 * over})`; c.fillRect(-HW, 0, HW * 2, HH); }
  }
  drawSite(c, W.contract.site, lw);
  // selected slot
  if (W.mode !== 'test') {
    const x0 = -HW + W.sel * SLOT_W;
    c.strokeStyle = 'rgba(212,169,79,0.6)'; c.setLineDash([0.12, 0.1]); c.lineWidth = 1.5 * lw;
    c.strokeRect(x0 + 0.06, -HH + 0.06, SLOT_W - 0.12, HH * 2 - 0.12); c.setLineDash([]);
  }
  // facade segments
  c.lineCap = 'round';
  const bld = BLD[W.contract.kind] || { base: '#4b6b8a', trim: '#cfd8e0' };
  for (const [a, b] of w.segs || w.buildSegments()) {
    const x0 = Math.max(a, -HW), x1 = Math.min(b, HW); if (x1 <= x0) continue;
    c.fillStyle = bld.base; c.fillRect(x0, -0.11, x1 - x0, 0.22);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x0, 0.05, x1 - x0, 0.06);
    c.fillStyle = bld.trim; c.globalAlpha = 0.7; c.fillRect(x0, -0.11, x1 - x0, 0.03); c.globalAlpha = 1;
  }
  // seasonal dressing on the shopfront
  const evk = W.contract.event || (eventOf(S.month) || {}).key;
  if (evk === 'xmas') for (let x = -HW + 0.15, k = 0; x < HW; x += 0.3, k++) { c.fillStyle = ['#ef5b4c', '#6fcf97', '#f3c56b', '#9cc4ec'][k % 4]; c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + k); c.beginPath(); c.arc(x, -0.2 + (k % 2) * 0.03, 0.04, 0, TAU); c.fill(); }
  c.globalAlpha = 1;
  // gap doors
  for (const d of w.doors) {
    if (d.type === 'swing') {
      const ang = d.swing * 1.2;
      c.strokeStyle = d.curtain ? '#d4a94f' : '#9cc4ec'; c.lineWidth = 0.06;
      for (const sg of [-1, 1]) { const hx = d.cx + sg * d.w / 2; c.beginPath(); c.moveTo(hx, 0); c.lineTo(hx - sg * Math.cos(ang) * d.w / 2, Math.sin(ang) * d.w / 2 * (sg > 0 ? 1 : -1)); c.stroke(); }
    } else if (d.type === 'slider') {
      const g = d.w * d.open / 2;
      c.fillStyle = d.button ? 'rgba(111,207,151,0.85)' : 'rgba(156,196,236,0.85)';
      c.fillRect(d.cx - d.w / 2 - 0.02, -0.06, d.w / 2 - g, 0.12); c.fillRect(d.cx + g, -0.06, d.w / 2 - g, 0.12);
      if (d.curtain) { c.fillStyle = '#d4a94f'; c.fillRect(d.cx - d.w / 2, 0.1, d.w, 0.05); }
    }
    if (d.vestibule && (d.type === 'swing' || d.type === 'slider')) {
      // inner doors and side walls of the draught lobby
      c.strokeStyle = 'rgba(200,225,245,0.45)'; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(d.cx - d.w / 2 - 0.05, 0); c.lineTo(d.cx - d.w / 2 - 0.05, 0.75); c.moveTo(d.cx + d.w / 2 + 0.05, 0); c.lineTo(d.cx + d.w / 2 + 0.05, 0.75); c.stroke();
      c.setLineDash([0.12, 0.08]); c.beginPath(); c.moveTo(d.cx - d.w / 2, 0.75); c.lineTo(d.cx + d.w / 2, 0.75); c.stroke(); c.setLineDash([]);
    }
    if (d.doorman && d.type !== 'wall' && d.type !== 'gates') {
      const dx = d.cx + (d.type === 'revolve' ? d.R + 0.25 : d.w / 2 + 0.3), dy = 0.35;
      c.fillStyle = '#d4a94f'; c.beginPath(); c.arc(dx, dy, 0.17, 0, TAU); c.fill();
      c.fillStyle = '#12151b'; c.beginPath(); c.arc(dx, dy, 0.07, 0, TAU); c.fill();
    }
    if (d.type !== 'wall' && d.type !== 'gates' && d.flow && d.flow !== 'both') {
      c.save(); c.scale(lw, lw); c.fillStyle = 'rgba(236,230,216,0.6)'; c.font = '700 11px Figtree, sans-serif'; c.textAlign = 'center';
      c.fillText(d.flow === 'in' ? '↓ IN' : '↑ OUT', d.cx * scale, (d.type === 'revolve' ? d.R + 0.45 : 0.55) * scale); c.restore();
    }
    if (d.leak > 0.005) {
      c.strokeStyle = `rgba(156,196,236,${Math.min(0.7, d.leak * 8)})`; c.lineWidth = 2 * lw;
      for (let i = 0; i < 4; i++) { const x = d.cx + (i - 1.5) * 0.22; const y0 = ((t * 2 + i * 0.4) % 2) - 1.4; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + 0.3); c.stroke(); }
    }
  }
  // gate lines: cabinets, paddles, and an arrow on each lane showing which way it lets people through
  for (const d of w.doors) {
    if (d.type !== 'gates') continue;
    for (const b of d.cabs) {
      const x0 = d.cx + b - d.cabHalf;
      c.fillStyle = '#3a404b'; c.fillRect(x0, -0.5, d.cabHalf * 2, 1.0);
      c.fillStyle = '#5a626e'; c.fillRect(x0, -0.5, d.cabHalf * 2, 0.08); c.fillRect(x0, 0.42, d.cabHalf * 2, 0.08);
    }
    for (const l of d.gl) {
      if (l.open <= 0) {   // paddles closed: two flaps meeting in the middle
        c.strokeStyle = l.user ? '#f3c56b' : '#d4a94f'; c.lineWidth = 0.07;
        c.beginPath(); c.moveTo(l.x - l.hw, 0); c.lineTo(l.x - 0.03, 0); c.moveTo(l.x + 0.03, 0); c.lineTo(l.x + l.hw, 0); c.stroke();
      }
      const col = l.switchT > 0 ? `rgba(212,169,79,${0.4 + 0.4 * Math.sin(t * 12)})` : l.dir > 0 ? '#9cc4ec' : '#e79a86';
      const ay = l.dir > 0 ? 0.25 : -0.25, s2 = 0.12 * l.dir;
      c.fillStyle = col; c.beginPath(); c.moveTo(l.x, ay + s2); c.lineTo(l.x - 0.1, ay - s2); c.lineTo(l.x + 0.1, ay - s2); c.closePath(); c.fill();
      if (l.auto) { c.fillStyle = 'rgba(212,169,79,.8)'; c.beginPath(); c.arc(l.x, -ay * 1.4, 0.035, 0, TAU); c.fill(); }
    }
    if (d.doorman) { c.fillStyle = '#d4a94f'; c.beginPath(); c.arc(d.cx + d.cabs[d.cabs.length - 1] - 0.05, 0.75, 0.17, 0, TAU); c.fill(); c.fillStyle = '#12151b'; c.beginPath(); c.arc(d.cx + d.cabs[d.cabs.length - 1] - 0.05, 0.75, 0.07, 0, TAU); c.fill(); }
  }
  // revolving drums
  for (const d of w.doors) {
    if (d.type !== 'revolve') continue;
    const th = d.mouth * Math.PI / 180, rc = d.core * d.R, R = d.R;
    c.fillStyle = '#2b2722'; c.beginPath(); c.arc(d.cx, 0, R, 0, TAU); c.fill();
    const rs = (V_SAFE + (d.padded ? 0.3 : 0)) / Math.max(0.01, W.mode === 'test' && d.sensor ? (d.omegaEff || d.rpm * TAU / 60) : d.rpm * TAU / 60);
    if (rs < R) {
      const r0 = Math.max(rs, rc);
      c.fillStyle = 'rgba(239,91,76,0.2)'; c.beginPath(); c.arc(d.cx, 0, R, 0, TAU); c.arc(d.cx, 0, r0, 0, TAU, true); c.fill();
      c.setLineDash([0.08, 0.07]); c.strokeStyle = 'rgba(239,91,76,0.85)'; c.lineWidth = 1.5 * lw; c.beginPath(); c.arc(d.cx, 0, r0, 0, TAU); c.stroke(); c.setLineDash([]);
    }
    if (d.sensor) { c.strokeStyle = 'rgba(111,207,151,0.7)'; c.lineWidth = 0.03; c.setLineDash([0.05, 0.06]); c.beginPath(); c.arc(d.cx, 0, R - 0.12, 0, TAU); c.stroke(); c.setLineDash([]); }
    for (const a0 of [-Math.PI / 2 + th, Math.PI / 2 + th]) {
      c.strokeStyle = '#d4a94f'; c.lineWidth = 0.08; c.beginPath(); c.arc(d.cx, 0, R + 0.03, a0, a0 + Math.PI - 2 * th); c.stroke();
    }
  }
  // your own pillars and lane barriers
  for (const o of w.obs) {
    if (!o.item) continue;
    if (o.tag === 'pillar') {
      const g = c.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.1, o.x, o.y, o.r);
      g.addColorStop(0, '#e6dcc4'); g.addColorStop(1, '#9a8f78'); c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.r, 0, TAU); c.fill();
    } else if (o.tag === 'lane') {
      c.strokeStyle = '#ef5b4c'; c.lineWidth = 0.04; c.setLineDash([0.12, 0.08]); c.beginPath(); c.moveTo((o.x0 + o.x1) / 2, o.y0); c.lineTo((o.x0 + o.x1) / 2, o.y1); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#4a505c'; for (const y of [o.y0, o.y1]) { c.beginPath(); c.arc((o.x0 + o.x1) / 2, y, 0.07, 0, TAU); c.fill(); }
    }
  }
  for (const p of w.people) drawPerson(c, p);
  for (const d of w.doors) {
    if (d.type !== 'revolve') continue;
    if (d.folded) {   // book-folded for the fire drill: wings pushed flat to the sides
      c.strokeStyle = 'rgba(190,220,245,0.75)'; c.lineWidth = 0.07;
      for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(d.cx + sg * 0.65, -0.5); c.lineTo(d.cx + sg * 0.65, 0.5); c.stroke(); }
      continue;
    }
    const rc = d.core * d.R, S2 = TAU / d.wings;
    for (let k = 0; k < d.wings; k++) {
      const a = d.phi + k * S2, ca = Math.cos(a), sa = Math.sin(a);
      c.strokeStyle = d.padded ? 'rgba(111,207,151,0.8)' : 'rgba(190,220,245,0.75)'; c.lineWidth = 0.07;
      c.beginPath(); c.moveTo(d.cx + ca * rc, sa * rc); c.lineTo(d.cx + ca * d.R, sa * d.R); c.stroke();
      c.strokeStyle = '#d4a94f'; c.lineWidth = 0.02; c.beginPath(); c.moveTo(d.cx + ca * rc, sa * rc); c.lineTo(d.cx + ca * d.R, sa * d.R); c.stroke();
    }
    const g = c.createRadialGradient(d.cx - rc * 0.3, -rc * 0.3, rc * 0.1, d.cx, 0, rc);
    g.addColorStop(0, '#f0d08a'); g.addColorStop(1, '#8a6a2a');
    c.fillStyle = g; c.beginPath(); c.arc(d.cx, 0, rc, 0, TAU); c.fill();
    if (d.stopTimer > 0) { c.save(); c.scale(lw, lw); c.fillStyle = '#ef5b4c'; c.font = '700 11px Figtree, sans-serif'; c.textAlign = 'center'; c.fillText('SAFETY STOP', d.cx * scale, (d.R + 0.3) * scale); c.restore(); }
  }
  // fx
  if (W.fx) {
    c.save(); c.scale(lw, lw); c.textAlign = 'center';
    W.fx = W.fx.filter(f => t - f.t0 < 1.1);
    for (const f of W.fx) {
      const k = (t - f.t0) / 1.1; c.globalAlpha = 1 - k;
      if (f.type === 'bump') { c.fillStyle = '#ef5b4c'; c.font = '700 11px Figtree, sans-serif'; c.fillText('BUMP', f.x * scale, (f.y - 0.35 - k * 0.3) * scale); }
      else if (f.type === 'lap') { c.fillStyle = '#b48cf0'; c.font = '700 12px Figtree, sans-serif'; c.fillText('↻', f.x * scale, (f.y - 0.3 - k * 0.3) * scale); }
      else if (f.type === 'away') { c.fillStyle = '#ef5b4c'; c.font = '700 11px Figtree, sans-serif'; c.fillText(f.who === 'bike' ? 'no door for bikes' : GUEST[f.who] && GUEST[f.who].stepfree ? 'no step-free door' : 'no way in', f.x * scale, f.y * scale); }
      else if (f.type === 'jam') { c.fillStyle = '#ef5b4c'; c.font = '700 11px Figtree, sans-serif'; c.fillText('JAM', f.x * scale, (f.y + 0.9 + k * 0.2) * scale); }
      else if (f.type === 'clear') { c.globalAlpha = 1; c.fillStyle = '#6fcf97'; c.font = '700 14px Figtree, sans-serif'; c.fillText('LOBBY CLEAR', 0, 1.6 * scale); }
      else if (f.type === 'through') { c.strokeStyle = '#6fcf97'; c.lineWidth = 1.5; c.beginPath(); c.arc(f.x * scale, f.y * scale, (0.2 + k * 0.3) * scale, 0, TAU); c.stroke(); }
    }
    c.restore();
  }
  // a day in phases: which part of it we're in, and trains pulling in
  if (W.contract.crowd.phases && W.mode === 'test') {
    c.save(); c.scale(lw, lw); c.textAlign = 'center'; c.font = '700 11px Figtree, sans-serif';
    const PH = { station: ['MORNING RUSH · INTO THE STATION', 'EVENING · TRAINS EMPTYING OUT'], towers: ['9AM · IN OFF THE UNDERGROUND', 'LUNCH · BOTH WAYS', '5PM · EVERYONE OUT'], cinema: ['FILM SHOWING · NEXT QUEUE ARRIVING', 'FILM ENDS · EVERYONE OUT', 'NEXT SCREENING'] }[W.contract.kind] || [];
    const lab = PH[w.phase || 0] || '', outish = /OUT/.test(lab);
    c.fillStyle = outish ? 'rgba(231,154,134,.9)' : 'rgba(156,196,236,.9)';
    c.fillText(lab, 0, (-HH + 0.35) * scale);
    const tr = w.events.filter(e => e.type === 'train' && w.t - e.t < 1.6).pop();
    if (tr) { c.fillStyle = `rgba(243,197,107,${1 - (w.t - tr.t) / 1.6})`; c.font = '700 13px Figtree, sans-serif'; c.fillText('TRAIN IN', 0, (HH - 0.55) * scale); }
    c.restore();
  }
  // fire alarm: flashing band across the lobby
  if (w.alarm && w.stats.evac == null) {
    c.save(); c.scale(lw, lw);
    c.fillStyle = `rgba(239,91,76,${0.18 + 0.12 * Math.sin(t * 9)})`; c.fillRect(-HW * scale, 0, HW * 2 * scale, HH * scale);
    c.fillStyle = '#ef5b4c'; c.font = '700 13px Figtree, sans-serif'; c.textAlign = 'center';
    c.fillText(`FIRE DRILL · ${(w.t - w.alarmT).toFixed(1)}s`, 0, (HH - 0.5) * scale);
    c.restore();
  }
  // labels
  c.save(); c.scale(lw, lw);
  c.font = '600 10px Figtree, sans-serif'; c.fillStyle = 'rgba(236,230,216,0.7)';
  c.textAlign = 'right'; c.fillText(`STREET ${W.contract.outsideTemp}°C${W.contract.rain ? ' · RAIN' : ''}`, (HW - 0.12) * scale, (-HH + 0.3) * scale);
  c.fillStyle = 'rgba(212,169,79,0.65)';
  c.fillText(W.contract.landmark === 'station' ? 'CONCOURSE' : `LOBBY ${w.temp.toFixed(1)}°C`, (HW - 0.12) * scale, (HH - 0.15) * scale); c.textAlign = 'left';
  c.restore();
  c.restore();
}
// street furniture: steps and ramp, the cash machine, taxi rank, bus shelter, tables, desks, columns, standing people
function drawSite(c, site, lw) {
  if (!site) return;
  for (const d of site.decos || []) {
    if (d.kind === 'steps' || d.kind === 'ramp') {
      c.fillStyle = d.kind === 'ramp' ? 'rgba(111,207,151,0.12)' : 'rgba(236,230,216,0.07)'; c.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      c.strokeStyle = d.kind === 'ramp' ? 'rgba(111,207,151,0.45)' : 'rgba(236,230,216,0.22)'; c.lineWidth = lw * 1.2;
      c.beginPath();
      if (d.kind === 'steps') for (let y = d.y0 + 0.15; y < d.y1; y += 0.18) { c.moveTo(d.x0, y); c.lineTo(d.x1, y); }
      else for (let x = d.x0 + 0.3; x < d.x1; x += 0.5) { c.moveTo(x, d.y1 - 0.08); c.lineTo(x + 0.18, d.y0 + 0.12); }
      c.stroke();
    } else if (d.kind === 'atm') {
      c.fillStyle = '#4b6b8a'; c.fillRect(d.x - 0.22, d.y - 0.1, 0.44, 0.14); c.fillStyle = '#6fcf97'; c.fillRect(d.x - 0.1, d.y - 0.07, 0.2, 0.05);
    } else if (d.kind === 'taxi') {
      c.fillStyle = '#d4a94f'; c.fillRect(d.x - 0.35, d.y - 0.18, 0.7, 0.36); c.fillStyle = '#12151b';
      c.save(); c.scale(lw, lw); c.font = '700 9px Figtree, sans-serif'; c.textAlign = 'center'; c.fillText('TAXI', d.x / lw, (d.y + 0.07) / lw); c.restore();
    } else if (d.kind === 'shelter') {
      c.fillStyle = 'rgba(156,196,236,0.18)'; c.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      c.strokeStyle = 'rgba(156,196,236,0.6)'; c.lineWidth = lw * 1.5; c.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    } else if (d.kind === 'queuer') drawStanding(c, d.x, d.y, 0.2);
    else if (d.kind === 'lifts') {
      c.fillStyle = '#2c313a'; c.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      for (let k = 0; k < 3; k++) { const lx = d.x0 + 0.1 + k * (d.x1 - d.x0 - 0.2) / 3; c.fillStyle = '#4a505c'; c.fillRect(lx + 0.05, d.y0 + 0.05, (d.x1 - d.x0 - 0.2) / 3 - 0.1, d.y1 - d.y0 - 0.1); c.fillStyle = '#f3c56b'; c.fillRect(lx + (d.x1 - d.x0 - 0.2) / 6 - 0.03, d.y0 + 0.02, 0.06, 0.04); }
    } else if (d.kind === 'escalator') {
      c.fillStyle = '#2c313a'; c.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      c.strokeStyle = 'rgba(236,230,216,.18)'; c.lineWidth = lw;
      const off = (performance.now() / 1000 * 0.5) % 0.18;
      c.beginPath(); for (let y = d.y1 - off; y > d.y0; y -= 0.18) { c.moveTo(d.x0 + 0.1, y); c.lineTo(d.x1 - 0.1, y); } c.stroke();
      c.fillStyle = '#4a505c'; c.fillRect(d.x0, d.y0, 0.08, d.y1 - d.y0); c.fillRect(d.x1 - 0.08, d.y0, 0.08, d.y1 - d.y0); c.fillRect((d.x0 + d.x1) / 2 - 0.04, d.y0, 0.08, d.y1 - d.y0);
    } else if (d.kind === 'board') {
      c.fillStyle = '#14171d'; c.fillRect(d.x0, d.y - 0.18, d.x1 - d.x0, 0.36);
      c.save(); c.scale(lw, lw); c.fillStyle = '#f3c56b'; c.font = '600 8px DM Mono, monospace'; c.textAlign = 'center';
      c.fillText('08:12 CITY  ·  08:15 COAST  ·  08:19 NORTH', (d.x0 + d.x1) / 2 / lw, (d.y + 0.06) / lw); c.restore();
    }
    else if (d.kind === 'window') {
      // a dressed shop window along the facade: a warm glow and fairy lights
      c.fillStyle = 'rgba(212,169,79,0.16)'; c.fillRect(d.x0, -0.45, d.x1 - d.x0, 0.32);
      const cols = ['#ef5b4c', '#6fcf97', '#d4a94f', '#9cc4ec'];
      for (let k = 0, x = d.x0 + 0.12; x < d.x1; x += 0.24, k++) { c.fillStyle = cols[k % 4]; c.beginPath(); c.arc(x, -0.5 + (k % 2) * 0.05, 0.035, 0, TAU); c.fill(); }
    }
  }
  for (const o of site.obstacles || []) {
    if (o.kind === 'person') { drawStanding(c, o.x, o.y, o.r); continue; }
    if (o.kind === 'rect') {
      if (o.tag === 'queue') continue;   // drawn as the people in it
      const w = o.x1 - o.x0, h = o.y1 - o.y0;
      if (o.tag === 'gatecab') continue;   // drawn with the gate line
      const fill = { tables: '#5a4330', desk: '#4a3a2c', bench: '#5a4330', trolley: 'rgba(212,169,79,0.25)', shelf: '#3a4250', machines: '#2f5a5a', poster: '#4a2a40', rack: '#8d93a0' }[o.tag] || '#3a4250';
      c.fillStyle = fill; c.fillRect(o.x0, o.y0, w, h);
      if (o.tag === 'tables') {   // two tables with chairs
        c.fillStyle = '#7a5c40';
        for (const [fx, fy] of [[0.28, 0.32], [0.72, 0.68]]) {
          const tx = o.x0 + w * fx, ty = o.y0 + h * fy;
          c.beginPath(); c.arc(tx, ty, 0.2, 0, TAU); c.fill();
          c.fillStyle = '#3a2c20'; for (const a of [0, 1.6, 3.1, 4.7]) { c.beginPath(); c.arc(tx + Math.cos(a) * 0.3, ty + Math.sin(a) * 0.3, 0.07, 0, TAU); c.fill(); } c.fillStyle = '#7a5c40';
        }
      }
      if (o.tag === 'trolley') { c.strokeStyle = '#d4a94f'; c.lineWidth = lw * 2; c.strokeRect(o.x0, o.y0, w, h); }
      continue;
    }
    // circles
    const style = { column: ['#cfc6b2', '#8d8471'], bollard: ['#4a505c', '#2a2f38'], aboard: ['#d4a94f', '#8a6a2a'], returns: ['#4b6b8a', '#2c4258'] }[o.tag] || ['#4a505c', '#2a2f38'];
    const g = c.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.1, o.x, o.y, o.r);
    g.addColorStop(0, style[0]); g.addColorStop(1, style[1]);
    c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.r, 0, TAU); c.fill();
  }
  c.save(); c.scale(lw, lw); c.font = '600 9.5px Figtree, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(236,230,216,0.55)';
  for (const l of site.labels || []) c.fillText(l.text, l.x / lw, l.y / lw);
  c.restore();
}
function drawStanding(c, x, y, r) { drawStandingFig(c, x, y, r); }
const COATS = { 1: ['#9cc4ec', '#86b2de', '#b3d2f0'], '-1': ['#e79a86', '#d98670', '#f0b2a2'] };
function drawPerson(c, p) {
  const v = Math.hypot(p.vx, p.vy), ux = v > 0.05 ? p.vx / v : 0, uy = v > 0.05 ? p.vy / v : p.dir;
  const ang = Math.atan2(uy, ux), coat = COATS[p.dir > 0 ? 1 : -1][(p.born * 7 | 0) % 3 || 0] || (p.dir > 0 ? '#9cc4ec' : '#e79a86');
  if (p.type === 'bike') {
    const ox = -uy * 0.2, oy = ux * 0.2;
    c.strokeStyle = '#d4a94f'; c.lineWidth = 0.05; c.beginPath(); c.moveTo(p.x + ox - ux * 0.38, p.y + oy - uy * 0.38); c.lineTo(p.x + ox + ux * 0.38, p.y + oy + uy * 0.38); c.stroke();
    c.fillStyle = '#12151b'; for (const s of [-0.3, 0.3]) { c.beginPath(); c.arc(p.x + ox + ux * s, p.y + oy + uy * s, 0.08, 0, TAU); c.fill(); }
  }
  if (p.type === 'pram') { c.fillStyle = '#b48cf0'; c.beginPath(); c.ellipse(p.x + ux * 0.3, p.y + uy * 0.3, 0.17, 0.13, ang, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(p.x + ux * 0.36, p.y + uy * 0.36, 0.09, 0.08, ang, 0, TAU); c.fill(); }
  if (p.type === 'case') { c.save(); c.translate(p.x - ux * 0.28 + uy * 0.12, p.y - uy * 0.28 - ux * 0.12); c.rotate(ang); c.fillStyle = '#9b7a4a'; c.fillRect(-0.14, -0.1, 0.28, 0.2); c.fillStyle = '#6b5232'; c.fillRect(-0.02, -0.1, 0.04, 0.2); c.restore(); }
  if (p.type === 'wheel') { c.save(); c.translate(p.x, p.y); c.rotate(ang); c.fillStyle = '#2a2f38'; c.fillRect(-p.r * 0.9, -p.r, p.r * 1.6, p.r * 2); c.fillStyle = '#5a626e'; c.fillRect(-p.r * 0.9, -p.r, p.r * 1.6, 0.06); c.fillRect(-p.r * 0.9, p.r - 0.06, p.r * 1.6, 0.06); c.restore(); }
  // shoulders across the direction of travel, head just ahead of them
  const sw = (p.type === 'wheel' ? 0.2 : p.r) * 1.0, sd = sw * 0.62;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(p.x + 0.03, p.y + 0.04, sw, sd, ang + Math.PI / 2, 0, TAU); c.fill();
  c.fillStyle = p.flash > 0 ? '#ef5b4c' : coat; c.beginPath(); c.ellipse(p.x, p.y, sw, sd, ang + Math.PI / 2, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.02; c.stroke();
  const hx = p.x + ux * sd * 0.4, hy = p.y + uy * sd * 0.4;
  c.fillStyle = p.type === 'elderly' ? '#ece6dc' : ['#2a1f18', '#4a3424', '#1d1d22', '#6b4a2a'][(p.born * 13 | 0) % 4 || 0];
  c.beginPath(); c.arc(hx, hy, sw * 0.4, 0, TAU); c.fill();
  if (p.umbrella) { c.fillStyle = ['rgba(239,91,76,.45)', 'rgba(156,196,236,.45)', 'rgba(212,169,79,.45)'][(p.born * 5 | 0) % 3 || 0]; c.beginPath(); c.arc(p.x, p.y, p.r + 0.04, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.02; c.beginPath(); for (let k = 0; k < 6; k++) { c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(k) * (p.r + 0.04), p.y + Math.sin(k) * (p.r + 0.04)); } c.stroke(); }
  if (p.flash > 0) { c.strokeStyle = `rgba(239,91,76,${Math.min(1, p.flash)})`; c.lineWidth = 0.05; c.beginPath(); c.arc(p.x, p.y, p.r + 0.06, 0, TAU); c.stroke(); }
  if (p.laps > 0) { c.strokeStyle = '#b48cf0'; c.lineWidth = 0.06; c.beginPath(); c.arc(p.x, p.y, p.r + 0.04, 0, TAU); c.stroke(); }
}
function drawStandingFig(c, x, y, r) {
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 0.03, y + 0.04, r, r * 0.62, 0, 0, TAU); c.fill();
  c.fillStyle = '#5a5f6a'; c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, 0, TAU); c.fill();
  c.fillStyle = '#2a1f18'; c.beginPath(); c.arc(x, y - 0.02, r * 0.46, 0, TAU); c.fill();
}

// ---------- loop ----------
let prev = performance.now(), acc = 0, hudT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
  if (W) {
    const h = SIM_DT;
    if (W.mode === 'test') {
      acc += dt * (S.speed || 3);
      let n = 0;
      // step count must match the surveyor's exactly, so the same design gives the same result
      const total = Math.round(runSeconds(W.contract) / h);
      W.steps = W.steps || 0;
      while (acc >= h && n < 80 && W.steps < total && !testOver(W.contract, W.world)) { W.world.step(h); W.steps++; acc -= h; n++; }
      if (n >= 80) acc = 0;
      for (const e of W.world.events) if (e.t > W.lastEvT) W.fx.push({ ...e, t0: now / 1000 });
      if (W.world.events.length) W.lastEvT = W.world.events[W.world.events.length - 1].t;
      if (W.steps >= total || testOver(W.contract, W.world)) {
        // let the "lobby clear" moment show for a beat before the results
        W.endHold = (W.endHold || 0) + dt;
        if (W.steps >= total || W.endHold > 1.2) { W.endHold = 0; evaluateTest(); updateHud(); }
      }
    } else if (W.mode === 'design') {
      acc += dt; while (acc >= h) { W.world.step(h); acc -= h; }
    }
    draw(now / 1000);
    if (coachEl.id) placeCoach();
    hudT += dt; if (hudT > 0.15) { hudT = 0; updateHud(); }
  }
  if (!W && coachEl.id) placeCoach();
  requestAnimationFrame(frame);
}

// full screen: the whole page, where the browser allows it (some embeds and iPhones don't)
(() => {
  const el = document.documentElement, btn = $('fsBtn');
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!req || !enabled) return;   // leave the button hidden
  btn.hidden = false;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const sync = () => {
    $('fsIcon').setAttribute('d', isFull() ? 'M8 3v5H3M17 8h-5V3M12 17v-5h5M3 12h5v5' : 'M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5');
    btn.setAttribute('aria-label', isFull() ? 'Exit full screen' : 'Full screen'); btn.title = btn.getAttribute('aria-label');
  };
  btn.onclick = () => {
    try {
      const p = isFull() ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : req.call(el);
      if (p && p.catch) p.catch(() => toast('Full screen isn\'t available here', true));
    } catch (e) { toast('Full screen isn\'t available here', true); }
  };
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
})();
renderStreet();
if (!S.seenIntro) {
  sheet(`<div class="eyebrow">Prototype</div><h3>Door Duty Contractors</h3>
    <p>You run a small firm that fits entrances on the High Street. Every shop that hires you is a puzzle: design its frontage, test it in a 40-second rush hour, and sign it off if the client is happy.</p>
    <p>Revolving doors seal out the cold, but their wing tips move at v = ω·r and bump people if you spin them too fast. Swing and sliding doors are cheap and quick but leak heat. Fitted clients pay maintenance every month, and sometimes call you back when things change.</p>
    <div style="display:flex;gap:8px"><button class="ghost" type="button" id="iSkip">I know the trade</button><button class="go" type="button" id="iGo">Show me around</button></div>`);
  $('iGo').onclick = () => { S.seenIntro = true; S.tut = { done: {} }; save(); closeSheet(); renderStreet(); };
  $('iSkip').onclick = () => { S.seenIntro = true; S.tut = { done: {}, off: true }; save(); closeSheet(); };
  // however the intro is dismissed, it only shows once
  $('sheetWrap').addEventListener('click', e => { if (e.target === $('sheetWrap') && !S.seenIntro) { S.seenIntro = true; S.tut = S.tut || { done: {} }; save(); setTimeout(renderStreet, 50); } });
}
$('coachOk').onclick = () => coachDone();
$('coachSkip').onclick = () => coachDone(true);
addEventListener('resize', () => coachEl.id && placeCoach());
requestAnimationFrame(frame);
})();
