// The paradox journal (Company › Guide): the counterintuitive bit each piece of research taught, kept once
// it's mastered. And the local paper's headlines for the month report. Wording only; game/briefs.js picks.

export const JOURNAL = {
  core: ['The slow hub', 'The middle of a revolving door barely moves (v = ω·r). A bigger solid core keeps people out at the fast edge, so fewer ride round again.'],
  mouth: ['The narrow mouth', 'Pull the curved walls in and the wind can\'t get round them; open them out and people flow faster. One setting, two jobs.'],
  padded: ['Soft edges, faster doors', 'Padding the wings lets the door spin faster without a bump counting: safety bought with speed, not against it.'],
  sensor: ['Slow for one, not for all', 'Slowing the door only while an older guest is inside gets more people through than slowing it for everyone.'],
  seals: ['Keep the wind out, keep the mouth wide', 'Brushes round the drum stop the gale getting in, so a windy corner can keep a wide, fast mouth.'],
  wide: ['The step-free drum', 'A bigger drum with fewer wings takes a wheelchair, and still seals like a revolving door.'],
  curtain: ['A wall of air', 'A curtain of warm air across an open door keeps most of the heat in, until a frost or a gale pushes through it.'],
  vestibule: ['Two doors are warmer than one', 'A draught lobby means the outer and inner doors are rarely open at once, so the cold never gets a straight run.'],
  closer: ['Shut it sooner', 'A closer snaps a swing door shut the moment the doorway is clear: a few hundred pounds that beat an air curtain on a raw day.'],
  autoswing: ['A swing door with a motor', 'An automatic opener makes a swing door step-free, for less than a sliding door. It holds the door longer, so it leaks more.'],
  telescopic: ['One wide bay', 'Telescopic panels open a sliding door to 2.4 m, so two streams pass at once in a bay that would only take one.'],
  barriers: ['Lanes through one door', 'Tape down the middle of a two-way door: in on one side, out on the other. Half the width each way, and nobody clipped.'],
  pillars: ['The pillar at the exit', 'An obstacle just inside an exit takes the push of the crowd, so the doorway jams less and a big crowd gets out faster.'],
  gates: ['One at a time', 'Gate lines take people single file, a second each. Point more lanes the busy way.'],
  tidal: ['Tidal flow', 'Gates that turn to face the heavier queue do the work of more gates fixed in place.'],
  doorman: ['A person beats a sensor', 'A doorman gets riders out of the drum on time and holds a swing door so nobody is clipped.'],
  escalators: ['Stand on both sides', 'On a tall escalator few people walk, so the walking lane runs half empty. Standing on both sides moves more people. On a short one, walk-left wins.'],
  zoning: ['Fewer stops, more trips', 'Lifts split into low and high zones make fewer stops each trip, so the same lifts carry more people in the morning rush.'],
  paternoster: ['Faster isn\'t more', 'A faster paternoster loop brings more cabins but less time to step on: people hesitate, miss them or stumble.'],
  travelator: ['Leave room to step off', 'A moving walkway speeds people up, then they pile up where it ends. A shorter walkway in the right place beats one to the desks.'],
  markings: ['A tin of paint', 'A line a step back from the baggage belt gets everyone their bags sooner than a second carousel.'],
  permits: ['Braess\'s paradox', 'A shortcut everyone takes crowds both pinch points. Close it and everyone is quicker. Unless the long way really is long.'],
  boarding: ['Back to front is slower', 'Boarding the back rows first piles everyone into the same part of the aisle. Any order spreads them out; windows first means nobody stands up to let anyone in.'],
  security: ['The trays, not the scanner', 'A scanner waiting for people to unload won\'t go faster with a second one beside it. More places to unload, and room to repack, move more people for less.'],
  chains: ['The slowest stage moves', 'Fix the escalators and the queue turns up at the gate line instead. A route is only as quick as its slowest stage, and fixing that one makes another the slowest.'],
  stewarding: ['The moving bottleneck', 'Holding a crowd back can get it in faster; and fix one crush, and it moves to the next stage.'],
  turnstiles: ['Through the gate, into the crush', 'Turnstiles set how fast the space behind them fills. More of them only helps if the bag search and the concourse can keep up.'],
};

// The local paper. Each kind has a few headlines; the month picks one (no dice: the same month, the same paper).
export const HEADLINES = {
  landmark: [n => `${n.name.toUpperCase()} OPENS ITS DOORS`, n => `CROWDS FLOW AT ${n.name.toUpperCase()}`],
  mastered: [n => `LOCAL FIRM MASTERS ${n.what.toUpperCase()}`, n => `"${n.lesson}": DOOR FIRM PROVES A POINT`],
  street: [n => `${n.name.toUpperCase()} OPENS FOR BUSINESS`, n => `NEW CLIENTS ON ${n.name.toUpperCase()}`],
  rival: [n => `${n.rival.toUpperCase()} WINS ${n.name.toUpperCase()}`, n => `CUT-PRICE RIVAL SNAPS UP ${n.name.toUpperCase()}`],
  claim: [n => `SHOPPER CLIPPED BY DOOR AT ${n.name.toUpperCase()}`, n => `"IT CAME OUT OF NOWHERE": DOOR BUMP AT ${n.name.toUpperCase()}`],
  inspectFail: [n => `INSPECTOR FAILS ${n.name.toUpperCase()} ENTRANCE`],
  inspectPass: [n => `${n.name.toUpperCase()} PASSES INSPECTION WITH FLYING COLOURS`],
  research: [n => `DOOR FIRM UNVEILS ${n.what.toUpperCase()}`, n => `WHAT'S NEXT FOR THE HIGH STREET'S DOORS? ${n.what.toUpperCase()}`],
  event: [n => `${n.what.toUpperCase()}: TOWN BRACES FOR CROWDS`],
};
