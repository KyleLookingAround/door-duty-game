// The town: streets, the rival firm, and why clients call back.
export const STREETS = [{ key: 'high', name: 'High Street', rep: 0 }, { key: 'market', name: 'Market Square', rep: 18 }, { key: 'riverside', name: 'Riverside', rep: 30 }];
// a rival firm starts bidding once the town is big enough to share
export const RIVAL = 'Brassworks Ltd';
export const CALLBACKS = {
  cold: 'A cold snap has the lobby freezing',
  hot: 'The heatwave has the lobby sweltering',
  busier: 'Footfall is up and the queue spills down the street',
  older: 'A new clinic upstairs brings an older crowd',
  botched: `${RIVAL} fitted cheap swing doors and the client regrets it`,
  safety: 'An inspector failed the entrance on safety: too many people clipped',
  access: 'An inspector failed the entrance: no step-free way in',
  study: 'Your market study found them wanting more: a bigger, busier entrance',
};

// Footfall: the town is one crowd. Each flow sends part of a building's crowd on to the buildings it feeds,
// through the doors you fitted it: good work (three stars) sends up to `share` more people on, a callback or
// the rival's cheap doors fewer, broken doors fewer still. Settled once a month (game/footfall.js), and capped
// at FOOTFALL_CAP either way so one bad job can't empty a street.
export const FLOWS = [
  { from: 'station', to: ['cafe', 'pharmacy', 'bank', 'office', 'hotel', 'library', 'store', 'townhall'], share: 0.15, who: 'commuters off the trains' },
  { from: 'office', to: ['cafe', 'pharmacy', 'bank'], share: 0.08, who: 'office workers at lunch' },
  { from: 'store', to: ['cafe', 'pharmacy'], share: 0.06, who: 'shoppers' },
  { from: 'hotel', to: ['library', 'townhall', 'museum'], share: 0.06, who: 'hotel guests out sightseeing' },
  { from: 'towers', to: ['gym', 'clinic', 'cinema', 'museum'], share: 0.12, who: 'office workers from the Towers' },
  { from: 'cinema', to: ['gym', 'museum'], share: 0.05, who: 'cinema-goers' },
  { from: 'skyport', to: ['galleria', 'arena'], share: 0.1, who: 'travellers with time to kill' },
  { from: 'stadium', to: ['galleria', 'arena'], share: 0.15, who: 'match-day crowds' },
  { from: 'galleria', to: ['arena'], share: 0.06, who: 'shoppers staying on for a show' },
];
export const FOOTFALL_CAP = 0.2, FOOTFALL_STEP = 0.1;

// The town day (game/townday.js): when each client's crowd comes. commute: the morning and evening rush;
// lunch: a lunchtime peak; shop: a broad middle of the day; evening: a show or a film after work; match:
// the crowd for an evening kick-off. Peaks are [hour, width in hours, weight].
export const DAY_RHYTHMS = {
  commute: [[8.5, 0.8, 1], [17.5, 0.9, 0.9]],
  lunch: [[8.5, 1, 0.35], [12.75, 0.9, 1]],
  shop: [[11, 1.6, 0.7], [14.5, 1.8, 1]],
  evening: [[13, 2, 0.3], [18.25, 0.7, 1]],
  match: [[17.75, 0.6, 1]],
};
export const DAY_RHYTHM = { station: 'commute', office: 'commute', towers: 'commute', skyport: 'commute', cafe: 'lunch', pharmacy: 'lunch', bank: 'lunch', clinic: 'lunch', cinema: 'evening', arena: 'evening', stadium: 'match' };
