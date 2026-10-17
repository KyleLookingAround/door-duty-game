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

// The blueprint book (Design office research): save a design that worked, and start a later job of the same
// shape from it. A shape is a frontage's number of bays, an inside job's stage, or a chained level's stages,
// never a particular client.
export const BLUEPRINT_MAX = 12;
export const blueprintShape = c => c.chain ? 'chain:' + c.chain.join('+') : c.stage ? 'stage:' + c.stage : 'doors:' + c.slots;
export function saveBlueprint(S, c, design, name) {
  if (!S.unlocks.designoffice) return null;
  const bp = { name, shape: blueprintShape(c), design: cloneDesign(design), month: S.month };
  const same = b => b.shape === bp.shape && JSON.stringify(b.design) === JSON.stringify(bp.design);
  S.blueprints = [bp, ...(S.blueprints || []).filter(b => !same(b))].slice(0, BLUEPRINT_MAX);
  return bp;
}
export const blueprintsFor = (S, c) => (S.blueprints || []).filter(b => b.shape === blueprintShape(c));
export function dropBlueprint(S, bp) { S.blueprints = (S.blueprints || []).filter(b => b !== bp && !(b.name === bp.name && b.month === bp.month && b.shape === bp.shape)); }
// hardware in a design that the firm can't fit (yet): research names, or [] (a door design; inside setups are
// checked by their own option lists)
const FEATURE_TECH = [[s => s.type === 'revolve' && s.core >= 0.3, 'core'], [s => s.type === 'revolve' && s.mouth !== 40, 'mouth'], [s => s.padded, 'padded'], [s => s.sensor, 'sensor'],
  [s => s.type === 'revolve' && s.wide, 'wide'], [s => s.curtain, 'curtain'], [s => s.vestibule, 'vestibule'], [s => s.lanes, 'barriers'], [s => s.pillar, 'pillars'],
  [s => s.closer, 'closer'], [s => s.auto, 'autoswing'], [s => s.tele, 'telescopic'], [s => s.doorman, 'doorman'], [s => s.type === 'gates', 'gates']];
export function unownedIn(design, tech) {
  if (!Array.isArray(design)) return [];
  return [...new Set(design.flatMap(s => FEATURE_TECH.filter(([f, k]) => f(s) && !tech[k]).map(([, k]) => k)))];
}
