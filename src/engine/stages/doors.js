// Doors as a stage: a frontage inside a chained level, run on the door physics (World), so a gate line can be
// fed by the escalators from the platforms, or a terminal's doors can feed the hall behind them. The frontage is
// a row of identical bays across a fixed width (walls in the rest), set with stage controls, not the bay editor.
// Each person the stage before hands on steps into the World on its street side and, once through the doors,
// is handed on to the next stage (World.onPass). As in every stage, people walk up the screen: the World's
// outward direction, so a gate line's lanes all run 'out'.
import { StageSim } from './common.js';
import { World, SLOT_W, WORLD_HH } from '../world.js';

// what a bay costs, as on a door job (contracts.js PRICE), and staff on the day
export const BAY_COST = { swing: 2500, slider: 6000, revolve: 12000, gates: 7000 };
const WIDE_AISLE_COST = 2000, BAY_STAFF_COST = 1500;
const BAY_LABEL = { swing: 'Swing doors', slider: 'Sliding doors', revolve: 'Revolving doors', gates: 'Ticket gates' };

// the bays of a door stage, as a door job's slots: the doors in the middle of the frontage, walls either side
export function doorSlots(c, d) {
  const width = c.params.width, n = Math.max(1, Math.min(width, d.bays)), first = Math.floor((width - n) / 2);
  const mid = first + Math.floor((n - 1) / 2);
  return Array.from({ length: width }, (_, i) => {
    if (i < first || i >= first + n) return { type: 'wall' };
    const staff = d.staff ? { doorman: true } : {};
    if (d.type === 'gates') return { type: 'gates', flow: 'out', wide: !!d.wide && i === mid, ...staff };
    if (d.type === 'revolve') return { type: 'revolve', wings: 4, mouth: 40, core: 0.15, rpm: 4, padded: false, flow: 'both', ...staff };
    if (d.type === 'slider') return { type: 'slider', curtain: false, flow: 'both', button: false, ...staff };
    return { type: 'swing', curtain: false, flow: 'both', ...staff };
  });
}

class DoorStageSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    this.world = new World({ slots: doorSlots(c, d), crowd: { in: 0, out: 0, mix: {} }, outsideTemp: 18, duration: 0, seed: (c.seed || 1) * 17 + 3,
      heater: 1, wind: 0, stack: 0, seals: 0, rain: false, site: { obstacles: [], labels: [], decos: [] }, drill: null, patient: true, tapK: c.params.tapK || 1 });
    this.waiting = [];   // people handed in who haven't found room to step onto the street side yet
    this.world.onPass = wp => { const p = wp.from; if (!p) return; this.waits.push(this.t - p.inAt); this.finish(p); };
    this.lost = 0; this.handed = 0;
  }
  admit(p) { p.gone = false; p.inAt = this.t; this.waiting.push(p); this.handed++; }
  pending() { return this.waiting.length; }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    // step people in at the street side, a few a frame (World.spawn refuses a spot someone is standing on)
    for (let k = 0; k < 3 && this.waiting.length; k++) {
      const p = this.waiting[0], wp = this.world.spawn(-1, undefined, p.type);
      if (wp === false) break;
      this.waiting.shift();
      if (wp === true) { this.lost++; continue; }   // no door fits them (a wheelchair at narrow gates): they never get through
      wp.from = p;
    }
    this.world.step(dt);
    this.people = this.world.people;
    this.events = this.world.events;
    this.stats.bumps = this.world.stats.bumps;
    this.stats.laps = this.world.stats.laps;
  }
  over() { return this.t >= this.c.arrive && !this.waiting.length && !this.world.people.length; }
  result() { return { ...super.result(), accessFail: this.world.stats.accessFail, bikeFail: this.world.stats.bikeFail, lost: this.lost, handed: this.handed }; }
}

export default {
  key: 'doors',
  name: 'The doors',
  paradox: 'The frontage',
  about: 'A frontage of doors or gates across the route. More bays take more people at once; staff keep each one moving.',
  waitLabel: '9 in 10 through the doors within',
  bumpLabel: 'Bumps at the doors',
  metric: 'p90',
  slack: 1.15,
  level(c, rng, tier) {
    const scale = 1 + 0.07 * Math.min(tier, 6);
    // a client sets the frontage in its tune: how many bays wide, and what can go in it
    c.params = { width: 4, types: ['swing', 'slider', 'revolve'] };
    let rate = 1.2 * scale * (0.94 + rng() * 0.12);
    if (c.twists.includes('paper')) c.params.tapK = 1.6;
    rate = StageSim.tune(c, rate, scale);
    const mix = { case: 0.1, elderly: 0.1, ...(c.params.mix || {}) };
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = c.params.arrive || 60; c.run = c.arrive + 60;
    // most of the crowd in the last stretch before kick-off
    if (c.twists.includes('kickoff')) c.crowd.phases = [{ until: 30, rate: +(rate * 0.5).toFixed(3) }, { until: 1e9, rate: +(rate * 1.5).toFixed(3) }];
  },
  bumps: c => Math.max(2, Math.round(c.crowd.rate * c.arrive * 0.04)),
  twists: {
    kickoff: { label: 'Kick-off rush', text: 'Half the crowd leaves it late and arrives in the last few minutes.' },
    paper: { label: 'Paper tickets', text: 'Paper tickets today: every fan takes longer to get through a gate.' },
  },
  box: { w: 4 * SLOT_W, h: 2 * WORLD_HH },
  boxOf: c => ({ w: c.params.width * SLOT_W, h: 2 * WORLD_HH }),
  options(c, tech) {
    const types = c.params.types;
    return [
      { key: 'bays', label: 'Bays', kind: 'stepper', min: 1, max: c.params.width },
      ...(types.length > 1 ? [{ key: 'type', label: 'Doors', kind: 'seg', choices: types.map(t => [t, BAY_LABEL[t].split(' ')[0]]) }] : []),
      { key: 'staff', label: types.every(t => t === 'gates') ? 'Gate-line staff' : 'Staff on the doors', kind: 'toggle', tech: 'doorman', note: `+£${BAY_STAFF_COST.toLocaleString('en-GB')} a bay · they keep people moving` },
      ...(types.includes('gates') ? [{ key: 'wide', label: 'A wide aisle', kind: 'toggle', note: `+£${WIDE_AISLE_COST.toLocaleString('en-GB')} · wheelchairs, prams and bikes fit through` }] : []),
    ];
  },
  explain(d, c) { return `${d.bays} bay${d.bays > 1 ? 's' : ''} of ${BAY_LABEL[d.type].toLowerCase()} across a ${c.params.width}-bay frontage.`; },
  hint(r, c) { return r.lost ? 'Some people found no door they could use: a wheelchair or a pram needs a wide aisle.' : 'People are queuing at the doors. More bays take more at once; staff keep each one moving.'; },
  defaults() { return { stage: 'doors', bays: 2, type: 'swing', staff: false, wide: false }; },
  cost(d, ex) {
    const same = ex && ex.type === d.type ? ex.bays : 0;
    return Math.max(0, d.bays - same) * BAY_COST[d.type] + (d.staff && !(ex && ex.staff) ? BAY_STAFF_COST * d.bays : 0)
      + (d.wide && d.type === 'gates' && !(ex && ex.wide && ex.type === 'gates') ? WIDE_AISLE_COST : 0);
  },
  sig(d) { return `d${d.bays}${d.type[0].toUpperCase()}${d.staff ? 'S' : ''}${d.wide ? 'W' : ''}`; },
  candidates(c, tech) {
    const out = [];
    for (const type of c.params.types) for (let bays = 1; bays <= c.params.width; bays++) for (const staff of tech.doorman ? [false, true] : [false])
      for (const wide of type === 'gates' ? [false, true] : [false]) out.push({ stage: 'doors', bays, type, staff, wide });
    return out;
  },
  Sim: DoorStageSim,
};
