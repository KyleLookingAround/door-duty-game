// Research: what each tech does, what it needs, and the lesson that explains how to use it.
export const BRANCHES = [['rev', 'Revolving doors'], ['open', 'Open doors'], ['crowd', 'Crowd science'], ['inside', 'Inside work'], ['firm', 'The firm']];
// Most research is a one-off. A refinement (kind 'refine') has levels instead: each one dearer than the last, for
// as long as there's money (brush seals, heat recovery, the supplier contract). S.unlocks[key] is its level.
export const TECH = [
  { key: 'core', branch: 'rev', tier: 1, price: 12000, months: 2, req: ['mouth'], name: 'Big-core drums', text: 'Unlocks the Core setting. The floor near the centre barely moves (v = ω·r), so people dawdle there and go round again. A bigger centre post keeps them out at the fast edge. Cores of 30% or more cost +£2k per door.' },
  { key: 'mouth', branch: 'rev', tier: 1, price: 10000, months: 1, name: 'Mouth adjusters', text: 'Unlocks the Mouth setting: move the curved walls in to keep wind out, or out to let people in faster.', opens: 'Windy-corner jobs, including Mercer & Sons Bank' },
  { key: 'padded', branch: 'rev', tier: 1, price: 12000, months: 2, req: ['mouth'], name: 'Padded wing edges', text: 'Soft wing edges. People shrug off impacts 0.3 m/s faster. +£1.5k per door.' },
  { key: 'seals', kind: 'refine', branch: 'rev', tier: 1, price: 18000, months: 2, req: ['mouth'], name: 'Brush seals', text: 'Seal the drum against wind. On windy corners you can keep wide mouths without the gale getting in.',
    levels: [{ price: 18000, months: 2, text: 'Keeps 85% of the wind out at a wide mouth.' }, { price: 30000, months: 3, text: 'Double brushes: 92% kept out.' }, { price: 50000, months: 3, text: 'Sealed drums: 96% kept out.' }] },
  { key: 'sensor', branch: 'rev', tier: 2, price: 35000, months: 3, req: ['padded'], name: 'Presence sensors', text: 'The door slows itself to a safe speed whenever an older guest is inside, then speeds back up. +£2k per door.' },
  { key: 'wide', branch: 'rev', tier: 3, price: 90000, months: 5, req: ['sensor'], name: 'Wide-drum revolving', text: 'A bigger drum. With 3 wings or fewer, wheelchair users can ride it. +£8k per door.', opens: 'Step-free jobs in the cold or on windy corners' },
  { key: 'curtain', branch: 'open', tier: 1, price: 14000, months: 2, name: 'Air curtains', text: 'A sheet of warm air across swing and sliding doors. Cuts their heat loss by 70%. +£3.5k per door.' },
  { key: 'vestibule', branch: 'open', tier: 2, price: 40000, months: 3, req: ['curtain'], name: 'Draught lobbies', text: 'A second set of doors behind the first. Cuts heat loss by almost 90% but slows people a little. +£5k per door.', opens: 'Cheap jobs and step-free jobs in the cold' },
  { key: 'heat', kind: 'refine', branch: 'open', tier: 2, price: 20000, months: 2, name: 'Heat recovery', text: 'Lobbies you fit reheat faster after a draught.',
    levels: [{ price: 20000, months: 2, text: 'Lobbies reheat 60% faster.' }, { price: 65000, months: 4, text: 'Heat pumps: 2.4 times as fast. Office Towers asks for this.' }, { price: 90000, months: 4, text: 'Heat pumps with stores: 3 times as fast.' }] },
  { key: 'doorman', branch: 'firm', tier: 2, price: 30000, months: 3, name: 'Door staff training', text: 'Lets you hire a doorman crew. A doorman gets riders out on time, so fewer go round again, and holds swing doors so they don\'t clip anyone.' },
  { key: 'supplier', kind: 'refine', branch: 'firm', tier: 3, price: 100000, months: 4, name: 'Supplier contract', text: 'A bulk deal with a door manufacturer: hardware costs you less.',
    levels: [{ price: 100000, months: 4, text: '8% off all hardware.' }, { price: 140000, months: 4, text: '12% off.' }, { price: 200000, months: 5, text: '15% off.' }] },
  { key: 'barriers', branch: 'crowd', tier: 1, price: 16000, months: 2, name: 'Queue barriers', text: 'Posts and tape through the middle of a swing or sliding door: in on one side, out on the other. Nobody gets a door swung into them, but each lane is half as wide. +£800 per door.' },
  { key: 'gates', branch: 'crowd', tier: 2, price: 35000, months: 3, req: ['barriers'], name: 'Ticket gates', text: 'Gate lines for stations: lanes with paddles, one person at a time, a second or so to tap through. Wide-aisle gates take wheelchairs, prams and bikes.', opens: 'Station Quarter, with Tidal-flow gates and Door staff training' },
  { key: 'tidal', branch: 'crowd', tier: 3, price: 50000, months: 3, req: ['gates'], name: 'Tidal-flow gates', text: 'Gate lanes set to Auto turn to face whichever way the queue is heavier: in for the morning rush, out when a train empties. +£2.5k per bay.', opens: 'Station Quarter, with Ticket gates and Door staff training' },
  { key: 'pillars', branch: 'crowd', tier: 2, price: 28000, months: 2, req: ['barriers'], name: 'Pillars', text: 'A slim column just inside an exit. In a crush it takes the push of the crowd behind, so the doorway jams less and big crowds get out faster. +£1.5k per door.', opens: 'Fire-drill jobs' },
  { key: 'escalators', branch: 'inside', tier: 2, price: 30000, months: 2, name: 'Escalator campaign', text: 'Signs and staff for the "stand on both sides" rule on escalators. Not always the right answer.', opens: 'Escalator jobs at Halden\'s and Station Quarter' },
  { key: 'markings', branch: 'inside', tier: 2, price: 15000, months: 1, req: ['escalators'], name: 'Floor markings', text: 'Painted lines and floor graphics that tell a crowd where to stand. Unlocks the stand-back line at baggage reclaim.' },
  { key: 'zoning', branch: 'inside', tier: 2, price: 30000, months: 2, name: 'Lift dispatch', text: 'Lift controllers that split a building into low and high zones, so each car makes fewer stops.', opens: 'Lift-lobby jobs at Atlas House and Office Towers' },
  { key: 'paternoster', branch: 'inside', tier: 2, price: 25000, months: 2, req: ['zoning'], name: 'Paternoster restoration', text: 'The know-how to get an old loop lift running safely again.', opens: 'The Town Hall paternoster' },
  { key: 'travelator', branch: 'inside', tier: 3, price: 45000, months: 3, req: ['escalators'], name: 'Travelators', text: 'Moving walkways: fitting them, and knowing where they help.', opens: 'Skyport Terminal on Riverside' },
  { key: 'permits', branch: 'inside', tier: 3, price: 40000, months: 2, req: ['zoning'], name: 'Route closures', text: 'Permits to close a walkway or bridge in a public building, and the modelling to justify it.', opens: 'The Galleria on Riverside' },
  { key: 'stewarding', branch: 'crowd', tier: 3, price: 50000, months: 3, req: ['pillars'], name: 'Event stewarding', text: 'Trained stewards who meter a crowd: holding people back so the space ahead never packs solid.', opens: 'Apollo Arena on Riverside, with escalator know-how' },
  // more for open doors: options on swing and sliding doors
  { key: 'closer', branch: 'open', tier: 1, price: 8000, months: 1, name: 'Door closers', text: 'A closer snaps a swing door shut the moment the doorway is clear: much less heat lost, though people push a little harder. +£600 per door.' },
  { key: 'autoswing', branch: 'open', tier: 1, price: 12000, months: 2, req: ['closer'], name: 'Automatic swing operators', text: 'A motor opens the swing door for anyone heading to it, so wheelchairs and prams can use it and nobody pushes. It stays open longer, and it still swings into people coming the other way. +£2k per door.', opens: 'Step-free jobs with swing doors' },
  { key: 'telescopic', branch: 'open', tier: 2, price: 30000, months: 2, req: ['autoswing'], name: 'Telescopic sliders', text: 'Extra panels that open a sliding door to 2.4 m instead of 1.7: more people through, more heat lost. +£3.5k per door.' },
  // jobs: how many more jobs a month the firm can sign off once it has this
  { key: 'sitemgmt', branch: 'firm', tier: 1, price: 12000, months: 1, jobs: 1, name: 'Site management', text: 'A site foreman, proper plans and a van rota: your crews can take one more job a month.' },
  { key: 'prefab', branch: 'firm', tier: 2, price: 30000, months: 2, req: ['sitemgmt'], jobs: 1, name: 'Prefabricated door sets', text: 'Doors built and tested in your workshop, then fitted on site in a day: one more job a month.' },
  // the firm: growing the business
  { key: 'designoffice', branch: 'firm', tier: 2, price: 25000, months: 2, name: 'Design office', text: 'A drawing office and a plan chest: save a design that worked, and start a later job of the same shape from it (the blueprint book).' },
  { key: 'network', branch: 'firm', tier: 2, price: 30000, months: 2, studies: 3, name: 'Sales network', text: 'Contacts all over town, built on your market studies: each study brings in twice the work, and clients asking for research wait a month longer.' },
  { key: 'lab', branch: 'firm', tier: 3, price: 80000, months: 3, name: 'Research lab', text: 'A proper lab at headquarters: a third research bench.' },
];

// The market study: always available, free and one month long, on any bench. It brings in work: a client
// asking for something new, or one of your clients wanting more. Research never stops, and this is what
// a bench does when there's nothing else to research (or no money to pay for it).
export const STUDY = { key: 'study', name: 'Market study', months: 1, price: 0, text: 'A month of calling round and walking the streets. Free. It brings in work: an enquiry, or a client wanting more.' };

// How-to lessons, shown when research finishes and in the Company › Guide tab: [title, what it does, where it appears, tip]
export const LESSONS = {
  core: ['Big-core drums', 'In a revolving door the floor near the centre barely moves (v = ω·r), so people standing there drift and miss their exit, riding round again. A bigger core keeps them out at the fast edge.', 'Workshop › revolving door › the new Core slider. 30% or more costs extra.', 'Try a bigger core when go-rounds are the problem, especially with a fast door or a 9am surge.'],
  mouth: ['Mouth adjusters', 'The mouth is how wide the curved walls open on each side. Narrow mouths keep wind out; wide ones let people in and out faster.', 'Workshop › revolving door › the new Mouth slider.', 'On a windy corner, narrow the mouth to about ±30°. Elsewhere, open it up for more throughput.'],
  padded: ['Padded wing edges', 'Soft edges on the wings: people shrug off impacts 0.3 m/s faster before it counts as a bump.', 'Workshop › revolving door › Padded wing edges.', 'Lets you spin a door faster for more people through, without the bumps.'],
  seals: ['Brush seals', 'Seal the drum against the wind, so a wide mouth doesn\'t let the gale in. Each level seals it better.', 'Automatic on every revolving door you fit.', 'On windy corners you can now keep a wide, fast mouth.'],
  sensor: ['Presence sensors', 'The door slows to a safe speed whenever an older guest is inside, then speeds back up.', 'Workshop › revolving door › Presence sensor.', 'The answer for older crowds that also need decent throughput.'],
  wide: ['Wide-drum revolving', 'A bigger drum. With 3 wings or fewer, wheelchair users can ride it.', 'Workshop › revolving door › Wide drum, then drop to 3 wings.', 'A step-free revolving door: warmth and access in one bay.'],
  curtain: ['Air curtains', 'A sheet of warm air across swing and sliding doors. Cuts their heat loss by 70%.', 'Workshop › swing or sliding door › Air curtain.', 'The cheap fix when an open door makes the lobby too cold, or too hot in a heatwave.'],
  vestibule: ['Draught lobbies', 'A second set of doors behind the first: heat loss down by almost 90%, people slowed a little.', 'Workshop › swing or sliding door › Draught lobby.', 'Step-free and warm at the same time, and the answer to the stack effect at Office Towers.'],
  heat: ['Heat recovery', 'Lobbies you fit reheat faster after a draught: 60% faster at level 1, 2.4 times with heat pumps (level 2), 3 times at level 3.', 'Automatic on every job. Research the next level from Company › Research.', 'Lets a leakier, faster design still hit the temperature goal. Office Towers asks for level 2.'],
  doorman: ['Door staff training', 'Lets you hire a doorman crew. A doorman gets riders out of revolving doors on time and holds swing doors so nobody gets clipped.', 'Company › Staff › hire a doorman crew, then Workshop › Doorman on any door. At a gate line, they become gate-line staff.', 'No hardware cost: just their wages.'],
  supplier: ['Supplier contract', 'A bulk deal with a manufacturer: hardware costs you 8% less, then 12%, then 15% as you renegotiate.', 'Automatic: you pay less than list price.', 'Makes two stars (at or under par) easier, since par is set at list price.'],
  barriers: ['Queue barriers', 'Posts and tape through a swing or sliding door: in on one side, out on the other. Nobody gets a door swung into them, but each lane is half as wide.', 'Workshop › swing or sliding door › Lane barriers.', 'Cuts bumps to almost nothing on a busy two-way door, at the cost of throughput.'],
  pillars: ['Pillars', 'A slim column just inside an exit. In a crush it takes the push of the crowd behind, so the doorway jams less. Strange but true: an obstacle makes the exit faster.', 'Workshop › any door › Pillar inside the exit. Fire-drill jobs now appear.', 'Worth it for big crowds at narrow exits; small crowds don\'t need it.'],
  gates: ['Ticket gates', 'Gate lines for the station: single-file lanes with paddles, about a second to tap through. Wide aisles take wheelchairs, prams and bikes.', 'At Station Quarter, every bay can be a gate line: set its lanes to In, Out or Mixed.', 'Point more lanes the busy way. One of the keys to Station Quarter.'],
  tidal: ['Tidal-flow gates', 'Gate lanes set to Auto turn to face whichever queue is heavier: in for the morning rush, out when a train empties.', 'Station Quarter › any gate bay › Lanes › Auto.', 'Fixed splits clog one way or the other. Auto lanes follow the crowd.'],
  escalators: ['Escalator campaign', 'Stand right, walk left looks efficient, but on a tall escalator few people walk, so the walking lane runs half empty while the standing queue backs up. Standing on both sides moves more people. On a short escalator plenty walk, and the walking lane earns its keep.', 'Escalator jobs › The rule.', 'Check the escalator\'s length and how many would walk before you change the rule.'],
  markings: ['Floor markings', 'At baggage reclaim, everyone crowds the belt to be ready, so the people behind can\'t see or reach their bags and bags go round again. A line a step back keeps the edge clear: people step forward when they spot their bag.', 'Baggage reclaim › Stand-back line.', 'A tin of paint beats a second carousel.'],
  zoning: ['Lift dispatch', 'In the morning rush, lifts spend most of their trips opening doors. Split them into low and high zones and each trip makes fewer stops, so the same lifts carry more people.', 'Lift lobby jobs › Dispatch › Low and high zones.', 'Try zoning before paying for another lift.'],
  paternoster: ['Paternoster restoration', 'A paternoster is a revolving door on its end: cabins loop past without stopping. Faster means more cabins, but less time to step on, so people hesitate, miss them, or stumble.', 'Town Hall › Paternoster › Loop speed.', 'The fastest loop is rarely the one that moves the most people, especially with older visitors.'],
  travelator: ['Travelators', 'A moving walkway speeds people up, but they pile up where it ends. Run one into the back of a queue and it has to stop.', 'Skyport › Pier walkway › length and where it goes.', 'Leave room to step off: a shorter walkway in the right place beats one all the way to the desks.'],
  permits: ['Route closures', 'Braess\'s paradox: add a shortcut and everyone takes it, crowding both pinch points, so everyone is slower. Close it and they spread out again.', 'The Galleria › Footbridge › Closed.', 'If every shopper is squeezing through both bottlenecks, the shortcut is the problem.'],
  stewarding: ['Event stewarding', 'Holding a crowd back can get it in faster. A packed space moves slowly and jams its exits; stewards who only let more in when there\'s room keep it flowing.', 'Concourse › Stewards metering the crowd. On a chained level, check every stage: fix one and the crush moves to the next.', 'Faster at the front can mean a crush further in.'],
  sitemgmt: ['Site management', 'Your crews can sign off one more job every month.', 'Automatic: the street shows how many jobs you can still take this month.', 'Worth it when good jobs wait because your crews are booked up.'],
  prefab: ['Prefabricated door sets', 'Doors arrive ready to hang, so your crews can sign off one more job every month.', 'Automatic: the street shows how many jobs you can still take this month.', 'With headquarters and both of these, a firm can take six jobs a month.'],
  designoffice: ['Design office', 'The blueprint book: after a passing test, save the design. On a later job of the same shape (the same number of bays, or the same inside stage), start from it instead of a bare frontage.', 'Job screen › result › Save as a blueprint; then Blueprints on any job of that shape.', 'A good starting point, not an answer: every client\'s crowd and weather are different.'],
  network: ['Sales network', 'Contacts all over town: each market study brings in two pieces of work instead of one, and clients asking for research give you a month longer.', 'Automatic: run market studies from Company › Research.', 'Worth it once market studies are part of your routine.'],
  lab: ['Research lab', 'A third research bench, so three projects run at once.', 'Company › Research: the new bench.', 'More research at once means more research calls, and faster mastery.'],
  closer: ['Door closers', 'A closer snaps a swing door shut as soon as the doorway is clear, so it lets far less heat out between people. It pushes back a little, so people are slightly slower through it.', 'Workshop › swing door › Door closer.', 'A cheap way to keep a swing door warm in mild cold: try it before a sliding door with an air curtain.'],
  autoswing: ['Automatic swing operators', 'A motor swings the door open for anyone heading to it: wheelchairs and prams can use it and nobody has to push. It holds the door longer, so it leaks more heat, and a two-way door still swings into people.', 'Workshop › swing door › Automatic opener.', 'Step-free for less than a sliding door: make it one-way, or split it with lane barriers.'],
  telescopic: ['Telescopic sliders', 'Extra panels let a sliding door open to 2.4 m instead of 1.7, so two streams of people pass at once. A wider opening lets more weather in.', 'Workshop › sliding door › Telescopic panels.', 'For a big two-way crowd through one bay, when a revolving door won\'t do.'],
};

// What each research teaches on a door job, for research calls (c.lesson): which door feature uses it, and
// the measurement it improves. The surveyor sets that goal so designs with the feature pass and designs
// without it don't (see solveContract). metric null: a price lesson (the cheapest pass uses it).
// Lower is better for laps, bumps and evac; higher for through and minTemp.
// forbid: the client keeps the kind of door they called about (their revolving door, their swing doors), so
// the lesson can't be dodged by fitting a different kind of door.
const KEEP_REVOLVING = ['swing', 'slider'], KEEP_OPEN = ['revolve'], KEEP_SWING = ['revolve', 'slider'], KEEP_SLIDING = ['revolve', 'swing'];
export const LESSON_GOALS = {
  core: { uses: s => s.type === 'revolve' && s.core >= 0.3, metric: 'laps', forbid: KEEP_REVOLVING },
  mouth: { uses: s => s.type === 'revolve' && s.mouth <= 32, metric: 'minTemp', forbid: KEEP_REVOLVING },
  padded: { uses: s => !!s.padded, metric: 'through', forbid: KEEP_REVOLVING },
  sensor: { uses: s => !!s.sensor, metric: 'through', forbid: KEEP_REVOLVING },
  curtain: { uses: s => !!s.curtain, metric: 'minTemp', forbid: KEEP_OPEN },
  vestibule: { uses: s => !!s.vestibule, metric: 'minTemp', forbid: KEEP_OPEN },
  wide: { uses: s => s.type === 'revolve' && !!s.wide, metric: 'minTemp', forbid: KEEP_REVOLVING },
  barriers: { uses: s => !!s.lanes, metric: null, forbid: KEEP_SWING },
  pillars: { uses: s => !!s.pillar, metric: 'evac' },
  doorman: { uses: s => !!s.doorman, metric: null, forbid: KEEP_REVOLVING },
  closer: { uses: s => !!s.closer, metric: null, forbid: KEEP_SWING },
  autoswing: { uses: s => !!s.auto, metric: null, forbid: KEEP_SWING },
  telescopic: { uses: s => !!s.tele, metric: 'through', forbid: KEEP_SLIDING },
};
