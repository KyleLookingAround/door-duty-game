// The harbour hospital on the Docks: the busiest step-free entrance in town. Wheelchairs, beds being wheeled in,
// prams and frail visitors, both ways all day, and the porters need the doors kept clear.
export default {
  key: 'hospital',
  plot: { name: 'Harbour Hospital', rep: 48, street: 'docks', needs: ['autoswing'], why: 'A hospital entrance has to be step-free: it wants automatic openers' },
  kind: { label: 'Hospital', slots: 3, in: 1.1, out: 0.9, mix: { elderly: 0.3, wheel: 0.08, pram: 0.06 }, comfort: 19, hook: { twists: ['stepfree', 'fragile'], temp: 9 } },
  // no tour groups or cyclists at a hospital entrance
  twistPool: ['tight', 'fragile', 'narrow', 'wind', 'surge', 'stepfree', 'nofire', 'cold', 'rain', 'drill', 'kids'],
  site({ S, n, HW, cx }) {
    // a ramp up to the first bay, the outpatients' desk and a row of seats inside
    if (n >= 2) { S.rampBays = [0]; S.decos.push({ kind: 'ramp', x0: cx(0) - 1.5, x1: cx(0) + 1.5, y0: -0.85, y1: -0.08 }); for (let i = 1; i < n; i++) S.decos.push({ kind: 'steps', x0: cx(i) - 1.5, x1: cx(i) + 1.5, y0: -0.85, y1: -0.08 }); S.labels.push({ x: cx(0), y: -1.1, text: 'Ramp' }); }
    S.obstacles.push({ kind: 'rect', x0: -0.9, x1: 0.9, y0: 1.6, y1: 2.0, tag: 'desk' }); S.labels.push({ x: 0, y: 2.25, text: 'Outpatients' });
    S.obstacles.push({ kind: 'rect', x0: HW - 1.9, x1: HW - 0.2, y0: 2.0, y1: 2.35, tag: 'bench' });
  },
  floor: { base: '#2b3436', kind: 'tiles', size: 0.5, line: 'rgba(236,245,240,.06)' },
  look: { w: 230, h: 190, base: '#d9d4c7', trim: '#2f6f7a', sign: 'HARBOUR HOSPITAL', labelTop: 10 },
  upper({ o, x, w, top, trim, grid }) {
    grid(5, 28, 30, 16);
    o.push(`<rect x="${x}" y="${top + 4}" width="${w}" height="6" fill="${trim}"/><g transform="translate(${x + w - 28} ${top + 30})"><rect x="-13" y="-13" width="26" height="26" rx="4" fill="#c44536"/><path d="M-3 -9h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#ece6d8"/></g>`);
  },
};
