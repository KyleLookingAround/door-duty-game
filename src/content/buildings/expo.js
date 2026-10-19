// The exhibition centre on the Docks: all inside work. Visitors queue at registration for their badges, then
// crowd through the doors into the hall when the show opens: the counter hall's snake and the concourse's moving
// bottleneck, as one route or on their own.
export default {
  key: 'expo',
  plot: { name: 'Exhibition Centre', rep: 46, street: 'docks', needs: ['barriers', 'stewarding'], why: 'A trade show needs queue barriers and stewards who can meter a crowd' },
  kind: { label: 'Exhibition centre', slots: 4, in: 1, out: 1, mix: {}, hook: { twists: [], temp: 12 } },
  jobs: [{ chain: ['queue', 'bottleneck'] }, { stage: 'queue' }, { stage: 'bottleneck' }],
  inside: { queue: { desks: 4 }, bottleneck: { openings: 3 } },
  tune: {
    queue: {
      name: 'Registration', about: 'Visitors collect their badges at a row of desks. Most are printed in a moment; a lost booking takes ages.', rate: 0.9, params: { service: 5, slow: 0.1, max: 10 },
      twists: {
        payday: { label: 'Opening morning', text: 'The first morning of the show: a third more visitors at the desks.' },
        mortgages: { label: 'Printer trouble', text: 'The badge printers keep jamming: nearly one visitor in four takes three times as long.' },
        pensions: { label: 'Antiques fair', text: 'An antiques fair: a third of the visitors are older and take their time.' },
        // the counter hall's day-shape twists, in show words (same effects)
        lunch: { label: 'Afternoon tickets', text: 'Quiet all morning, then most of the day\'s visitors arrive after lunch.' },
        opening: { label: 'Queue at the doors', text: 'A queue outside before the show opens, then a quiet day.' },
        quick: { label: 'Booked ahead', text: 'Nearly everyone booked ahead: their badges print in a moment, and hardly anyone takes long.' },
      },
    },
    bottleneck: {
      name: 'Hall doors', waitLabel: '9 in 10 into the hall within', about: 'The doors from the foyer into the exhibition hall. A packed foyer moves slowly and jams the doors.', params: { through: 2.2, into: 'HALL' },
      twists: {
        soldout: { label: 'Big show', text: 'A big name on the opening stand: a fifth more visitors arriving at once.' },
        matinee: { label: 'Collectors\' day', text: 'A collectors\' day with plenty of older visitors, who don\'t like a crush.' },
        lastminute: { label: 'Doors at ten', text: 'Half the visitors wait outside for the doors to open, and come in at once.' },
        walkup: { label: 'Free entry', text: 'Free entry today: hardly anyone has booked a time.' },
      },
    },
  },
  site() {},
  floor: { base: '#2a2d33', kind: 'tiles', size: 1.2, line: 'rgba(0,0,0,.3)' },
  look: { w: 270, h: 150, base: '#8a5a3a', trim: '#f0e2d0', sign: 'EXHIBITION CENTRE', labelTop: 24, hoarding: 'BOAT SHOW · COMING SOON' },
  upper({ o, x, w, top, upBot, trim }) {
    // an old dockside warehouse: a saw-tooth roof and tall arched windows
    for (let k = 0; k < 5; k++) { const sx = x + k * w / 5; o.push(`<path d="M${sx} ${top} L${sx + w / 10} ${top - 22} L${sx + w / 5} ${top} Z" fill="#6e4630" stroke="${trim}" stroke-width="1"/>`); }
    for (let c = 0; c < 7; c++) { const wx = x + 14 + c * (w - 28) / 7, ww = (w - 28) / 7 - 8; o.push(`<path d="M${wx} ${upBot - 4} V${top + 22} Q${wx + ww / 2} ${top + 8} ${wx + ww} ${top + 22} V${upBot - 4} Z" fill="rgba(243,197,107,.35)" stroke="${trim}" stroke-width="1"/>`); }
  },
};
