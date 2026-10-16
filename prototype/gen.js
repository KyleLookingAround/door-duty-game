// ---------- Contracts: generation, pricing, solver ----------
// Each building's first contract is a hand-picked "hook" that breaks the stock answers.
// Later contracts draw twists from the same pool, and a novelty check stops repeats.
const KINDS = {
  cafe:     { label: 'Café',             slots: 2, in: 0.7, out: 0.7, mix: {},
              hook: { twists: ['tight'], temp: 13 } },
  pharmacy: { label: 'Pharmacy',         slots: 2, in: 0.55, out: 0.5, mix: { elderly: 0.2 },
              hook: { twists: ['fragile', 'narrow'], temp: 3 } },
  bank:     { label: 'Bank',             slots: 2, in: 0.9, out: 0.8, mix: {},
              hook: { twists: ['wind'], temp: 1 } },
  office:   { label: 'Office block',     slots: 3, in: 2.0, out: 0.4, mix: {},
              hook: { twists: ['surge'], temp: 6, budgetCap: 32000 } },
  hotel:    { label: 'Hotel',            slots: 3, in: 1.0, out: 1.0, mix: { case: 0.4 }, comfort: 18,
              hook: { twists: ['listed'], temp: 7 } },
  library:  { label: 'Library',          slots: 3, in: 0.9, out: 0.8, mix: { elderly: 0.2 }, comfort: 16,
              hook: { twists: ['stepfree', 'fragile'], temp: 8 } },
  store:    { label: 'Department store', slots: 4, in: 1.8, out: 1.4, mix: { elderly: 0.1, case: 0.1 },
              hook: { twists: ['nofire', 'cold'], temp: 2 } },
  station:  { label: 'Railway station',  slots: 3, in: 4.0, out: 0.5, mix: { case: 0.1 }, station: true,
              hook: { twists: ['stepfree'], temp: 8 } },
  // Market Square: the second street
  museum:   { label: 'Museum',           slots: 3, in: 0.9, out: 0.8, mix: { elderly: 0.25, pram: 0.05 }, comfort: 18,
              hook: { twists: ['listed', 'stepfree'], temp: 6 } },
  cinema:   { label: 'Cinema',           slots: 2, in: 0.8, out: 0.15, mix: {}, cinema: true,
              hook: { twists: [], temp: 9 } },
  gym:      { label: 'Gym',              slots: 2, in: 1.3, out: 1.2, mix: { bike: 0.12 },
              hook: { twists: ['bikes', 'wind'], temp: 7 } },
  clinic:   { label: 'Health centre',    slots: 2, in: 0.7, out: 0.6, mix: { elderly: 0.35, wheel: 0.05, pram: 0.06 }, comfort: 18,
              hook: { twists: ['stepfree', 'fragile'], temp: 10 } },
  towers:   { label: 'Office towers',    slots: 4, in: 3.0, out: 2.6, mix: { case: 0.05 }, towers: true, comfort: 19,
              hook: { twists: [], temp: 4 } },
  townhall: { label: 'Town hall',        slots: 3, in: 1.1, out: 0.9, mix: { elderly: 0.15 }, comfort: 16,
              hook: { twists: ['stepfree', 'surge'], temp: 9 } },
};

// Street furniture: fixed per building, built for however many bays the job has.
// obstacles collide and steer people; decos and labels are drawing only.
function buildSite(kind, n) {
  const HW = n * SLOT_W / 2, cx = i => -HW + SLOT_W / 2 + i * SLOT_W, last = n - 1;
  const S = { obstacles: [], decos: [], labels: [] };
  const person = (x, y) => S.obstacles.push({ kind: 'person', x, y, r: 0.2 });
  if (kind === 'cafe') {
    const x0 = n > 1 ? cx(0) - 0.9 : -HW + 0.25, x1 = n > 1 ? cx(0) + 0.5 : -HW + 0.95;
    S.obstacles.push({ kind: 'rect', x0, x1, y0: -2.2, y1: -1.3, tag: 'tables' });
    S.obstacles.push({ kind: 'circle', x: cx(last) + 1.15, y: -0.75, r: 0.16, tag: 'aboard' });
    S.labels.push({ x: (x0 + x1) / 2, y: -2.45, text: 'Café tables' });
  } else if (kind === 'pharmacy') {
    for (const x of n > 1 ? [cx(0) - 1.3, cx(last) + 1.3] : [-HW + 0.2, HW - 0.2]) S.obstacles.push({ kind: 'circle', x, y: -0.6, r: 0.12, tag: 'bollard' });
    S.obstacles.push({ kind: 'rect', x0: -HW + 0.15, x1: -HW + 0.55, y0: 0.6, y1: 1.8, tag: 'shelf' });
    S.labels.push({ x: -HW + 0.35, y: 2.05, text: 'Display' });
  } else if (kind === 'bank') {
    // the cash machine sits in the wall beside bay 1; its queue snakes along the pavement across bay 1's approach
    const ax = n > 1 ? cx(0) + 1.3 : HW - 0.3;
    S.decos.push({ kind: 'atm', x: ax, y: -0.08 });
    // two at the machine, the rest lined up along the pavement: one solid obstacle people route round
    person(ax + 0.05, -0.48); person(ax + 0.1, -1.0);
    S.obstacles.push({ kind: 'rect', x0: ax - 1.85, x1: ax - 0.05, y0: -2.48, y1: -2.02, tag: 'queue' });
    for (let k = 0; k < 4; k++) S.decos.push({ kind: 'queuer', x: ax - 0.3 - k * 0.46, y: -2.25 + (k % 2 ? 0.04 : -0.04) });
    S.labels.push({ x: ax - 1.2, y: -2.6, text: 'Cash machine queue' });
  } else if (kind === 'office') {
    S.obstacles.push({ kind: 'rect', x0: -1.2, x1: 1.2, y0: 1.5, y1: 2.0, tag: 'desk' });
    S.obstacles.push({ kind: 'rect', x0: cx(last) - 0.5, x1: cx(last) + 0.5, y0: -2.45, y1: -2.05, tag: 'bench' });
    S.labels.push({ x: 0, y: 2.3, text: 'Reception' });
    S.labels.push({ x: cx(last), y: -2.75, text: 'Smokers\' bench' });
  } else if (kind === 'hotel') {
    S.spawnIn = { x: -HW + 1.0, spread: 0.9, p: 0.55 };
    S.decos.push({ kind: 'taxi', x: -HW + 0.6, y: -3.0 });
    S.obstacles.push({ kind: 'rect', x0: cx(0) + 0.75, x1: cx(0) + 1.3, y0: 1.2, y1: 1.85, tag: 'trolley' });
    S.labels.push({ x: -HW + 1.3, y: -2.55, text: 'Taxi rank' });
  } else if (kind === 'library') {
    if (n >= 3) {
      S.rampBays = [1];
      for (const i of [0, 2]) S.decos.push({ kind: 'steps', x0: cx(i) - 1.5, x1: cx(i) + 1.5, y0: -0.85, y1: -0.08 });
      S.decos.push({ kind: 'ramp', x0: cx(1) - 1.5, x1: cx(1) + 1.5, y0: -0.85, y1: -0.08 });
      S.labels.push({ x: cx(1), y: -1.1, text: 'Ramp' });
    }
    S.obstacles.push({ kind: 'circle', x: cx(last) + 1.0, y: -1.7, r: 0.24, tag: 'returns' });
  } else if (kind === 'store') {
    S.surge = { every: 9, n: 6, x: -HW + 1.3, spread: 0.9 };
    S.decos.push({ kind: 'shelter', x0: -HW + 0.2, x1: -HW + 2.4, y0: -3.45, y1: -3.05 });
    S.labels.push({ x: -HW + 1.3, y: -2.75, text: 'Bus stop' });
    if (n >= 2) { const bx = cx(0) + 1.5; person(bx - 0.28, -1.15); person(bx + 0.27, -1.2); S.labels.push({ x: bx, y: -1.6, text: 'Window shoppers' }); }
  } else if (kind === 'museum') {
    // grand steps with a ramp at one end, and a school party waiting by the railings
    if (n >= 3) { S.rampBays = [n - 1]; for (let i = 0; i < n - 1; i++) S.decos.push({ kind: 'steps', x0: cx(i) - 1.5, x1: cx(i) + 1.5, y0: -0.85, y1: -0.08 }); S.decos.push({ kind: 'ramp', x0: cx(last) - 1.5, x1: cx(last) + 1.5, y0: -0.85, y1: -0.08 }); S.labels.push({ x: cx(last), y: -1.1, text: 'Ramp' }); }
    S.obstacles.push({ kind: 'rect', x0: -HW + 0.3, x1: -HW + 1.6, y0: -2.6, y1: -2.15, tag: 'queue' });
    for (let k = 0; k < 3; k++) S.decos.push({ kind: 'queuer', x: -HW + 0.5 + k * 0.45, y: -2.38 });
    S.labels.push({ x: -HW + 0.95, y: -2.8, text: 'School party' });
    S.obstacles.push({ kind: 'rect', x0: -1.0, x1: 1.0, y0: 1.7, y1: 2.2, tag: 'desk' }); S.labels.push({ x: 0, y: 2.45, text: 'Cloakroom' });
  } else if (kind === 'cinema') {
    // poster stands either side, and the screens empty out at the back of the foyer
    for (const x of [-HW + 0.35, HW - 0.35]) S.obstacles.push({ kind: 'rect', x0: x - 0.2, x1: x + 0.2, y0: -1.1, y1: -0.6, tag: 'poster' });
    S.obstacles.push({ kind: 'rect', x0: -0.9, x1: 0.9, y0: 1.4, y1: 1.85, tag: 'desk' }); S.labels.push({ x: 0, y: 2.1, text: 'Popcorn' });
    S.labels.push({ x: 0, y: 3.35, text: 'Screens' });
  } else if (kind === 'gym') {
    // bike racks along the pavement
    for (let k = 0; k < 3; k++) S.obstacles.push({ kind: 'rect', x0: -HW + 0.3 + k * 0.5, x1: -HW + 0.36 + k * 0.5, y0: -2.5, y1: -1.9, tag: 'rack' });
    S.labels.push({ x: -HW + 0.85, y: -2.75, text: 'Bike racks' });
    S.obstacles.push({ kind: 'rect', x0: HW - 1.6, x1: HW - 0.3, y0: 1.5, y1: 1.95, tag: 'desk' }); S.labels.push({ x: HW - 0.95, y: 2.2, text: 'Turnstile desk' });
  } else if (kind === 'clinic') {
    // a ramp on the left bay, waiting-room chairs inside
    if (n >= 2) { S.rampBays = [0]; S.decos.push({ kind: 'ramp', x0: cx(0) - 1.5, x1: cx(0) + 1.5, y0: -0.85, y1: -0.08 }); for (let i = 1; i < n; i++) S.decos.push({ kind: 'steps', x0: cx(i) - 1.5, x1: cx(i) + 1.5, y0: -0.85, y1: -0.08 }); S.labels.push({ x: cx(0), y: -1.1, text: 'Ramp' }); }
    S.obstacles.push({ kind: 'rect', x0: HW - 1.9, x1: HW - 0.2, y0: 1.8, y1: 2.15, tag: 'bench' }); S.labels.push({ x: HW - 1.05, y: 2.4, text: 'Waiting room' });
  } else if (kind === 'towers') {
    // a tube exit dumps commuters at one end; security desk and the lift bank inside
    S.surge = { every: 7, n: 7, x: -HW + 1.4, spread: 1.0, until: 16 };
    S.decos.push({ kind: 'shelter', x0: -HW + 0.2, x1: -HW + 2.6, y0: -3.45, y1: -3.05 });
    S.labels.push({ x: -HW + 1.4, y: -2.75, text: 'Underground exit' });
    S.obstacles.push({ kind: 'rect', x0: -1.4, x1: 1.4, y0: 1.6, y1: 2.0, tag: 'desk' }); S.labels.push({ x: 0, y: 2.25, text: 'Security' });
    for (const x of [-HW + 1.5, HW - 1.5]) S.decos.push({ kind: 'lifts', x0: x - 1.1, x1: x + 1.1, y0: 3.0, y1: 3.55 });
    S.labels.push({ x: 0, y: 3.35, text: 'Lifts' });
  } else if (kind === 'station') {
    // ticket machines on the street side, the departure board and the escalators down to the platforms
    S.obstacles.push({ kind: 'rect', x0: -HW + 0.15, x1: -HW + 0.75, y0: -1.75, y1: -1.35, tag: 'machines' });
    S.obstacles.push({ kind: 'rect', x0: HW - 0.75, x1: HW - 0.15, y0: -1.75, y1: -1.35, tag: 'machines' });
    S.labels.push({ x: -HW + 0.9, y: -2.0, text: 'Tickets' });
    S.decos.push({ kind: 'board', x0: -1.4, x1: 1.4, y: 1.55 });
    const ex = n >= 3 ? [cx(0), cx(last)] : [-HW + 1.2, HW - 1.2];
    for (const x of ex) S.decos.push({ kind: 'escalator', x0: x - 0.7, x1: x + 0.7, y0: 2.5, y1: 3.6 });
    S.labels.push({ x: 0, y: 3.25, text: 'Escalators to the platforms' });
    S.trains = { every: 6, n: 16, from: 20, xs: ex };
  } else if (kind === 'townhall') {
    // portico columns flank each doorway
    for (let i = 0; i <= n; i++) S.obstacles.push({ kind: 'circle', x: -HW + i * SLOT_W, y: -1.5, r: 0.32, tag: 'column' });
    S.labels.push({ x: cx(0), y: -2.15, text: 'Portico' });
  }
  return S;
}

// Calendar: one event a month, the same every year, so you can see it coming
const EVENTS = {
  0:  { key: 'sales', label: 'January sales', text: 'Bargain hunters with bags. Every tender is busier, and shoppers carry big bags through the doors.' },
  1:  { key: 'storm', label: 'Storm season', text: 'Gales and rain all month. Wind pushes air through open doors and wide mouths, and the queue outside wants in quickly.' },
  3:  { key: 'marathon', label: 'Marathon day', text: 'Everyone rushes out to watch the runners. Lots of prams. The flow is mostly outward.' },
  6:  { key: 'heatwave', label: 'Heatwave', text: 'Over 30°C outside. Lobbies need keeping cool, not warm: the same leaks now let the heat in.' },
  10: { key: 'blackfriday', label: 'Black Friday', text: 'The biggest crowds of the year. Half as many people again, and they want in now.' },
  11: { key: 'xmas', label: 'Christmas windows', text: 'Shop windows are dressed for Christmas, and people stop in front of them. A bay with a window display has a crowd standing in its way.' },
};
const eventOf = month => EVENTS[((month % 12) + 12) % 12] || null;
// which bays get a Christmas window display
const xmasBays = n => n <= 1 ? [] : n === 2 ? [1] : n === 3 ? [0] : [0, n - 1];

// Twists: each one breaks a different stock answer
const TWISTS = {
  tight:    { label: 'Tight budget', text: 'A small budget, and the owner has ruled out a revolving door.' },
  fragile:  { label: 'Fragile guests', text: 'Half the customers are older and bruise easily. One bump and you\'re in the local paper.' },
  narrow:   { label: 'Narrow frontage', text: 'The shopfront is one bay wide. Whatever you fit has to do everything.' },
  wind:     { label: 'Windy corner', text: 'A gale funnels down the street. Wide mouths and open doors let it straight in.' },
  surge:    { label: '9am surge', text: 'Everyone arrives at once, and late staff who ride the door round again get reported to HR.' },
  listed:   { label: 'Listed building', text: 'The brass revolving door in the centre bay is listed. You can\'t touch it, only work around it.' },
  stepfree: { label: 'Step-free', text: 'Wheelchair users, prams and delivery trolleys must be able to get in. Standard revolving doors won\'t take them.' },
  bikes:    { label: 'Cycle commuters', text: 'People wheel their bikes in from the street. A bike won\'t go through a revolving door, and turning cyclists away annoys the client.' },
  rain:     { label: 'Rainy day', text: 'Umbrellas up: everyone takes more room and moves a little slower.' },
  drill:    { label: 'Fire drill', text: 'After the rush the fire officer sounds the alarm, and the lobby has to empty fast. Revolving doors fold flat, every door becomes an exit, and crowds jam at narrow ones.' },
  nofire:   { label: 'Fire officer', text: 'No swing doors: they jam in a crush.' },
  cold:     { label: 'Cold snap', text: 'Freezing outside. Keep the lobby warm.' },
};
// a station only gets the twists that make sense at a gate line
const STATION_POOL = ['fragile', 'stepfree', 'rain', 'surge', 'bikes', 'narrow'];
const TWIST_POOL = ['tight', 'fragile', 'narrow', 'wind', 'surge', 'listed', 'stepfree', 'nofire', 'cold', 'bikes', 'rain', 'drill'];
// twists only offered to firms with the right research
const TWIST_REQ = { drill: t => t.pillars, wind: t => t.mouth };
// Pairs that leave no workable door. Some become possible with R&D: those are
// "specialist" jobs that only firms with the right tech get offered, at a premium.
const CONFLICTS = [
  ['tight', 'surge'], ['tight', 'listed'], ['narrow', 'listed'], ['narrow', 'stepfree'], ['narrow', 'surge'],
  ['tight', 'cold', t => t.vestibule], ['tight', 'wind'],
  ['stepfree', 'cold', t => t.wide || t.vestibule], ['stepfree', 'wind', t => t.wide],
  ['bikes', 'cold', t => t.vestibule], ['bikes', 'wind', t => t.vestibule], ['bikes', 'tight'],
];
const clashes = (list, t, tech = {}) => CONFLICTS.some(([a, b, ok]) => ((a === t && list.includes(b)) || (b === t && list.includes(a))) && !(ok && ok(tech)));
// twists that only specialist firms are offered (others in TWIST_REQ just need a basic tool researched)
const SPECIAL_TWISTS = ['drill'];
const isSpecialist = list => CONFLICTS.some(([a, b, ok]) => ok && list.includes(a) && list.includes(b)) || list.some(t => SPECIAL_TWISTS.includes(t));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEASON_T = [3, 4, 7, 10, 14, 17, 19, 18, 15, 11, 7, 4];
const TEST_SECONDS = 40;
const SIM_DT = 1 / 60;                  // shared by the surveyor and the in-game test
const RUN_SECONDS = TEST_SECONDS + 6;   // arrivals stop at 40s; the last people get 6s to clear the door
const PRICE = { revolve: 12000, wingExtra: 1500, bigCore: 2000, padded: 1500, sensor: 2000, wide: 8000, swing: 2500, slider: 6000, curtain: 3500, vestibule: 5000, pillar: 1500, lanes: 800, gates: 7000, gatesWide: 9000, tidal: 2500 };

function slotCost(s) {
  if (!s || s.type === 'wall') return 0;
  const extras = (s.pillar ? PRICE.pillar : 0);
  if (s.type === 'gates') return (s.wide ? PRICE.gatesWide : PRICE.gates) + (s.flow === 'auto' ? PRICE.tidal : 0);
  if (s.type === 'revolve') return extras + PRICE.revolve + (s.wide ? PRICE.wide : 0) + Math.max(0, s.wings - 3) * PRICE.wingExtra + (s.core >= 0.3 ? PRICE.bigCore : 0) + (s.padded ? PRICE.padded : 0) + (s.sensor ? PRICE.sensor : 0);
  return extras + (s.type === 'swing' ? PRICE.swing : PRICE.slider) + (s.curtain ? PRICE.curtain : 0) + (s.vestibule ? PRICE.vestibule : 0) + (s.lanes ? PRICE.lanes : 0);
}
function designCost(slots, existing) {
  let c = 0;
  slots.forEach((s, i) => {
    const old = existing && existing[i];
    if (!old || old.type !== s.type || ((s.type === 'revolve' || s.type === 'gates') && !!s.wide !== !!old.wide)) { c += slotCost(s) - (s.pillar && old && old.pillar ? PRICE.pillar : 0); return; }
    if (s.pillar && !old.pillar) c += PRICE.pillar;
    if (s.type === 'gates') { if (s.flow === 'auto' && old.flow !== 'auto') c += PRICE.tidal; return; }
    if (s.type === 'revolve') {
      c += Math.max(0, s.wings - old.wings) * PRICE.wingExtra;
      if (s.core >= 0.3 && old.core < 0.3) c += PRICE.bigCore;
      if (s.padded && !old.padded) c += PRICE.padded;
      if (s.sensor && !old.sensor) c += PRICE.sensor;
    } else {
      if (s.curtain && !old.curtain) c += PRICE.curtain;
      if (s.vestibule && !old.vestibule) c += PRICE.vestibule;
      if (s.lanes && !old.lanes) c += PRICE.lanes;
    }
  });
  return c;
}
// a position-free fingerprint of a design, for the novelty check
function designSig(slots) {
  return slots.filter(s => s.type !== 'wall').map(s => {
    let t = s.type[0];
    if (s.flow && s.flow !== 'both') t += s.flow[0];
    if (s.type === 'gates') t += s.wide ? 'W' : '';
    if (s.type === 'revolve') t += (s.wide ? 'W' : '') + s.wings + (s.core >= 0.3 ? 'C' : '') + (s.mouth <= 32 ? 'N' : '') + (s.rpm <= 3.5 ? 'S' : '') + (s.sensor ? 'P' : '');
    if (s.button) t += 'B';
    if (s.vestibule) t += 'V';
    if (s.doorman) t += 'D';
    if (s.pillar) t += 'X';
    if (s.lanes) t += 'L';
    return t;
  }).sort().join(',');
}
function violatesRules(contract, slots) {
  const r = contract.rules || {};
  if (r.forbid && slots.some(s => r.forbid.includes(s.type))) return true;
  if (r.fixed) for (const [i, f] of Object.entries(r.fixed)) if (slots[i].type !== f.type) return true;
  return false;
}

function makeContract(kindKey, tier, month, seed, opts = {}) {
  const k = KINDS[kindKey], rng = makeRng(seed * 7919 + 13), tech = opts.tech || {};
  const first = !!opts.first;
  const scale = first ? 1 : (1 + 0.1 * Math.min(tier, 6)) * (0.88 + rng() * 0.24);
  let temp = first && k.hook.temp != null ? k.hook.temp : SEASON_T[month % 12] + Math.round(rng() * 5 - 3);
  let slots = k.slots;
  const mix = { ...k.mix };
  let crowdIn = k.in * scale, crowdOut = k.out * scale;
  const c = { kind: kindKey, tier, month, seed, first, rules: {}, wind: 0, budgetCap: null, solved: false };
  const goals = { bumps: 0, minTemp: null, access: false, laps: null };

  // pick twists: the hook for a first visit, otherwise the callback reason plus random draws
  let twists = [];
  if (first) twists = [...k.hook.twists];
  else {
    const CB = { busier: 'surge', older: 'fragile', cold: 'cold', safety: 'fragile', access: 'stepfree' };
    if (opts.callback && CB[opts.callback] && !(k.station && opts.callback === 'cold')) twists.push(CB[opts.callback]);
    const n = tier >= 3 ? 2 : 1;
    const pool = (k.station ? STATION_POOL : k.towers ? ['fragile', 'stepfree', 'rain', 'wind', 'bikes'] : TWIST_POOL).filter(t => !twists.includes(t) && (!TWIST_REQ[t] || TWIST_REQ[t](tech)));
    while (twists.length < n + (opts.callback ? 1 : 0) && pool.length) {
      const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      if (!clashes(twists, t, tech)) twists.push(t);
    }
    // firms with the right tech get offered specialist jobs that others can't take on
    const special = CONFLICTS.filter(([a, b, ok]) => ok && ok(tech) && !(opts.existing && [a, b].some(x => x === 'narrow' || x === 'listed')));
    // once you own pillars, fire officers start calling
    if (tech.pillars && !k.station && !k.towers && !twists.includes('drill') && rng() < 0.2) twists.push('drill');
    if (special.length && !k.station && !k.towers && rng() < 0.25) {
      const [a, b] = special[Math.floor(rng() * special.length)];
      twists = twists.filter(t => !clashes([a, b], t, tech) && t !== a && t !== b);
      twists.push(a, b);
    }
  }
  for (const t of (opts.extra || [])) if (!twists.includes(t) && !clashes(twists, t, tech)) twists.push(t);
  // existing hardware on a callback can't conflict with a listed-door rule
  if (opts.existing) twists = twists.filter(t => t !== 'listed' && t !== 'narrow' && !(t === 'tight' && opts.existing.some(s => s.type === 'revolve')));
  // cyclists need an open door: buildings that insist on a very warm lobby can't take them without draught lobbies
  if (k.comfort >= 18 && !tech.vestibule) twists = twists.filter(t => t !== 'bikes');
  // last-resort plain job: just the callback reason, nothing extra
  if (opts.plain) twists = opts.callback ? twists.slice(0, 1) : [];
  // narrow + listed or narrow + stepfree is impossible on one bay
  if (twists.includes('narrow') && (twists.includes('listed') || twists.includes('stepfree')) ) twists = twists.filter(t => t !== 'narrow');

  if (twists.length > 3) {
    const keep = [];
    if (opts.callback) keep.push(twists[0]);
    for (const [a, b, ok] of CONFLICTS) if (ok && twists.includes(a) && twists.includes(b) && keep.length <= 1) keep.push(a, b);
    for (const t of twists) if (keep.length < 3 && !keep.includes(t)) keep.push(t);
    twists = [...new Set(keep)].slice(0, 3);
  }
  for (const t of twists) {
    if (t === 'tight') { c.budgetCap = 8000 + Math.min(tier, 6) * 1000 + (twists.includes('cold') ? 6000 : 0); c.rules.forbid = [...(c.rules.forbid || []), 'revolve']; }
    if (t === 'fragile') { mix.elderly = Math.max(mix.elderly || 0, 0.5); goals.bumpsCap = 0; }
    if (t === 'narrow') slots = Math.max(1, slots - 1);
    if (t === 'wind') { c.wind = 3; temp = Math.min(temp, 4); }
    if (t === 'surge') { crowdIn *= 1.6; crowdOut *= 0.4; goals.laps = 1; }
    if (t === 'listed') { const mid = Math.floor((slots - 1) / 2); c.rules.fixed = { [mid]: { type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 4, flow: 'both' } }; }
    if (t === 'stepfree') { mix.wheel = Math.max(mix.wheel || 0, 0.06); mix.pram = Math.max(mix.pram || 0, 0.05); goals.access = true; }
    if (t === 'bikes') { mix.bike = Math.max(mix.bike || 0, 0.08); goals.bikes = true; }
    if (t === 'rain') c.rain = true;
    if (t === 'drill') c.drill = { at: TEST_SECONDS, n: 42 + Math.min(tier, 6) * 3 };
    if (t === 'nofire') c.rules.forbid = [...(c.rules.forbid || []), 'swing'];
    if (t === 'cold') temp = Math.min(temp, -3 - Math.round(rng() * 4));
  }
  // the month's event: first visits keep their hand-picked hook
  const ev = !first && opts.event ? Object.values(EVENTS).find(e => e.key === opts.event) : null;
  if (ev) {
    c.event = ev.key;
    if (ev.key === 'sales') { crowdIn *= 1.25; crowdOut *= 1.25; mix.case = Math.max(mix.case || 0, 0.3); }
    if (ev.key === 'storm') { c.rain = true; if (tech.mouth) c.wind = Math.max(c.wind, 2); temp = Math.min(temp, 6); }
    if (ev.key === 'marathon') { crowdOut *= 1.8; crowdIn *= 0.8; mix.pram = Math.max(mix.pram || 0, 0.12); }
    if (ev.key === 'heatwave') { temp = 29 + Math.round(rng() * 3); c.heat = true; twists = twists.filter(t => t !== 'cold'); }
    if (ev.key === 'blackfriday') { crowdIn *= 1.5; crowdOut *= 1.2; }
    if (ev.key === 'xmas') temp = Math.min(temp, 4);
  }
  if (first && k.hook.budgetCap) c.budgetCap = k.hook.budgetCap;
  if (opts.existing) slots = opts.existing.length;   // a callback keeps the frontage you built
  if (k.station) slots = Math.max(slots, twists.includes('narrow') ? 2 : 3);
  c.slots = slots;
  c.site = buildSite(kindKey, slots);
  if (c.event === 'xmas' && !k.station) {
    // a small crowd stands in front of each window display, just beyond the doors' reach
    const HW = slots * SLOT_W / 2, cx = i => -HW + SLOT_W / 2 + i * SLOT_W;
    for (const i of xmasBays(slots)) {
      c.site.decos.push({ kind: 'window', x0: cx(i) - 1.2, x1: cx(i) + 1.2 });
      for (const dx of [-0.5, 0, 0.5]) c.site.obstacles.push({ kind: 'person', x: cx(i) + dx, y: -1.75 + (dx ? 0.08 : -0.06), r: 0.2, gazer: true });
      c.site.labels.push({ x: cx(i), y: -2.2, text: 'Window display' });
    }
  }
  c.outsideTemp = temp;
  c.crowd = { in: +crowdIn.toFixed(2), out: +crowdOut.toFixed(2), mix };
  if (k.cinema) {
    // the film ends at 22s and the whole audience pours out at once
    const house = Math.round(30 * scale * (twists.includes('surge') ? 1.3 : 1));
    c.crowd.phases = [{ until: 22, in: +crowdIn.toFixed(2), out: 0.15 }, { until: 30, in: 0.2, out: +(house / 8).toFixed(2) }, { until: 1e9, in: +crowdIn.toFixed(2), out: 0.3 }];
    c.crowd.out = +(house / 40 + 0.2).toFixed(2);
  }
  if (k.towers) {
    temp = Math.min(temp, 8);
    // a tall building pulls cold air in at the doors (the stack effect), and the day comes in three waves
    c.stack = 1;
    c.crowd.phases = [{ until: 15, in: +crowdIn.toFixed(2), out: 0.2 }, { until: 26, in: +(crowdIn * 0.35).toFixed(2), out: +(crowdOut * 0.35).toFixed(2) }, { until: 1e9, in: 0.2, out: +crowdOut.toFixed(2) }];
    c.crowd.in = +(crowdIn * 0.5).toFixed(2); c.crowd.out = +(crowdOut * 0.5).toFixed(2);
    c.landmark = 'towers';
    goals.laps = null;
  }
  if (k.station) {
    // morning: commuters pour in. Evening: trains empty out up the escalators every few seconds.
    const busy = twists.includes('surge') ? 1.25 : 1;
    c.crowd.phases = [{ until: TEST_SECONDS / 2, in: +(crowdIn * busy).toFixed(2), out: 0.3 }, { until: 1e9, in: 0.4, out: +crowdOut.toFixed(2) }];
    c.crowd.in = +((crowdIn * busy + 0.4) / 2).toFixed(2); c.crowd.out = +((0.3 + crowdOut) / 2 + 0.6).toFixed(2);
    c.site.trains = { ...c.site.trains, n: Math.round(16 * scale * busy * (slots === 2 ? 0.7 : 1)) };
    if (slots === 2) c.crowd.phases[0].in = +(c.crowd.phases[0].in * 0.7).toFixed(2);
    c.rules.forbid = ['revolve', 'swing', 'slider'];
    c.landmark = 'station';
  }
  const arrivals = (c.crowd.in + c.crowd.out) * TEST_SECONDS;
  goals.bumps = goals.bumpsCap != null ? goals.bumpsCap : Math.max(2, Math.round(arrivals * 0.05));
  delete goals.bumpsCap;
  goals.minTemp = k.comfort ? Math.max(k.comfort, temp < 12 ? 16 : 0) : (temp < 12 ? 16 : null);
  // specialist clients are fussy: they want a properly warm lobby, which needs the new tech
  if (isSpecialist(twists)) goals.minTemp = Math.max(goals.minTemp || 0, 19);
  // a station concourse is open to the air: nobody heats it
  if (k.station) { goals.minTemp = null; goals.laps = null; c.heat = false; }
  // in a heatwave the lobby must stay cool instead
  if (c.heat) { goals.minTemp = null; goals.maxTemp = isSpecialist(twists) || k.comfort ? 22 : 23; }
  c.goals = goals;
  c.twists = twists;
  c.specialist = isSpecialist(twists);
  c.opts = opts;
  if (opts.callback === 'botched') c.rescue = true;   // putting right the rival's work pays a premium
  if (opts.existing) c.existing = opts.existing;
  else if (c.rules.fixed) c.existing = Array.from({ length: slots }, (_, i) => c.rules.fixed[i] ? { ...c.rules.fixed[i] } : { type: 'wall' });
  return c;
}

function worldCfg(contract, slots, tech) {
  const t = tech || {};
  return { slots, crowd: contract.crowd, outsideTemp: contract.outsideTemp, duration: TEST_SECONDS, seed: contract.seed,
    heater: t.heat2 ? 2.4 : t.heat ? 1.6 : 1, wind: contract.wind || 0, stack: contract.stack || 0, seals: !!t.seals, rain: !!contract.rain, site: contract.site, drill: contract.drill || null };
}
// how long a test runs: the 40s rush plus time for the last people to clear, or a fire drill's evacuation window
const runSeconds = contract => contract.drill ? contract.drill.at + 35 : RUN_SECONDS;
// shared by the surveyor and the in-game test, so both stop at exactly the same step
const testOver = (contract, w) => !!contract.drill && w.stats.evac != null;
function runHeadless(contract, slots, unlocks, dt = SIM_DT) {
  const w = new World(worldCfg(contract, slots, unlocks));
  const n = Math.round(runSeconds(contract) / dt);
  for (let i = 0; i < n && !testOver(contract, w); i++) w.step(dt);
  return { ...w.stats, wait: w.waitP90(), minTemp: w.minTemp, maxTemp: w.maxTemp, evac: w.stats.evac == null ? (contract.drill ? 99 : null) : w.stats.evac };
}
function meetsSoft(contract, r) {
  const g = contract.goals;
  return r.bumps <= g.bumps && (g.minTemp == null || r.minTemp >= g.minTemp) && (g.maxTemp == null || r.maxTemp <= g.maxTemp) && (g.wait == null || r.wait <= g.wait) && (!g.access || r.accessFail === 0) && (!g.bikes || r.bikeFail === 0) && (g.laps == null || r.laps <= g.laps)
    && (g.evac == null || r.evac <= g.evac);
}

function stationCandidates(contract, unlocks) {
  const n = contract.slots, out = [], wall = { type: 'wall' };
  const G = (flow, o = {}) => ({ type: 'gates', flow, wide: false, ...o });
  const needWide = contract.goals.access || contract.goals.bikes;
  const staffs = unlocks.doorman ? [false, true] : [false];
  const sets = [];
  for (let k = Math.max(1, n - 1); k <= n; k++) {
    const pats = [Array(k).fill('both')];
    if (unlocks.tidal) pats.push(Array(k).fill('auto'));
    if (k >= 2) { pats.push([...Array(k - 1).fill('in'), 'out']); pats.push(['in', ...Array(k - 2).fill('both'), 'out']); }
    if (k >= 3) pats.push(['in', 'out', 'out'], ['in', 'in', 'both']);
    for (const pat of pats) sets.push(pat.slice(0, k));
  }
  for (const pat of sets) for (const staff of staffs) for (const wideAt of needWide ? [Math.floor(pat.length / 2)] : [-1, Math.floor(pat.length / 2)]) {
    const items = pat.map((f, i) => G(f, { wide: i === wideAt, doorman: staff || undefined }));
    const s = Array.from({ length: n }, () => ({ ...wall }));
    const idx = items.length === n ? items.map((_, i) => i) : items.length === 1 ? [Math.floor((n - 1) / 2)] : items.map((_, i) => Math.round(i * (n - 1) / (items.length - 1)));
    items.forEach((it, i) => { s[idx[i]] = it; });
    out.push(s);
  }
  const seen = new Set();
  return out.filter(s => { const key = JSON.stringify(s); if (seen.has(key)) return false; seen.add(key); return true; });
}
function candidates(contract, unlocks) {
  if (contract.landmark === 'station') return stationCandidates(contract, unlocks);
  const n = contract.slots, out = [], tw = contract.twists || [];
  const wall = { type: 'wall' };
  const cold = contract.goals.minTemp != null || contract.goals.maxTemp != null;   // either way, leaky doors need help
  // core and mouth stay at the factory setting until you research the adjusters
  const rev = (o) => {
    const r = { type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 4.5, flow: 'both', ...o };
    if (!unlocks.core) r.core = 0.15;
    if (!unlocks.mouth) r.mouth = 40;
    return r;
  };
  const P = [rev({ wings: 3, mouth: 35, rpm: 4 }), rev({})];
  const windy = tw.includes('wind') || contract.wind > 0;
  if (windy) P.push(rev({ mouth: 28 }), rev({ wings: 5, mouth: 30, rpm: 4 }));
  if (tw.includes('fragile')) P.push(rev({ rpm: 3 }), rev({ rpm: 3.5, mouth: 45, core: 0.3 }));
  if (tw.includes('surge')) P.push(rev({ rpm: 6, core: 0.35 }), rev({ rpm: 6, core: 0.35, mouth: 45 }), rev({ rpm: 6 }));
  if (unlocks.padded) P.push(rev({ mouth: 45, core: 0.3, rpm: 6.5, padded: true }));
  if (unlocks.sensor && tw.includes('fragile')) P.push(rev({ rpm: 5, sensor: true }), rev({ rpm: 5.5, core: 0.3, sensor: true }));
  if (unlocks.doorman && (tw.includes('surge') || contract.goals.laps != null)) P.push(rev({ rpm: 6, doorman: true }));
  if (unlocks.seals && windy) P.push(rev({ mouth: 45, rpm: 5 }));
  { const seen = new Set(); for (let i = P.length - 1; i >= 0; i--) { const k = JSON.stringify(P[i]); if (seen.has(k)) P.splice(i, 1); else seen.add(k); } }
  const wideP = unlocks.wide ? [rev({ wide: true, wings: 3, mouth: 32, rpm: 3.5 }), rev({ wide: true, wings: 3, mouth: 30, rpm: 4 })] : [];
  const gap = (t, o = {}) => ({ type: t, curtain: !!(cold && unlocks.curtain), flow: 'both', ...o });
  const place = (items) => {
    const s = Array.from({ length: n }, () => ({ ...wall }));
    if (items.length > n) return null;
    const idx = items.length === 1 ? [Math.floor((n - 1) / 2)] : items.map((_, i) => Math.round(i * (n - 1) / (items.length - 1)));
    items.forEach((it, i) => { s[idx[i]] = { ...it }; });
    return s;
  };
  const access = contract.goals.access;
  for (let k = 1; k <= Math.min(n, 3); k++) for (const p of P) {
    const items = Array.from({ length: k }, () => p);
    if (access) { if (k < n) items.splice(Math.floor(k / 2), 0, gap('slider', { button: true })); else continue; }
    out.push(place(items));
  }
  for (let k = 1; k <= Math.min(n, 3); k++) for (const p of wideP) {
    out.push(place(Array.from({ length: k }, () => p)));
    if (k < n) out.push(place([...Array.from({ length: k }, () => p), P[1]]));
  }
  const vest = cold && unlocks.vestibule ? [false, true] : [false];
  for (const v of vest) {
    const g2 = (t, o = {}) => gap(t, { ...o, vestibule: v });
    for (let k = 1; k <= Math.min(n, 2); k++) {
      out.push(place(Array.from({ length: k }, () => g2('slider'))));
      out.push(place(Array.from({ length: k }, () => g2('swing'))));
    }
    if (n >= 2) {
      out.push(place([g2('swing', { flow: 'in' }), g2('swing', { flow: 'out' })]));
      if (v) out.push(place([g2('slider', { flow: 'in' }), g2('slider', { flow: 'out' })]));
    }
    if (v && access) for (const p of P.slice(0, 2)) out.push(place([p, g2('slider', { button: true })]));
  }
  if (n >= 2) {
    out.push(place([gap('swing', { flow: 'in' }), gap('swing', { flow: 'out' })]));
    out.push(place([gap('slider', { flow: 'in' }), gap('slider', { flow: 'out' })]));
  }
  // cyclists need a door that isn't revolving
  if (tw.includes('bikes') && n >= 2) for (const p of P.slice(0, 2)) for (const t of ['slider', 'swing']) {
    out.push(place([p, gap(t)]));
    if (n >= 3) out.push(place([p, gap(t), p]));
  }
  // steps everywhere but the ramp: the step-free door has to go in a ramp bay
  const ramps = contract.site && contract.site.rampBays;
  if (access && ramps) for (const rb of ramps) for (const p of [...P.slice(0, 2), ...wideP]) {
    const s1 = Array.from({ length: n }, (_, i) => i === rb ? gap('slider', { button: !p.wide }) : { ...p });
    out.push(s1);
    if (p.wide) out.push(Array.from({ length: n }, (_, i) => i === rb ? { ...p } : { ...P[1] }));
  }
  // listed door: fill the remaining bays around the fixed revolving door
  if (contract.rules && contract.rules.fixed) {
    const fixedIdx = +Object.keys(contract.rules.fixed)[0];
    const others = [...Array(n).keys()].filter(i => i !== fixedIdx);
    const fills = [[], [gap('slider')], [gap('slider'), gap('slider')], [gap('slider', { flow: 'in' }), gap('slider', { flow: 'out' })],
      [gap('swing', { flow: 'in' }), gap('swing', { flow: 'out' })], [P[0]], [P[1]], [P[1], P[1]]];
    if (access) fills.push([gap('slider', { button: true })], [gap('slider', { button: true }), P[1]]);
    for (const f of fills) {
      const s = Array.from({ length: n }, () => ({ ...wall }));
      s[fixedIdx] = { ...contract.rules.fixed[fixedIdx] };
      f.forEach((it, i) => { if (others[i] != null) s[others[i]] = { ...it }; });
      out.push(s);
    }
  }
  // one swing door with lane barriers: cheap two-way without the clipping
  if (unlocks.barriers) {
    out.push(place([gap('swing', { lanes: true })]));
    if (n >= 2) out.push(place([gap('swing', { lanes: true }), gap('swing', { lanes: true })]));
  }
  // fire drills: try every layout with and without a pillar inside each exit
  if (contract.drill && unlocks.pillars) {
    // pillars matter where exits are few: only try them on layouts with one or two doors
    const withP = out.filter(s => s && s.filter(d => d.type !== 'wall').length <= 2).map(s => s.map(d => d.type === 'wall' ? d : { ...d, pillar: true }));
    out.push(...withP);
  }
  const seen = new Set();
  return out.filter(s => {
    if (!s) return false;
    if (contract.rules && contract.rules.fixed) for (const [i, f] of Object.entries(contract.rules.fixed)) s[i] = { ...f };
    if (violatesRules(contract, s)) return false;
    if (contract.budgetCap != null && designCost(s, contract.existing) > contract.budgetCap) return false;
    const key = JSON.stringify(s); if (seen.has(key)) return false; seen.add(key); return true;
  });
}

// several surveys can run at once; the one the player is waiting on goes first
const GATE = { focus: null, active: new Set() };
async function yieldStep(job) {
  await new Promise(res => setTimeout(res, 0));
  while (GATE.focus != null && GATE.focus !== job && GATE.active.has(GATE.focus)) await new Promise(res => setTimeout(res, 15));
}
async function solveContract(contract, unlocks, onProgress) {
  const cands = candidates(contract, unlocks);
  const results = [];
  for (let i = 0; i < cands.length; i++) {
    const r = runHeadless(contract, cands[i], unlocks);
    results.push({ slots: cands[i], r, cost: designCost(cands[i], contract.existing) });
    if (onProgress) onProgress((i + 1) / cands.length);
    await yieldStep(contract.job);
  }
  let ok = results.filter(x => meetsSoft(contract, x.r));
  contract.relaxed = !ok.length;
  if (!ok.length) {
    const g = contract.goals;
    const best = results.slice().sort((a, b) => (a.r.bumps - b.r.bumps) || (b.r.minTemp - a.r.minTemp) || (a.r.maxTemp - b.r.maxTemp) || (b.r.through - a.r.through))[0];
    g.bumps = Math.max(g.bumps, best.r.bumps);
    if (g.minTemp != null && best.r.minTemp < g.minTemp) g.minTemp = Math.floor(best.r.minTemp);
    if (g.maxTemp != null && best.r.maxTemp > g.maxTemp) g.maxTemp = Math.ceil(best.r.maxTemp);
    if (g.laps != null && best.r.laps > g.laps) g.laps = best.r.laps;
    if (g.access && best.r.accessFail) g.access = false;
    if (g.bikes && best.r.bikeFail) g.bikes = false;
    ok = results.filter(x => meetsSoft(contract, x.r));
    if (!ok.length) ok = [best];
  }
  // fire drill: the target is a little slower than the best evacuation found among otherwise-passing designs
  if (contract.drill) {
    const bestEvac = Math.min(...ok.map(x => x.r.evac));
    if (bestEvac >= 99) contract.relaxed = true;
    contract.goals.evac = Math.ceil(Math.min(bestEvac, 34) * 1.15 + 0.5);
    ok = ok.filter(x => x.r.evac <= contract.goals.evac);
  }
  const topThrough = Math.max(...ok.map(x => x.r.through));
  // a contract where even the best design moves a trickle is pointless: treat it as unfair
  const expected = (contract.crowd.in + contract.crowd.out) * TEST_SECONDS;
  if (topThrough < expected * 0.45) contract.relaxed = true;
  contract.goals.through = Math.max(5, Math.floor(topThrough * (contract.landmark ? 0.9 : (contract.twists || []).includes('surge') ? 0.95 : 0.88)));
  // on a callback the doors you already have must not be enough: raise the bar above them
  if (contract.existing && contract.opts && contract.opts.callback) {
    const r0 = runHeadless(contract, contract.existing, unlocks);
    const better = ok.filter(x => x.cost > 0).map(x => x.r.through);
    if (meetsSoft(contract, r0) && r0.through >= contract.goals.through) {
      const want = r0.through + Math.max(3, Math.round(r0.through * 0.06));
      if (better.length && Math.max(...better) >= want) contract.goals.through = want;
    }
  }
  let passing = ok.filter(x => x.r.through >= contract.goals.through).sort((a, b) => a.cost - b.cost);
  if (!passing.length) {
    // nothing moves enough people: an unfair contract. Keep it solvable and flag it so it gets rerolled.
    contract.relaxed = true;
    const top = ok.slice().sort((a, b) => b.r.through - a.r.through)[0];
    contract.goals.through = top.r.through;
    passing = [top];
  }
  // a station also has to keep the queues short: 9 in 10 commuters through within a time set by the best designs
  if (contract.landmark && passing.length) {
    const best = Math.min(...passing.map(x => x.r.wait));
    contract.goals.wait = Math.ceil(best * 1.4 * 2) / 2;
    passing = passing.filter(x => x.r.wait <= contract.goals.wait);
  }
  const par = passing[0];
  contract.par = { cost: par.cost, slots: par.slots, through: par.r.through, sig: designSig(par.slots) };
  // how many genuinely different designs pass: a measure of how open the puzzle is
  contract.distinct = new Set(passing.map(x => designSig(x.slots))).size;
  const parCost = Math.max(par.cost, 2500);
  // fee = the par hardware cost + your margin. Bonuses (specialist, sales, HQ) only ever scale the margin.
  contract.budget = contract.budgetCap != null ? contract.budgetCap : Math.ceil(parCost * 1.5 / 500) * 500 + 3000;
  contract.margin = Math.ceil((Math.max(3000, par.cost * 0.3) + Math.min(contract.tier, 6) * 800) * (contract.specialist ? 1.6 : 1) * (contract.event ? 1.25 : 1) * (contract.landmark ? 1.5 : 1) * (contract.rescue ? 1.3 : 1) / 500) * 500;
  contract.fee = par.cost + contract.margin;
  contract.solved = true;
  return contract;
}

if (typeof module !== 'undefined') module.exports = { buildSiteTowers: null, STATION_POOL, stationCandidates, EVENTS, eventOf, xmasBays, buildSite, runSeconds, testOver, TWIST_REQ, KINDS, TWISTS, TWIST_POOL, CONFLICTS, MONTHS, makeContract, worldCfg, isSpecialist, solveContract, designCost, designSig, slotCost, candidates, runHeadless, violatesRules, TEST_SECONDS, PRICE };

// Make a contract and solve it, retrying when the result would be a bad puzzle:
//  - unfair: nothing passes without watering the goals down -> reroll the twists
//  - free: the existing doors already pass (a callback you fix for £0) -> add a counter-twist
//  - repeat: the best answer matches one the player used recently -> add a counter-twist
async function generateSolved(contract, unlocks, recent, onProgress) {
  const job = contract.job != null ? contract.job : contract.seed;
  GATE.active.add(job);
  try { return await generateSolvedInner(contract, unlocks, recent, onProgress, job); }
  finally { GATE.active.delete(job); }
}
async function generateSolvedInner(contract, unlocks, recent, onProgress, job) {
  contract.job = job;
  let c = contract, best = null;
  const MAX = 3;
  for (let attempt = 0; attempt < MAX; attempt++) {
    if (onProgress) onProgress(0, attempt);
    try { await solveContract(c, unlocks, f => onProgress && onProgress(f, attempt)); }
    catch (err) { c.relaxed = true; c.par = c.par || { cost: 0, slots: [], through: 0, sig: '' }; c.broken = true; }
    const free = c.par.cost === 0 && !!c.existing;
    const repeat = !c.first && recent && recent.includes(c.par.sig);
    if (!c.relaxed && (!best || best.relaxed || best.free || best.repeat)) best = c;
    c.free = free; c.repeat = repeat;
    if (!c.relaxed && !free && !repeat) return c;
    if (attempt === MAX - 1) break;
    const opts = { ...(c.opts || {}) };
    if (c.relaxed) {
      // unfair combination: same building and callback reason, fresh random twists
      c = makeContract(c.kind, c.tier, c.month, c.seed + 101 * (attempt + 1), { ...opts, extra: [] }); c.job = job;
    } else {
      const gapOnly = !c.par.sig.includes('r');
      const banned = c.existing ? ['listed', 'narrow'] : [];
      const counters = gapOnly ? ['cold', 'wind'] : ['surge', 'fragile', 'tight', 'stepfree', 'wind'];
      const ct = (c.opts && c.opts.tech) || unlocks, allowed = t => !c.twists.includes(t) && !banned.includes(t) && !clashes(c.twists, t, ct) && (!TWIST_REQ[t] || TWIST_REQ[t](ct));
      let pool = counters.filter(allowed);
      if (!pool.length) pool = TWIST_POOL.filter(allowed);
      if (!pool.length) break;
      opts.extra = [...(opts.extra || []), pool[Math.floor(makeRng(c.seed + attempt)() * pool.length)]];
      c = makeContract(c.kind, c.tier, c.month, c.seed, opts); c.job = job;
    }
    c.novelty = true;
  }
  if (best && !best.relaxed) return best;
  // every version was unfair: fall back to a plain job with no extra twists
  try {
    const plain = makeContract(contract.kind, contract.tier, contract.month, contract.seed + 997, { ...(contract.opts || {}), extra: [], plain: true }); plain.job = job;
    await solveContract(plain, unlocks);
    if (!plain.relaxed) return plain;
    if (!c.broken) return plain;
  } catch (err) { /* fall through */ }
  if (c.broken) throw new Error('survey failed');
  return c;
}
if (typeof module !== 'undefined') { module.exports.generateSolved = generateSolved; module.exports.GATE = GATE; }
