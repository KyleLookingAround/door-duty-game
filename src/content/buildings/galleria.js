// The Galleria: a two-level shopping centre whose new footbridge made getting out slower (Braess's paradox).
export default {
  key: 'galleria',
  plot: { name: 'The Galleria', rep: 33, street: 'riverside', needs: ['permits'], why: 'They need a firm allowed to close routes' },
  kind: { label: 'Shopping centre', slots: 3, in: 1, out: 1, mix: { pram: 0.06 }, hook: { twists: [], temp: 12 } },
  jobs: [{ stage: 'braess' }],
  inside: {},
  site() {},
  floor: { base: '#34302c', kind: 'check', size: 1.0, alt: '#3a3530' },
  look: { w: 240, h: 140, base: '#b9a58c', trim: '#f2e7d6', sign: 'THE GALLERIA', labelTop: 12, hoarding: 'NEW FOOTBRIDGE' },
  upper({ o, x, w, top, upTop, upBot, trim }) {
    // a glass barrel roof and two floors of shop windows with a bridge between
    o.push(`<path d="M${x + 20} ${top} Q${x + w / 2} ${top - 40} ${x + w - 20} ${top}" fill="rgba(156,196,236,.3)" stroke="${trim}" stroke-width="3"/>`);
    for (let c = 0; c < 6; c++) for (const yy of [upTop + 4, upTop + 34]) o.push(`<rect x="${x + 10 + c * (w - 20) / 6}" y="${yy}" width="${(w - 20) / 6 - 8}" height="22" fill="rgba(243,197,107,.45)" stroke="${trim}" stroke-width="1"/>`);
    o.push(`<rect x="${x + w / 2 - 30}" y="${upTop + 28}" width="60" height="5" fill="${trim}"/>`);
  },
};
