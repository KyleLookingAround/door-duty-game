// The live save for this browser. Screens import { S } and read/mutate it; only this module replaces it.
import { SAVE_KEY, freshState, migrate } from '../game/state.js';

export let S = null;
export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; }
  S = migrate(s);
  return S;
}
export function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
export function wipeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(freshState())); } catch (e) {} }
