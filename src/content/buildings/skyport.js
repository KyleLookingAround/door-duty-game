// Skyport: an airport terminal, all inside work. A long pier to passport control, then baggage reclaim.
// Its levels: the pier walkway, baggage reclaim, or the whole arrival (pier and passport control, then reclaim) as one chain.
// With Security lanes researched: security on its own, and the whole departure (the terminal doors from the kerb,
// check-in, then security) as one chain.
export default {
  key: 'skyport',
  plot: { name: 'Skyport Terminal', rep: 30, street: 'riverside', needs: ['travelator'], why: 'The new terminal wants a firm that knows travelators' },
  kind: { label: 'Airport', slots: 3, in: 1, out: 1, mix: { case: 0.4 }, hook: { twists: [], temp: 12 } },
  jobs: [{ stage: 'walkway' }, { stage: 'carousel' }, { chain: ['walkway', 'carousel'] }, { stage: 'security', needs: 'security' }, { chain: ['doors', 'queue', 'security'], needs: 'security' }],
  inside: { walkway: { belt: 0 }, carousel: { belts: 1 }, security: { lanes: 3, searchers: 3 }, doors: { bays: 1, type: 'revolve' }, queue: { desks: 4 } },
  // departures: the doors in from the kerb, the check-in desks and security
  tune: {
    doors: { name: 'Terminal doors', about: 'The doors in from the drop-off kerb. Everyone has a case or a trolley.', rate: 0.3, params: { width: 4, arrive: 120, types: ['revolve', 'slider', 'swing'], mix: { case: 0.45, elderly: 0.1 } },
      twists: { kickoff: { label: 'Last call', text: 'A late check-in rush: half the passengers turn up in the last few minutes.' }, paper: null } },   // no ticket gates here
    queue: {
      name: 'Check-in', about: 'Passengers drop their bags at a row of check-in desks. Most are quick; an overweight bag takes ages.', params: { service: 13, slow: 0.12, max: 8 },
      twists: {
        payday: { label: 'Charter flights', text: 'Two charter flights checking in at once: a third more passengers.' },
        mortgages: { label: 'Overweight bags', text: 'Holiday luggage: nearly one passenger in four has to repack an overweight bag.' },
        pensions: { label: 'Cruise passengers', text: 'A cruise transfer: a third of the passengers are older and take their time.' },
      },
    },
  },
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
