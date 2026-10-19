// The street scene: a side-on painting of the current street. Pure string-building (SVG); street.js puts it on the page.
// A side-on painting of the High Street at dusk. Each client has its own building; your doors appear on its
// ground floor once fitted. The month sets the sky, the trees and the dressing; events leave their mark.
import { BUILDING, KINDS, PLOTS } from '../content/buildings/index.js';
import { PREMISES } from '../content/company.js';
import { eventOf } from '../content/events.js';
import { RIVAL, STREETS } from '../content/town.js';
import { MONTHS } from '../game/contracts.js';
import { feeOf, missingNeeds, needsMet, needsText, plotNeeds, rep, rivalInstall, streetOf, techName, upkeep } from '../game/economy.js';
import { sheet } from './dom.js';
import { S } from './store.js';
import { W } from './workshop.js';
import { kmoney } from '../util/format.js';
export const SC_H = 330, G = 252;                       // scene height, ground line (top of the pavement)
const SKY = {   // dusk palettes: top, horizon, distant rooftops
  winter: ['#151d2b', '#3d4a63', '#232c3b'], spring: ['#2a2742', '#8a6f8f', '#2f2c43'],
  summer: ['#1d2f4f', '#c98b5b', '#2b3048'], autumn: ['#2a1f2a', '#c46f3e', '#33242a'],
  heatwave: ['#3a2430', '#f0a050', '#3f2a2c'], storm: ['#12161d', '#3a4350', '#1a1f27'],
};
export function scSeason(m) { m = ((m % 12) + 12) % 12; return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }
export const scEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export const RND = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// one bay of the ground floor: whatever you fitted there, or the old frontage
export function bayArt(s, x, w, state) {
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

export function buildingArt(p, x) {
  const B = BUILDING[p.kind], b = B.look, st = p.status, locked = st === 'locked', fitted = st === 'fitted';
  const { w, h, base, trim } = b, top = G - h, o = [];
  const winLit = fitted ? 'rgba(243,197,107,.8)' : locked ? '#2a2f38' : 'rgba(243,197,107,.35)';
  const win = (wx, wy, ww, wh) => o.push(`<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="${winLit}" stroke="${trim}" stroke-width="1.5"/>`);
  // body
  o.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${base}"/>`);
  o.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#brick)" opacity=".5"/>`);
  o.push(`<rect x="${x - 3}" y="${top - 6}" width="${w + 6}" height="8" fill="${trim}" opacity=".85"/>`);   // cornice
  // the building's own architecture above the shopfront (drawn by its content file)
  const upTop = top + 14, upBot = G - 72;
  const grid = (cols, rowH, ww, wh) => { for (let yy = upTop; yy + wh <= upBot; yy += rowH) for (let c = 0; c < cols; c++) win(x + (w / cols) * c + (w / cols - ww) / 2, yy, ww, wh); };
  const a = { o, x, w, h, top, upTop, upBot, base, trim, locked, fitted, winLit, win, grid, G, RND };
  if (B.upper) B.upper(a);
  // fascia with the name, and the shopfront bays below it
  o.push(`<rect x="${x + 4}" y="${G - 70}" width="${w - 8}" height="16" fill="#14171d"/><text x="${x + w / 2}" y="${G - 58.5}" text-anchor="middle" class="sc-sign" style="fill:${trim}">${scEsc(b.sign)}</text>`);
  if (B.front) B.front(a);
  const inst = st === 'rival' ? rivalInstall(p) : p.install;
  const n = inst ? inst.length : (p.contract ? p.contract.slots : KINDS[p.kind].slots);
  const fx0 = x + 6, bw = (w - 12) / n;
  for (let i = 0; i < n; i++) o.push(bayArt(inst ? inst[i] : null, fx0 + i * bw, bw, st === 'rival' ? 'fitted' : st));
  // a landmark behind hoardings shows the research it's waiting for
  if (b.hoarding && locked && plotNeeds(p).length) {
    const needs = plotNeeds(p);
    o.push(`<rect x="${x - 4}" y="${G - 70}" width="${w + 8}" height="70" fill="#5a4a36"/><rect x="${x}" y="${G - 66}" width="${w}" height="62" fill="none" stroke="#3a2f22" stroke-width="2"/>`);
    o.push(`<text x="${x + 12}" y="${G - 52}" class="sc-small" style="fill:#f3c56b">${b.hoarding}</text>`);
    needs.forEach((k, j) => { const ok = !!S.unlocks[k]; o.push(`<text x="${x + 12}" y="${G - 38 + j * 13}" class="sc-need" style="fill:${ok ? '#6fcf97' : '#ece6d8'}">${ok ? '✓' : '○'} ${scEsc(techName(k))}</text>`); });
    o.push(`<text x="${x + w - 12}" y="${G - 12}" text-anchor="end" class="sc-need" style="fill:${rep(S) >= p.rep ? '#6fcf97' : '#ece6d8'}">${rep(S) >= p.rep ? '✓' : '○'} ${p.rep}★</text>`);
  }
  if (B.after) B.after(a);
  return { svg: o.join(''), w, top: top - (b.labelTop || 8) };
}

export function firmArt(x, w) {
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
export function streetSVG() {
  const m = S.month % 12, season = scSeason(m), ev = eventOf(S.month), evk = ev ? ev.key : '';
  const sky = SKY[evk === 'heatwave' ? 'heatwave' : evk === 'storm' ? 'storm' : season];
  const GAP = 46, X0 = 30;
  // lay the buildings out along the street
  const plots = S.plots.filter(p => streetOf(p) === (S.street || 'high'));
  const home = (S.street || 'high') === 'high', firmW = [130, 170, 214][S.premises || 0];
  const docks = S.street === 'docks', yardW = 120;   // on the Docks, your yard comes first
  let x = X0 + (home ? firmW + GAP : docks ? yardW + GAP : 0); const placed = plots.map(p => { const at = x; x += BUILDING[p.kind].look.w + GAP; return at; });
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
  // the Docks: cranes and a ship's hull behind the sheds
  if (docks) for (let cx = 160; cx < W; cx += 420) {
    o.push(`<g opacity=".85" fill="none" stroke="#3b4656" stroke-width="5"><path d="M${cx} ${G} V${G - 190} M${cx - 30} ${G - 190} H${cx + 120} M${cx} ${G - 150} L${cx + 90} ${G - 190}"/></g><line x1="${cx + 100}" y1="${G - 190}" x2="${cx + 100}" y2="${G - 120}" stroke="#3b4656" stroke-width="1.5"/><rect x="${cx + 88}" y="${G - 120}" width="24" height="14" fill="#c44536" opacity=".8"/>`);
    o.push(`<path d="M${cx + 180} ${G - 60} H${cx + 380} L${cx + 360} ${G - 20} H${cx + 196} Z" fill="#2a3340" opacity=".9"/><rect x="${cx + 250} " y="${G - 92}" width="60" height="32" fill="#2a3340" opacity=".9"/>`);
  }
  // your own firm, first on the High Street: it grows with your premises, staff and record
  if (home) o.push(firmArt(X0, firmW));
  if (docks) o.push(`<g aria-label="Your yard"><rect x="${X0}" y="${G - 96}" width="${yardW}" height="96" fill="#5a4a36"/><path d="M${X0 - 6} ${G - 96} L${X0 + yardW / 2} ${G - 124} L${X0 + yardW + 6} ${G - 96} Z" fill="#3a2f22"/><rect x="${X0 + 4}" y="${G - 70}" width="${yardW - 8}" height="16" fill="#14171d"/><text x="${X0 + yardW / 2}" y="${G - 58.5}" text-anchor="middle" class="sc-sign" style="fill:#d4a94f">YOUR YARD</text><rect x="${X0 + 20}" y="${G - 48}" width="${yardW - 40}" height="48" fill="#2a2f38" stroke="#d4a94f" stroke-width="1.5"/></g>`);
  // buildings (clickable)
  plots.forEach((p, i) => {
    const a = buildingArt(p, placed[i]), st = p.status, bx = placed[i], bw = a.w;
    o.push(`<g class="sbld ${st}" data-i="${p.i}" ${st === 'locked' || st === 'rival' ? '' : 'role="button" tabindex="0"'} aria-label="${scEsc(p.name)}">${a.svg}`);
    // what's going on here, floating above the roofline
    const lbl = st === 'open' ? ['TENDER' + (p.contract && p.contract.solved ? ' · ' + kmoney(feeOf(S, p.contract)) : ''), '#d4a94f', '#1d1608']
      : st === 'callback' && p.reason === 'paradox' ? ['NEW WORK' + (p.contract && p.contract.solved ? ' · ' + kmoney(feeOf(S, p.contract)) : ''), '#d4a94f', '#1d1608']
      : st === 'callback' ? ['CALLBACK', '#ef5b4c', '#1a0a08']
      : st === 'checking' ? ['CHECKING THE DOORS…', 'rgba(20,23,29,.85)', '#9cc4ec']
      : st === 'rival' ? [`${RIVAL} · back in ${Math.max(1, (p.rivalUntil || 0) - S.month)} mo`, 'rgba(60,60,64,.9)', '#c8c2b6']
      : st === 'fitted' && p.broken ? ['BROKEN DOWN · tap to service', '#ef5b4c', '#1a0a08']
      : st === 'fitted' && p.enquiry && !p.enquiry.ready ? [`ENQUIRY · ${techName(p.enquiry.tech)} · ${p.enquiry.by - S.month} mo`, 'rgba(20,23,29,.85)', '#d4a94f']
      : st === 'fitted' ? ['★'.repeat(p.stars) + (p.green ? ' 🌿' : '') + (p.cert ? ' ✓' : '') + ' · ' + kmoney(upkeep(S, p)) + '/mo' + ((p.wear || 0) >= 0.7 ? ' ⚠' : ''), 'rgba(20,23,29,.85)', (p.wear || 0) >= 0.7 ? '#ef8a6a' : '#d4a94f']
      : [rep(S) >= p.rep && !needsMet(S, p) ? (missingNeeds(S, p).length > 1 ? `Needs ${missingNeeds(S, p).length} more research` : 'Needs ' + needsText(S, p)) : p.rep + '★ to bid', 'rgba(20,23,29,.75)', '#8d93a0'];
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
    const gx = bx + BUILDING[plots[i].kind].look.w + GAP / 2;
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
  // the street reacts to your firm: visitors walk in through the doors you fitted, a crowd waits outside work
  // that's on the table, and the rival's van is parked outside what it won (cosmetic: Math.random is fine here)
  const fig = (col, extra = '') => `<circle cx="0" cy="-26" r="4.2" fill="${col}"/><rect x="-4.5" y="-21" width="9" height="16" rx="3" fill="${col}"/><rect x="-3.5" y="-6" width="2.5" height="7" fill="${col}"/><rect x="1" y="-6" width="2.5" height="7" fill="${col}"/>${extra}`;
  plots.forEach((p, i) => {
    const bx = placed[i], bw = BUILDING[p.kind].look.w, st = p.status, inst = st === 'rival' ? rivalInstall(p) : p.install;
    const n = inst ? inst.length : 1, fx0 = bx + 6, sw = (bw - 12) / n;
    const doors = inst ? inst.map((d, j) => d && d.type !== 'wall' ? fx0 + (j + 0.5) * sw : null).filter(x => x != null) : [bx + bw / 2];
    if (st === 'fitted' && !p.broken && doors.length) {
      // two or three visitors heading in, more for a busy client
      const k = 2 + (p.stars >= 3 ? 1 : 0);
      for (let v = 0; v < k; v++) {
        const door = doors[v % doors.length], from = door + (v % 2 ? 1 : -1) * (160 + RND(p.i, v) * 200), d = 10 + RND(v, p.i) * 9;
        o.push(`<g class="visit" style="--x0:${from}px;--x1:${door}px;animation-duration:${d}s;animation-delay:${-RND(p.i * 3, v) * d}s"><g transform="translate(0 ${G + 3 + (v % 2) * 3})">${fig(['#1a1d24', '#2a2530', '#202a30'][v % 3])}</g></g>`);
      }
    }
    if ((st === 'open' || st === 'callback' || st === 'checking') && st !== 'locked') {
      // the job, visible: people bunched up at the door
      const door = doors[0], k = st === 'checking' ? 2 : 4;
      for (let v = 0; v < k; v++) o.push(`<g class="bob" style="animation-delay:${v * 0.4}s"><g transform="translate(${door - 16 + v * 9} ${G + 6 + (v % 2) * 3})">${fig(st === 'callback' ? '#3a2226' : '#22262e')}</g></g>`);
    }
    if (st === 'rival') {
      const vx = bx + bw / 2;
      o.push(`<g transform="translate(${vx} ${G + 38})"><rect x="-38" y="-24" width="76" height="24" rx="4" fill="#6a6e76"/><rect x="22" y="-22" width="14" height="10" rx="2" fill="#9cc4ec" opacity=".7"/><rect x="-34" y="-16" width="52" height="9" fill="#3a3d43"/><text x="-8" y="-9.5" text-anchor="middle" class="sc-small" style="fill:#c8c2b6;font-size:6px">${scEsc(RIVAL.toUpperCase())}</text><circle cx="-22" cy="1" r="5" fill="#111"/><circle cx="22" cy="1" r="5" fill="#111"/></g>`);
    }
  });
  // people on the pavement: busier the more clients you serve on this street
  const served = plots.filter(p => p.status === 'fitted').length;
  const crowd = Math.min(30, (evk === 'blackfriday' ? 26 : evk === 'sales' ? 18 : evk === 'storm' ? 6 : 11) + served * 2);
  // match days on Riverside once the Stadium is yours: fans in club scarves
  const fans = plots.some(p => p.kind === 'stadium' && p.status === 'fitted');
  for (let k = 0; k < crowd; k++) {
    const dir = k % 2 ? 1 : -1, dur = 26 + RND(k, 13) * 22, col = ['#1a1d24', '#2a2530', '#202a30', '#2d2620'][k % 4];
    const pram = evk === 'marathon' && k % 4 === 0, umb = evk === 'storm' || (season === 'winter' && k % 3 === 0 && evk !== 'xmas');
    o.push(`<g class="walker ${dir > 0 ? 'right' : 'left'}" style="animation-duration:${dur}s;animation-delay:${-RND(k, 14) * dur}s;--sw:${W + 40}px">
      <g transform="translate(0 ${G + 4 + (k % 3) * 4})"><circle cx="0" cy="-26" r="4.2" fill="${col}"/><rect x="-4.5" y="-21" width="9" height="16" rx="3" fill="${col}"/><rect x="-3.5" y="-6" width="2.5" height="7" fill="${col}"/><rect x="1" y="-6" width="2.5" height="7" fill="${col}"/>
      ${umb ? `<path d="M-11 -30 q11 -12 22 0 z" fill="${['#ef5b4c', '#9cc4ec', '#d4a94f'][k % 3]}"/><line x1="0" y1="-30" x2="0" y2="-18" stroke="#111" stroke-width="1"/>` : ''}
      ${pram ? `<rect x="${dir * 7}" y="-12" width="10" height="7" rx="2" fill="#b48cf0"/>` : ''}
      ${fans && k % 3 === 1 ? `<rect x="-5" y="-22" width="10" height="3" fill="#ef5b4c"/><rect x="${dir > 0 ? -6 : 3}" y="-20" width="3" height="8" fill="#ef5b4c"/>` : ''}</g></g>`);
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

