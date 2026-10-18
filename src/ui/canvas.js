// The job screen's canvas: the plan view of the street, the frontage and the lobby, drawn every frame.
import { BUILDING } from '../content/buildings/index.js';
import { $ } from './dom.js';
import { drawStage, stageLayout } from './stageart.js';
import { eventOf } from '../content/events.js';
import { GUEST, SLOT_W, TAU, V_SAFE, WORLD_HH, makeRng } from '../engine/world.js';
import { S } from './store.js';
import { W } from './workshop.js';
export let cv = null, ctx = null;
export let cw = 0, ch = 0, dpr = 1, scale = 1;
export function initCanvas() { cv = $('cv'); ctx = cv.getContext('2d'); window.addEventListener('resize', sizeCanvas); }
export function sizeCanvas() {
  if (!W) return;
  const r = $('stage').getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = r.width;
  // an inside job sizes to its own hall; a chained level lays its stages out across a wide screen or down a narrow one
  if (W.contract.stage) W.layout = stageLayout(W.contract, cw > 720);
  const n = W.contract.slots, box = W.layout && W.contract.stage ? W.layout : null, ww = box ? box.w : n * SLOT_W, wh = box ? box.h : WORLD_HH * 2;
  ch = Math.min(cw * wh / ww, window.innerHeight * (W.contract.chain ? 0.8 : 0.5));
  scale = Math.min(cw / ww, ch / wh);
  cv.style.height = ch + 'px';
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
}
// ---------- drawing ----------
const rngTex = makeRng(11);
const specks = Array.from({ length: 220 }, () => [rngTex() * 2 - 1, rngTex(), rngTex()]);
export function groundLayer(w) {
  const key = [W.contract.seed, W.contract.kind, cw, ch, dpr, S.month % 12].join('|');
  if (W.bg && W.bg.key === key) return W.bg.cv;
  const cv2 = document.createElement('canvas'); cv2.width = cv.width; cv2.height = cv.height;
  const c = cv2.getContext('2d'), HW = w.HW, HH = w.HH, lw = 1 / scale, R = makeRng(W.contract.seed || 3);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.translate(cw / 2, ch / 2); c.scale(scale, scale);
  // the street fills the whole canvas, even past the client's own frontage
  const VW = Math.max(HW, cw / 2 / scale + 0.1);
  // outside: paving slabs, a kerb and a strip of road
  const m = S.month % 12, wet = W.contract.rain, snowy = W.contract.outsideTemp <= 1;
  c.fillStyle = wet ? '#30353d' : '#3a3f48'; c.fillRect(-VW, -HH, VW * 2, HH);
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = lw;
  c.beginPath();
  for (let y = 0, row = 0; y > -HH + 0.45; y -= 0.6, row++) { c.moveTo(-VW, y); c.lineTo(VW, y); for (let x = -HW - Math.ceil((VW - HW) / 0.9) * 0.9 + (row % 2) * 0.45; x < VW; x += 0.9) { c.moveTo(x, y); c.lineTo(x, y - 0.6); } }
  c.stroke();
  for (let i = 0; i < 70 * VW / HW; i++) { c.fillStyle = `rgba(236,230,216,${0.02 + R() * 0.03})`; c.fillRect(-VW + R() * VW * 2, -HH + R() * HH, 0.4 + R() * 0.5, 0.3 + R() * 0.3); }
  c.fillStyle = '#23272e'; c.fillRect(-VW, -HH, VW * 2, 0.42);
  c.fillStyle = '#6a707a'; c.fillRect(-VW, -HH + 0.42, VW * 2, 0.07);
  c.strokeStyle = 'rgba(236,230,216,.35)'; c.lineWidth = 2 * lw; c.setLineDash([0.5, 0.45]); c.beginPath(); c.moveTo(-VW, -HH + 0.12); c.lineTo(VW, -HH + 0.12); c.stroke(); c.setLineDash([]);
  if (wet) for (let i = 0; i < 6 * VW / HW; i++) { c.fillStyle = 'rgba(156,196,236,.10)'; c.beginPath(); c.ellipse(-VW + R() * VW * 2, -HH + 0.8 + R() * (HH - 1.5), 0.3 + R() * 0.4, 0.12 + R() * 0.1, 0, 0, TAU); c.fill(); }
  if (snowy) { c.fillStyle = 'rgba(235,242,250,.16)'; c.fillRect(-VW, -HH + 0.49, VW * 2, HH - 0.49); for (let i = 0; i < 16 * VW / HW; i++) { c.fillStyle = 'rgba(240,245,250,.12)'; c.beginPath(); c.ellipse(-VW + R() * VW * 2, -HH + 0.5 + R() * (HH - 0.8), 0.15 + R() * 0.3, 0.06 + R() * 0.08, 0, 0, TAU); c.fill(); } }
  if (m >= 8 && m <= 10) for (let i = 0; i < 26 * VW / HW; i++) { c.fillStyle = ['#b8642c', '#d89a3f', '#8a4a2a'][i % 3]; c.save(); c.translate(-VW + R() * VW * 2, -HH + 0.6 + R() * (HH - 1)); c.rotate(R() * TAU); c.beginPath(); c.ellipse(0, 0, 0.07, 0.035, 0, 0, TAU); c.fill(); c.restore(); }
  // next door, either side: other people's shops, their floors and the party walls between
  if (VW > HW) {
    for (const sg of [-1, 1]) {
      const x0 = sg < 0 ? -VW : HW, wdt = VW - HW;
      c.fillStyle = '#1b1e24'; c.fillRect(x0, 0, wdt, HH);
      c.strokeStyle = 'rgba(236,230,216,.04)'; c.lineWidth = lw; c.beginPath();
      for (let x = x0; x < x0 + wdt; x += 0.6) { c.moveTo(x, 0); c.lineTo(x, HH); } for (let y = 0; y < HH; y += 0.6) { c.moveTo(x0, y); c.lineTo(x0 + wdt, y); } c.stroke();
      c.fillStyle = '#4a4f58'; c.fillRect(x0, -0.11, wdt, 0.22);   // their shopfront, closed for this job
      c.fillStyle = 'rgba(236,230,216,.08)'; c.fillRect(x0, -0.11, wdt, 0.03);
      c.fillStyle = '#3a3f48'; c.fillRect(sg < 0 ? -HW - 0.08 : HW, 0, 0.08, HH);   // party wall
      c.save(); c.scale(lw, lw); c.fillStyle = 'rgba(236,230,216,.18)'; c.font = '600 9px Figtree, sans-serif'; c.textAlign = 'center';
      if (wdt > 0.9) c.fillText('NEXT DOOR', (x0 + wdt / 2) * scale, (HH * 0.5) * scale); c.restore();
    }
  }
  // inside: the floor
  const f = (BUILDING[W.contract.kind] || {}).floor || BUILDING.office.floor;
  c.fillStyle = f.base; c.fillRect(-HW, 0, HW * 2, HH);
  c.lineWidth = lw;
  if (f.kind === 'boards') { c.strokeStyle = f.line; c.beginPath(); for (let x = -HW; x < HW; x += 0.22) { c.moveTo(x, 0); c.lineTo(x, HH); } for (let x = -HW, k = 0; x < HW; x += 0.22, k++) for (let y = (k % 3) * 0.5; y < HH; y += 1.4) { c.moveTo(x, y); c.lineTo(x + 0.22, y); } c.stroke(); for (let i = 0; i < 40; i++) { c.fillStyle = f.hi; c.fillRect(-HW + Math.floor(R() * HW * 2 / 0.22) * 0.22, R() * HH, 0.22, 0.6); } }
  if (f.kind === 'tiles') { c.strokeStyle = f.line; c.beginPath(); for (let x = -HW; x <= HW; x += f.size) { c.moveTo(x, 0); c.lineTo(x, HH); } for (let y = 0; y <= HH; y += f.size) { c.moveTo(-HW, y); c.lineTo(HW, y); } c.stroke(); }
  if (f.kind === 'check') { c.fillStyle = f.alt; for (let x = -HW, i = 0; x < HW; x += f.size, i++) for (let y = 0, j = 0; y < HH; y += f.size, j++) if ((i + j) % 2) c.fillRect(x, y, f.size, f.size); }
  if (f.kind === 'carpet') { c.strokeStyle = f.border; c.lineWidth = 0.08; c.strokeRect(-HW + 0.35, 0.35, HW * 2 - 0.7, HH - 0.7); c.lineWidth = 0.03; c.strokeRect(-HW + 0.5, 0.5, HW * 2 - 1, HH - 1); for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(212,169,79,.05)'; c.beginPath(); c.arc(-HW + 0.8 + R() * (HW * 2 - 1.6), 0.8 + R() * (HH - 1.6), 0.08, 0, TAU); c.fill(); } }
  if (f.kind === 'parquet') { c.strokeStyle = f.line; c.beginPath(); for (let x = -HW, i = 0; x < HW; x += 0.5, i++) for (let y = 0, j = 0; y < HH; y += 0.5, j++) { if ((i + j) % 2) { for (let k = 0.125; k < 0.5; k += 0.125) { c.moveTo(x + k, y); c.lineTo(x + k, y + 0.5); } } else { for (let k = 0.125; k < 0.5; k += 0.125) { c.moveTo(x, y + k); c.lineTo(x + 0.5, y + k); } } } c.stroke(); }
  if (f.kind === 'terrazzo') for (let i = 0; i < 500; i++) { c.fillStyle = ['rgba(236,230,216,.10)', 'rgba(212,169,79,.10)', 'rgba(0,0,0,.18)'][i % 3]; c.fillRect(-HW + R() * HW * 2, R() * HH, 0.04 + R() * 0.04, 0.04 + R() * 0.04); }
  // a soft shadow under the facade on both sides
  let gr = c.createLinearGradient(0, 0, 0, 0.6); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-VW, 0, VW * 2, 0.6);
  gr = c.createLinearGradient(0, 0, 0, -0.5); gr.addColorStop(0, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-VW, -0.5, VW * 2, 0.5);
  W.bg = { key, cv: cv2 };
  return cv2;
}
export function draw(t) {
  if (!W || !cv.width || !cv.height) return;   // not laid out yet
  const c = ctx, w = W.world, HW = w.HW, HH = w.HH;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cw, ch);
  if (W.contract.stage) {   // an inside job draws its own hall
    c.fillStyle = '#0e1116'; c.fillRect(0, 0, cw, ch);
    c.save(); c.translate(cw / 2, ch / 2); c.scale(scale, scale); drawStage(c, W, t, 1 / scale); c.restore();
    return;
  }
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
  const bld = (BUILDING[W.contract.kind] || {}).look || { base: '#4b6b8a', trim: '#cfd8e0' };
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
    const PH = BUILDING[W.contract.kind].phases || [];
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
  c.fillText(BUILDING[W.contract.kind].concourse ? 'CONCOURSE' : `LOBBY ${w.temp.toFixed(1)}°C`, (HW - 0.12) * scale, (HH - 0.15) * scale); c.textAlign = 'left';
  c.restore();
  c.restore();
}
// street furniture: steps and ramp, the cash machine, taxi rank, bus shelter, tables, desks, columns, standing people
export function drawSite(c, site, lw) {
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
export function drawStanding(c, x, y, r) { drawStandingFig(c, x, y, r); }
const COATS = { 1: ['#9cc4ec', '#86b2de', '#b3d2f0'], '-1': ['#e79a86', '#d98670', '#f0b2a2'] };
export function drawPerson(c, p) {
  const v = Math.hypot(p.vx, p.vy), ux = v > 0.05 ? p.vx / v : 0, uy = v > 0.05 ? p.vy / v : p.dir;
  const ang = Math.atan2(uy, ux), coat = COATS[p.dir > 0 ? 1 : -1][(p.born * 7 | 0) % 3 || 0] || (p.dir > 0 ? '#9cc4ec' : '#e79a86');
  if (p.type === 'bike') {
    const ox = -uy * 0.2, oy = ux * 0.2;
    c.strokeStyle = '#d4a94f'; c.lineWidth = 0.05; c.beginPath(); c.moveTo(p.x + ox - ux * 0.38, p.y + oy - uy * 0.38); c.lineTo(p.x + ox + ux * 0.38, p.y + oy + uy * 0.38); c.stroke();
    c.fillStyle = '#12151b'; for (const s of [-0.3, 0.3]) { c.beginPath(); c.arc(p.x + ox + ux * s, p.y + oy + uy * s, 0.08, 0, TAU); c.fill(); }
  }
  if (p.type === 'tourist') { c.fillStyle = '#d4a94f'; c.fillRect(p.x + ux * 0.16 - 0.05, p.y + uy * 0.16 - 0.05, 0.1, 0.1); }   // a tourist: a camera held up
  if (p.type === 'kid') { c.fillStyle = '#6fcf97'; c.beginPath(); c.arc(p.x, p.y, p.r * 0.55, 0, TAU); c.fill(); }   // a child: small, with a green cap
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
  if (p.laps > ((GUEST[p.type] || {}).joy || 0)) { c.strokeStyle = '#b48cf0'; c.lineWidth = 0.06; c.beginPath(); c.arc(p.x, p.y, p.r + 0.04, 0, TAU); c.stroke(); }
}
export function drawStandingFig(c, x, y, r) {
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 0.03, y + 0.04, r, r * 0.62, 0, 0, TAU); c.fill();
  c.fillStyle = '#5a5f6a'; c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, 0, TAU); c.fill();
  c.fillStyle = '#2a1f18'; c.beginPath(); c.arc(x, y - 0.02, r * 0.46, 0, TAU); c.fill();
}

