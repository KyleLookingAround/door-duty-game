export default {
  key: 'bank',
  plot: { name: 'Mercer & Sons Bank', rep: 2, needs: 'mouth', why: 'Their corner is a wind tunnel' },
  kind: { label: 'Bank', slots: 2, in: 0.9, out: 0.8, mix: {}, hook: { twists: ['wind'], temp: 1 } },
  site({ S, n, HW, cx, person }) {
    // the cash machine sits in the wall beside bay 1; its queue snakes along the pavement across bay 1's approach
    const ax = n > 1 ? cx(0) + 1.3 : HW - 0.3;
    S.decos.push({ kind: 'atm', x: ax, y: -0.08 });
    // two at the machine, the rest lined up along the pavement: one solid obstacle people route round
    person(ax + 0.05, -0.48); person(ax + 0.1, -1.0);
    S.obstacles.push({ kind: 'rect', x0: ax - 1.85, x1: ax - 0.05, y0: -2.48, y1: -2.02, tag: 'queue' });
    for (let k = 0; k < 4; k++) S.decos.push({ kind: 'queuer', x: ax - 0.3 - k * 0.46, y: -2.25 + (k % 2 ? 0.04 : -0.04) });
    S.labels.push({ x: ax - 1.2, y: -2.6, text: 'Cash machine queue' });
  },
  floor: { base: '#2d2b29', kind: 'check', size: 0.75, alt: '#363330' },
  look: { w: 186, h: 168, base: '#8d8471', trim: '#ece2c8', sign: 'MERCER & SONS', labelTop: 40 },
  upper({ o, x, w, top, upTop, upBot, base, trim, win }) {
    o.push(`<polygon points="${x - 4},${top - 6} ${x + w / 2},${top - 40} ${x + w + 4},${top - 6}" fill="${trim}"/><polygon points="${x + 14},${top - 10} ${x + w / 2},${top - 32} ${x + w - 14},${top - 10}" fill="${base}"/>`);
    for (let c = 0; c < 5; c++) o.push(`<rect x="${x + 12 + c * (w - 32) / 4}" y="${top + 6}" width="8" height="${upBot - top - 2}" fill="${trim}" opacity=".9"/>`);
    for (let c = 0; c < 4; c++) win(x + 26 + c * (w - 32) / 4, upTop + 10, 18, 40);
  },
};
