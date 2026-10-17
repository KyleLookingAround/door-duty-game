// Skyport: an airport terminal, all inside work. A long pier to passport control, then baggage reclaim.
// Its levels: the pier walkway, baggage reclaim, or the whole arrival (pier and passport control, then reclaim) as one chain.
export default {
  key: 'skyport',
  plot: { name: 'Skyport Terminal', rep: 30, street: 'riverside', needs: ['travelator'], why: 'The new terminal wants a firm that knows travelators' },
  kind: { label: 'Airport', slots: 3, in: 1, out: 1, mix: { case: 0.4 }, hook: { twists: [], temp: 12 } },
  jobs: [{ stage: 'walkway' }, { stage: 'carousel' }, { chain: ['walkway', 'carousel'] }],
  inside: { walkway: { belt: 0 }, carousel: { belts: 1 } },
  site() {},
  floor: { base: '#2c3138', kind: 'tiles', size: 1.2, line: 'rgba(0,0,0,.25)' },
  look: { w: 260, h: 150, base: '#5f6f7e', trim: '#dfe8ee', sign: 'SKYPORT', labelTop: 16, hoarding: 'TERMINAL 2 · OPENING SOON' },
  upper({ o, x, w, top, upBot, trim }) {
    // a long glass curtain wall under a curved roof, and a control tower behind
    o.push(`<rect x="${x + w - 46}" y="${top - 70}" width="16" height="70" fill="#4b5966"/><rect x="${x + w - 54}" y="${top - 86}" width="32" height="18" rx="4" fill="#9cc4ec" opacity=".8"/>`);
    o.push(`<path d="M${x - 6} ${top + 4} Q${x + w / 2} ${top - 34} ${x + w + 6} ${top + 4}" fill="none" stroke="${trim}" stroke-width="6"/>`);
    for (let c = 0; c < 12; c++) o.push(`<rect x="${x + 8 + c * (w - 16) / 12}" y="${top + 10}" width="${(w - 16) / 12 - 3}" height="${upBot - top - 14}" fill="rgba(156,196,236,.35)" stroke="${trim}" stroke-width=".8"/>`);
  },
};
