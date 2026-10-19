// Street standing and advertising (Phase 2b): a street opens on standing earned on the one before it, after
// enough months there, with some of its techs mastered; standing counts every job and never falls; adverts
// bring in work at a rising price.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, migrate } from '../src/game/state.js';
import { signOff, advertise } from '../src/game/jobs.js';
import { refreshPlots } from '../src/game/plots.js';
import { advertCost, gateText, standing, streetOpen } from '../src/game/economy.js';
import { STREET_GATES } from '../src/content/balance.js';

const job = { goals: {}, par: { cost: 0 }, fee: 5000, margin: 5000, existing: null };
const sign = (S, p, stars) => { p.status = 'open'; signOff(S, p, job, [{ type: 'wall' }], stars, { bumps: 0 }); };

test('every job signed on a street adds its stars to that street\'s standing', () => {
  const S = freshState(1), cafe = S.plots.find(p => p.kind === 'cafe');
  sign(S, cafe, 3); sign(S, cafe, 2);
  assert.equal(standing(S, 'high'), 5, 'repeat work counts, not just the best');
  assert.equal(cafe.stars, 3);
});

test('Market Square opens on High Street standing, months and mastery, and stays open', () => {
  const S = freshState(2), g = STREET_GATES.market;
  S.standing = { high: g.standing };
  assert.ok(!streetOpen(S, 'market'), 'not in the first months');
  S.month = 4 + g.months;
  assert.ok(!streetOpen(S, 'market'), 'not without the mastered techs');
  assert.match(gateText(S, 'market'), /mastered/);
  for (const k of g.list.slice(0, g.mastered)) { S.unlocks[k] = true; S.mastered[k] = true; }
  assert.ok(streetOpen(S, 'market'));
  refreshPlots(S);
  assert.ok(S.marketOpen && S.marketOpenedAt === S.month);
  S.standing = { high: 0 }; S.mastered = {};
  assert.ok(streetOpen(S, 'market'), 'once open, always open');
  assert.ok(!streetOpen(S, 'riverside'), 'Riverside needs time on Market Square');
});

test('clients on a street that isn\'t open yet don\'t talk to you, whatever your stars', () => {
  const S = freshState(3);
  S.standing = { high: 40 };   // plenty of standing, but not enough months on the High Street or mastery
  refreshPlots(S);
  assert.ok(S.plots.filter(p => p.street === 'market').every(p => p.status === 'locked'));
});

test('adverts bring in work, cost more each time in a month, and nothing is charged with nobody to reach', () => {
  const S = freshState(4); S.cash = 100000;
  assert.equal(advertise(S), false, 'no fitted clients yet');
  assert.equal(S.cash, 100000);
  for (const p of S.plots.slice(0, 3)) { p.status = 'fitted'; p.stars = 2; p.install = [{ type: 'swing', flow: 'both' }]; p.fee = 5000; }
  const first = advertCost(S), got = advertise(S);
  assert.ok(got && got.p, 'a client answered');
  assert.equal(S.cash, 100000 - first);
  assert.ok(advertCost(S) > first, 'the next one costs more');
});

test('an old save keeps its open streets and starts standing from its stars', () => {
  const S = freshState(5); S.version = 7; delete S.standing; S.marketOpen = true;
  S.plots[0].stars = 3; S.plots[1].stars = 2;
  migrate(S);
  assert.equal(standing(S, 'high'), 5);
  assert.ok(streetOpen(S, 'market'));
});

test('the Docks open on Riverside standing and a yard you buy, which then costs rent', async () => {
  const { buyYard } = await import('../src/game/jobs.js');
  const { endMonth } = await import('../src/game/month.js');
  const { yardToBuy } = await import('../src/game/economy.js');
  const S = freshState(7), g = STREET_GATES.docks;
  S.marketOpen = S.riversideOpen = true; S.riversideOpenedAt = S.month - g.months;
  S.standing = { riverside: g.standing };
  for (const k of g.list.slice(0, g.mastered)) { S.unlocks[k] = true; S.mastered[k] = true; }
  assert.ok(!streetOpen(S, 'docks'), 'earned is not enough: the yard has to be bought');
  assert.equal(yardToBuy(S).key, 'docks');
  assert.match(gateText(S, 'docks'), /yard on the Docks/);
  S.cash = g.buy - 1;
  assert.equal(buyYard(S, 'docks'), false, 'not without the money');
  S.cash = g.buy + 50000;
  assert.ok(buyYard(S, 'docks'));
  assert.equal(S.cash, 50000);
  assert.ok(streetOpen(S, 'docks'));
  refreshPlots(S);
  assert.ok(S.docksOpen && S.docksOpenedAt === S.month);
  const rpt = endMonth(S);
  assert.equal(rpt.yards, g.rent, 'the yard costs rent every month');
  assert.equal(rpt.booked[0].amount, -g.buy, 'and the purchase is in the month\'s books');
});

test('an old save already working with the Stadium keeps it: the Docks count as open', () => {
  const S = freshState(8); S.version = 11;
  S.plots.find(p => p.kind === 'stadium').status = 'fitted';
  migrate(S);
  assert.ok(streetOpen(S, 'docks'));
  assert.ok(S.plots.some(p => p.kind === 'hospital'), 'the new clients are added to the save');
  const T = freshState(9); T.version = 11; migrate(T);
  assert.ok(!streetOpen(T, 'docks'), 'a firm that never reached the Stadium has to earn the Docks');
});
