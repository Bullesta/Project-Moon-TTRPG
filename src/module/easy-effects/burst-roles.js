/**
 * Unlinked token actors can share a world actor's id so we use uuid as the the real key.
 * @param {object|null|undefined} actor
 * @returns {string|null}
 */
export function actorIdentityKey(actor) {
  if (!actor) return null;
  const uuid = String(actor.uuid ?? "").trim();
  if (uuid) return uuid;
  const id = actor.id ?? actor._id ?? null;
  return id == null || id === "" ? null : String(id);
}

/** True when both refs are the same token actor*/
export function sameActor(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const key = actorIdentityKey(a);
  return !!key && key === actorIdentityKey(b);
}

/**
 * Same embedded item id can exist on two different actors.
 * @param {object|null|undefined} item
 * @returns {string|null}
 */
export function itemIdentityKey(item) {
  if (!item) return null;
  const uuid = String(item.uuid ?? "").trim();
  if (uuid) return uuid;
  const id = item.id ?? item._id ?? null;
  if (id == null || id === "") return null;
  const ownerKey = actorIdentityKey(item.actor);
  return ownerKey ? `${ownerKey}:${id}` : `item:${id}`;
}

/** Dialog answerer if we're in one, else self*/
export function resolveBurstBurster(context) {
  return context?._dialogResponder ?? context?.self ?? null;
}

/**
 * @param {...(object|null|undefined)} actors
 * @returns {object[]}
 */
export function uniqueBurstOwners(...actors) {
  const out = [];
  const seen = new Set();
  for (const actor of actors) {
    const key = actorIdentityKey(actor);
    if (!actor || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(actor);
  }
  return out;
}

/**
 * @param {object|null|undefined} item
 * @param {object|null|undefined} owner
 * @returns {boolean}
 */
export function itemBelongsToActor(item, owner) {
  if (!item || !owner) return false;
  const ownerKey = actorIdentityKey(owner);
  const itemOwnerKey = actorIdentityKey(item.actor);
  if (ownerKey && itemOwnerKey && ownerKey === itemOwnerKey) return true;
  const owned = owner.items?.get?.(item.id ?? item._id);
  if (!owned) return false;
  return itemIdentityKey(owned) === itemIdentityKey(item);
}

/**
 * @param {Set<string>} seenKeys
 * @param {object|null|undefined} item
 * @param {string|null} skipItemKey
 * @returns {boolean}
 */
export function rememberBurstListenerItem(seenKeys, item, skipItemKey) {
  const key = itemIdentityKey(item);
  if (!key) return false;
  if (skipItemKey && key === skipItemKey) return false;
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  return true;
}
