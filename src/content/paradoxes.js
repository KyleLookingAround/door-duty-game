// Paradox callbacks: when a research project finishes, a client you've already fitted hears about it and
// calls with exactly the problem it solves. Door research brings a door job with the matching twist;
// inside research brings an inside job (a stage) or a chained level.
// Each entry: kinds (which fitted clients might call), and one of twist / stage / chain, plus what they say.
const DOOR_CLIENTS = ['cafe', 'pharmacy', 'bank', 'office', 'hotel', 'library', 'store', 'townhall', 'museum', 'cinema', 'gym', 'clinic'];
const OLDER = ['pharmacy', 'library', 'townhall', 'museum', 'clinic', 'hotel'];
const WINDY = ['bank', 'office', 'hotel', 'store', 'gym', 'cinema'];

export const PARADOX_CALLS = {
  mouth: [{ kinds: WINDY, twist: 'wind', text: 'The wind has started whipping round their corner and straight through the revolving door. Now you can adjust the mouth, they want it sorted.' }],
  core: [{ kinds: ['office', 'store', 'hotel', 'bank'], twist: 'surge', text: 'Their rush hour is getting heavier and people near the hub keep going round again. They\'ve heard big-core drums fix that.' }],
  padded: [{ kinds: OLDER, twist: 'fragile', text: 'More frail visitors than ever, and they\'re nervous of the wings. Padded edges would let the door keep its speed.' }],
  sensor: [{ kinds: OLDER, twist: 'fragile', text: 'A care home has opened nearby. They want the door to slow for older visitors only, not for everyone.' }],
  seals: [{ kinds: WINDY, twist: 'wind', text: 'A gale funnels down the street all winter. Brush seals would keep it out without narrowing the mouth.' }],
  curtain: [{ kinds: DOOR_CLIENTS, twist: 'cold', text: 'Their heating bills have doubled with the open doors. They\'ve heard about air curtains.' }],
  vestibule: [{ kinds: ['library', 'museum', 'hotel', 'clinic', 'townhall'], twist: 'cold', text: 'They want a properly warm lobby this winter without giving up the open doors.' }],
  wide: [{ kinds: ['library', 'townhall', 'museum', 'clinic', 'hotel'], twist: 'stepfree', text: 'An access audit is coming. They want everyone through the revolving door, wheelchairs included.' }],
  barriers: [
    { kinds: ['bank'], stage: 'queue', text: 'Mercer & Sons have seen your queue barriers and want their counter hall sorted: some lines crawl while others fly.' },
    { kinds: ['cafe', 'pharmacy', 'gym'], twist: 'fragile', text: 'People keep getting clipped by the swing door. Could lanes split the in and the out?' },
  ],
  pillars: [{ kinds: ['cinema', 'store', 'museum', 'office', 'gym'], twist: 'drill', text: 'The fire officer wants a full evacuation drill, and the doorway jammed last time.' }],
  doorman: [{ kinds: ['hotel', 'office', 'store'], twist: 'surge', text: 'Busier than ever at the door. A doorman would get people out of the drum on time.' }],
  escalators: [
    { kinds: ['store'], stage: 'escalator', text: 'Halden\'s are putting in "stand on both sides" signs on the escalator up to the sales floor. They want to know if it actually helps.' },
    { kinds: ['station'], stage: 'escalator', text: 'The deep escalators up from the platforms are jammed every evening. London tried standing on both sides; they want to try it too.' },
  ],
  zoning: [
    { kinds: ['office'], stage: 'lifts', text: 'Atlas House has heard about zoned lifts. Mornings in their lift lobby are chaos.' },
    { kinds: ['towers'], stage: 'lifts', text: 'The towers\' lift lobby is the worst in town at nine. Zoning might fix it without a new lift.' },
  ],
  paternoster: [{ kinds: ['townhall'], stage: 'paternoster', text: 'The council has found the old paternoster behind a wall and wants it running again for the staff.' }],
  travelator: [{ kinds: ['skyport'], stage: 'walkway', text: 'Skyport wants moving walkways down the long pier, but they\'ve heard they can make things worse.' }],
  markings: [{ kinds: ['skyport'], stage: 'carousel', text: 'Bags are taking forever at reclaim, and passengers crowd the belt. They\'ve heard a painted line helps.' }],
  permits: [{ kinds: ['galleria'], stage: 'braess', text: 'The Galleria\'s new footbridge was meant to speed things up. Since it opened, getting out has been slower.' }],
  stewarding: [{ kinds: ['arena'], chain: ['queue', 'escalator', 'bottleneck'], text: 'Apollo Arena has a sell-out coming. Every time they fix one crush, another appears further in.' }],
};
