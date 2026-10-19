// Pacing and money: the numbers the pacing bands tune (npm run pacing). Change them here, not in the rules.

// Each street opens on standing earned on the street before it (the stars from every job signed there), after
// at least `months` on it, with `mastered` of the techs in `list` mastered: research what the street's clients
// want and you move on sooner. Standing never falls, so there's always a way forward.
export const STREET_GATES = {
  market: { from: 'high', standing: 20, months: 6, mastered: 2, list: ['mouth', 'core', 'padded', 'curtain', 'closer', 'barriers', 'autoswing'] },
  riverside: { from: 'market', standing: 18, months: 6, mastered: 2, list: ['sensor', 'vestibule', 'pillars', 'escalators', 'zoning', 'telescopic', 'doorman', 'wide'] },
  // the Docks also have to be bought into: a yard to work from (buy, once) that costs rent every month
  docks: { from: 'riverside', standing: 15, months: 6, mastered: 2, list: ['travelator', 'permits', 'chains', 'stewarding', 'security', 'boarding', 'tidal', 'turnstiles'], buy: 200000, rent: 2500, yard: 'a yard on the Docks', text: 'Opens the Docks: a ferry terminal, an exhibition centre, a hospital and the Stadium, all bigger jobs than the town has seen.' },
};

// Advertising: pay to bring in work this month. Each advert in the same month costs more; the sales network
// makes them cheaper.
export const ADVERT = { base: 3000, step: 3000, network: 0.7 };
