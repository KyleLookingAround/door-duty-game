// Apollo Arena: the concert venue at the end of Riverside, a landmark. A sell-out crowd goes through bag check,
// up the escalators and along the concourse to the seats, all as one chain: the moving bottleneck.
export default {
  key: 'arena',
  plot: { name: 'Apollo Arena', rep: 38, street: 'riverside', needs: ['stewarding', 'escalators', 'barriers'], why: 'A sell-out venue: it needs stewarding, escalator know-how and queue barriers' },
  kind: { label: 'Concert venue', slots: 4, in: 1, out: 1, mix: {}, hook: { twists: [], temp: 12 } },
  landmark: true,
  jobs: [{ chain: ['queue', 'escalator', 'bottleneck'] }, { stage: 'bottleneck' }],
  inside: { queue: { desks: 4 }, escalator: { count: 2, rule: 'walk' }, bottleneck: { openings: 4 } },
  // the arena's versions of each stage: a quick bag check at many desks, mid-height escalators, a sell-out crowd
  tune: {
    queue: {
      name: 'Bag check', about: 'Security check every bag at a row of desks. Most are quick; a few people need searching.', rate: 2.9, params: { service: 2.4, slow: 0.08, max: 12 },
      // the bank's queue twists, in concert words (same effects)
      twists: {
        payday: { label: 'Late doors', text: 'The doors open late and everyone arrives at once: a third more fans at the desks.' },
        mortgages: { label: 'Strict search', text: 'Security are searching properly tonight: nearly one fan in four takes three times as long.' },
        pensions: { label: 'Classic act', text: 'A band from the seventies: a third of the fans are older and take their time.' },
      },
    },
    escalator: {
      params: { length: 16, walkers: 0.3, crush: 45 },
      twists: {
        rush: { label: 'Last-minute rush', text: 'Most fans turn up just before the show: a quarter more people than usual.' },
        seniors: { label: 'Older fans', text: 'A quarter of the crowd won\'t walk up whatever the rule says.' },
        shoppers: { label: 'Coats and merch', text: 'Fans with coats and merchandise bags stand still on the steps.' },
      },
    },
    bottleneck: { params: { through: 1.75 } },
  },
  site() {},
  floor: { base: '#26232b', kind: 'tiles', size: 1.0, line: 'rgba(0,0,0,.3)' },
  look: { w: 280, h: 176, base: '#3d3550', trim: '#e2d8f0', sign: 'APOLLO ARENA', labelTop: 30, hoarding: 'SOLD OUT · OPENING NIGHT' },
  upper({ o, x, w, top, upBot, trim }) {
    // a drum of a building with a ring of lights and a giant screen
    o.push(`<ellipse cx="${x + w / 2}" cy="${top + 4}" rx="${w / 2 + 6}" ry="22" fill="#4a4060"/>`);
    for (let k = 0; k < 18; k++) o.push(`<circle cx="${x + 10 + k * (w - 20) / 17}" cy="${top + 10}" r="2.5" fill="#f3c56b" opacity=".85"/>`);
    o.push(`<rect x="${x + w / 2 - 50}" y="${top + 24}" width="100" height="${upBot - top - 30}" fill="#1b1830" stroke="${trim}" stroke-width="2"/><text x="${x + w / 2}" y="${top + 24 + (upBot - top - 30) / 2 + 4}" text-anchor="middle" class="sc-small" style="fill:#b48cf0">TONIGHT</text>`);
  },
};
