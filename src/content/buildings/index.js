// Every client in the town. The order here is the order of plots in a save file: only ever append.
import cafe from './cafe.js';
import pharmacy from './pharmacy.js';
import bank from './bank.js';
import office from './office.js';
import hotel from './hotel.js';
import library from './library.js';
import store from './store.js';
import townhall from './townhall.js';
import station from './station.js';
import museum from './museum.js';
import cinema from './cinema.js';
import gym from './gym.js';
import clinic from './clinic.js';
import towers from './towers.js';
import skyport from './skyport.js';
import galleria from './galleria.js';
import arena from './arena.js';
import stadium from './stadium.js';
import ferry from './ferry.js';
import expo from './expo.js';
import hospital from './hospital.js';
import { SLOT_W } from '../../engine/world.js';

export const BUILDINGS = [cafe, pharmacy, bank, office, hotel, library, store, townhall, station, museum, cinema, gym, clinic, towers, skyport, galleria, arena, stadium, ferry, expo, hospital];
export const BUILDING = Object.fromEntries(BUILDINGS.map(b => [b.key, b]));
export const KINDS = Object.fromEntries(BUILDINGS.map(b => [b.key, b.kind]));
export const PLOTS = BUILDINGS.map(b => ({ ...b.plot, kind: b.key }));

// Street furniture: fixed per building, built for however many bays the job has.
// obstacles collide and steer people; decos and labels are drawing only.
export function buildSite(kind, n) {
  const HW = n * SLOT_W / 2, cx = i => -HW + SLOT_W / 2 + i * SLOT_W, last = n - 1;
  const S = { obstacles: [], decos: [], labels: [] };
  const person = (x, y) => S.obstacles.push({ kind: 'person', x, y, r: 0.2 });
  const b = BUILDING[kind];
  if (b && b.site) b.site({ S, n, HW, cx, last, person });
  return S;
}
