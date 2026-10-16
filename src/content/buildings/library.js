export default {
  key: 'library',
  plot: { name: 'Carnegie Library', rep: 8 },
  kind: { label: 'Library', slots: 3, in: 0.9, out: 0.8, mix: { elderly: 0.2 }, comfort: 16, hook: { twists: ['stepfree', 'fragile'], temp: 8 } },
  site({ S, n, cx, last }) {
    if (n >= 3) {
      S.rampBays = [1];
      for (const i of [0, 2]) S.decos.push({ kind: 'steps', x0: cx(i) - 1.5, x1: cx(i) + 1.5, y0: -0.85, y1: -0.08 });
      S.decos.push({ kind: 'ramp', x0: cx(1) - 1.5, x1: cx(1) + 1.5, y0: -0.85, y1: -0.08 });
      S.labels.push({ x: cx(1), y: -1.1, text: 'Ramp' });
    }
    S.obstacles.push({ kind: 'circle', x: cx(last) + 1.0, y: -1.7, r: 0.24, tag: 'returns' });
  },
  floor: { base: '#3a2e22', kind: 'parquet', line: 'rgba(0,0,0,.25)' },
  look: { w: 206, h: 160, base: '#a08a62', trim: '#f0e4c4', sign: 'PUBLIC LIBRARY', labelTop: 64 },
  upper({ o, x, w, top, upTop, trim, win }) {
    o.push(`<path d="M${x + w / 2 - 44} ${top - 4} A44 40 0 0 1 ${x + w / 2 + 44} ${top - 4} Z" fill="#6f8a7a"/><rect x="${x + w / 2 - 5}" y="${top - 58}" width="10" height="14" fill="${trim}"/><circle cx="${x + w / 2}" cy="${top - 60}" r="4" fill="#d4a94f"/>`);
    for (let c = 0; c < 5; c++) win(x + 14 + c * (w - 28) / 5 + 4, upTop + 6, 24, 38);
  },
  after({ o, x, w, G }) {   // the library steps
    for (let k = 0; k < 3; k++) o.push(`<rect x="${x - 6 + k * 4}" y="${G + k * 4}" width="${w + 12 - k * 8}" height="4" fill="#b7a27a" opacity="${0.9 - k * 0.2}"/>`);
  },
};
