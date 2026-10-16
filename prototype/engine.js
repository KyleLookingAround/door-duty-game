// ---------- Multi-door entrance simulation (no DOM) ----------
const TAU = Math.PI * 2;
const SLOT_W = 3.0;      // m per frontage slot
const WORLD_HH = 3.6;    // half height
const REV_R = 1.15;      // revolving drum radius
const WIDE_R = 1.42;     // wide-drum revolving door (R&D)
const V_SAFE = 0.75;
const BLADE_T = 0.035, WALL_T = 0.05;

const GUEST = {
  normal:  { r: [0.18, 0.22], walk: [1.1, 1.4], safe: 1.0, react: [0.3, 1.1] },
  elderly: { r: [0.19, 0.22], walk: [0.65, 0.85], safe: 0.6, react: [0.8, 1.8] },
  wheel:   { r: [0.33, 0.35], walk: [0.85, 1.0], safe: 0.8, react: [0.4, 1.0], stepfree: true },
  case:    { r: [0.26, 0.29], walk: [0.95, 1.15], safe: 0.9, react: [0.5, 1.3] },
  pram:    { r: [0.30, 0.33], walk: [0.9, 1.05], safe: 0.8, react: [0.4, 1.0], stepfree: true },   // prams and delivery trolleys
  bike:    { r: [0.28, 0.32], walk: [1.0, 1.2], safe: 1.0, react: [0.4, 0.9], noRevolve: true },  // cyclists wheeling a bike
};
const MIX_TYPES = ['elderly', 'wheel', 'case', 'pram', 'bike'];
// seconds to tap through a ticket gate
const TAP = { normal: 0.9, elderly: 1.8, wheel: 2.0, case: 1.4, pram: 1.8, bike: 2.0 };

// does the segment (x0,y0)-(x1,y1) pass through the box? (slab test)
function segHitsBox(x0, y0, x1, y1, bx0, by0, bx1, by1) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - bx0], [dx, bx1 - x0], [-dy, y0 - by0], [dy, by1 - y0]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
// nearest point on an obstacle to (x, y): circles, rectangles and standing people
function obstacleNearest(o, x, y) {
  if (o.kind === 'rect') {
    const qx = Math.max(o.x0, Math.min(o.x1, x)), qy = Math.max(o.y0, Math.min(o.y1, y));
    return { qx, qy, t: 0 };
  }
  const dx = x - o.x, dy = y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  return { qx: o.x + dx / d * o.r, qy: o.y + dy / d * o.r, t: 0 };
}

function modT(a) { a %= TAU; return a < 0 ? a + TAU : a; }
function arcOverlap(a0, la, b0, lb) {
  const d = modT(b0 - a0);
  let len = 0, best = null;
  for (const s of [d, d - TAU]) {
    const os = Math.max(0, s), oe = Math.min(la, s + lb);
    if (oe > os) { len += oe - os; if (!best || oe - os > best[1] - best[0]) best = [os, oe]; }
  }
  return { len, mid: best ? a0 + (best[0] + best[1]) / 2 : 0 };
}
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

class World {
  // cfg: { slots:[{type,wings,mouth,core,rpm,padded,curtain}], crowd:{in,out,mix:{elderly,wheel,case}},
  //        outsideTemp, duration, seed, heater, wind, brakes, radar, signs, rain, site }
  // site: { obstacles:[{kind:'circle'|'rect'|'person',...}], rampBays:[i], spawnIn:{x,spread,p}, surge:{every,n,x,spread} }
  // per-door R&D options: sensor (presence-sensing slowdown), wide (wide drum),
  // vestibule (draught lobby on open doors), doorman (staffed door)
  constructor(cfg) {
    this.cfg = cfg;
    this.rng = makeRng(cfg.seed || 7);
    const n = cfg.slots.length;
    this.HW = n * SLOT_W / 2; this.HH = WORLD_HH;
    this.doors = cfg.slots.map((s, i) => {
      const cx = -this.HW + SLOT_W / 2 + i * SLOT_W;
      const d = { ...s, cx, i, leak: 0 };
      if (s.type === 'revolve') Object.assign(d, { R: s.wide ? WIDE_R : REV_R, phi: this.rng() * TAU, stopTimer: 0, rampTimer: 0, omegaEff: 0 });
      if (s.type === 'swing') Object.assign(d, { w: 1.2, swing: 0, lastDir: 0, lastT: -9 });
      if (s.type === 'slider') Object.assign(d, { w: 1.7, open: 0, hold: 0 });
      if (s.type === 'gates') {
        // standard: three narrow lanes; wide aisles: two lanes wheelchairs, prams and bikes fit through
        const xs = s.wide ? [-0.75, 0.75] : [-1, 0, 1], hw = s.wide ? 0.46 : 0.34;
        const start = s.flow === 'out' ? -1 : 1;
        d.gl = xs.map((x, k) => ({ x: cx + x, hw, k, dir: s.flow === 'in' ? 1 : s.flow === 'out' ? -1 : (k % 2 ? -start : start), auto: s.flow === 'auto', user: null, open: 0, switchT: 0 }));
        d.cabs = s.wide ? [-1.5, 0, 1.5] : [-1.5, -0.5, 0.5, 1.5];
        d.cabHalf = s.wide ? 0.29 : 0.16;
        d.w = xs.length * hw * 2;
        d.tidalT = 0;
      }
      return d;
    });
    this.site = cfg.site || {};
    this.obs = [...(this.site.obstacles || [])];
    // door options that put things in the crowd's way: a pillar inside the exit, lane barriers through the door
    for (const d of this.doors) {
      if (d.type === 'wall') continue;
      if (d.pillar) { d.pil = { kind: 'circle', x: d.cx, y: (d.type === 'revolve' ? d.R * 0.5 : 0) + 1.5, r: 0.2, tag: 'pillar', item: true }; this.obs.push(d.pil); }
      if (d.type === 'gates') for (const b of d.cabs) this.obs.push({ kind: 'rect', x0: d.cx + b - d.cabHalf, x1: d.cx + b + d.cabHalf, y0: -0.5, y1: 0.5, tag: 'gatecab', item: true });
      if (d.lanes && d.type !== 'revolve' && d.type !== 'gates') {
        d.laned = true;
        this.obs.push({ kind: 'rect', x0: d.cx - 0.035, x1: d.cx + 0.035, y0: -1.4, y1: -0.07, tag: 'lane', item: true });
        this.obs.push({ kind: 'rect', x0: d.cx - 0.035, x1: d.cx + 0.035, y0: 0.07, y1: 1.4, tag: 'lane', item: true });
      }
    }
    // street furniture in front of a door makes people prefer another one
    for (const d of this.doors) {
      d.pen = { 1: 0, '-1': 0 };
      for (const o of this.obs) {
        if (o.item) continue;   // your own pillars and barriers don't put people off
        const ox = o.kind === 'rect' ? (o.x0 + o.x1) / 2 : o.x, oy = o.kind === 'rect' ? (o.y0 + o.y1) / 2 : o.y;
        const half = o.kind === 'rect' ? (o.x1 - o.x0) / 2 : o.r;
        if (Math.abs(ox - d.cx) < 1.1 + half && Math.abs(oy) < 1.9) d.pen[oy < 0 ? 1 : -1] += o.kind === 'rect' ? 1.2 : 0.6;
      }
    }
    this.surgeT = 0;
    this.people = [];
    this.t = 0; this.temp = 21; this.minTemp = 21; this.maxTemp = 21;
    this.stats = { through: 0, bumps: 0, laps: 0, stops: 0, turnedAway: 0, accessFail: 0, bikeFail: 0, spawned: 0, evac: null };
    this.alarm = false;
    this.events = [];
    this.acc = { in: this.rng(), out: this.rng() };
  }

  doorFits(d, p) {
    if (d.type === 'wall') return false;
    if (this.alarm) return true;   // in a fire every door is an exit
    const g = GUEST[p.type];
    if (d.type === 'gates') {
      if (!d.gl.some(l => l.auto || l.dir === p.dir)) return false;
      if ((g.stepfree || g.noRevolve) && !d.wide) return false;   // wheelchairs, prams and bikes need the wide aisles
      if (g.stepfree && this.site.rampBays && !this.site.rampBays.includes(d.i)) return false;
      return true;
    }
    if ((d.flow === 'in' && p.dir < 0) || (d.flow === 'out' && p.dir > 0)) return false;
    if (g.stepfree) {
      if (this.site.rampBays && !this.site.rampBays.includes(d.i)) return false;   // steps everywhere but the ramp
      return d.type === 'slider' || (d.type === 'revolve' && d.wide && d.wings <= 3);
    }
    if (g.noRevolve && d.type === 'revolve') return false;
    if (d.type === 'slider' && d.button) return false;   // push-button door: step-free guests only
    return true;
  }
  queueAt(d, dir) { let q = 0; for (const p of this.people) if (p.door === d.i && p.state === 'approach' && p.dir === dir) q++; return q; }
  chooseDoor(p) {
    let best = -1, bs = 1e9;
    for (const d of this.doors) {
      if (!this.doorFits(d, p)) continue;
      const s = this.alarm ? Math.abs(p.x - d.cx) + 0.35 * this.queueAt(d, p.dir)
        : Math.abs(p.x - d.cx) + (this.cfg.signs ? 1.1 : 0.45) * this.queueAt(d, p.dir) + (d.type === 'revolve' ? 0 : 0.3) + d.pen[p.dir];
      if (s < bs) { bs = s; best = d.i; }
    }
    return best;
  }

  spawn(dir, atX) {
    const m = this.cfg.crowd.mix || {};
    const u = this.rng();
    let type = 'normal', acc = 0;
    for (const k of MIX_TYPES) { acc += m[k] || 0; if (u < acc) { type = k; break; } }
    if (m.bike && !this.bikeSeen && this.stats.spawned === 5) type = 'bike';
    if (type === 'bike') this.bikeSeen = true;
    // step-free jobs always see at least one wheelchair user early, so a design can't pass by luck
    if (m.wheel && !this.wheelSeen && this.stats.spawned === 3) type = 'wheel';
    if (type === 'wheel') this.wheelSeen = true;
    const g = GUEST[type];
    const lerp = (a, t) => a[0] + (a[1] - a[0]) * t;
    let x = (this.rng() * 2 - 1) * (this.HW - 0.4);
    const si = this.site.spawnIn;
    if (atX != null) x = atX;
    else if (dir > 0 && si && this.rng() < si.p) x = si.x + (this.rng() * 2 - 1) * si.spread;   // e.g. a taxi rank at one end
    x = Math.max(-this.HW + 0.4, Math.min(this.HW - 0.4, x));
    const y = -dir * (this.HH + 0.3);
    for (const q of this.people) if ((q.x - x) ** 2 + (q.y - y) ** 2 < 0.36) return false;
    // umbrellas: people on the street are wider and a little slower; they fold them at the door
    const rain = this.cfg.rain && dir > 0 ? 1 : 0;
    const p = { x, y, vx: 0, vy: dir * 0.8, dir, type, r: lerp(g.r, this.rng()) + rain * 0.07, walk: lerp(g.walk, this.rng()) * (1 - rain * 0.08), umbrella: !!rain,
      reactBase: g.react, state: 'approach', react: null, accum: 0, lastA: 0, laps: 0, touch: 0, touchNow: 0,
      flash: 0, rechoose: 0, born: this.t };
    p.door = this.chooseDoor(p);
    this.stats.spawned++;
    if (p.door < 0) { this.stats.turnedAway++; if (g.stepfree) this.stats.accessFail++; if (type === 'bike') this.stats.bikeFail++; this.events.push({ type: 'away', who: type, x: Math.max(-this.HW + 1.2, Math.min(this.HW - 1.2, x)), y: -dir * (this.HH - 0.9), t: this.t }); return true; }
    if (this.queueAt(this.doors[p.door], dir) > 22) { this.stats.turnedAway++; return true; }
    this.people.push(p);
    return true;
  }

  step(dt) {
    const c = this.cfg;
    this.t += dt;
    if (this.t < c.duration) {
      // a station's rush comes in phases: the morning pours in, then trains empty out
      const ph = c.crowd.phases ? (c.crowd.phases.find(f => this.t < f.until) || c.crowd.phases[c.crowd.phases.length - 1]) : c.crowd;
      this.phase = c.crowd.phases ? c.crowd.phases.indexOf(ph) : null;
      for (const [k, dir] of [['in', 1], ['out', -1]]) {
        this.acc[k] += (ph[k] || 0) * dt;
        if (this.acc[k] >= 1) { if (this.spawn(dir)) this.acc[k] -= 1 + (this.rng() - 0.5) * 0.7; else this.acc[k] -= 0.2; }
      }
      // a train pulls in and its passengers come up the escalators
      const tr = this.site.trains;
      if (tr && this.t >= tr.from) {
        this.trainT = (this.trainT == null ? tr.every - 0.5 : this.trainT) + dt;
        if (this.trainT >= tr.every) {
          this.trainT -= tr.every;
          this.trainPending = (this.trainPending || 0) + tr.n;
          this.events.push({ type: 'train', x: 0, y: this.HH - 0.6, t: this.t });
        }
      }
      // passengers step off the escalators one after another
      if (this.trainPending > 0) {
        this.trainCool = (this.trainCool || 0) - dt;
        if (this.trainCool <= 0) {
          const ex = tr.xs[Math.floor(this.rng() * tr.xs.length)];
          if (this.spawn(-1, ex + (this.rng() - 0.5) * 1.4)) { this.trainPending--; this.trainCool = 0.12; } else this.trainCool = 0.05;
        }
      }
      // a bus pulls up and drops a crowd at the stop
      const sg = this.site.surge;
      if (sg && !(sg.until && this.t > sg.until)) {
        this.surgeT += dt;
        if (this.surgeT >= sg.every) {
          this.surgeT -= sg.every;
          for (let i = 0; i < sg.n; i++) this.spawn(1, sg.x + (i - (sg.n - 1) / 2) * (sg.spread / Math.max(1, sg.n - 1)) * 2);
          this.events.push({ type: 'bus', x: sg.x, y: -this.HH + 0.6, t: this.t });
        }
      }
    }
    if (c.drill && !this.alarm && this.t >= c.drill.at) this.startAlarm();
    // doors
    let leakSum = 0;
    for (const d of this.doors) {
      if (this.alarm) {
        // fire alarm: revolving doors book-fold flat, swing doors are held, sliders fail open
        if (d.type === 'revolve') { d.folded = true; d.omegaEff = 0; }
        if (d.type === 'slider') d.open = 1;
        if (d.type === 'swing') d.swing = 1;
        if (d.type === 'gates') for (const l of d.gl) l.open = 1;
        d.leak = 0;
        // a crush at the doorway arches and jams for a moment; fewer people pressing, fewer jams
        if (d.type !== 'wall') {
          d.jamT = Math.max(0, (d.jamT || 0) - dt);
          d.passT = Math.max(0, (d.passT || 0) - dt);
          // pressure on the doorway: the people right at it, plus the push of the crowd behind them.
          // A pillar in front takes most of that push (that's why it helps).
          let near = 0, behind = 0;
          const px = d.cx, py = 0.1;
          for (const p of this.people) {
            if (p.state !== 'approach' || p.y <= -0.05 || p.y > 2.6) continue;
            const dx = p.x - px, dy = p.y - py, r2 = dx * dx + dy * dy;
            if (r2 < 0.9 * 0.9) near++; else if (r2 < 2.3 * 2.3) behind++;
          }
          const press = near + behind * 0.5 * (d.pil ? 0.2 : 1);
          d.press = press;
          d.coolT = Math.max(0, (d.coolT || 0) - dt);
          // jams get sharply worse as the push builds: more often and longer
          const over = press - 5;
          if (d.jamT <= 0 && d.coolT <= 0 && over > 0 && this.rng() < dt * Math.min(3, 0.12 * over * over)) {
            d.jamT = (0.3 + 0.08 * over) * (0.7 + this.rng() * 0.6); d.coolT = d.jamT + 0.3;
            this.stats.jams = (this.stats.jams || 0) + 1;
            this.events.push({ type: 'jam', x: d.cx, y: 0.5, t: this.t });
          }
        }
        continue;
      }
      if (d.type === 'revolve') {
        let set = d.rpm * TAU / 60;
        if (d.sensor) {
          // presence sensing: drop to the slowest guest's safe tip speed while they're inside
          let lim = Infinity;
          for (const p of this.people) if (p.door === d.i && p.state === 'in') {
            const sf = GUEST[p.type].safe;
            if (sf < 1) lim = Math.min(lim, (V_SAFE + (d.padded ? 0.3 : 0)) * sf * 0.9 / d.R);
          }
          set = Math.min(set, lim);
        }
        if (d.stopTimer > 0) { d.stopTimer -= dt; d.omegaEff = 0; if (d.stopTimer <= 0) d.rampTimer = c.brakes ? 0.3 : 0.8; }
        else if (d.rampTimer > 0) { d.rampTimer -= dt; d.omegaEff = set * (1 - Math.max(0, d.rampTimer) / (c.brakes ? 0.3 : 0.8)); }
        else d.omegaEff = set;
        d.phi = modT(d.phi + d.omegaEff * dt);
        const N = d.wings, S = TAU / N, th = d.mouth * Math.PI / 180;
        let lk = 0;
        for (let k = 0; k < N; k++) {
          const s0 = d.phi + k * S;
          lk = Math.max(lk, Math.min(arcOverlap(s0, S, -Math.PI / 2 - th, 2 * th).len, arcOverlap(s0, S, Math.PI / 2 - th, 2 * th).len));
        }
        // wind forces air through wide mouths even when the wings seal
        const wind = (c.wind || 0) + (c.stack || 0) * 1.5;
        d.leak = lk * 1.0 + wind * Math.max(0, d.mouth - 30) / 40 * 0.12 * (c.seals ? 0.15 : 1);
      } else if (d.type === 'slider') {
        let want = false;
        for (const p of this.people) {
          if ((d.button || c.radar) && p.door !== d.i) continue;   // radar ignores passers-by
          const near = (p.door === d.i && p.state === 'approach') ? (Math.abs(p.x - d.cx) < 1.6 && Math.abs(p.y) < 1.7) : (Math.abs(p.x - d.cx) < 1.2 && Math.abs(p.y) < 0.9);
          if (near) { want = true; break; }
        }
        if (want) d.hold = c.radar ? 0.35 : 1.4; else d.hold -= dt;
        d.open = Math.max(0, Math.min(1, d.open + (d.hold > 0 ? (c.express ? 3.5 : 1.4) : (c.express ? -2.2 : -0.9)) * dt));
        d.leak = d.open * 0.07 * (d.curtain ? 0.3 : 1) * (d.vestibule ? 0.12 : 1) * (1 + (c.wind || 0) + (c.stack || 0) * 2);
      } else if (d.type === 'swing') {
        let busy = false;
        for (const p of this.people) if (Math.abs(p.x - d.cx) < 0.9 && Math.abs(p.y) < 0.7) { busy = true; break; }
        d.swing = Math.max(0, Math.min(1, d.swing + (busy ? 4 : -1.5) * dt));
        if (c.stack && !d.vestibule) d.swing = Math.max(d.swing, 0.3 * c.stack);   // the draught holds it ajar
        d.leak = d.swing * 0.08 * (d.curtain ? 0.3 : 1) * (d.vestibule ? 0.12 : 1) * (1 + (c.wind || 0) + (c.stack || 0) * 2);
      } else if (d.type === 'gates') {
        // tidal flow: auto lanes turn to face whichever way the queue is heavier
        const autos = d.gl.filter(l => l.auto);
        if (autos.length) {
          d.tidalT -= dt;
          if (d.tidalT <= 0) {
            d.tidalT = 1;
            const qi = this.queueAt(d, 1), qo = this.queueAt(d, -1), n = autos.length;
            let nin = qi + qo === 0 ? Math.ceil(n / 2) : Math.round(n * qi / (qi + qo));
            if (qi > 0 && nin === 0) nin = 1;
            if (qo > 0 && nin === n && n > 1) nin = n - 1;
            autos.forEach((l, k) => { const want = k < nin ? 1 : -1; if (l.dir !== want && !l.user && l.switchT <= 0) { l.dir = want; l.switchT = 1.0; } });
          }
        }
        for (const l of d.gl) {
          // the lane is free: whoever is right at the paddle taps in next
          if (!l.user && l.switchT <= 0) {
            let nb = null, ny = 9;
            for (const p of this.people) {
              if (p.state !== 'approach' || !p.lane || p.lane.l !== l || p.dir !== l.dir) continue;
              const ay = -p.y * p.dir;   // distance in front of the paddle
              if (ay > -0.12 && ay < 0.9 && Math.abs(p.x - l.x) < 0.32 && ay < ny) { ny = ay; nb = p; }
            }
            if (nb) { l.user = nb; nb.tapT = TAP[nb.type] * (d.doorman ? 0.6 : 1) * (0.85 + this.rng() * 0.3); }
          }
          l.switchT = Math.max(0, l.switchT - dt);
          if (l.user && (l.user.state === 'after' || l.user.dead)) l.user = null;
          if (l.user && l.user.tapT <= 0) l.open = Math.max(l.open, 0.35);   // stays open while they walk through
          l.open = Math.max(0, l.open - dt);
        }
        d.leak = 0;
      } else d.leak = 0;
      leakSum += d.leak;
    }
    const heat = 0.05 * (c.heater || 1);
    this.temp += (leakSum * 0.55 * (c.outsideTemp - this.temp) + heat * (21 - this.temp)) * dt;
    if (!this.alarm) { this.minTemp = Math.min(this.minTemp, this.temp); this.maxTemp = Math.max(this.maxTemp, this.temp); }

    // walls rebuilt each step (slider panels move)
    this.segs = this.buildSegments();

    if (this.cfg.rain) for (const p of this.people) {
      if (p.umbrella && p.y > -1.7) { p.umbrella = false; p.r -= 0.07; p.walk /= 0.92; }                       // folded at the door
      else if (!p.umbrella && !p.opened && p.dir < 0 && p.y < -1.8) { p.umbrella = p.opened = true; p.r += 0.07; p.walk *= 0.92; }   // up again outside
    }
    for (const p of this.people) this.steer(p, dt);
    this.collide(dt);
    if (this.people.some(p => p.state === 'after' && Math.abs(p.y) > this.HH + 0.5)) this.people = this.people.filter(p => !(p.state === 'after' && Math.abs(p.y) > this.HH + 0.5));
    if (this.stats.queuePeak == null) this.stats.queuePeak = 0;
    if (!this.alarm && this.t < c.duration) { let q = 0; for (const p of this.people) if (p.state === 'approach') q++; if (q > this.stats.queuePeak) this.stats.queuePeak = q; }
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
    // evacuation is over once nobody is left in the lobby
    if (this.alarm && this.stats.evac == null && !this.people.some(p => p.y > -0.1 && p.state !== 'after')) {
      this.stats.evac = this.t - this.alarmT;
      this.events.push({ type: 'clear', x: 0, y: 1.5, t: this.t });
    }
  }

  // how long it took 9 in 10 people to get through, from arriving to clearing the doors
  waitP90() {
    const w = (this.waits || []).slice().sort((a, b) => a - b);
    if (!w.length) return 0;
    return w[Math.min(w.length - 1, Math.floor(w.length * 0.9))];
  }

  startAlarm() {
    const c = this.cfg;
    this.alarm = true; this.alarmT = this.t;
    // anyone still outside stays outside; everyone inside heads for the street
    this.people = this.people.filter(p => !(p.dir > 0 && p.state === 'approach' && p.y < 0));
    for (const p of this.people) {
      if (p.state === 'after' && p.y < 0) continue;
      p.dir = -1; p.state = 'approach'; p.react = null;
      p.door = this.chooseDoor(p);
    }
    const mix = c.crowd.mix || {};
    let placed = 0, tries = 0;
    while (placed < c.drill.n && tries < c.drill.n * 30) {
      tries++;
      const x = (this.rng() * 2 - 1) * (this.HW - 0.4), y = 0.9 + this.rng() * (this.HH - 1.2);
      if (this.people.some(q => (q.x - x) ** 2 + (q.y - y) ** 2 < 0.2) || this.obs.some(o => obstacleNearest(o, x, y) && Math.hypot(x - obstacleNearest(o, x, y).qx, y - obstacleNearest(o, x, y).qy) < 0.3)) continue;
      const type = this.rng() < (mix.elderly || 0) ? 'elderly' : 'normal', g = GUEST[type];
      const p = { x, y, vx: 0, vy: 0, dir: -1, type, r: g.r[0] + this.rng() * (g.r[1] - g.r[0]), walk: (g.walk[0] + this.rng() * (g.walk[1] - g.walk[0])) * 1.15,
        reactBase: g.react, state: 'approach', react: null, accum: 0, lastA: 0, laps: 0, touch: 0, touchNow: 0, flash: 0, rechoose: 0, evacuee: true };
      p.door = this.chooseDoor(p);
      this.people.push(p); placed++;
    }
    this.events.push({ type: 'alarm', x: 0, y: 0, t: this.t });
  }

  buildSegments() {
    const gaps = [];
    for (const d of this.doors) {
      if (d.jamT > 0) continue;   // jammed: nobody gets through this instant
      if (d.folded) gaps.push([d.cx - 0.6, d.cx + 0.6]);
      else if (d.type === 'revolve') gaps.push([d.cx - d.R, d.cx + d.R]);
      else if (d.type === 'swing') gaps.push([d.cx - d.w / 2, d.cx + d.w / 2]);
      else if (d.type === 'slider') { const g = d.w * d.open; gaps.push([d.cx - g / 2, d.cx + g / 2]); }
      else if (d.type === 'gates') for (const l of d.gl) if (l.open > 0) gaps.push([l.x - l.hw, l.x + l.hw]);   // closed paddles are walls
    }
    gaps.sort((a, b) => a[0] - b[0]);
    const segs = []; let x = -this.HW - 1;
    for (const [a, b] of gaps) { if (a > x + 1e-3) segs.push([x, a]); x = Math.max(x, b); }
    segs.push([x, this.HW + 1]);
    return segs;
  }

  steer(p, dt) {
    const d = this.doors[p.door];
    p.flash = Math.max(0, p.flash - dt);
    let tx, ty, sp = p.walk;
    if (p.state === 'approach') {
      p.rechoose -= dt;
      if (p.rechoose <= 0 && Math.abs(p.y) > 1.6) { p.rechoose = 1.5; const nd = this.chooseDoor(p); if (nd >= 0) p.door = nd; }
      const dd = this.doors[p.door];
      const lx = p.x - dd.cx;
      if (dd.type === 'gates' && !this.alarm && p.y * p.dir <= p.r) {
        // pick a lane facing my way: the shortest queue, then the nearest
        if (!p.lane || p.lane.door !== dd.i || (p.lane.l.dir !== p.dir && p.lane.l.user !== p)) {
          let best = null, bs = 1e9;
          for (const l of dd.gl) {
            if (l.dir !== p.dir && !l.auto) continue;
            let q = 0; for (const o of this.people) if (o.lane && o.lane.l === l && o.state === 'approach' && o !== p) q++;
            const s = Math.abs(p.x - l.x) + 0.7 * q + (l.dir !== p.dir ? 3 : 0);
            if (s < bs) { bs = s; best = l; }
          }
          p.lane = best ? { door: dd.i, l: best } : null;
        }
        const l = p.lane && p.lane.l;
        if (!l) { tx = dd.cx; ty = -p.dir * 1.2; sp *= 0.3; }
        else if (Math.abs(p.y) > 1.8) { tx = l.x; ty = -p.dir * 1.2; }
        else {
          tx = l.x;
          if (l.user === p) {
            if (p.tapT > 0) { p.tapT -= dt; ty = p.y; sp = 0; if (p.tapT <= 0) l.open = 0.5; }
            else ty = p.dir * 1.0;
          } else {
            if (p.y * p.dir > -0.12 && l.open > 0) ty = p.dir * 1.0;   // squeezed through behind someone: carry on
            else { ty = -p.dir * 0.62; if (Math.abs(p.y) < 1.3) sp *= 0.6; }   // queue at the paddle
          }
        }
      } else if (dd.type === 'revolve' && !dd.folded) {
        const dist = Math.hypot(lx, p.y);
        if (dist < dd.R - p.r * 0.4 && p.y * p.dir < dd.R * 0.95) { p.state = 'in'; p.accum = 0; p.lastA = Math.atan2(p.y, lx); p.react = null; }
        else if (Math.abs(p.y) > 2.0) { tx = dd.cx; ty = -p.dir * 1.8; }
        else { tx = dd.cx + lx * 0.15; ty = -p.dir * 0.3; if (dist < dd.R + 0.9) sp *= 0.75; }
      } else {
        if (p.y * p.dir > p.r) {
          p.state = 'after';
          if (p.lane && p.lane.l.user === p) p.lane.l.user = null;
          if (this.alarm) this.stats.evacuated = (this.stats.evacuated || 0) + 1;   // the drill doesn't count as rush-hour traffic
          else { this.stats.through++; if (p.born != null) (this.waits || (this.waits = [])).push(this.t - p.born); }
          this.events.push({ type: 'through', x: p.x, y: p.y, t: this.t });
          // fire-exit capacity: about 1.3 people per metre of door width per second
          if (this.alarm) dd.passT = 1 / (1.3 * (dd.folded ? 1.2 : dd.w || 1.2));
          if (dd.type === 'swing') {
            // a swing door opened from the other side moments ago swings into you
            if (!dd.doorman && !dd.laned && !this.alarm && dd.lastDir === -p.dir && this.t - dd.lastT < 0.9) { this.stats.bumps++; p.flash = 1; this.events.push({ type: 'bump', x: p.x, y: p.y, t: this.t }); }
            dd.lastDir = p.dir; dd.lastT = this.t;
          }
        }
        else if (Math.abs(p.y) > 1.8) { tx = dd.cx; ty = -p.dir * 1.2; }
        else {
          tx = dd.laned && !this.alarm ? dd.cx + (p.dir > 0 ? -0.32 : 0.32)   // keep to your own lane
            : dd.cx + Math.max(-0.3, Math.min(0.3, lx * 0.5));
          ty = p.dir * 1.0;
          if (this.alarm) {
            tx = dd.cx + Math.max(-0.25, Math.min(0.25, lx * 0.4)); sp *= 1.1;
            if (dd.passT > 0 && Math.abs(p.y) < 0.45) sp *= 0.12;   // the doorway is full: wait your turn
          }
          else if (dd.type === 'swing' && Math.abs(p.y) < 0.6) sp *= dd.doorman ? 0.9 : 0.55;     // pushing the door (or held open)
          if (dd.vestibule && Math.abs(p.y) < 1.0) sp *= 0.75;               // two sets of doors
          if (dd.type === 'slider' && dd.open < 0.6 && Math.abs(p.y) < 0.9) sp *= 0.2; // waiting for it to open
        }
      }
    }
    if (p.state === 'in') {
      const w = d.omegaEff, lx = p.x - d.cx, ly = p.y;
      const dist = Math.hypot(lx, ly), ang = Math.atan2(ly, lx);
      const th = d.mouth * Math.PI / 180, N = d.wings, S = TAU / N, rc = d.core * d.R;
      const entryA = p.dir > 0 ? -Math.PI / 2 : Math.PI / 2, exitA = -entryA;
      let da = ang - p.lastA; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      p.accum += da; p.lastA = ang;
      if (Math.abs(p.accum) > Math.PI + th + 0.35 + p.laps * TAU) { p.laps++; this.stats.laps++; this.events.push({ type: 'lap', x: p.x, y: p.y, t: this.t }); }
      if (dist > d.R + p.r * 0.4) {
        if (ly * p.dir > 0) { p.state = 'after'; if (this.alarm) this.stats.evacuated = (this.stats.evacuated || 0) + 1; else { this.stats.through++; (this.waits || (this.waits = [])).push(this.t - p.born); } this.events.push({ type: 'through', x: p.x, y: p.y, t: this.t }); }
        else p.state = 'approach';
      } else {
        const k = Math.floor(modT(ang - d.phi) / S), s0 = d.phi + k * S;
        const ex = arcOverlap(s0 + 0.08, S - 0.16, exitA - th, 2 * th);
        const en = arcOverlap(s0 + 0.08, S - 0.16, entryA - th, 2 * th);
        if (ex.len > 0.22) {
          if (p.react === null) p.react = (p.reactBase[0] + this.rng() * (p.reactBase[1] - p.reactBase[0])) * (d.doorman ? 0.35 : 1);
          p.react -= dt;
          if (p.react <= 0) { tx = d.cx + Math.cos(ex.mid) * (d.R + 1); ty = Math.sin(ex.mid) * (d.R + 1); sp = Math.min(0.6, p.walk); }
        } else p.react = null;
        if (tx === undefined) {
          if (en.len > 0.1) { const ma = s0 + S / 2, rr = rc + p.r + 0.12; tx = d.cx + Math.cos(ma) * rr; ty = Math.sin(ma) * rr; sp = 0.7; }
          else { p.dvx = -w * ly; p.dvy = w * lx; }
        }
      }
    }
    if (p.state === 'after') { tx = Math.max(-this.HW + 0.7, Math.min(this.HW - 0.7, p.x + (p.x - (d ? d.cx : 0)) * 0.2)); ty = p.dir * (this.HH + 2); sp = p.walk; }
    // detour: if furniture stands between us and where we're heading, aim past its nearer end first
    if (tx !== undefined && p.state !== 'in' && this.obs.length) {
      for (const o of this.obs) {
        if (o.tag === 'gatecab') continue;   // gate cabinets line the lanes; people walk between them
        const m = p.r + 0.18;
        const bx0 = (o.kind === 'rect' ? o.x0 : o.x - o.r) - m, bx1 = (o.kind === 'rect' ? o.x1 : o.x + o.r) + m;
        const by0 = (o.kind === 'rect' ? o.y0 : o.y - o.r) - m, by1 = (o.kind === 'rect' ? o.y1 : o.y + o.r) + m;
        // only the core of the box counts as blocking, so people skirting the edge aren't sent back round
        const cx0 = bx0 + 0.12, cx1 = bx1 - 0.12;
        if (!segHitsBox(p.x, p.y, tx, ty, cx0, by0 + 0.12, cx1, by1 - 0.12)) continue;
        const ox0 = o.kind === 'rect' ? o.x0 : o.x - o.r, ox1 = o.kind === 'rect' ? o.x1 : o.x + o.r;
        const oy0 = o.kind === 'rect' ? o.y0 : o.y - o.r, oy1 = o.kind === 'rect' ? o.y1 : o.y + o.r;
        if (tx >= ox0 && tx <= ox1 && ty >= oy0 && ty <= oy1) continue;            // the target is inside it: nothing to route round
        const goLeft = Math.abs(p.x - bx0) + Math.abs(tx - bx0) <= Math.abs(p.x - bx1) + Math.abs(tx - bx1);
        const inBand = p.y > by0 && p.y < by1;
        const sideX = goLeft ? bx0 - 0.1 : bx1 + 0.1;
        if (inBand && (goLeft ? p.x <= sideX + 0.15 : p.x >= sideX - 0.15)) {
          // already beside it: walk on past its end towards where we're going
          tx = sideX; ty = ty > p.y ? by1 + 0.2 : by0 - 0.2;
        } else {
          // right behind it: step straight sideways; further off: aim for the near corner
          tx = sideX; ty = inBand ? p.y : Math.max(by0, Math.min(by1, p.y)) + (ty > p.y ? 0.25 : -0.25);
        }
        break;
      }
    }
    if (tx !== undefined) {
      const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1, s = Math.min(sp, l * 2);
      p.dvx = dx / l * s; p.dvy = dy / l * s;
    }
    // walk around street furniture rather than into it
    if (p.state !== 'in' && this.obs.length) {
      const sp0 = Math.hypot(p.dvx, p.dvy) || 1;
      for (const o of this.obs) {
        if (o.tag === 'gatecab') continue;
        const { qx, qy } = obstacleNearest(o, p.x, p.y);
        let nx = p.x - qx, ny = p.y - qy; const dist = Math.hypot(nx, ny) || 1e-6;
        const reach = 0.65 + p.r;
        if (dist > reach) continue;
        nx /= dist; ny /= dist;
        if (p.dvx * nx + p.dvy * ny > 0) continue;            // already moving away
        const w = (reach - dist) / reach;
        let side = (p.dvx * ny - p.dvy * nx) >= 0 ? 1 : -1;    // slide round the side we're already heading
        const tx0 = ny * side;                                   // ...unless that runs into the edge of the street
        if ((p.x > this.HW - 1.0 && tx0 > 0) || (p.x < -this.HW + 1.0 && tx0 < 0)) side = -side;
        p.dvx += (nx * 0.6 + ny * side) * w * sp0;
        p.dvy += (ny * 0.6 - nx * side) * w * sp0;
      }
    }
    const k = Math.min(1, dt * 7);
    p.vx += (p.dvx - p.vx) * k; p.vy += (p.dvy - p.vy) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }

  collide(dt) {
    const people = this.people, n = people.length;
    for (const p of people) p.touchNow = 0;
    // blade directions are fixed within a step: compute them once
    for (const d of this.doors) if (d.type === 'revolve') {
      const S = TAU / d.wings;
      d.bc = d.bc && d.bc.length === d.wings ? d.bc : new Float64Array(d.wings);
      d.bs = d.bs && d.bs.length === d.wings ? d.bs : new Float64Array(d.wings);
      for (let k = 0; k < d.wings; k++) { d.bc[k] = Math.cos(d.phi + k * S); d.bs[k] = Math.sin(d.phi + k * S); }
    }
    // flat bucket grid over the world (linked lists in typed arrays: no allocation per step)
    const cell = 0.6, x0 = -this.HW - 1.5, y0 = -this.HH - 3.5;
    const gw = Math.ceil((this.HW * 2 + 3) / cell) + 1, gh = Math.ceil((this.HH * 2 + 7) / cell) + 1;
    if (!this.gHead || this.gHead.length !== gw * gh) this.gHead = new Int32Array(gw * gh);
    if (!this.gNext || this.gNext.length < n) this.gNext = new Int32Array(Math.max(64, n * 2));
    const head = this.gHead, next = this.gNext;
    if (!this.gCx || this.gCx.length < n) { this.gCx = new Int32Array(Math.max(64, n * 2)); this.gCy = new Int32Array(Math.max(64, n * 2)); }
    const cx = this.gCx, cy = this.gCy;
    for (let it = 0; it < 3; it++) {
      head.fill(-1);
      for (let i = 0; i < n; i++) {
        const p = people[i];
        let gx = Math.floor((p.x - x0) / cell), gy = Math.floor((p.y - y0) / cell);
        gx = gx < 0 ? 0 : gx >= gw ? gw - 1 : gx; gy = gy < 0 ? 0 : gy >= gh ? gh - 1 : gy;
        cx[i] = gx; cy[i] = gy;
        const c = gy * gw + gx; next[i] = head[c]; head[c] = i;
      }
      for (let i = 0; i < n; i++) {
        const p = people[i], gx = cx[i], gy = cy[i];
        for (let oy = -1; oy <= 1; oy++) {
          const yy = gy + oy; if (yy < 0 || yy >= gh) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = gx + ox; if (xx < 0 || xx >= gw) continue;
            for (let j = head[yy * gw + xx]; j !== -1; j = next[j]) {
              if (j <= i) continue;
              const q = people[j], dx = q.x - p.x, dy = q.y - p.y, dd = dx * dx + dy * dy, m = p.r + q.r;
              if (dd < m * m && dd > 1e-9) {
                const dl = Math.sqrt(dd), o = (m - dl) / 2, nx = dx / dl, ny = dy / dl;
                p.x -= nx * o; p.y -= ny * o; q.x += nx * o; q.y += ny * o;
              }
            }
          }
        }
      }
      for (const p of people) {
        for (const d of this.doors) {
          if (d.type !== 'revolve' || d.folded || Math.abs(p.x - d.cx) > d.R + 0.6 || Math.abs(p.y) > d.R + 0.6) continue;
          this.collideRevolve(p, d, true);
        }
        this.collideStatic(p);
      }
    }
    for (const d of this.doors) {
      if (d.type !== 'revolve' || d.folded) continue;
      let pinched = false;
      for (const p of people) {
        if (p.state === 'after' || Math.abs(p.x - d.cx) > d.R + 0.6 || Math.abs(p.y) > d.R + 0.6) continue;
        if (this.collideRevolve(p, d, false) > 0.07 && d.omegaEff > 0.01) { pinched = true; p.flash = 1.2; this.events.push({ type: 'pinch', x: p.x, y: p.y, t: this.t }); }
      }
      if (pinched && d.stopTimer <= 0) { d.stopTimer = this.cfg.brakes ? 0.5 : 1.6; this.stats.stops++; }
    }
    for (const p of people) p.touch = p.touchNow;
  }

  collideRevolve(p, d, apply) {
    const lx0 = p.x - d.cx, ly0 = p.y, R = d.R, rc = d.core * R;
    let maxPen = 0;
    // core
    if (apply) { const dd = Math.sqrt(lx0 * lx0 + ly0 * ly0), m = rc + p.r; if (dd < m && dd > 1e-6) { p.x = d.cx + lx0 * m / dd; p.y = ly0 * m / dd; } }
    const N = d.wings, w = d.omegaEff, bc = d.bc, bs = d.bs;
    for (let k = 0; k < N; k++) {
      const lx = p.x - d.cx, ly = p.y;
      const reach = R + p.r + 0.05;
      if (lx * lx + ly * ly > reach * reach) break;
      const ca = bc[k], sa = bs[k];
      const t = Math.max(rc, Math.min(R, lx * ca + ly * sa));
      const qx = ca * t, qy = sa * t;
      let dx = lx - qx, dy = ly - qy, dd = Math.sqrt(dx * dx + dy * dy);
      const m = p.r + BLADE_T;
      if (dd >= m) continue;
      if (dd < 1e-6) { dx = -sa; dy = ca; dd = 1; }
      const nx = dx / dd, ny = dy / dd, pen = m - dd;
      maxPen = Math.max(maxPen, pen);
      if (!apply) continue;
      p.x += nx * pen; p.y += ny * pen;
      const bvx = -w * qy, bvy = w * qx, bn = bvx * nx + bvy * ny, pn = p.vx * nx + p.vy * ny;
      const bit = 1 << (k + d.i * 6);
      if (!(p.touch & bit) && !(p.touchNow & bit) && p.state !== 'after') {
        const limit = (V_SAFE + (d.padded ? 0.3 : 0)) * GUEST[p.type].safe;
        if (bn - Math.max(0, pn) > limit) { this.stats.bumps++; p.flash = 1.0; this.events.push({ type: 'bump', x: p.x, y: p.y, t: this.t }); }
      }
      p.touchNow |= bit;
      const rel = pn - bn; if (rel < 0) { p.vx -= nx * rel; p.vy -= ny * rel; }
    }
    // enclosure arcs (static)
    if (apply) {
      // the enclosure only matters for someone near the drum's rim
      const lx = p.x - d.cx, ly = p.y, r0 = Math.sqrt(lx * lx + ly * ly);
      if (Math.abs(r0 - R) >= p.r + WALL_T) return maxPen;
      const th = d.mouth * Math.PI / 180;
      for (const a0 of [-Math.PI / 2 + th, Math.PI / 2 + th]) {
        const len = Math.PI - 2 * th, lx = p.x - d.cx, ly = p.y;
        const a = Math.atan2(ly, lx), rel = modT(a - a0);
        const qa = rel <= len ? a : (rel - len < TAU - rel ? a0 + len : a0);
        this.pushFrom(p, d.cx + Math.cos(qa) * R, Math.sin(qa) * R, WALL_T, Math.cos(qa), Math.sin(qa));
      }
    }
    return maxPen;
  }

  collideStatic(p) {
    for (const o of this.obs) {
      if (o.kind === 'rect') {
        const qx = Math.max(o.x0, Math.min(o.x1, p.x)), qy = Math.max(o.y0, Math.min(o.y1, p.y));
        // inside the rectangle: push out through the nearest edge
        if (qx === p.x && qy === p.y) {
          const dl = p.x - o.x0, dr = o.x1 - p.x, db = p.y - o.y0, dt2 = o.y1 - p.y, m = Math.min(dl, dr, db, dt2);
          if (m === dl) p.x = o.x0 - p.r; else if (m === dr) p.x = o.x1 + p.r; else if (m === db) p.y = o.y0 - p.r; else p.y = o.y1 + p.r;
        } else this.pushFrom(p, qx, qy, 0, 0, 1);
      } else {
        const dx = p.x - o.x, dy = p.y - o.y, m = o.r + p.r;
        if (dx * dx + dy * dy < m * m) this.pushFrom(p, o.x, o.y, o.r, 0, p.y >= o.y ? 1 : -1);
      }
    }
    if (Math.abs(p.y) < p.r + WALL_T) for (const [a, b] of this.segs) {
      const qx = Math.max(a, Math.min(b, p.x));
      this.pushFrom(p, qx, 0, WALL_T, 0, p.y >= 0 ? 1 : -1);
    }
    if (p.x < -this.HW + p.r) { p.x = -this.HW + p.r; p.vx = Math.max(0, p.vx); }
    if (p.x > this.HW - p.r) { p.x = this.HW - p.r; p.vx = Math.min(0, p.vx); }
  }

  pushFrom(p, qx, qy, t, fnx, fny) {
    let dx = p.x - qx, dy = p.y - qy;
    const m = p.r + t, d2 = dx * dx + dy * dy;
    if (d2 >= m * m) return;
    let d = Math.sqrt(d2);
    let nx, ny;
    if (d < 1e-6) { nx = fnx; ny = fny; d = 0; } else { nx = dx / d; ny = dy / d; }
    p.x += nx * (m - d); p.y += ny * (m - d);
    const vn = p.vx * nx + p.vy * ny; if (vn < 0) { p.vx -= nx * vn; p.vy -= ny * vn; }
  }
}

if (typeof module !== 'undefined') module.exports = { World, GUEST, TAP, MIX_TYPES, SLOT_W, REV_R, WIDE_R, V_SAFE, TAU, makeRng };
