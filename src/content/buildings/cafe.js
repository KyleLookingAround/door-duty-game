export default {
  key: 'cafe',
  plot: { name: 'Lark Café', rep: 0 },
  kind: { label: 'Café', slots: 2, in: 0.7, out: 0.7, mix: {}, hook: { twists: ['tight'], temp: 13 } },
  site({ S, n, HW, cx, last }) {
    const x0 = n > 1 ? cx(0) - 0.9 : -HW + 0.25, x1 = n > 1 ? cx(0) + 0.5 : -HW + 0.95;
    S.obstacles.push({ kind: 'rect', x0, x1, y0: -2.2, y1: -1.3, tag: 'tables' });
    S.obstacles.push({ kind: 'circle', x: cx(last) + 1.15, y: -0.75, r: 0.16, tag: 'aboard' });
    S.labels.push({ x: (x0 + x1) / 2, y: -2.45, text: 'Café tables' });
  },
  floor: { base: '#3a2a20', kind: 'boards', line: 'rgba(0,0,0,.28)', hi: 'rgba(236,200,150,.05)' },
  look: { w: 150, h: 118, base: '#7a4a3a', trim: '#e8d9bf', sign: 'LARK CAFÉ', labelTop: 8 },
  upper({ o, x, w, upTop, grid }) {
    grid(3, 34, 22, 24);
    for (let c = 0; c < 3; c++) o.push(`<rect x="${x + (w / 3) * c + (w / 3 - 26) / 2}" y="${upTop + 25}" width="26" height="5" fill="#4f7a3f"/>`);
  },
  front({ o, x, w, G }) {   // striped awning over the shopfront
    const n = 10;
    for (let k = 0; k < n; k++) o.push(`<polygon points="${x + 2 + k * (w - 4) / n},${G - 54} ${x + 2 + (k + 1) * (w - 4) / n},${G - 54} ${x + 2 + (k + 1) * (w - 4) / n + 2},${G - 42} ${x + 2 + k * (w - 4) / n + 2},${G - 42}" fill="${k % 2 ? '#e8d9bf' : '#b8483a'}"/>`);
  },
};
