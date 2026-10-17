// One snaking queue: a counter hall with a row of desks.
// A line per desk looks fair, but one slow customer strands everyone behind them. One long snake feeding
// every desk keeps the slow ones from holding anyone else up, so fewer desks give shorter worst-case waits.
import { StageSim } from './common.js';

const DESK_Y = -3.0, HEAD_Y = -1.9, ROW_W = 9.2, ROW_GAP = 0.68, SLOT = 0.62, DOOR = [0, 4.1];

class QueueSim extends StageSim {
  constructor(c, d, tech) {
    super(c, d, tech);
    const n = d.desks;
    this.desks = Array.from({ length: n }, (_, i) => ({ i, x: (i - (n - 1) / 2) * Math.min(1.7, 11 / n), y: DESK_Y, user: null, until: 0, line: [] }));
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
      for (const dk of this.desks) { const s = dk.line.length + (dk.user ? 0.5 : 0) + this.rng() * 0.4 + Math.abs(dk.x - p.x) * 0.03; if (s < bs) { bs = s; best = dk; } }
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
        const q = this.d.layout === 'snake' ? this.snake : dk.line;
        if (q.length) { const p = q.shift(); dk.next = p; p.called = dk; }
      }
      if (!dk.user && dk.next) { dk.user = dk.next; dk.next = null; }
    }
    for (const p of this.people) {
      if (p.leaving) { if (this.walkTo(p, p.x < 0 ? -7.2 : 7.2, DESK_Y + 0.4, dt)) p.gone = true; continue; }
      if (p.called) {
        const dk = p.called;
        if (dk.user !== p) { this.walkTo(p, dk.x, dk.y + 1.15, dt, p.walk * 1.35); continue; }   // waiting just behind the counter line
        if (!p.atDesk && this.walkTo(p, dk.x, dk.y + 0.5, dt, p.walk * 1.35)) {
          p.atDesk = true; dk.until = this.t + p.service;
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
    const scale = 1 + 0.08 * Math.min(tier, 6);
    c.params = { service: 11, slow: 0.15, desks0: c.existing ? c.existing.desks : 3, max: 7 };
    let rate = 0.27 * scale * (0.92 + rng() * 0.16);
    const mix = {};
    if (c.twists.includes('payday')) rate *= 1.3;
    if (c.twists.includes('mortgages')) c.params.slow = 0.22;
    if (c.twists.includes('pensions')) mix.elderly = 0.35;
    rate = StageSim.tune(c, rate, scale);
    c.crowd = { rate: +rate.toFixed(3), mix };
    c.arrive = 90; c.run = 170;
  },
  twists: {
    payday: { label: 'Payday', text: 'It\'s payday: a third more customers through the door.' },
    mortgages: { label: 'Mortgage desk', text: 'More complicated business today: nearly one customer in four takes three times as long.' },
    pensions: { label: 'Pension day', text: 'Pension day: a third of the customers are older and take their time.' },
  },
  options(c, tech) {
    return [
      { key: 'desks', label: 'Desks open', kind: 'stepper', min: 2, max: c.params.max, price: 5000, note: `£5,000 a desk beyond the ${c.params.desks0} already there` },
      { key: 'layout', label: 'Queue', kind: 'seg', choices: [['lines', 'A line per desk'], ['snake', 'One snaking queue', 'barriers']] },
    ];
  },
  defaults() { return { stage: 'queue', desks: 3, layout: 'lines' }; },
  cost(d, existing) {
    const had = existing ? existing.desks : 0;
    return Math.max(0, d.desks - had) * 5000 + (d.layout === 'snake' && !(existing && existing.layout === 'snake') ? 800 : 0);
  },
  sig(d) { return `q${d.desks}${d.layout === 'snake' ? 'S' : 'L'}`; },
  candidates(c, tech) {
    const out = [];
    for (let n = Math.max(2, c.params.desks0); n <= c.params.max; n++) for (const layout of tech.barriers ? ['lines', 'snake'] : ['lines']) out.push({ stage: 'queue', desks: n, layout });
    return out;
  },
  Sim: QueueSim,
};
