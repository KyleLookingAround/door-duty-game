export default {
  key: 'hotel',
  plot: { name: 'The Wren Hotel', rep: 6 },
  kind: { label: 'Hotel', slots: 3, in: 1.0, out: 1.0, mix: { case: 0.4 }, comfort: 18, hook: { twists: ['listed'], temp: 7 } },
  site({ S, HW, cx }) {
    S.spawnIn = { x: -HW + 1.0, spread: 0.9, p: 0.55 };
    S.decos.push({ kind: 'taxi', x: -HW + 0.6, y: -3.0 });
    S.obstacles.push({ kind: 'rect', x0: cx(0) + 0.75, x1: cx(0) + 1.3, y0: 1.2, y1: 1.85, tag: 'trolley' });
    S.labels.push({ x: -HW + 1.3, y: -2.55, text: 'Taxi rank' });
  },
  floor: { base: '#3a2230', kind: 'carpet', border: 'rgba(212,169,79,.35)' },
  look: { w: 200, h: 196, base: '#5a3646', trim: '#ead6c0', sign: 'THE WREN', labelTop: 40 },
  upper({ o, x, w, top, upTop, upBot, trim, grid, G }) {
    grid(4, 32, 22, 22);
    for (let yy = upTop + 24; yy < upBot; yy += 32) o.push(`<rect x="${x + 6}" y="${yy}" width="${w - 12}" height="3" fill="${trim}" opacity=".6"/>`);
    for (const fx of [x + 16, x + w - 16]) o.push(`<line x1="${fx}" y1="${top - 6}" x2="${fx}" y2="${top - 40}" stroke="#ccc" stroke-width="1.5"/><path d="M${fx} ${top - 40} l18 4 l-18 5z" fill="#d4a94f" class="flag"/>`);
    o.push(`<rect x="${x + w / 2 - 50}" y="${G - 66}" width="100" height="10" fill="#2a1820"/><rect x="${x + w / 2 - 50}" y="${G - 58}" width="2" height="58" fill="#d4a94f"/><rect x="${x + w / 2 + 48}" y="${G - 58}" width="2" height="58" fill="#d4a94f"/>`);
  },
};
