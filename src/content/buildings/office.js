export default {
  key: 'office',
  plot: { name: 'Atlas House', rep: 4 },
  kind: { label: 'Office block', slots: 3, in: 2.0, out: 0.4, mix: {}, hook: { twists: ['surge'], temp: 6, budgetCap: 32000 } },
  site({ S, cx, last }) {
    S.obstacles.push({ kind: 'rect', x0: -1.2, x1: 1.2, y0: 1.5, y1: 2.0, tag: 'desk' });
    S.obstacles.push({ kind: 'rect', x0: cx(last) - 0.5, x1: cx(last) + 0.5, y0: -2.45, y1: -2.05, tag: 'bench' });
    S.labels.push({ x: 0, y: 2.3, text: 'Reception' });
    S.labels.push({ x: cx(last), y: -2.75, text: 'Smokers\' bench' });
  },
  floor: { base: '#252b33', kind: 'tiles', size: 1.0, line: 'rgba(156,196,236,.07)' },
  look: { w: 190, h: 226, base: '#2c3a4c', trim: '#9cc4ec', sign: 'ATLAS HOUSE', labelTop: 8 },
  upper({ o, x, upTop, upBot, fitted, locked, RND }) {
    for (let yy = upTop; yy + 14 <= upBot; yy += 18) for (let c = 0; c < 7; c++) o.push(`<rect x="${x + 8 + c * 25.5}" y="${yy}" width="21" height="14" fill="${fitted ? (RND(c, yy) > 0.35 ? 'rgba(156,196,236,.55)' : 'rgba(243,197,107,.7)') : locked ? '#232a35' : 'rgba(156,196,236,.25)'}"/>`);
  },
};
