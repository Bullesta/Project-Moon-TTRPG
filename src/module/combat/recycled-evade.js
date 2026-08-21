const FLAG_SCOPE = "projectmoonttrpg";
const FLAG_KEY = "recycledEvade";
const DEFAULT_PENALTY = 2;

/** if the outfit has the swift property, the penalty is 1 instead of 2 */
function recycledEvadeStep(outfit) {
  return outfit?.system?.outfitProperty === "swift" ? 1 : DEFAULT_PENALTY;
}

/**
 * @param {Actor|null|undefined} actor
 * @returns {{ active: boolean, penalty: number }|null}
 */
export function getRecycledEvade(actor) {
  if (!actor) return null;
  const raw = actor.getFlag(FLAG_SCOPE, FLAG_KEY);
  if (!raw || raw.active !== true) return null;
  const penalty = Math.max(0, Number(raw.penalty) || DEFAULT_PENALTY);
  return { active: true, penalty };
}

/** @param {Actor} actor @param {Item|null} [outfit] */
export async function grantRecycledEvade(actor, outfit = null) {
  if (!actor) return;
  if (getRecycledEvade(actor)) return;
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, { active: true, penalty: recycledEvadeStep(outfit) });
}

/** @param {Actor} actor @param {Item|null} [outfit] */
export async function bumpRecycledEvade(actor, outfit = null) {
  if (!actor) return;
  const current = getRecycledEvade(actor);
  if (!current) return;
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, {
    active: true,
    penalty: current.penalty + recycledEvadeStep(outfit),
  });
}

/** @param {Actor} actor */
export async function clearRecycledEvade(actor) {
  if (!actor) return;
  if (!actor.getFlag(FLAG_SCOPE, FLAG_KEY)) return;
  await actor.unsetFlag(FLAG_SCOPE, FLAG_KEY);
}

/**
 * @param {Actor|null|undefined} actor
 * @returns {number}
 */
export function recycledPowerPenalty(actor) {
  const state = getRecycledEvade(actor);
  if (!state) return 0;
  return -state.penalty;
}
