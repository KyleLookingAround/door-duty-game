// The second landmark: the stack effect at the door, and a day in three waves.
export default {
  key: 'towers',
  plot: { name: 'Office Towers', rep: 24, street: 'market', needs: ['vestibule', 'wide', 'heat2'], why: 'The towers only talk to firms that can beat the stack effect' },
  kind: { label: 'Office towers', slots: 4, in: 3.0, out: 2.6, mix: { case: 0.05 }, towers: true, comfort: 19, hook: { twists: [], temp: 4 } },
  twistPool: ['fragile', 'stepfree', 'rain', 'wind', 'bikes'],
  inside: { lifts: { count: 6, mode: 'all' } },
  site({ S, HW }) {
    // a tube exit dumps commuters at one end; security desk and the lift bank inside
    S.surge = { every: 7, n: 7, x: -HW + 1.4, spread: 1.0, until: 16 };
    S.decos.push({ kind: 'shelter', x0: -HW + 0.2, x1: -HW + 2.6, y0: -3.45, y1: -3.05 });
    S.labels.push({ x: -HW + 1.4, y: -2.75, text: 'Underground exit' });
    S.obstacles.push({ kind: 'rect', x0: -1.4, x1: 1.4, y0: 1.6, y1: 2.0, tag: 'desk' }); S.labels.push({ x: 0, y: 2.25, text: 'Security' });
    for (const x of [-HW + 1.5, HW - 1.5]) S.decos.push({ kind: 'lifts', x0: x - 1.1, x1: x + 1.1, y0: 3.0, y1: 3.55 });
    S.labels.push({ x: 0, y: 3.35, text: 'Lifts' });
  },
  floor: { base: '#252b33', kind: 'tiles', size: 1.0, line: 'rgba(156,196,236,.07)' },
  look: { w: 232, h: 222, base: '#25303e', trim: '#9cc4ec', sign: 'OFFICE TOWERS', labelTop: 46, hoarding: 'TO BID FOR THE TOWERS, YOU NEED' },
  upper({ o, x, w, top, upTop, upBot, base, fitted, locked, RND }) {
    for (let yy = upTop; yy + 10 <= upBot; yy += 13) for (let c = 0; c < 9; c++) o.push(`<rect x="${x + 8 + c * 24.5}" y="${yy}" width="20" height="10" fill="${locked ? '#1d2430' : RND(c, yy) > (fitted ? 0.3 : 0.7) ? 'rgba(243,197,107,.6)' : 'rgba(156,196,236,.3)'}"/>`);
    o.push(`<rect x="${x + w / 2 - 30}" y="${top - 20}" width="60" height="20" fill="${base}"/><line x1="${x + w / 2}" y1="${top - 20}" x2="${x + w / 2}" y2="${top - 44}" stroke="#ccc" stroke-width="2"/><circle cx="${x + w / 2}" cy="${top - 45}" r="3" fill="#ef5b4c" class="twinkle"/>`);
  },
  brief: () => `<p><strong style="color:var(--brass)">Landmark job.</strong> A tall building sucks cold air in at its doors (the stack effect): it holds swing doors ajar and pulls air through every opening. The day comes in three waves: 9am in off the underground, lunch both ways, 5pm out. Landmarks pay 50% more margin.</p>`,
  chips: () => [['Stack effect · 9 to 5', 'brass']],
  phases: ['9AM · IN OFF THE UNDERGROUND', 'LUNCH · BOTH WAYS', '5PM · EVERYONE OUT'],
};
