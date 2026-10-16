// The calendar: one event a month, the same every year, so the player can see it coming.
export const EVENTS = {
  0:  { key: 'sales', label: 'January sales', text: 'Bargain hunters with bags. Every tender is busier, and shoppers carry big bags through the doors.' },
  1:  { key: 'storm', label: 'Storm season', text: 'Gales and rain all month. Wind pushes air through open doors and wide mouths, and the queue outside wants in quickly.' },
  3:  { key: 'marathon', label: 'Marathon day', text: 'Everyone rushes out to watch the runners. Lots of prams. The flow is mostly outward.' },
  6:  { key: 'heatwave', label: 'Heatwave', text: 'Over 30°C outside. Lobbies need keeping cool, not warm: the same leaks now let the heat in.' },
  10: { key: 'blackfriday', label: 'Black Friday', text: 'The biggest crowds of the year. Half as many people again, and they want in now.' },
  11: { key: 'xmas', label: 'Christmas windows', text: 'Shop windows are dressed for Christmas, and people stop in front of them. A bay with a window display has a crowd standing in its way.' },
};
export const eventOf = month => EVENTS[((month % 12) + 12) % 12] || null;
// which bays get a Christmas window display
export const xmasBays = n => n <= 1 ? [] : n === 2 ? [1] : n === 3 ? [0] : [0, n - 1];

