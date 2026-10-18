// Every inside job (stage), by key. Each one teaches a paradox; see the stage files for the science.
// 'chain' is a level that runs several stages together as one crowd.
import queue from './queue.js';
import escalator from './escalator.js';
import lifts from './lifts.js';
import paternoster from './paternoster.js';
import walkway from './walkway.js';
import carousel from './carousel.js';
import braess from './braess.js';
import bottleneck from './bottleneck.js';
import doors from './doors.js';
import security from './security.js';
import boarding from './boarding.js';
import { makeChain } from './chain.js';

export const STAGE_LIST = [queue, escalator, lifts, paternoster, walkway, carousel, braess, bottleneck, doors, security, boarding];
export const STAGES = Object.fromEntries(STAGE_LIST.map(s => [s.key, s]));
STAGES.chain = makeChain(STAGES);
// what a client calls a stage (the arena's queue is its bag check)
export const stageName = (c, key) => (c.tunes && c.tunes[key] && c.tunes[key].name) || (c.tune && c.stage === key && c.tune.name) || STAGES[key].name;
export const stageAbout = (c, key) => (c.tunes && c.tunes[key] && c.tunes[key].about) || STAGES[key].about || '';
// every stage twist by key, including the ones only deeper levels draw (keys are unique across stages: test/stages.test.js)
export const STAGE_TWISTS = Object.assign({}, ...STAGE_LIST.map(s => ({ ...s.twists, ...(s.turnTwists || {}), ...(s.deepTwists || {}), ...(s.dayTwists || {}) })));
