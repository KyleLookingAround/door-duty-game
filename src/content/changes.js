// Street changes: the causes of callbacks. Something happens in the town that you can see coming on the
// calendar (a bus stop moves, a care home opens, a cold snap), and the clients it touches have their doors
// re-tested against it. Only the ones whose doors genuinely fall short call you back; the rest cope, and
// the client remembers it.
//
// Each change: label (short, for the calendar), text (what happens, with {where}), reason (the callback it
// brings, see CALLBACKS in town.js), and where it lands:
//   street: true    one street, and the clients on it
//   near: true      one client and its neighbours either side
//   all: true       anyone (weather): the most exposed clients are checked
// months: only in these months of the year (0 = January). max: how many clients get checked at most.
export const CHANGES = [
  { key: 'busstop', label: 'Bus stop moves', text: 'The bus stop moves to {where}. Buses drop crowds right outside.', reason: 'busier', street: true, max: 4 },
  { key: 'flats', label: 'New flats', text: 'A block of flats opens behind {where}. More people walking past, morning and evening.', reason: 'busier', street: true, max: 4 },
  { key: 'office', label: 'Offices reopen', text: 'A big employer moves back into {where}. The lunch rush gets heavier.', reason: 'busier', street: true, max: 2 },
  { key: 'carehome', label: 'Care home opens', text: 'A care home opens next to {where}. More older visitors, who need slower doors.', reason: 'older', near: true, max: 3 },
  { key: 'surgery', label: 'GP surgery moves', text: 'The GP surgery moves in beside {where}. An older crowd, and more of them.', reason: 'older', near: true, max: 3 },
  { key: 'audit', label: 'Access audit', text: 'The council starts an access audit on {where}. Wheelchairs and prams must get in everywhere.', reason: 'access', street: true, max: 2 },
  { key: 'coldsnap', label: 'Cold snap', text: 'A cold snap is on its way: well below freezing for weeks.', reason: 'cold', all: true, months: [10, 11, 0, 1], max: 3 },
  { key: 'gales', label: 'Gales forecast', text: 'Gales are forecast for the whole town: cold air driven straight through open doors.', reason: 'cold', all: true, months: [1, 2, 9, 10], max: 2 },
  { key: 'hot', label: 'Hot spell', text: 'A long hot spell is forecast: lobbies will need keeping cool.', reason: 'hot', all: true, months: [5, 6, 7], max: 3 },
];
export const CHANGE = Object.fromEntries(CHANGES.map(c => [c.key, c]));
// the text of a scheduled change, with the place filled in
export const changeText = (ch, where) => CHANGE[ch.key].text.replace('{where}', where || 'the High Street');
