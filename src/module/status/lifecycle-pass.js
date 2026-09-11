import { itemIdentityKey } from "../easy-effects/burst-roles.js";

/*
 * Foundry may leave deleted statuses in `actor.items` until `updateCombat`
 * finishes. Keep their identities here so later lifecycle phases do not
 * collect them again.
 *
 * Overlapping updateCombat handlers share the same set since Foundry does not
 * await async hook listeners.
 */
const removedKeys = new Set();
let depth = 0;

export function beginCombatLifecyclePass() {
  if (depth === 0) removedKeys.clear();
  depth += 1;
}

export function endCombatLifecyclePass() {
  depth = Math.max(0, depth - 1);
  if (depth === 0) removedKeys.clear();
}

/*
 * Record the key before deletion while the item's uuid and owner are still
 * available.
 */
export function noteRemovedStatusItem(item) {
  if (depth <= 0) return;
  const key = itemIdentityKey(item);
  if (!key) return;
  removedKeys.add(key);
}

export function wasRemovedThisLifecyclePass(item) {
  const key = itemIdentityKey(item);
  return !!key && removedKeys.has(key);
}
