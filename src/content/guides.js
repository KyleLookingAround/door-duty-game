// Teaching text: the basics guides and the first-game walk-through tips.
export const BASICS = [
  ['doors', 'The three doors', 'Revolving doors seal out the weather, but their wing tips move at v = ω·r: spin them fast and the tips clip people. More wings seal better but leave smaller gaps. Swing doors are cheap and quick, leak heat with every push, and swing into people coming the other way unless you set a direction. Sliding doors are gentle and step-free, and open for anyone nearby, so the cold gets in often. A wall is free.'],
  ['brief', 'Reading a brief', 'The brief tells you who is coming (older guests, wheelchairs, suitcases, bikes), how cold or windy it is, and the goals. Every goal must pass: enough people through in 40 seconds, few enough bumps, a warm enough lobby, and any special rules. The surveyor\'s par is the cheapest design they found that passes.'],
  ['test', 'Testing and stars', 'Run rush hour to watch 40 seconds of real crowd. Speed it up with the speed button, or Skip to jump straight to the results. One star: everything passes. Two: at or under par. Three: under par with no bumps and no safety stops. If anything fails, the hint tells you why. Reset puts the frontage back how it started.'],
  ['month', 'Months, maintenance and callbacks', 'Fitted clients pay maintenance every month, more for more stars. End the month to collect it, pay rent and wages, and finish research. Clients sometimes call you back when things change: a cold snap, a busier street, an older crowd. Your old doors stay; you only pay for new hardware.'],
  ['firm', 'Running the firm', 'Doors wear every month: worn ones pay less, and broken ones pay nothing until you service them (tap the building). Insurance goes up with every bump on your record. Inspectors re-test old jobs: a pass earns a certificate, a fail a fine and a callback. A lobby kept snug in the cold earns a green star and a better fee.'],
  ['company', 'Research, staff and premises', 'Research unlocks new kit, and new kit unlocks new kinds of job. Staff cost wages but pay their way: fitters cut hardware costs, a sales manager raises margins. Bigger premises give you more benches and higher tiers of research. The Company button on the street has it all; your own building grows as you do.'],
  ['calendar', 'The calendar', 'Each month can bring an event you can see coming: January sales, storms, marathon day, a heatwave where lobbies must stay cool, Black Friday and Christmas windows. Tenders in an event month take it on, and pay 25% more.'],
];

export const COACH = {
  tender: ['Your first client', 'Tap their building, the one with the glowing TENDER label, to read the job.'],
  brief: ['The brief', 'Who\'s coming, the weather, and the goals. Every goal at the bottom must pass. Par is the cheapest design the surveyor found. Take the job when you\'re ready.'],
  bays: ['Your frontage', 'The shopfront is split into bays. Tap a bay up here, then choose what goes in it below.'],
  doors: ['Pick a door', 'Revolving doors keep the heat in but bump people if they spin too fast. Swing doors are cheap and quick. Sliding doors are step-free. Walls are free.'],
  run: ['Test it', 'Run a 40-second rush hour. The speed button fast-forwards; Skip jumps straight to the result.'],
  result: ['The verdict', 'Every row must pass. ★ pass · ★★ at or under par · ★★★ no bumps too. If something fails, the hint says why: tweak and run again.'],
  month: ['End the month', 'Fitted clients pay maintenance every month. End the month to collect it, and watch for clients calling you back.'],
  company: ['Your company', 'Research new kit, hire staff and move to bigger premises. Research brings new kinds of job. The Guide tab explains everything again.'],
};
export const NEXT = { bays: 'doors', doors: 'run', month: 'company' };
