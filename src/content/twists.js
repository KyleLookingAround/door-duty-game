// Twists: each one breaks a different stock answer.
export const TWISTS = {
  tight:    { label: 'Tight budget', text: 'A small budget, and the owner has ruled out a revolving door.' },
  fragile:  { label: 'Fragile guests', text: 'Half the customers are older and bruise easily. One bump and you\'re in the local paper.' },
  narrow:   { label: 'Narrow frontage', text: 'The shopfront is one bay wide. Whatever you fit has to do everything.' },
  wind:     { label: 'Windy corner', text: 'A gale funnels down the street. Wide mouths and open doors let it straight in.' },
  surge:    { label: '9am surge', text: 'Everyone arrives at once, and late staff who ride the door round again get reported to HR.' },
  listed:   { label: 'Listed building', text: 'The brass revolving door in the centre bay is listed. You can\'t touch it, only work around it.' },
  stepfree: { label: 'Step-free', text: 'Wheelchair users, prams and delivery trolleys must be able to get in. Standard revolving doors won\'t take them.' },
  bikes:    { label: 'Cycle commuters', text: 'People wheel their bikes in from the street. A bike won\'t go through a revolving door, and turning cyclists away annoys the client.' },
  rain:     { label: 'Rainy day', text: 'Umbrellas up: everyone takes more room and moves a little slower.' },
  drill:    { label: 'Fire drill', text: 'After the rush the fire officer sounds the alarm, and the lobby has to empty fast. Revolving doors fold flat, every door becomes an exit, and crowds jam at narrow ones.' },
  nofire:   { label: 'Fire officer', text: 'No swing doors: they jam in a crush.' },
  cold:     { label: 'Cold snap', text: 'Freezing outside. Keep the lobby warm.' },
};
export const TWIST_POOL = ['tight', 'fragile', 'narrow', 'wind', 'surge', 'listed', 'stepfree', 'nofire', 'cold', 'bikes', 'rain', 'drill'];
// twists only offered to firms with the right research
export const TWIST_REQ = { drill: t => t.pillars, wind: t => t.mouth };
// Pairs that leave no workable door. Some become possible with R&D: those are
// "specialist" jobs that only firms with the right tech get offered, at a premium.
export const CONFLICTS = [
  ['tight', 'surge'], ['tight', 'listed'], ['narrow', 'listed'], ['narrow', 'stepfree'], ['narrow', 'surge'],
  ['tight', 'cold', t => t.vestibule], ['tight', 'wind'],
  ['stepfree', 'cold', t => t.wide || t.vestibule], ['stepfree', 'wind', t => t.wide],
  ['bikes', 'cold', t => t.vestibule], ['bikes', 'wind', t => t.vestibule], ['bikes', 'tight'],
];
export const clashes = (list, t, tech = {}) => CONFLICTS.some(([a, b, ok]) => ((a === t && list.includes(b)) || (b === t && list.includes(a))) && !(ok && ok(tech)));
// twists that only specialist firms are offered (others in TWIST_REQ just need a basic tool researched)
export const SPECIAL_TWISTS = ['drill'];
export const isSpecialist = list => CONFLICTS.some(([a, b, ok]) => ok && list.includes(a) && list.includes(b)) || list.some(t => SPECIAL_TWISTS.includes(t));

