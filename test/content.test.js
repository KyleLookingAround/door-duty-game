// Content checks: every building, twist, tech and guide entry is well formed and points at things that exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, BUILDING, KINDS, PLOTS, buildSite } from '../src/content/buildings/index.js';
import { TWISTS, TWIST_POOL, TWIST_REQ, CONFLICTS } from '../src/content/twists.js';
import { TECH, BRANCHES, LESSONS } from '../src/content/tech.js';
import { COACH, NEXT, BASICS } from '../src/content/guides.js';
import { EVENTS } from '../src/content/events.js';
import { PREMISES, STAFF } from '../src/content/company.js';
import { STREETS, CALLBACKS } from '../src/content/town.js';

// the save stores plots by position, so this order may only ever grow at the end
const SAVE_ORDER = ['cafe', 'pharmacy', 'bank', 'office', 'hotel', 'library', 'store', 'townhall', 'station', 'museum', 'cinema', 'gym', 'clinic', 'towers'];

test('buildings keep their save order (append only)', () => {
  assert.deepEqual(BUILDINGS.slice(0, SAVE_ORDER.length).map(b => b.key), SAVE_ORDER);
  assert.equal(new Set(BUILDINGS.map(b => b.key)).size, BUILDINGS.length, 'keys are unique');
});

for (const b of BUILDINGS) {
  test(`building ${b.key} is complete`, () => {
    assert.ok(b.plot && b.plot.name && typeof b.plot.rep === 'number', 'plot has a name and a rep');
    assert.ok(b.kind && b.kind.label && b.kind.slots >= 1, 'kind has a label and slots');
    assert.equal(typeof b.site, 'function');
    assert.ok(b.floor && b.floor.base, 'floor');
    assert.ok(b.look && b.look.w > 0 && b.look.h > 0 && b.look.sign, 'look');
    for (const f of ['upper', 'front', 'after', 'brief', 'chips', 'candidates']) if (b[f] != null) assert.equal(typeof b[f], 'function', f);
    if (b.plot.street) assert.ok(STREETS.some(s => s.key === b.plot.street), 'street exists');
    for (const n of [].concat(b.plot.needs || [])) assert.ok(TECH.some(t => t.key === n), `needs ${n} is a tech`);
    if (b.twistPool) for (const t of b.twistPool) assert.ok(TWISTS[t], `twist ${t}`);
    if (b.doorTypes) for (const t of b.doorTypes) assert.ok(['wall', 'revolve', 'swing', 'slider', 'gates'].includes(t));
    // the site builds for every frontage width it could be given
    for (let n = 1; n <= b.kind.slots + 2; n++) {
      const s = buildSite(b.key, n);
      assert.ok(Array.isArray(s.obstacles) && Array.isArray(s.decos) && Array.isArray(s.labels));
    }
  });
}

test('lookups agree with the list', () => {
  assert.equal(Object.keys(BUILDING).length, BUILDINGS.length);
  assert.equal(Object.keys(KINDS).length, BUILDINGS.length);
  assert.equal(PLOTS.length, BUILDINGS.length);
});

test('twists', () => {
  for (const t of TWIST_POOL) assert.ok(TWISTS[t], `pool twist ${t} is defined`);
  for (const t of Object.keys(TWIST_REQ)) assert.ok(TWISTS[t], `requirement for ${t}`);
  for (const [a, b] of CONFLICTS) { assert.ok(TWISTS[a], a); assert.ok(TWISTS[b], b); }
});

test('research tree', () => {
  const keys = new Set(TECH.map(t => t.key));
  assert.equal(keys.size, TECH.length, 'tech keys are unique');
  for (const t of TECH) {
    assert.ok(BRANCHES.some(([b]) => b === t.branch), `${t.key} branch`);
    for (const r of t.req || []) assert.ok(keys.has(r), `${t.key} requires ${r}`);
    assert.ok(t.tier >= 1 && t.tier <= PREMISES.length, `${t.key} tier`);
    assert.ok(t.price > 0 && t.months > 0);
  }
  for (const k of Object.keys(LESSONS)) assert.ok(keys.has(k), `lesson ${k} is a tech`);
  for (const s of STAFF) if (s.req) assert.ok(keys.has(s.req), `staff ${s.key} needs ${s.req}`);
});

test('guides and calendar', () => {
  for (const [a, b] of Object.entries(NEXT)) { assert.ok(COACH[a], a); assert.ok(COACH[b], b); }
  assert.ok(BASICS.every(b => b.length >= 3));
  for (const m of Object.keys(EVENTS)) assert.ok(+m >= 0 && +m < 12);
  assert.ok(CALLBACKS.botched, 'rival rescue callback text');
});
