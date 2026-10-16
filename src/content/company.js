// Premises and staff: the firm's money sinks.
export const PREMISES = [
  { name: 'Lock-up garage', rent: 500, tier: 1, labs: 1, staff: 1, text: 'One bench, one project at a time.' },
  { name: 'Workshop', price: 25000, rep: 6, rent: 1500, tier: 2, labs: 1, staff: 3, text: 'Room for a crew and tier 2 research.' },
  { name: 'Headquarters', price: 60000, rep: 14, rent: 3500, tier: 3, labs: 2, staff: 4, fee: 0.2, text: 'Two research projects at once, tier 3 research, and the name adds 20% to your margins.' },
];
export const STAFF = [
  { key: 'fitter', name: 'Fitting crew', wage: 1500, text: 'Your own fitters. Hardware costs you 10% less.' },
  { key: 'doorman', name: 'Doorman crew', wage: 1200, req: 'doorman', text: 'Station a doorman at any door you fit, at no hardware cost.' },
  { key: 'engineer', name: 'Service engineer', wage: 1800, text: 'Sells servicing plans. Every fitted building pays 40% more maintenance.' },
  { key: 'sales', name: 'Sales manager', wage: 2200, text: 'Negotiates harder. Your margin on every job is 30% bigger.' },
];
