// Drawing the inside jobs on the job screen's canvas. One function per stage, in metres, centred on (0, 0).
// The canvas has already been translated to the centre and scaled; lw is one screen pixel in metres.
import { BUILDING } from '../content/buildings/index.js';
import { TAU } from '../engine/world.js';
import { STAGES, stageName } from '../engine/stages/index.js';
import { drawPerson } from './canvas.js';

const INK = '#12151b', LINE = 'rgba(236,230,216,0.18)', BRASS = '#d4a94f', TEXT = 'rgba(236,230,216,0.6)';

function label(c, lw, text, x, y, opts = {}) {
  c.save(); c.scale(lw, lw);
  c.font = `${opts.weight || 600} ${opts.size || 10}px Figtree, sans-serif`; c.textAlign = opts.align || 'center';
  c.fillStyle = opts.color || TEXT; c.fillText(text, x / lw, y / lw); c.restore();
}
function floor(c, kind, w, h) {
  const f = (BUILDING[kind] || {}).floor || { base: '#2a2e36' };
  c.fillStyle = f.base; c.fillRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = f.line || 'rgba(0,0,0,.25)'; c.lineWidth = 0.02;
  for (let x = -w / 2; x < w / 2; x += 1) { c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke(); }
  for (let y = -h / 2; y < h / 2; y += 1) { c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); }
}
function walls(c, lw, w, h, gaps = []) {
  c.strokeStyle = '#8a8f99'; c.lineWidth = 0.12; c.lineCap = 'butt';
  c.strokeRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = INK; c.lineWidth = 0.16;
  for (const [x0, y0, x1, y1] of gaps) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
}
function fx(c, W, t) {
  for (const e of W.fx || []) {
    const age = t - e.t0; if (age > 1.2) continue;
    if (e.type === 'bump') { c.strokeStyle = `rgba(239,91,76,${1 - age / 1.2})`; c.lineWidth = 0.06; c.beginPath(); c.arc(e.x, e.y, 0.25 + age * 0.6, 0, TAU); c.stroke(); }
    if (e.type === 'slow') { c.fillStyle = `rgba(212,169,79,${1 - age / 1.2})`; c.beginPath(); c.arc(e.x, e.y - 0.6 - age * 0.3, 0.12, 0, TAU); c.fill(); }
  }
}

const ART = {
  queue(c, W, t, lw) {
    const s = W.world, d = W.design, box = STAGES.queue.box;
    floor(c, W.contract.kind, box.w, box.h);
    walls(c, lw, box.w, box.h, [[-0.9, box.h / 2, 0.9, box.h / 2], [-box.w / 2, -2.9, -box.w / 2, -1.9], [box.w / 2, -2.9, box.w / 2, -1.9]]);
    // the counter, with a window per desk
    c.fillStyle = '#3b3128'; c.fillRect(-box.w / 2 + 0.3, -3.75, box.w - 0.6, 0.45);
    c.fillStyle = '#5b4a38'; c.fillRect(-box.w / 2 + 0.3, -3.35, box.w - 0.6, 0.1);
    for (const dk of s.desks) {
      const busy = !!(dk.user && dk.user.atDesk);
      c.fillStyle = busy ? 'rgba(212,169,79,.85)' : 'rgba(111,207,151,.8)';
      c.beginPath(); c.arc(dk.x, -3.52, 0.12, 0, TAU); c.fill();
      label(c, lw, String(dk.i + 1), dk.x, -3.95, { size: 9 });
      if (busy && dk.user.slow) label(c, lw, 'slow', dk.x, -2.55, { size: 8, color: 'rgba(212,169,79,.9)' });
    }
    // the queue furniture: barrier tape for the snake, floor markers for lines
    if (d.layout === 'snake') {
      c.strokeStyle = 'rgba(212,169,79,.75)'; c.lineWidth = 0.035;
      const rows = 7, per = 9.2;
      for (let r = 0; r <= rows; r++) {
        const y = -1.9 + 0.75 + r * 0.68 - 0.34;
        const open = r % 2 ? -1 : 1;   // the gap alternates ends, so the queue snakes
        c.beginPath(); c.moveTo(-per / 2 - 0.35 + (open < 0 ? 0.9 : 0), y); c.lineTo(per / 2 + 0.35 - (open > 0 ? 0.9 : 0), y); c.stroke();
        for (const x of [-per / 2 - 0.35, per / 2 + 0.35]) { c.fillStyle = '#9a9fa8'; c.beginPath(); c.arc(x, y, 0.06, 0, TAU); c.fill(); }
      }
      label(c, lw, 'WAIT HERE FOR THE NEXT FREE DESK', 0, -1.35, { size: 8, color: 'rgba(212,169,79,.8)' });
    } else {
      c.fillStyle = 'rgba(236,230,216,.12)';
      for (const dk of s.desks) for (let j = 0; j < 9; j++) c.fillRect(dk.x - 0.22, -3.0 + 0.9 + j * 0.62 - 0.02, 0.44, 0.04);
    }
    for (const p of s.people) drawPerson(c, p);
    fx(c, W, t);
    label(c, lw, 'ENTRANCE', 0, box.h / 2 - 0.25, { size: 8 });
  },

  escalator(c, W, t, lw) {
    const s = W.world, d = W.design, box = STAGES.escalator.box, FOOT = 3.4, TOP = -3.2, P = W.contract.params;
    floor(c, W.contract.kind, box.w, box.h);
    walls(c, lw, box.w, box.h, [[-3.5, box.h / 2, 3.5, box.h / 2]]);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-box.w / 2, -box.h / 2, box.w, TOP + box.h / 2 + 0.3);
    label(c, lw, 'UPPER FLOOR', 0, -box.h / 2 + 0.45, { size: 9 });
    // the stairs, beside the escalators
    const SX = 5.0;
    c.fillStyle = '#3a3630'; c.fillRect(SX - 0.45, TOP, 0.9, FOOT - TOP);
    c.strokeStyle = 'rgba(236,230,216,.16)'; c.lineWidth = 0.03;
    for (let y = TOP + 0.2; y < FOOT; y += 0.3) { c.beginPath(); c.moveTo(SX - 0.42, y); c.lineTo(SX + 0.42, y); c.stroke(); }
    label(c, lw, 'STAIRS', SX, FOOT + 0.55, { size: 7, color: 'rgba(236,230,216,.6)' });
    const v = s.v || 0.5;
    for (const e of s.escs) {
      const up = e.dir !== 'down';
      c.fillStyle = '#2b2f37'; c.fillRect(e.x - 0.75, TOP, 1.5, FOOT - TOP);
      c.strokeStyle = up ? '#9aa0aa' : '#c9a25a'; c.lineWidth = 0.06; c.strokeRect(e.x - 0.75, TOP, 1.5, FOOT - TOP);
      // the steps creep the way it runs
      c.strokeStyle = 'rgba(236,230,216,.12)'; c.lineWidth = 0.03;
      const off = (t * v * (FOOT - TOP) / P.length * 4) % 0.4;
      for (let y = up ? FOOT - off : TOP + off; up ? y > TOP : y < FOOT; y += up ? -0.4 : 0.4) { c.beginPath(); c.moveTo(e.x - 0.7, y); c.lineTo(e.x + 0.7, y); c.stroke(); }
      c.strokeStyle = 'rgba(236,230,216,.25)'; c.beginPath(); c.moveTo(e.x, TOP); c.lineTo(e.x, FOOT); c.stroke();
      // an arrow down the middle, and the rule where people step on
      const mid = (TOP + FOOT) / 2, a = up ? -1 : 1;
      c.fillStyle = up ? 'rgba(156,196,236,.35)' : 'rgba(212,169,79,.4)';
      c.beginPath(); c.moveTo(e.x, mid + a * 0.5); c.lineTo(e.x - 0.35, mid - a * 0.1); c.lineTo(e.x + 0.35, mid - a * 0.1); c.closePath(); c.fill();
      const ry = up ? FOOT + 0.55 : TOP - 0.3;
      if (d.rule === 'walk') { label(c, lw, 'WALK', e.x - 0.38, ry, { size: 7, color: 'rgba(212,169,79,.85)' }); label(c, lw, 'STAND', e.x + 0.38, ry, { size: 7, color: 'rgba(156,196,236,.85)' }); }
      else label(c, lw, 'STAND BOTH SIDES', e.x, ry, { size: 7, color: 'rgba(156,196,236,.85)' });
      label(c, lw, up ? 'UP' : 'DOWN', e.x, up ? TOP - 0.3 : FOOT + 0.55, { size: 7, color: up ? 'rgba(156,196,236,.85)' : 'rgba(212,169,79,.85)' });
    }
    label(c, lw, `${Math.round(P.length)} m escalator${s.escs.length > 1 ? 's' : ''}${v > 0.5 ? ' · fast' : ''}`, -box.w / 2 + 0.3, TOP + 0.4, { size: 8, align: 'left' });
    for (const p of s.people) drawPerson(c, p);
    for (const e of W.fx || []) if (e.type === 'train') { const age = t - e.t0; if (age < 1.6) label(c, lw, 'TRAIN IN', 0, box.h / 2 - 0.5, { size: 12, color: `rgba(243,197,107,${1 - age / 1.6})` }); }
    fx(c, W, t);
  },
  lifts(c, W, t, lw) {
    const s = W.world, box = STAGES.lifts.box, F = W.contract.params.floors, LOBBY = 4.2, H = 8.4, fh = H / F;
    floor(c, W.contract.kind, box.w, box.h);
    walls(c, lw, box.w, box.h, [[-2, box.h / 2, 2, box.h / 2]]);
    // floors, and a shaft per lift with its car
    c.strokeStyle = 'rgba(236,230,216,.07)'; c.lineWidth = 0.02;
    for (let f = 1; f <= F; f++) { const y = LOBBY - f * fh; c.beginPath(); c.moveTo(-box.w / 2, y); c.lineTo(box.w / 2, y); c.stroke(); if (f % 2 === 0 || F <= 12) label(c, lw, String(f), -box.w / 2 + 0.3, y + 0.12, { size: 7, align: 'left' }); }
    for (const car of s.cars) {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(car.x - 0.42, LOBBY - H, 0.84, H);
      const y = LOBBY - car.at * fh;
      c.fillStyle = car.g ? '#b48cf0' : BRASS; c.fillRect(car.x - 0.38, y - 0.36, 0.76, 0.36);
      if (car.load.length) label(c, lw, String(car.load.length), car.x, y - 0.1, { size: 8, color: INK });
    }
    if (s.groups.length > 1) { label(c, lw, `FLOORS 1–${s.groups[0].to}`, -2.4, LOBBY + 0.55, { size: 8, color: BRASS }); label(c, lw, `FLOORS ${s.groups[1].from}–${F}`, 2.4, LOBBY + 0.55, { size: 8, color: '#b48cf0' }); }
    else label(c, lw, 'ALL FLOORS', 0, LOBBY + 0.55, { size: 8, color: BRASS });
    for (const p of s.people) if (!p.hidden) drawPerson(c, p);
    fx(c, W, t);
  },
  paternoster(c, W, t, lw) {
    const s = W.world, d = W.design, box = STAGES.paternoster.box, LAND = 3.4;
    floor(c, W.contract.kind, box.w, box.h);
    walls(c, lw, box.w, box.h, [[-4.5, 3.6, -4.5, 4.6]]);
    // the loop: cabins rise on the left side of the shaft and come down on the right
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-0.7, -box.h / 2 + 0.3, 1.9, box.h - 0.6);
    const per = 2.6 * 0.6, phase = (s.phase || 0) * 0.6;
    for (let y = LAND + 0.6 + phase; y > -box.h / 2 + 0.3; y -= per) { c.fillStyle = '#6b5232'; c.fillRect(-0.62, y - 1.2, 0.8, 1.15); c.fillStyle = 'rgba(243,197,107,.35)'; c.fillRect(-0.55, y - 1.1, 0.66, 0.9); }
    for (let y = -box.h / 2 + 0.3 - phase + per; y < LAND + 0.6; y += per) { c.fillStyle = '#5a4430'; c.fillRect(0.32, y - 1.2, 0.8, 1.15); }
    for (let f = 1; f <= W.contract.params.floors; f++) label(c, lw, `FLOOR ${f}`, -1.0, LAND - f * 1.5 + 0.1, { size: 7, align: 'right' });
    label(c, lw, `${d.speed.toFixed(2)} m/s`, 1.9, LAND + 0.2, { size: 9, align: 'left', color: BRASS });
    // the stairs, for anyone who gives up on it
    c.strokeStyle = 'rgba(236,230,216,.18)'; c.lineWidth = 0.04;
    for (let k = 0; k < 14; k++) { c.beginPath(); c.moveTo(3.1, 3.2 - k * 0.42); c.lineTo(4.2, 3.2 - k * 0.42); c.stroke(); }
    label(c, lw, 'STAIRS', 3.65, 3.75, { size: 8 });
    for (const p of s.people) drawPerson(c, p);
    fx(c, W, t);
  },
  walkway(c, W, t, lw) {
    const s = W.world, box = STAGES.walkway.box, L = s.len, X = v => -6.5 + 13 * v / L;
    floor(c, W.contract.kind, box.w, box.h);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-7, -1.1, 14, 2.2);
    c.strokeStyle = '#8a8f99'; c.lineWidth = 0.1; c.beginPath(); c.moveTo(-7, -1.15); c.lineTo(7, -1.15); c.moveTo(-7, 1.15); c.lineTo(7, 1.15); c.stroke();
    if (s.belt) {
      const x0 = X(s.belt[0]), x1 = X(s.belt[1]);
      c.fillStyle = s.stopT > 0 ? 'rgba(239,91,76,.35)' : '#2f3540'; c.fillRect(x0, -0.75, x1 - x0, 1.5);
      c.strokeStyle = 'rgba(236,230,216,.15)'; c.lineWidth = 0.02;
      const off = s.stopT > 0 ? 0 : (t * 1.0 * 13 / L) % 0.3;
      for (let x = x0 + off; x < x1; x += 0.3) { c.beginPath(); c.moveTo(x, -0.72); c.lineTo(x, 0.72); c.stroke(); }
      if (s.stopT > 0) label(c, lw, 'STOPPED', (x0 + x1) / 2, -0.95, { size: 9, color: '#ef5b4c' });
    }
    c.fillStyle = '#3b3128'; c.fillRect(6.6, -1.1, 0.35, 2.2); label(c, lw, 'PASSPORTS', 6.75, 1.65, { size: 8 });
    label(c, lw, 'FROM THE GATE', -6.4, 1.65, { size: 8, align: 'left' });
    for (const p of s.people) drawPerson(c, p);
    fx(c, W, t);
  },
  carousel(c, W, t, lw) {
    const s = W.world, d = W.design, box = STAGES.carousel.box;
    floor(c, W.contract.kind, box.w, box.h);
    walls(c, lw, box.w, box.h, [[-box.w / 2, 3.2, -box.w / 2, 4.2], [box.w / 2, 3.2, box.w / 2, 4.2]]);
    const ring = (b, off, style, width, dash) => {
      c.strokeStyle = style; c.lineWidth = width; c.setLineDash(dash || []);
      c.beginPath(); for (let k = 0; k <= 64; k++) { const [x, y] = s.pos(s.per * k / 64, off, b); if (k) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); c.setLineDash([]);
    };
    for (let b = 0; b < s.belts; b++) {
      ring(b, 0, '#3a3f49', 0.5); ring(b, 0, 'rgba(236,230,216,.12)', 0.02);
      if (d.line) ring(b, 1.0, 'rgba(212,169,79,.85)', 0.05, [0.2, 0.12]);
      const [cx, cy] = s.pos(0, -0.6, b); c.fillStyle = '#5a4a36'; c.fillRect(cx - 0.3, cy - 0.3, 0.6, 0.6);
    }
    for (const bag of s.bags) if (bag.on && !bag.taken) { const [x, y] = s.pos(bag.s, 0, bag.belt); c.fillStyle = ['#9b7a4a', '#3d5a7a', '#b8483a', '#6fcf97'][bag.owner.id % 4]; c.fillRect(x - 0.15, y - 0.11, 0.3, 0.22); }
    label(c, lw, d.line ? 'STAND BEHIND THE LINE' : 'BAGGAGE RECLAIM', 0, -box.h / 2 + 0.5, { size: 9, color: d.line ? BRASS : TEXT });
    for (const p of s.people) drawPerson(c, p);
    fx(c, W, t);
  },
  braess(c, W, t, lw) {
    const s = W.world, d = W.design, box = STAGES.braess.box;
    floor(c, W.contract.kind, box.w, box.h);
    const corridor = (pts, col, wdt) => { c.strokeStyle = col; c.lineWidth = wdt; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
    corridor([[-6.2, -2.4], [6.2, -2.4], [6.2, 0]], '#2b2f37', 1.1);
    corridor([[-6.2, 0], [-6.2, 2.4], [6.2, 2.4]], '#2b2f37', 1.1);
    corridor([[-6.2, 0], [-6.2, -2.4], [-2.6, -2.4]], d.wideEsc ? '#5a4a36' : '#4a3d30', d.wideEsc ? 1.1 : 0.7);
    corridor([[2.6, 2.4], [6.2, 2.4], [6.2, 0]], d.wideStairs ? '#5a4a36' : '#4a3d30', d.wideStairs ? 1.1 : 0.7);
    corridor([[0, -2.4], [0, 2.4]], d.bridge === 'open' ? '#3a4452' : 'rgba(239,91,76,.25)', 0.8);
    if (d.bridge !== 'open') { c.strokeStyle = '#ef5b4c'; c.lineWidth = 0.1; c.beginPath(); c.moveTo(-0.4, -0.4); c.lineTo(0.4, 0.4); c.moveTo(0.4, -0.4); c.lineTo(-0.4, 0.4); c.stroke(); }
    label(c, lw, 'ESCALATORS', -4.4, -2.95, { size: 8, color: BRASS }); label(c, lw, 'UPPER MALL', 2, -3.0, { size: 8 });
    label(c, lw, 'LOWER MALL', -2, 3.15, { size: 8 }); label(c, lw, 'STAIRS', 4.4, 3.15, { size: 8, color: BRASS });
    label(c, lw, d.bridge === 'open' ? 'FOOTBRIDGE' : 'BRIDGE CLOSED', 0.9, 0.1, { size: 8, align: 'left', color: d.bridge === 'open' ? TEXT : '#ef5b4c' });
    label(c, lw, 'ENTRANCE', -6.3, 0.15, { size: 8, align: 'right' }); label(c, lw, 'TRAM', 6.35, 0.15, { size: 8, align: 'left' });
    for (const p of s.people) drawPerson(c, p);
    fx(c, W, t);
  },
  bottleneck(c, W, t, lw) {
    const s = W.world, d = W.design, box = STAGES.bottleneck.box, X0 = -7.5, LEN = 16, WD = 4.5;
    floor(c, W.contract.kind, box.w, box.h);
    const rho = s.density ? s.density() : 0, P = W.contract.params;
    c.fillStyle = `rgba(239,91,76,${Math.min(0.45, Math.max(0, (rho - P.ok) / (P.jam - P.ok)) * 0.45)})`; c.fillRect(X0, -WD / 2, LEN, WD);
    c.strokeStyle = '#8a8f99'; c.lineWidth = 0.12; c.beginPath(); c.moveTo(X0, -WD / 2); c.lineTo(X0 + LEN, -WD / 2); c.moveTo(X0, WD / 2); c.lineTo(X0 + LEN, WD / 2); c.stroke();
    // the openings into the arena
    c.fillStyle = '#4a4060'; c.fillRect(X0 + LEN, -WD / 2 - 0.4, 0.5, WD + 0.8);
    for (let k = 0; k < d.openings; k++) { const y = ((k + 0.5) / d.openings - 0.5) * (WD - 0.6); c.fillStyle = INK; c.fillRect(X0 + LEN, y - 0.3, 0.5, 0.6); }
    label(c, lw, 'ARENA', X0 + LEN + 0.25, -WD / 2 - 0.65, { size: 8 });
    if (d.metering) { c.fillStyle = BRASS; for (const y of [-WD / 2 + 0.3, WD / 2 - 0.3]) { c.beginPath(); c.arc(X0 + 0.2, y, 0.16, 0, TAU); c.fill(); } label(c, lw, 'STEWARDS', X0 + 0.2, -WD / 2 - 0.3, { size: 8, color: BRASS }); }
    label(c, lw, `${rho.toFixed(1)} people per m²`, X0 + LEN - 0.2, WD / 2 + 0.45, { size: 8, align: 'right', color: rho > P.crush ? '#ef5b4c' : TEXT });
    for (const p of s.people) drawPerson(c, p);
    fx(c, W, t);
  },
};

// a chained level lays its stages out in a row on a wide screen, stacked on a narrow one
export function stageLayout(contract, wide) {
  if (!contract.chain) { const b = STAGES[contract.stage].box; return { w: b.w, h: b.h, parts: [{ x: 0, y: 0, box: b }] }; }
  const boxes = contract.chain.map(k => STAGES[k].box), gap = 1.2;
  if (wide) {
    const w = boxes.reduce((a, b) => a + b.w, 0) + gap * (boxes.length - 1), h = Math.max(...boxes.map(b => b.h));
    let x = -w / 2;
    return { w, h, parts: boxes.map(b => { const at = x + b.w / 2; x += b.w + gap; return { x: at, y: 0, box: b }; }) };
  }
  const w = Math.max(...boxes.map(b => b.w)), h = boxes.reduce((a, b) => a + b.h, 0) + gap * (boxes.length - 1);
  let y = -h / 2;
  return { w, h, parts: boxes.map(b => { const at = y + b.h / 2; y += b.h + gap; return { x: 0, y: at, box: b }; }) };
}

export function drawStage(c, W, t, lw) {
  const con = W.contract;
  if (!con.chain) { const fn = ART[con.stage]; if (fn) fn(c, W, t, lw); return; }
  const L = W.layout || stageLayout(con, true);
  con.chain.forEach((k, i) => {
    const pt = L.parts[i];
    c.save(); c.translate(pt.x, pt.y);
    ART[k](c, { world: W.world.parts[i], design: W.design.parts[i], contract: { ...con.parts[i], kind: con.kind }, fx: (W.fx || []).filter(e => e.part === i) }, t, lw);
    // which stage the editor is on, and the order they come in
    if (W.mode !== 'test' && i === (W.part || 0)) { c.strokeStyle = 'rgba(212,169,79,.8)'; c.lineWidth = 2 * lw; c.setLineDash([6 * lw, 4 * lw]); c.strokeRect(-pt.box.w / 2, -pt.box.h / 2, pt.box.w, pt.box.h); c.setLineDash([]); }
    label(c, lw, `${i + 1}. ${stageName(con, k).toUpperCase()}`, -pt.box.w / 2 + 0.25, -pt.box.h / 2 + 0.45, { size: 10, align: 'left', color: BRASS });
    c.restore();
  });
}
