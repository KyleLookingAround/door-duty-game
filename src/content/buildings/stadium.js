// Riverside Stadium: the football ground down on the Docks, a landmark (it moved there from the end of Riverside
// when the Docks opened; the name stays, it's still by the river). Match day: fans come through the turnstiles (a door stage of ticket gates), the bag search and the
// concourse to the stands, all as one chain. More turnstiles fill the space behind them faster.
export default {
  key: 'stadium',
  plot: { name: 'Riverside Stadium', rep: 42, street: 'docks', needs: ['turnstiles', 'stewarding'], why: 'Match days need turnstiles, a bag search and trained stewards' },
  kind: { label: 'Football stadium', slots: 4, in: 1, out: 1, mix: {}, hook: { twists: [], temp: 10 } },
  landmark: true,
  jobs: [{ chain: ['doors', 'queue', 'bottleneck'] }, { stage: 'doors' }],
  inside: { doors: { bays: 2, type: 'gates' }, queue: { desks: 4 }, bottleneck: { openings: 4 } },
  // the stadium's versions of each stage: a row of turnstiles, a bag search at trestle tables, a packed concourse
  tune: {
    doors: { name: 'Turnstiles', about: 'Fans tap a ticket and push through one at a time. Only a wide aisle takes a wheelchair.', rate: 2.4, params: { width: 4, types: ['gates'], mix: { case: 0, elderly: 0.08, wheel: 0.02 } } },
    queue: {
      name: 'Bag search', about: 'Stewards look in every bag at a row of tables. Most are quick; a few need a proper search.', params: { service: 2.4, slow: 0.08, max: 12 },
      // the bank's queue twists, in match-day words (same effects)
      twists: {
        payday: { label: 'Cup tie', text: 'A cup tie and a sell-out: a third more fans at the tables.' },
        mortgages: { label: 'Strict search', text: 'A tip-off: the stewards are searching properly, and nearly one fan in four takes three times as long.' },
        pensions: { label: 'Family day', text: 'Family day: a third of the crowd are grandparents and young children, who take their time.' },
      },
    },
    bottleneck: {
      twists: {
        soldout: { label: 'Sell-out', text: 'Every seat sold: a fifth more fans arriving at once.' },
        matinee: { label: 'Lunchtime kick-off', text: 'A lunchtime kick-off with plenty of older fans, who don\'t like a crush.' },
      },
      about: 'The last stretch: a concourse to the stairways up into the stands. A packed concourse moves slowly and jams the stairways.', params: { through: 3.4, into: 'STANDS' } },
  },
  site() {},
  floor: { base: '#24302a', kind: 'tiles', size: 1.0, line: 'rgba(0,0,0,.3)' },
  look: { w: 290, h: 170, base: '#2f4a3a', trim: '#e6efe8', sign: 'RIVERSIDE STADIUM', labelTop: 30, hoarding: 'MATCH DAY · TURNSTILES OPEN 1 HOUR BEFORE KICK-OFF' },
  upper({ o, x, w, top, upBot, trim }) {
    // the back of a stand: a sloping roof on struts, and four floodlight pylons
    o.push(`<path d="M${x - 4} ${top + 10} L${x + w + 4} ${top + 10} L${x + w - 10} ${top - 18} L${x + 10} ${top - 18} Z" fill="#3c5a48" stroke="${trim}" stroke-width="1.5"/>`);
    for (let k = 0; k < 4; k++) {
      const px = x + 14 + k * (w - 28) / 3;
      o.push(`<line x1="${px}" y1="${top - 18}" x2="${px}" y2="${top - 52}" stroke="#5f7a6a" stroke-width="3"/><rect x="${px - 12}" y="${top - 62}" width="24" height="10" fill="#f3f0d8" opacity=".9"/>`);
    }
    for (let c = 0; c < 10; c++) o.push(`<rect x="${x + 10 + c * (w - 20) / 10}" y="${top + 16}" width="${(w - 20) / 10 - 4}" height="${upBot - top - 20}" fill="rgba(111,207,151,.18)" stroke="${trim}" stroke-width=".6"/>`);
  },
};
