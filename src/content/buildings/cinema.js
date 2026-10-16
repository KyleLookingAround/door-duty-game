// Everyone leaves at once when the film ends.
export default {
  key: 'cinema',
  plot: { name: 'The Roxy', rep: 18, street: 'market' },
  kind: { label: 'Cinema', slots: 2, in: 0.8, out: 0.15, mix: {}, cinema: true, hook: { twists: [], temp: 9 } },
  site({ S, HW }) {
    // poster stands either side, and the screens empty out at the back of the foyer
    for (const x of [-HW + 0.35, HW - 0.35]) S.obstacles.push({ kind: 'rect', x0: x - 0.2, x1: x + 0.2, y0: -1.1, y1: -0.6, tag: 'poster' });
    S.obstacles.push({ kind: 'rect', x0: -0.9, x1: 0.9, y0: 1.4, y1: 1.85, tag: 'desk' }); S.labels.push({ x: 0, y: 2.1, text: 'Popcorn' });
    S.labels.push({ x: 0, y: 3.35, text: 'Screens' });
  },
  floor: { base: '#3a2230', kind: 'carpet', border: 'rgba(212,169,79,.35)' },
  look: { w: 176, h: 150, base: '#2a1f33', trim: '#f3c56b', sign: 'THE ROXY', labelTop: 32 },
  upper({ o, x, w, top, trim, locked, G }) {
    // the marquee: a lit board of bulbs over the doors, and a blade sign up the front
    o.push(`<rect x="${x - 6}" y="${G - 100}" width="${w + 12}" height="30" fill="#14171d" stroke="${trim}" stroke-width="2"/><text x="${x + w / 2}" y="${G - 80}" text-anchor="middle" class="sc-sign" style="fill:#f3c56b">NOW SHOWING</text>`);
    for (let k = 0; k < 22; k++) o.push(`<circle cx="${x - 2 + k * (w + 4) / 21}" cy="${G - 102}" r="2" fill="#f3c56b" class="${locked ? '' : 'twinkle'}" style="animation-delay:${(k % 5) * 0.2}s"/>`);
    o.push(`<rect x="${x + w / 2 - 14}" y="${top - 30}" width="28" height="${G - 104 - top + 30}" fill="#3a2440" stroke="${trim}" stroke-width="1.5"/>${'ROXY'.split('').map((ch, k) => `<text x="${x + w / 2}" y="${top - 12 + k * 17}" text-anchor="middle" class="sc-sign" style="fill:#ef5b4c;font-size:14px">${ch}</text>`).join('')}`);
  },
  brief: () => `<p><strong style="color:var(--text)">Showtime.</strong> At 22 seconds the film ends and the whole audience heads out at once, while the next queue is still coming in.</p>`,
  chips: () => [['Film ends at 22s', 'brass']],
  phases: ['FILM SHOWING · NEXT QUEUE ARRIVING', 'FILM ENDS · EVERYONE OUT', 'NEXT SCREENING'],
};
