// Designs. A door job's design is a list of bays; an inside job's is one object of settings, and a
// chained level's holds a list of parts. Copies are always deep: a design that shares objects with the
// contract's existing setup edits that setup too, and the job comes out free (designCost against itself).
export function defaultSlot(type) {
  if (type === 'revolve') return { type, wings: 4, mouth: 40, core: 0.15, rpm: 4, padded: false, flow: 'both' };
  if (type === 'swing') return { type, curtain: false, flow: 'both' };
  if (type === 'slider') return { type, curtain: false, flow: 'both', button: false };
  if (type === 'gates') return { type, flow: 'both', wide: false };
  return { type: 'wall' };
}
export const cloneDesign = d => structuredClone(d);
// what the editor starts from: what's already there, or a bare frontage
export function newDesign(c) {
  if (c.stage) return cloneDesign(c.existing || {});
  return c.existing ? cloneDesign(c.existing) : Array.from({ length: c.slots }, () => defaultSlot('wall'));
}
