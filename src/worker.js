// The survey worker: solves contracts off the main thread so the street stays smooth.
// In the built page this runs from the "core" bundle; in development it loads as a module.
import { generateSolved, GATE } from './game/contracts.js';

self.onmessage = async (e) => {
  if (e.data.focus !== undefined) { GATE.focus = e.data.focus; return; }
  const { id, contract, unlocks, recent } = e.data;
  try {
    const solved = await generateSolved(contract, unlocks, recent, (f, attempt) => self.postMessage({ id, progress: f, attempt }));
    self.postMessage({ id, done: true, contract: solved });
  } catch (err) { self.postMessage({ id, done: true, failed: true }); }
};
