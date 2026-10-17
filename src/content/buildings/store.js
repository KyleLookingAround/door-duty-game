export default {
  key: 'store',
  plot: { name: "Halden's", rep: 11 },
  kind: { label: 'Department store', slots: 4, in: 1.8, out: 1.4, mix: { elderly: 0.1, case: 0.1 }, hook: { twists: ['nofire', 'cold'], temp: 2 } },
  inside: { escalator: { count: 1, rule: 'stand' } },   // they've put up "stand on both sides" signs
  site({ S, n, HW, cx, person }) {
    S.surge = { every: 9, n: 6, x: -HW + 1.3, spread: 0.9 };
    S.decos.push({ kind: 'shelter', x0: -HW + 0.2, x1: -HW + 2.4, y0: -3.45, y1: -3.05 });
    S.labels.push({ x: -HW + 1.3, y: -2.75, text: 'Bus stop' });
    if (n >= 2) { const bx = cx(0) + 1.5; person(bx - 0.28, -1.15); person(bx + 0.27, -1.2); S.labels.push({ x: bx, y: -1.6, text: 'Window shoppers' }); }
  },
  floor: { base: '#332c25', kind: 'tiles', size: 0.9, line: 'rgba(236,230,216,.06)' },
  look: { w: 250, h: 178, base: '#6b4a32', trim: '#e9c98a', sign: "HALDEN'S", labelTop: 32 },
  upper({ o, x, w, top, upTop, trim, win }) {
    for (let c = 0; c < 4; c++) win(x + 12 + c * (w - 24) / 4, upTop + 4, (w - 24) / 4 - 10, 40);
    for (let c = 0; c < 4; c++) win(x + 12 + c * (w - 24) / 4, upTop + 54, (w - 24) / 4 - 10, 24);
    o.push(`<circle cx="${x + w / 2}" cy="${top - 14}" r="16" fill="${trim}" stroke="#3a2a1a" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 14}" x2="${x + w / 2}" y2="${top - 25}" stroke="#2a1f14" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 14}" x2="${x + w / 2 + 7}" y2="${top - 12}" stroke="#2a1f14" stroke-width="2"/>`);
  },
};
