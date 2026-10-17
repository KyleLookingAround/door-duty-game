import { SLOT_W } from '../../engine/world.js';
export default {
  key: 'townhall',
  plot: { name: 'Town Hall', rep: 14 },
  kind: { label: 'Town hall', slots: 3, in: 1.1, out: 0.9, mix: { elderly: 0.15 }, comfort: 16, hook: { twists: ['stepfree', 'surge'], temp: 9 } },
  inside: { paternoster: { speed: 0.45, wide: false, attendant: false } },   // found behind a wall, running too fast
  site({ S, n, HW, cx }) {
    // portico columns flank each doorway
    for (let i = 0; i <= n; i++) S.obstacles.push({ kind: 'circle', x: -HW + i * SLOT_W, y: -1.5, r: 0.32, tag: 'column' });
    S.labels.push({ x: cx(0), y: -2.15, text: 'Portico' });
  },
  floor: { base: '#302d28', kind: 'check', size: 0.9, alt: '#38342e' },
  look: { w: 214, h: 170, base: '#8a7f6a', trim: '#efe6d0', sign: 'TOWN HALL', labelTop: 132 },
  upper({ o, x, w, top, base, trim, grid }) {
    const tw = 46, tx = x + w / 2 - tw / 2;
    o.push(`<rect x="${tx}" y="${top - 70}" width="${tw}" height="70" fill="${base}"/><polygon points="${tx - 4},${top - 70} ${x + w / 2},${top - 112} ${tx + tw + 4},${top - 70}" fill="#4b5560"/>`);
    o.push(`<circle cx="${x + w / 2}" cy="${top - 40}" r="14" fill="${trim}" stroke="#3a3328" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 40}" x2="${x + w / 2}" y2="${top - 50}" stroke="#2a241c" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 40}" x2="${x + w / 2 + 6}" y2="${top - 37}" stroke="#2a241c" stroke-width="2"/>`);
    o.push(`<line x1="${x + w / 2}" y1="${top - 112}" x2="${x + w / 2}" y2="${top - 132}" stroke="#ccc" stroke-width="1.5"/><path d="M${x + w / 2} ${top - 132} l16 4 l-16 5z" fill="#ef5b4c" class="flag"/>`);
    grid(5, 40, 20, 30);
  },
};
