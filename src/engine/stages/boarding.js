// Boarding at the gate: back to front is slower than no order at all.
// One aisle, rows of three seats either side. Everyone stops in the aisle to put a bag in the locker, and a window
// passenger whose row-mates are already sitting makes them stand up. Boarding the back rows first sends everyone
// to the same few rows at once, so they queue behind each other's bags; boarding at random spreads them along
// the aisle, so many stow at once. Windows first, then middles, then aisles (outside in) is quicker still: nobody
// has to stand up. More levers: gate staff (people board in their group; without them a third don't), checking
// big bags in at the gate (fewer to stow, but it takes a little time at the desk), and the rear stairs.
import { StageSim } from './common.js';

const SEAT_ROW_W = 0.8, PLANE_X0 = -6.2, AISLE_Y = 0, SEAT_DY = 0.55, GATE_X = -8.2;
const METHOD_COST = 500, GATE_STAFF_COST = 1500, GATE_CHECK_COST = 1500, REAR_STAIRS_COST = 6000;

class BoardingSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    this.gate = [];                     // waiting at the gate, in the order they arrived
    this.front = []; this.rear = [];   // in each aisle, nearest the door first
    this.seated = new Set();            // `${row}${seat}` taken
    this.bins = {};                     // bags already in each row's lockers: a fuller locker takes longer
    this.nextSeat = 0;
    const P = c.params;
    // seat everyone will have: a shuffled list of the plane's seats, as full as the flight
    const seats = [];
    for (let r = 1; r <= P.rows; r++) for (const s of 'ABCDEF') seats.push({ row: r, seat: s });
    for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; }
    this.seats = seats;
  }
  // which group someone boards in: lower first. Some ignore their group unless gate staff keep order.
  group(p) {
    const P = this.c.params, m = this.d.method;
    if (m === 'random') return 0;
    if (this.rng() < (this.d.staff ? 0.08 : 0.35)) return Math.floor(this.rng() * 3);
    if (m === 'backfront') return 2 - Math.min(2, Math.floor(3 * (p.row - 1) / P.rows));
    return { A: 0, F: 0, B: 1, E: 1, C: 2, D: 2 }[p.seat];   // outside in: windows, middles, aisles
  }
  admit(p) {
    const P = this.c.params, s = this.seats[this.nextSeat++ % this.seats.length];
    Object.assign(p, s);
    p.gone = false; p.inAt = this.t; p.state = 'gate';
    p.depth = { A: 2, F: 2, B: 1, E: 1, C: 0, D: 0 }[p.seat];
    p.side = 'ABC'.includes(p.seat) ? -1 : 1;
    p.bag = this.rng() < (this.d.gatecheck ? P.bags * 0.5 : P.bags);
    p.stowT = (2.5 + this.rng() * 4) * (p.type === 'elderly' ? 1.6 : 1) * P.stowK;
    p.g = this.group(p); p.rearDoor = !!this.d.rear && p.row > P.rows / 2;
    p.x = GATE_X + (this.rng() - 0.5) * 1.5; p.y = 3.0;
    this.gate.push(p); this.people.push(p);
  }
  aisle(p) { return p.rearDoor ? this.rear : this.front; }
  // where along the aisle: cells from the door the person came in by
  target(p) { return p.rearDoor ? this.c.params.rows + 1 - p.row : p.row; }
  rowX(row) { return PLANE_X0 + (row - 0.5) * SEAT_ROW_W; }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    const P = this.c.params;
    // boarding: once it's called, the next in the lowest group steps up when the door is clear (a bag check at
    // the desk slows the line a little)
    if (this.t >= P.call) for (const ai of [this.front, this.rear]) {
      const last = ai[ai.length - 1];
      if (last && last.pos < 1.1) continue;
      if (this.t < (ai.nextAt || 0)) continue;
      let best = -1;
      for (let i = 0; i < this.gate.length; i++) { const q = this.gate[i]; if ((ai === this.rear) !== q.rearDoor) continue; if (best < 0 || q.g < this.gate[best].g) best = i; }
      if (best < 0) continue;
      const p = this.gate.splice(best, 1)[0];
      p.state = 'aisle'; p.pos = 0; ai.push(p);
      ai.nextAt = this.t + (this.d.gatecheck ? 1.2 : 0.8);
    }
    for (const ai of [this.front, this.rear]) {
      for (let i = 0; i < ai.length; i++) {
        const p = ai[i], ahead = ai[i - 1], tgt = this.target(p);
        if (p.state === 'aisle') {
          const room = ahead ? ahead.pos - 1 : Infinity;
          p.pos = Math.min(tgt, room, p.pos + dt * p.walk * 0.75 / SEAT_ROW_W);
          if (p.pos >= tgt - 1e-6) { p.state = 'stow'; p.until = this.t + (p.bag ? p.stowT * (1 + 0.12 * (this.bins[p.row] || 0)) : 0.6); if (p.bag) this.bins[p.row] = (this.bins[p.row] || 0) + 1; }
        } else if (p.state === 'stow' && this.t >= p.until) {
          // row-mates nearer the aisle on this side stand up to let them in
          const side = p.side < 0 ? 'ABC' : 'DEF';
          let block = 0;
          for (const s of side) { const dp = { A: 2, F: 2, B: 1, E: 1, C: 0, D: 0 }[s]; if (dp < p.depth && this.seated.has(p.row + s)) block++; }
          p.state = 'shuffle'; p.until = this.t + 1.2 + block * P.standUp;
        } else if (p.state === 'shuffle' && this.t >= p.until) {
          p.state = 'seated'; this.seated.add(p.row + p.seat); this.waits.push(this.t - p.inAt);
          if (this.out) this.finish(p); else this.stats.through++;
        }
        // the plan: where they are now
        if (p.state !== 'seated') { p.x = this.rowX(p.rearDoor ? P.rows + 1 - p.pos : Math.max(0.5, p.pos)); p.y = AISLE_Y; }
        else { p.x = this.rowX(p.row); p.y = p.side * (0.42 + SEAT_DY * p.depth); }
      }
      // seated people stay on the plan but leave the aisle
      const keep = ai.filter(p => p.state !== 'seated');
      ai.length = 0; ai.push(...keep);
    }
    for (const [k, p] of this.gate.entries()) this.walkTo(p, GATE_X + 1.3 - (k % 6) * 0.42, -2.8 + Math.floor(k / 6) * 0.4, dt);
  }
  over() { return this.t >= this.c.arrive && !this.gate.length && !this.front.length && !this.rear.length; }
}

export default {
  key: 'boarding',
  name: 'Boarding',
  paradox: 'Back to front is slower',
  about: 'Passengers board a single-aisle plane from the gate. Everyone stops in the aisle to put a bag in the locker.',
  waitLabel: '9 in 10 in their seats within',
  box: { w: 19, h: 6.4 },
  metric: 'p90',
  slack: 1.05,
  // targets: what the airline could do at the gate without the rear stairs
  reference(ok) { return ok.filter(x => !x.slots.rear); },
  level(c, rng, tier) {
    const scale = 1 + 0.05 * Math.min(tier, 6);
    if (c.existing) for (const [k, v] of Object.entries({ method: 'backfront', staff: false, gatecheck: false, rear: false })) if (c.existing[k] == null) c.existing[k] = v;
    const rows = 16, load = c.twists.includes('fullflight') ? 1 : 0.85;
    c.params = { rows, bags: c.twists.includes('handluggage') ? 0.95 : 0.75, stowK: c.twists.includes('handluggage') ? 1.3 : 1, standUp: 2.4, call: 20 };
    const mix = { elderly: c.twists.includes('coachtour') ? 0.3 : 0.08 };
    // everyone is at the gate when boarding is called
    const n = Math.round(rows * 6 * load);
    let rate = n / 20 * Math.min(scale, 1);
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = 20; c.run = 600;
  },
  twists: {
    fullflight: { label: 'Full flight', text: 'Every seat sold.' },
    handluggage: { label: 'Hand luggage only', text: 'Cheap fares with no hold bags: nearly everyone has a big cabin bag.' },
    coachtour: { label: 'Coach tour', text: 'A coach tour on board: plenty of older passengers, slower with their bags.' },
  },
  options(c, tech) {
    return [
      { key: 'method', label: 'Boarding order', kind: 'seg', choices: [['random', 'Any order'], ['backfront', 'Back to front'], ['outsidein', 'Windows first']] },
      { key: 'staff', label: 'Gate staff', kind: 'toggle', note: `+£${GATE_STAFF_COST.toLocaleString('en-GB')} · they call each group and keep people to it; without them a third board when they like` },
      // a research call is about the boarding order: no bag checks or rear stairs
      ...(c.opts.callback === 'paradox' ? [] : [
        { key: 'gatecheck', label: 'Check big bags at the gate', kind: 'toggle', note: `+£${GATE_CHECK_COST.toLocaleString('en-GB')} · half as many bags to stow, but the line at the desk moves slower` },
        { key: 'rear', label: 'Rear stairs', kind: 'toggle', note: `+£${REAR_STAIRS_COST.toLocaleString('en-GB')} · the back half of the plane boards by the rear door` },
      ]),
    ];
  },
  explain(d, c) { return `${c.params.rows} rows of six, one aisle. ${d.method === 'random' ? 'Passengers board in any order.' : d.method === 'backfront' ? 'The back rows board first, then the middle, then the front.' : 'Window seats board first, then middles, then aisles.'}`; },
  hint(r, c) { return 'Watch the aisle: when everyone heads for the same few rows, they wait behind each other\'s bags. And watch who has to stand up to let a window passenger in.'; },
  defaults() { return { stage: 'boarding', method: 'backfront', staff: false, gatecheck: false, rear: false }; },
  cost(d, ex) {
    return (d.method !== (ex ? ex.method : 'backfront') ? METHOD_COST : 0) + (d.staff && !(ex && ex.staff) ? GATE_STAFF_COST : 0)
      + (d.gatecheck && !(ex && ex.gatecheck) ? GATE_CHECK_COST : 0) + (d.rear && !(ex && ex.rear) ? REAR_STAIRS_COST : 0);
  },
  sig(d) { return `b${{ random: 'R', backfront: 'B', outsidein: 'O' }[d.method]}${d.staff ? 'S' : ''}${d.gatecheck ? 'G' : ''}${d.rear ? 'D' : ''}`; },
  candidates(c) {
    const out = [], plain = c.opts.callback === 'paradox';
    for (const method of ['random', 'backfront', 'outsidein']) for (const staff of [false, true]) for (const gatecheck of plain ? [false] : [false, true]) for (const rear of plain ? [false] : [false, true])
      if (!(method === 'random' && staff)) out.push({ stage: 'boarding', method, staff, gatecheck, rear });
    return out;
  },
  Sim: BoardingSim,
};
