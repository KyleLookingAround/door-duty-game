// The town day in the month report: a sped-up day on one street (game/townday.js), drawn on a canvas while the
// surveyor works. Buildings in a row, people walking past, a queue outside each door; a clock and a caption
// for what's happening. Clients being checked against a street change carry a "?" until the surveyor is back,
// then show how the day went for them (townDayOutcome).
import { dayClock } from '../game/townday.js';

const TD_H = 172, TD_GROUND = 128, TD_PLAY = 14;   // canvas height, pavement line, seconds for the whole day
const TD_INK = '#12151b', TD_BLOCK = '#3a404b', TD_MINE = '#4a4436', TD_RIVAL = '#2f3540', TD_BRASS = '#d4a94f', TD_TEXT = 'rgba(236,230,216,0.75)';
let tdNow = null;   // the day being played: { day, canvas, outcome: { i: true|false }, t0 }

const tdRnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

export function playTownDay(canvas, day) {
  if (!canvas || !day || !day.plots.length) return;
  tdNow = { day, canvas, outcome: {}, t0: performance.now(), extra: [] };
  const still = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) tdNow.t0 -= TD_PLAY * 1000;
  const me = tdNow;
  const frame = () => {
    if (tdNow !== me || !canvas.isConnected) return;
    drawTownDay(me);
    if ((performance.now() - me.t0) / 1000 < TD_PLAY + 0.5 || me.dirty) { me.dirty = false; requestAnimationFrame(frame); }
  };
  requestAnimationFrame(frame);
}
// (canvas: a fresh one, when the report has been drawn again)
export function replayTownDay(canvas) { if (tdNow) { const { day, outcome, extra } = tdNow; playTownDay(canvas || tdNow.canvas, day); Object.assign(tdNow.outcome, outcome); tdNow.extra = extra; } }

// the surveyor is back from a client being checked: coped (true) or calling you back (false)
export function townDayOutcome(i, coped) {
  if (!tdNow) return;
  const o = tdNow.day.plots.find(x => x.i === i);
  if (!o || !o.checked) return;
  tdNow.outcome[i] = coped;
  if (!coped) tdNow.extra.push({ k: o.short.spilled != null ? o.short.spilled : tdNow.day.steps - 8, text: `${o.name} can't keep up: they'll call you`, i });
  // a finished day redraws once with the news
  tdNow.dirty = true;
  const me = tdNow;
  requestAnimationFrame(() => { if (tdNow === me && me.canvas.isConnected) drawTownDay(me); });
}

function drawTownDay(me) {
  const { day, canvas } = me, dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 600;
  if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(TD_H * dpr); }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const secs = (performance.now() - me.t0) / 1000, f = Math.min(1, secs / TD_PLAY), kf = f * (day.steps - 1), k = Math.floor(kf), kk = Math.min(day.steps - 1, k + 1), u = kf - k;
  const at = arr => arr[k] + (arr[kk] - arr[k]) * u;
  const hour = day.from + (day.to - day.from) * f;
  // the sky: morning to dusk
  const dusk = Math.max(0, Math.min(1, (hour - 16.5) / 3.5)), dawn = Math.max(0, Math.min(1, (8 - hour) / 1));
  const sky = g.createLinearGradient(0, 0, 0, TD_GROUND);
  sky.addColorStop(0, tdMix('#3b5874', '#1f2333', Math.max(dusk, dawn)));
  sky.addColorStop(1, tdMix('#8aa4b8', '#6a4a5a', Math.max(dusk, dawn)));
  g.fillStyle = sky; g.fillRect(0, 0, W, TD_GROUND);
  g.fillStyle = '#2a2f38'; g.fillRect(0, TD_GROUND, W, 14);
  g.fillStyle = TD_INK; g.fillRect(0, TD_GROUND + 14, W, TD_H - TD_GROUND - 14);
  // people walking past: more of them in the busy hours
  const n = day.plots.length, bw = W / n, busy = day.plots.reduce((a, o) => a + at(o.demand), 0) / n;
  const walkers = Math.min(60, Math.round(busy * 1.4));
  g.fillStyle = 'rgba(18,21,27,0.85)';
  for (let j = 0; j < walkers; j++) {
    const dir = j % 2 ? 1 : -1, sp = 0.05 + tdRnd(j, 1) * 0.04, x = (((tdRnd(j, 2) + dir * secs * sp) % 1) + 1) % 1 * W;
    g.beginPath(); g.arc(x, TD_GROUND + 4 + (j % 3) * 3, 2.2, 0, 7); g.fill();
  }
  // the buildings, their doors and their queues
  const lit = hour > 17.5 || hour < 8;
  const extra = me.extra;
  day.plots.forEach((o, j) => {
    const x0 = j * bw + 3, w = bw - 6, h = 54 + Math.round(tdRnd(o.i, 3) * 40), y0 = TD_GROUND - h;
    g.fillStyle = o.rival ? TD_RIVAL : o.yours ? TD_MINE : TD_BLOCK;
    g.fillRect(x0, y0, w, h);
    if (o.yours) { g.fillStyle = TD_BRASS; g.fillRect(x0, y0, w, 3); }
    // windows
    g.fillStyle = lit ? 'rgba(232,196,120,0.75)' : 'rgba(156,196,236,0.35)';
    const cols = Math.max(1, Math.floor(w / 14)), rows = Math.floor((h - 26) / 14);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (tdRnd(o.i * 7 + r, c) > (lit ? 0.35 : 0.1)) g.fillRect(x0 + 4 + c * ((w - 8) / cols), y0 + 8 + r * 14, (w - 8) / cols - 4, 8);
    // the queue: which ending, for a client being checked
    const seen = o.checked ? (me.outcome[o.i] === false ? o.queue : o.coped) : o.queue, q = at(seen);
    const door = o.broken ? '#8a5a52' : q >= 10 ? '#ef5b4c' : q >= 4 ? TD_BRASS : '#6fcf97';
    g.fillStyle = door; g.fillRect(x0 + w / 2 - 6, TD_GROUND - 16, 12, 16);
    const shown = Math.min(16, Math.round(q));
    g.fillStyle = q >= 10 ? '#ef5b4c' : TD_TEXT;
    for (let d = 0; d < shown; d++) { g.beginPath(); g.arc(x0 + w / 2 - 6 + (d % 4) * 4, TD_GROUND + 4 + Math.floor(d / 4) * 4, 1.8, 0, 7); g.fill(); }
    if (q > 16.5) { g.font = '10px system-ui, sans-serif'; g.fillText(`+${Math.round(q - 16)}`, x0 + w / 2 + 10, TD_GROUND + 12); }
    // the name, and the check
    g.fillStyle = TD_TEXT; g.font = `${bw < 70 ? 9 : 11}px system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText(tdShort(o.name, w), x0 + w / 2, TD_GROUND + 30);
    if (o.checked) {
      const res = me.outcome[o.i], tag = res == null ? '?' : res ? '✓' : '!';
      g.fillStyle = res == null ? TD_BRASS : res ? '#6fcf97' : '#ef5b4c';
      g.beginPath(); g.arc(x0 + w / 2, y0 - 10, 8, 0, 7); g.fill();
      g.fillStyle = TD_INK; g.font = 'bold 11px system-ui, sans-serif'; g.fillText(tag, x0 + w / 2, y0 - 6);
    }
    g.textAlign = 'left';
  });
  // the clock and what's happening
  g.fillStyle = 'rgba(18,21,27,0.7)'; g.fillRect(0, 0, W, 22);
  g.fillStyle = TD_BRASS; g.font = 'bold 12px ui-monospace, monospace'; g.fillText(dayClock(Math.round(kf)), 8, 15);
  const all = [...day.moments, ...extra].filter(m => m.k <= kf + 0.5).sort((a, b) => a.k - b.k), cap = all[all.length - 1];
  g.fillStyle = TD_TEXT; g.font = '12px system-ui, sans-serif';
  g.fillText(f >= 1 && !cap ? `A day on ${day.streetName}` : cap ? tdFit(g, cap.text, W - 70) : `A day on ${day.streetName}`, 60, 15);
}

const tdShort = (s, w) => { const t = s.replace(/^The /, ''); const max = Math.max(4, Math.floor(w / 6.2)); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
function tdFit(g, t, w) { if (g.measureText(t).width <= w) return t; while (t.length > 4 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
function tdMix(a, b, f) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(',')})`;
}
