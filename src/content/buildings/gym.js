export default {
  key: 'gym',
  plot: { name: 'Ironworks Gym', rep: 19, street: 'market' },
  kind: { label: 'Gym', slots: 2, in: 1.3, out: 1.2, mix: { bike: 0.12 }, hook: { twists: ['bikes', 'wind'], temp: 7 } },
  site({ S, HW }) {
    // bike racks along the pavement
    for (let k = 0; k < 3; k++) S.obstacles.push({ kind: 'rect', x0: -HW + 0.3 + k * 0.5, x1: -HW + 0.36 + k * 0.5, y0: -2.5, y1: -1.9, tag: 'rack' });
    S.labels.push({ x: -HW + 0.85, y: -2.75, text: 'Bike racks' });
    S.obstacles.push({ kind: 'rect', x0: HW - 1.6, x1: HW - 0.3, y0: 1.5, y1: 1.95, tag: 'desk' }); S.labels.push({ x: HW - 0.95, y: 2.2, text: 'Turnstile desk' });
  },
  floor: { base: '#252b33', kind: 'tiles', size: 1.0, line: 'rgba(156,196,236,.07)' },
  look: { w: 176, h: 128, base: '#2c3a4c', trim: '#6fcf97', sign: 'IRONWORKS GYM', labelTop: 8 },
  upper({ o, x, w, upTop, upBot, trim, fitted, locked }) {
    for (let c = 0; c < 2; c++) o.push(`<rect x="${x + 10 + c * (w - 20) / 2}" y="${upTop}" width="${(w - 20) / 2 - 8}" height="${upBot - upTop - 6}" fill="${fitted ? 'rgba(156,196,236,.45)' : locked ? '#232a35' : 'rgba(156,196,236,.2)'}" stroke="${trim}" stroke-width="1.5"/>`);
    if (!locked) for (let k = 0; k < 4; k++) o.push(`<g transform="translate(${x + 28 + k * 36} ${upBot - 10})"><circle cx="0" cy="-14" r="3.5" fill="#1d2129"/><rect x="-3" y="-11" width="6" height="11" fill="#1d2129"/><circle cx="-6" cy="2" r="4" fill="none" stroke="#1d2129" stroke-width="1.5"/><circle cx="6" cy="2" r="4" fill="none" stroke="#1d2129" stroke-width="1.5"/></g>`);
    o.push(`<rect x="${x}" y="${upBot - 2}" width="${w}" height="5" fill="${trim}"/>`);
  },
};
