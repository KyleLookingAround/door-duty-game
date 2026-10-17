// The first landmark: a gate line, not doors. Morning in, evening out.
export default {
  key: 'station',
  plot: { name: 'Station Quarter', rep: 16, needs: ['gates', 'tidal', 'doorman'], why: 'The station only talks to firms that can run a gate line' },
  kind: { label: 'Railway station', slots: 3, in: 4.0, out: 0.5, mix: { case: 0.1 }, station: true, hook: { twists: ['stepfree'], temp: 8 } },
  // a station only gets the twists that make sense at a gate line
  twistPool: ['fragile', 'stepfree', 'rain', 'surge', 'bikes', 'narrow'],
  doorTypes: ['wall', 'gates'],
  inside: { escalator: { count: 2, rule: 'walk' } },   // the deep escalators up from the platforms
  site({ S, n, HW, cx, last }) {
    // ticket machines on the street side, the departure board and the escalators down to the platforms
    S.obstacles.push({ kind: 'rect', x0: -HW + 0.15, x1: -HW + 0.75, y0: -1.75, y1: -1.35, tag: 'machines' });
    S.obstacles.push({ kind: 'rect', x0: HW - 0.75, x1: HW - 0.15, y0: -1.75, y1: -1.35, tag: 'machines' });
    S.labels.push({ x: -HW + 0.9, y: -2.0, text: 'Tickets' });
    S.decos.push({ kind: 'board', x0: -1.4, x1: 1.4, y: 1.55 });
    const ex = n >= 3 ? [cx(0), cx(last)] : [-HW + 1.2, HW - 1.2];
    for (const x of ex) S.decos.push({ kind: 'escalator', x0: x - 0.7, x1: x + 0.7, y0: 2.5, y1: 3.6 });
    S.labels.push({ x: 0, y: 3.25, text: 'Escalators to the platforms' });
    S.trains = { every: 6, n: 16, from: 20, xs: ex };
  },
  // the surveyor's designs: gate bays in different directions, with and without staff and wide aisles
  candidates(contract, unlocks) {
    const n = contract.slots, out = [], wall = { type: 'wall' };
    const G = (flow, o = {}) => ({ type: 'gates', flow, wide: false, ...o });
    const needWide = contract.goals.access || contract.goals.bikes;
    const staffs = unlocks.doorman ? [false, true] : [false];
    const sets = [];
    for (let k = Math.max(1, n - 1); k <= n; k++) {
      const pats = [Array(k).fill('both')];
      if (unlocks.tidal) pats.push(Array(k).fill('auto'));
      if (k >= 2) { pats.push([...Array(k - 1).fill('in'), 'out']); pats.push(['in', ...Array(k - 2).fill('both'), 'out']); }
      if (k >= 3) pats.push(['in', 'out', 'out'], ['in', 'in', 'both']);
      for (const pat of pats) sets.push(pat.slice(0, k));
    }
    for (const pat of sets) for (const staff of staffs) for (const wideAt of needWide ? [Math.floor(pat.length / 2)] : [-1, Math.floor(pat.length / 2)]) {
      const items = pat.map((f, i) => G(f, { wide: i === wideAt, doorman: staff || undefined }));
      const s = Array.from({ length: n }, () => ({ ...wall }));
      const idx = items.length === n ? items.map((_, i) => i) : items.length === 1 ? [Math.floor((n - 1) / 2)] : items.map((_, i) => Math.round(i * (n - 1) / (items.length - 1)));
      items.forEach((it, i) => { s[idx[i]] = it; });
      out.push(s);
    }
    const seen = new Set();
    return out.filter(s => { const key = JSON.stringify(s); if (seen.has(key)) return false; seen.add(key); return true; });
  },
  floor: { base: '#2c2f34', kind: 'terrazzo' },
  look: { w: 252, h: 150, base: '#3a4250', trim: '#ece6d8', sign: 'STATION', labelTop: 60, hoarding: 'TO BID FOR THE GATE LINE, YOU NEED' },
  upper({ o, x, w, top, upTop, upBot, trim, winLit, locked }) {
    // the train shed: a great arched roof, a clock, and tall arched windows
    o.push(`<path d="M${x - 8} ${top + 4} Q${x + w / 2} ${top - 80} ${x + w + 8} ${top + 4} Z" fill="#4b5560"/><path d="M${x + 6} ${top + 2} Q${x + w / 2} ${top - 64} ${x + w - 6} ${top + 2} Z" fill="${locked ? '#2a2f38' : 'rgba(243,197,107,.28)'}"/>`);
    for (let k = 1; k < 8; k++) o.push(`<line x1="${x + w * k / 8}" y1="${top}" x2="${x + w / 2}" y2="${top - 52}" stroke="#4b5560" stroke-width="1.5"/>`);
    o.push(`<circle cx="${x + w / 2}" cy="${top - 30}" r="13" fill="${trim}" stroke="#2a2f38" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 30}" x2="${x + w / 2}" y2="${top - 39}" stroke="#222" stroke-width="2"/><line x1="${x + w / 2}" y1="${top - 30}" x2="${x + w / 2 + 6}" y2="${top - 28}" stroke="#222" stroke-width="2"/>`);
    for (let c = 0; c < 4; c++) { const wx = x + 18 + c * (w - 36) / 4 + 6, ww = (w - 36) / 4 - 12; o.push(`<path d="M${wx} ${upBot} V${upTop + 18} a${ww / 2} ${ww / 2} 0 0 1 ${ww} 0 V${upBot} Z" fill="${winLit}" stroke="${trim}" stroke-width="1.5"/>`); }
  },
  brief: c => `<p><strong style="color:var(--brass)">Landmark job.</strong> A gate line, not doors. For the first 20 seconds the morning rush pours in; then the evening starts and a train empties up the escalators every ${c.site.trains.every} seconds, ${c.site.trains.n} people at a time. Landmarks pay 50% more margin.</p>`,
  chips: () => [['Morning in · evening out', 'brass']],
  phases: ['MORNING RUSH · INTO THE STATION', 'EVENING · TRAINS EMPTYING OUT'],
  concourse: true,   // the job screen calls the lobby a concourse and shows the queue instead of the temperature
};
