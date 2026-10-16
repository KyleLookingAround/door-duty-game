export default {
  key: 'pharmacy',
  plot: { name: 'Corner Pharmacy', rep: 0 },
  kind: { label: 'Pharmacy', slots: 2, in: 0.55, out: 0.5, mix: { elderly: 0.2 }, hook: { twists: ['fragile', 'narrow'], temp: 3 } },
  site({ S, n, HW, cx, last }) {
    for (const x of n > 1 ? [cx(0) - 1.3, cx(last) + 1.3] : [-HW + 0.2, HW - 0.2]) S.obstacles.push({ kind: 'circle', x, y: -0.6, r: 0.12, tag: 'bollard' });
    S.obstacles.push({ kind: 'rect', x0: -HW + 0.15, x1: -HW + 0.55, y0: 0.6, y1: 1.8, tag: 'shelf' });
    S.labels.push({ x: -HW + 0.35, y: 2.05, text: 'Display' });
  },
  floor: { base: '#2b3634', kind: 'tiles', size: 0.5, line: 'rgba(236,245,240,.06)' },
  look: { w: 140, h: 138, base: '#2f5a5a', trim: '#cfe3dc', sign: 'PHARMACY', labelTop: 8 },
  upper({ o, x, w, top, grid, locked }) {
    grid(2, 34, 30, 24);
    o.push(`<g transform="translate(${x + w - 4} ${top + 40})"><rect x="0" y="-2" width="14" height="3" fill="#5a5a5a"/><rect x="10" y="-12" width="22" height="22" rx="3" fill="#1f3a2e"/><path d="M18 -8h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#6fcf97" class="${locked ? '' : 'glow'}" transform="translate(-3 1) scale(.9)"/></g>`);
  },
};
