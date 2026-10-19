// The ferry terminal on the Docks: everyone comes ashore at once. At 22 seconds a ferry ties up and its foot
// passengers pour out through the doors with their cases (the cinema's rush), while the next sailing's passengers
// are still coming in, and the wind off the water comes straight through an open door.
export default {
  key: 'ferry',
  plot: { name: 'Ferry Terminal', rep: 44, street: 'docks' },
  kind: { label: 'Ferry terminal', slots: 3, in: 0.85, out: 0.2, mix: { case: 0.35, pram: 0.04 }, cinema: true, hook: { twists: ['wind'], temp: 8 } },
  site({ S, HW }) {
    // the ticket desk, and benches for the next sailing
    S.obstacles.push({ kind: 'rect', x0: -HW + 0.3, x1: -HW + 1.9, y0: 1.5, y1: 1.9, tag: 'desk' }); S.labels.push({ x: -HW + 1.1, y: 2.15, text: 'Tickets' });
    S.obstacles.push({ kind: 'rect', x0: HW - 1.9, x1: HW - 0.3, y0: 1.8, y1: 2.15, tag: 'bench' }); S.labels.push({ x: HW - 1.1, y: 2.4, text: 'Next sailing' });
    S.labels.push({ x: 0, y: 3.35, text: 'Gangway' });
  },
  floor: { base: '#26303a', kind: 'tiles', size: 0.8, line: 'rgba(156,196,236,.08)' },
  look: { w: 210, h: 140, base: '#d8dee4', trim: '#2f5f8a', sign: 'FERRY TERMINAL', labelTop: 30 },
  upper({ o, x, w, top, trim, G }) {
    // a departures board over the doors, and a ship's funnel and mast behind the roof
    o.push(`<rect x="${x + w - 70}" y="${top - 44}" width="34" height="44" fill="#c44536"/><rect x="${x + w - 70}" y="${top - 44}" width="34" height="8" fill="#1c1a17"/><line x1="${x + 30}" y1="${top}" x2="${x + 30}" y2="${top - 52}" stroke="#5e6b78" stroke-width="3"/>`);
    o.push(`<rect x="${x + 10}" y="${G - 96}" width="${w - 20}" height="22" fill="#14171d" stroke="${trim}" stroke-width="1.5"/><text x="${x + w / 2}" y="${G - 81}" text-anchor="middle" class="sc-small" style="fill:#f3c56b">NEXT SAILING · ON TIME</text>`);
    for (let c = 0; c < 6; c++) o.push(`<circle cx="${x + 24 + c * (w - 48) / 5}" cy="${top + 22}" r="8" fill="rgba(156,196,236,.5)" stroke="${trim}" stroke-width="2"/>`);
  },
  brief: () => `<p><strong style="color:var(--text)">The ferry docks.</strong> At 22 seconds a ferry ties up and its passengers come ashore at once with their cases, while the next sailing's passengers are still coming in.</p>`,
  chips: () => [['Ferry docks at 22s', 'brass']],
  phases: ['NEXT SAILING CHECKING IN', 'FERRY DOCKS · EVERYONE ASHORE', 'BACK TO NORMAL'],
};
