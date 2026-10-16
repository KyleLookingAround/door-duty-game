export default {
  key: 'museum',
  plot: { name: 'Corn Exchange Museum', rep: 18, street: 'market' },
  kind: { label: 'Museum', slots: 3, in: 0.9, out: 0.8, mix: { elderly: 0.25, pram: 0.05 }, comfort: 18, hook: { twists: ['listed', 'stepfree'], temp: 6 } },
  site({ S, n, HW, cx, last }) {
    // grand steps with a ramp at one end, and a school party waiting by the railings
    if (n >= 3) { S.rampBays = [n - 1]; for (let i = 0; i < n - 1; i++) S.decos.push({ kind: 'steps', x0: cx(i) - 1.5, x1: cx(i) + 1.5, y0: -0.85, y1: -0.08 }); S.decos.push({ kind: 'ramp', x0: cx(last) - 1.5, x1: cx(last) + 1.5, y0: -0.85, y1: -0.08 }); S.labels.push({ x: cx(last), y: -1.1, text: 'Ramp' }); }
    S.obstacles.push({ kind: 'rect', x0: -HW + 0.3, x1: -HW + 1.6, y0: -2.6, y1: -2.15, tag: 'queue' });
    for (let k = 0; k < 3; k++) S.decos.push({ kind: 'queuer', x: -HW + 0.5 + k * 0.45, y: -2.38 });
    S.labels.push({ x: -HW + 0.95, y: -2.8, text: 'School party' });
    S.obstacles.push({ kind: 'rect', x0: -1.0, x1: 1.0, y0: 1.7, y1: 2.2, tag: 'desk' }); S.labels.push({ x: 0, y: 2.45, text: 'Cloakroom' });
  },
  floor: { base: '#302d28', kind: 'check', size: 0.9, alt: '#38342e' },
  look: { w: 224, h: 168, base: '#9a8f78', trim: '#efe6d0', sign: 'CORN EXCHANGE MUSEUM', labelTop: 44 },
  upper({ o, x, w, top, upTop, upBot, base, trim }) {
    o.push(`<polygon points="${x - 6},${top - 6} ${x + w / 2},${top - 44} ${x + w + 6},${top - 6}" fill="${trim}"/><polygon points="${x + 16},${top - 10} ${x + w / 2},${top - 36} ${x + w - 16},${top - 10}" fill="${base}"/>`);
    for (let c = 0; c < 6; c++) o.push(`<rect x="${x + 10 + c * (w - 28) / 5}" y="${top + 4}" width="8" height="${upBot - top}" fill="${trim}"/>`);
    for (const [bx2, col] of [[x + 40, '#b8483a'], [x + w - 56, '#3d5a7a']]) o.push(`<rect x="${bx2}" y="${upTop + 4}" width="16" height="56" fill="${col}"/><polygon points="${bx2},${upTop + 60} ${bx2 + 8},${upTop + 52} ${bx2 + 16},${upTop + 60}" fill="${base}"/>`);
  },
};
