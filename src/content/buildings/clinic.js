export default {
  key: 'clinic',
  plot: { name: 'Market Health Centre', rep: 20, street: 'market' },
  kind: { label: 'Health centre', slots: 2, in: 0.7, out: 0.6, mix: { elderly: 0.35, wheel: 0.05, pram: 0.06 }, comfort: 18, hook: { twists: ['stepfree', 'fragile'], temp: 10 } },
  site({ S, n, HW, cx }) {
    // a ramp on the left bay, waiting-room chairs inside
    if (n >= 2) { S.rampBays = [0]; S.decos.push({ kind: 'ramp', x0: cx(0) - 1.5, x1: cx(0) + 1.5, y0: -0.85, y1: -0.08 }); for (let i = 1; i < n; i++) S.decos.push({ kind: 'steps', x0: cx(i) - 1.5, x1: cx(i) + 1.5, y0: -0.85, y1: -0.08 }); S.labels.push({ x: cx(0), y: -1.1, text: 'Ramp' }); }
    S.obstacles.push({ kind: 'rect', x0: HW - 1.9, x1: HW - 0.2, y0: 1.8, y1: 2.15, tag: 'bench' }); S.labels.push({ x: HW - 1.05, y: 2.4, text: 'Waiting room' });
  },
  floor: { base: '#2b3634', kind: 'tiles', size: 0.5, line: 'rgba(236,245,240,.06)' },
  look: { w: 176, h: 122, base: '#cfc8b8', trim: '#3d5a7a', sign: 'HEALTH CENTRE', labelTop: 8 },
  upper({ o, x, w, top, trim, grid }) {
    grid(3, 30, 26, 18);
    o.push(`<rect x="${x}" y="${top + 4}" width="${w}" height="6" fill="${trim}"/><g transform="translate(${x + w - 26} ${top + 26})"><rect x="-12" y="-12" width="24" height="24" rx="4" fill="${trim}"/><path d="M-3 -8h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#ece6d8"/></g>`);
  },
};
