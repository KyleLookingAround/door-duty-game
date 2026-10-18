// One snaking queue: a counter hall with a row of desks.
// A line per desk looks fair, but one slow customer strands everyone behind them. One long snake feeding
// every desk keeps the slow ones from holding anyone else up, so fewer desks give shorter worst-case waits.
// Two more levers, as banks run their counters (not on research calls or chained levels, which stay about
// the snake):
//  - An express desk for quick jobs only, a third quicker at them: a slow customer never blocks it, but on
//    a day of long business it stands idle while the queue for the others backs up.
//  - Lunchtime cover: part-time desks, cheaper than a full one and a little slower, open only through the
//    middle and end of the day (COVER). Worth it when the lunch rush comes; little help with an opening rush.
import { StageSim } from './common.js';

const LUNCH = [0.4, 0.85];   // the share of the arrivals window the lunch rush comes in
const COVER = [0.55, 1.2];    // lunchtime cover's shift, as shares of the arrivals window
const DESK_Y = -3.0, HEAD_Y = -1.9, ROW_W = 9.2, ROW_GAP = 0.68, SLOT = 0.62, DOOR = [0, 4.1];

const EXPRESS_COST = 1500, COVER_COST = 2500;
class QueueSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    const n = d.desks + (d.cover || 0);
    // the express desk is the first; cover desks are the last ones along
    this.desks = Array.from({ length: n }, (_, i) => ({ i, x: (i - (n - 1) / 2) * Math.min(1.7, 11 / n), y: DESK_Y, user: null, until: 0, line: [], express: !!d.express && i === 0, cover: i >= d.desks }));
    this.snake = [];
  }
  // where the j-th person in the snake stands: rows that zig-zag down the hall, barriers between them
  snakeSpot(j) {
    if (j === 0) return [0, HEAD_Y];
    j -= 1;
    const per = Math.floor(ROW_W / SLOT), row = Math.floor(j / per), k = j % per;
    const x = row % 2 ? ROW_W / 2 - k * SLOT : -ROW_W / 2 + k * SLOT;
    return [x, HEAD_Y + 0.75 + row * ROW_GAP];
  }
  lineSpot(desk, j) { return [desk.x, DESK_Y + 0.9 + j * SLOT]; }
  // lunchtime cover desks are staffed through the middle of the arrivals window only
  open(dk) { return !dk.cover || (this.t >= this.c.arrive * COVER[0] && this.t < this.c.arrive * COVER[1]); }
  // who a desk can serve: the express desk takes quick jobs only (people know whether their business is quick)
  serves(dk, p) { return !dk.express || !p.slow; }
  // someone walks in: from the street, or from the stage before in a chain
  admit(p) {
    const type = p.type;
    p.x = DOOR[0] + (this.rng() - 0.5) * 1.2; p.y = DOOR[1];
    p.called = null; p.atDesk = false; p.leaving = false; p.queued = false; p.gone = false; p.desk = null; p.inAt = this.t;
    const slow = this.rng() < this.c.params.slow;
    const base = this.c.params.service * (0.6 + this.rng() * 0.8) * (type === 'elderly' ? 1.4 : 1);
    p.service = slow ? base * 4 : base; p.slow = slow;
    if (this.d.layout === 'snake') this.snake.push(p);
    else {
      // everyone joins the shortest-looking line and stays in it: people judge by its length, not by who's at the desk
      let best = this.desks[0], bs = 1e9;
      for (const dk of this.desks) { if (!this.serves(dk, p) || !this.open(dk)) continue; const s = dk.line.length + (dk.user ? 0.5 : 0) + this.rng() * 0.4 + Math.abs(dk.x - p.x) * 0.03; if (s < bs) { bs = s; best = dk; } }
      best.line.push(p); p.desk = best;
    }
    this.people.push(p);
  }
  step(dt) {
    this.t += dt;
    this.arrivals(dt);
    for (const dk of this.desks) {
      // a customer finishes and leaves by the side door
      if (dk.user && dk.user.atDesk && this.t >= dk.until) {
        const u = dk.user; dk.user = null; u.atDesk = false;
        if (this.out) this.finish(u); else { u.leaving = true; this.stats.through++; }
      }
      // the desk calls the next person a moment before it's free ("cashier number 3, please"),
      // so they're stepping up as the last customer leaves: the head of its own line, or of the snake
      if (!dk.next && (!dk.user || (dk.user.atDesk && dk.until - this.t < 2.5))) {
        if (this.d.layout === 'snake') {
          // the snake feeds every open desk: the express desk calls the first quick customer in it
          if (this.open(dk)) { const j = this.snake.findIndex(p => this.serves(dk, p)); if (j >= 0) { const p = this.snake.splice(j, 1)[0]; dk.next = p; p.called = dk; } }
        } else if (dk.line.length) { const p = dk.line.shift(); dk.next = p; p.called = dk; }   // a closing desk still serves its own line
      }
      if (!dk.user && dk.next) { dk.user = dk.next; dk.next = null; }
    }
    for (const p of this.people) {
      if (p.leaving) { if (this.walkTo(p, p.x < 0 ? -7.2 : 7.2, DESK_Y + 0.4, dt)) p.gone = true; continue; }
      if (p.called) {
        const dk = p.called;
        if (dk.user !== p) { this.walkTo(p, dk.x, dk.y + 1.15, dt, p.walk * 1.35); continue; }   // waiting just behind the counter line
        if (!p.atDesk && this.walkTo(p, dk.x, dk.y + 0.5, dt, p.walk * 1.35)) {
          // an express till is set up for quick business (a third quicker); part-timers are a little slower
          p.atDesk = true; dk.until = this.t + p.service * (dk.express ? 0.65 : dk.cover ? 1.3 : 1);
          this.waits.push(this.t - p.inAt);
          if (p.slow) this.note('slow', dk.x, dk.y);
        }
        continue;
      }
      // queuing: walk up to your place, shuffle forward as the queue moves
      const j = this.d.layout === 'snake' ? this.snake.indexOf(p) : p.desk.line.indexOf(p);
      const [tx, ty] = this.d.layout === 'snake' ? this.snakeSpot(j) : this.lineSpot(p.desk, j);
      if (this.walkTo(p, tx, ty, dt)) p.queued = true;
    }
    this.sweep();
  }
  over() { return this.t >= this.c.arrive && !this.people.length; }
}

export default {
  key: 'queue',
  name: 'Counter hall',
  paradox: 'One snaking queue',
  about: 'Customers queue for a row of desks. Most are quick; now and then one takes ages.',
  waitLabel: '9 in 10 reach a desk within',
  box: { w: 15, h: 9.4 },
  metric: 'p90',
  // targets are set by what two more desks could do at most: the client won't pay to open every desk
  reference(ok, c) { return ok.filter(x => x.slots.desks <= c.existing.desks + 2); },
  slack: 1.1,
  // a job: how busy the hall is, how long a transaction takes, and how many are slow
  level(c, rng, tier) {
    // a hall saved before express desks and cover: neither
    if (c.existing) for (const [k, v] of Object.entries({ express: false, cover: 0 })) if (c.existing[k] == null) c.existing[k] = v;
    const scale = 1 + 0.08 * Math.min(tier, 6);
    c.params = { service: 11, slow: 0.15, desks0: c.existing ? c.existing.desks : 3, max: 7 };
    let rate = 0.27 * scale * (0.92 + rng() * 0.16);
    const mix = {};
    if (c.twists.includes('payday')) rate *= 1.3;
    if (c.twists.includes('mortgages')) c.params.slow = 0.22;
    if (c.twists.includes('pensions')) mix.elderly = 0.35;
    if (c.twists.includes('quick')) c.params.slow = 0.05;
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    // the lunch rush: quiet, then most of the day's customers at once, then quiet again
    // the opening rush: a queue at the door first thing, then a quiet day
    if (c.twists.includes('opening')) c.crowd.phases = [{ until: 90 * 0.3, rate: +(rate * 2.2).toFixed(3) }, { until: 1e9, rate: +(rate * 0.5).toFixed(3) }];
    if (c.twists.includes('lunch')) c.crowd.phases = [{ until: 90 * LUNCH[0], rate: +(rate * 0.4).toFixed(3) }, { until: 90 * LUNCH[1], rate: +(rate * 2.2).toFixed(3) }, { until: 1e9, rate: +(rate * 0.4).toFixed(3) }];
    c.params.deep = !c.chained && c.opts.callback !== 'paradox';
    c.arrive = 90; c.run = 170;
  },
  twists: {
    payday: { label: 'Payday', text: 'It\'s payday: a third more customers through the door.' },
    mortgages: { label: 'Mortgage desk', text: 'More complicated business today: nearly one customer in four takes three times as long.' },
    pensions: { label: 'Pension day', text: 'Pension day: a third of the customers are older and take their time.' },
  },
  // twists about the shape of the day, where the express desk and lunchtime cover are on offer
  dayTwists: {
    lunch: { label: 'Lunch rush', text: 'Quiet all morning, then most of the day\'s customers in their lunch hour.' },
    opening: { label: 'Opening rush', text: 'A queue at the door when you open, then a quiet day.' },
    quick: { label: 'Quick jobs', text: 'Mostly quick business today: paying in and cheques. Hardly anyone takes long.' },
  },
  twistsOf(opts) { return opts.callback === 'paradox' ? this.twists : { ...this.twists, ...this.dayTwists }; },
  options(c, tech) {
    return [
      { key: 'desks', label: 'Desks open', kind: 'stepper', min: 2, max: c.params.max, price: 5000, note: `£5,000 a desk beyond the ${c.params.desks0} already there` },
      { key: 'layout', label: 'Queue', kind: 'seg', choices: [['lines', 'A line per desk'], ['snake', 'One snaking queue', 'barriers']] },
      ...(c.params.deep ? [
        { key: 'express', label: 'Express desk (quick jobs only)', kind: 'toggle', note: `+£${EXPRESS_COST.toLocaleString('en-GB')} · the first desk only takes quick business; a slow customer never blocks it, but it idles when quick jobs are few` },
        { key: 'cover', label: 'Lunchtime cover', kind: 'stepper', min: 0, max: 2, note: `£${COVER_COST.toLocaleString('en-GB')} a desk · part-timers who open extra desks from midday to closing, a little slower than your full-time staff` },
      ] : []),
    ];
  },
  defaults() { return { stage: 'queue', desks: 3, layout: 'lines', express: false, cover: 0 }; },
  cost(d, existing) {
    const had = existing ? existing.desks : 0;
    return Math.max(0, d.desks - had) * 5000 + (d.layout === 'snake' && !(existing && existing.layout === 'snake') ? 800 : 0)
      + (d.express && !(existing && existing.express) ? EXPRESS_COST : 0) + Math.max(0, (d.cover || 0) - ((existing && existing.cover) || 0)) * COVER_COST;
  },
  sig(d) { return `q${d.desks}${d.layout === 'snake' ? 'S' : 'L'}${d.express ? 'E' : ''}${d.cover ? 'c' + d.cover : ''}`; },
  candidates(c, tech) {
    const out = [];
    for (let n = Math.max(2, c.params.desks0); n <= c.params.max; n++) for (const layout of tech.barriers ? ['lines', 'snake'] : ['lines'])
      for (const express of c.params.deep ? [false, true] : [false]) for (let cover = 0; cover <= (c.params.deep && n <= c.params.desks0 + 2 ? 2 : 0); cover++) out.push({ stage: 'queue', desks: n, layout, express, cover });
    return out;
  },
  Sim: QueueSim,
};
