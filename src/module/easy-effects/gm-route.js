import { applyRuntimeResourceLocal, recoverPoolLocal } from "./nouns.js";
import { getEquippedOutfit } from "../damage-application.js";
import { normalizeResistanceLevel } from "./resistances.js";
import { applyEEMetaPatch, canMutateEEMetaHost, isApprovedEEMetaHost } from "./ee-meta.js";
import { canUserUpdateDocument } from "../acting-user.js";

const SOCKET_EVENT = "system.projectmoonttrpg";
const GM_REQUEST = "eeGmRequest";
const GM_RESPONSE = "eeGmResponse";
const GM_TIMEOUT_MS = 30_000;

/** @type {Map<string, { resolve: (v: any) => void, reject: (e: Error) => void }>} */
const _pending = new Map();
let _socketRegistered = false;

export function canMutateActor(actor) {
  return canUserUpdateDocument(actor);
}

function sanitizeActorUpdate(update) {
  if (!update || typeof update !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith("system.attributes.") || key.startsWith("flags.projectmoonttrpg.")) {
      out[key] = value;
    }
  }
  return out;
}

function sanitizeItemUpdate(update) {
  if (!update || typeof update !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith("system.")) out[key] = value;
  }
  return out;
}

function uuidFromDocOrString(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof value.uuid === "string" && value.uuid.trim()) {
    return value.uuid.trim();
  }
  return null;
}

function pushUuid(out, seen, value) {
  const uuid = uuidFromDocOrString(value);
  if (!uuid || seen.has(uuid)) return;
  seen.add(uuid);
  out.push(uuid);
}

/**
 * Socket payload for applyDamage.
 */
export function sanitizeDamageOptions(options = {}) {
  const out = {};
  if (options.op != null) out.op = options.op;
  if (options.pool != null) out.pool = options.pool;
  if (typeof options.source === "string") out.source = options.source;
  if (options.fromAttack === true) out.fromAttack = true;
  if (typeof options.damageType === "string") out.damageType = options.damageType;
  if (typeof options.sourceLabel === "string") out.sourceLabel = options.sourceLabel;
  if (typeof options.formula === "string" && options.formula.trim()) {
    out.formula = options.formula.trim();
  }
  if (options.skipEasyEffects === true) out.skipEasyEffects = true;
  if (options.skipResistance === true) out.skipResistance = true;
  if (options.skipResistance === false) out.skipResistance = false;
  if (options.createMessage === false) out.createMessage = false;
  if (Number.isFinite(Number(options.afterResistance))) {
    out.afterResistance = Number(options.afterResistance);
  }
  const healerUuid = uuidFromDocOrString(options.healerUuid) ?? uuidFromDocOrString(options.healer);
  if (healerUuid) out.healerUuid = healerUuid;
  const itemUuid = uuidFromDocOrString(options.itemUuid) ?? uuidFromDocOrString(options.item);
  if (itemUuid) out.itemUuid = itemUuid;
  const attackerUuid = uuidFromDocOrString(options.attackerUuid) ?? uuidFromDocOrString(options.attacker);
  if (attackerUuid) out.attackerUuid = attackerUuid;
  const attackerItemUuid = uuidFromDocOrString(options.attackerItemUuid)
    ?? uuidFromDocOrString(options.attackerItem);
  if (attackerItemUuid) out.attackerItemUuid = attackerItemUuid;

  const sourceItemUuids = [];
  const seen = new Set();
  if (Array.isArray(options.sourceItemUuids)) {
    for (const value of options.sourceItemUuids) pushUuid(sourceItemUuids, seen, value);
  }
  if (Array.isArray(options.sourceItems)) {
    for (const value of options.sourceItems) pushUuid(sourceItemUuids, seen, value);
  } else {
    pushUuid(sourceItemUuids, seen, options.sourceItems);
  }
  pushUuid(sourceItemUuids, seen, attackerItemUuid);
  if (sourceItemUuids.length) out.sourceItemUuids = sourceItemUuids;
  return out;
}

export function getPrimaryGM() {
  return game.users.find((u) => u.active && u.isGM) ?? null;
}

function isPrimaryGM() {
  const gm = getPrimaryGM();
  return !!(gm && game.user.id === gm.id);
}

/**
 * Routes actor mutations through an owner or active GM.
 * Persistent EE metadata uses `runEEMetaPatch` instead
 * @param {Actor} actor
 * @param {string} op
 * @param {object} [payload]
 * @returns {Promise<any>}
 */
export async function runAsOwnerOrGM(actor, op, payload = {}) {
  ensureGmRouteSocket();

  if (!HANDLERS[op]) {
    throw new Error(`[EasyEffects] Unknown GM route op '${op}'`);
  }

  if (canMutateActor(actor)) {
    return HANDLERS[op]({ ...payload, actor });
  }

  const primary = getPrimaryGM();
  if (!primary) {
    const msg = game.i18n.localize("PMTTRPG.Dialog.easyEffectsNoGM");
    console.warn(`[EasyEffects] ${msg} (op=${op})`);
    ui.notifications?.warn(msg);
    return null;
  }

  const requestId = foundry.utils.randomID();
  const wirePayload = {
    ...payload,
    actorUuid: actor.uuid,
  };
  delete wirePayload.actor;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pending.delete(requestId);
      const msg = game.i18n.localize("PMTTRPG.Dialog.easyEffectsGmTimeout");
      console.warn(`[EasyEffects] ${msg} (op=${op})`);
      ui.notifications?.warn(msg);
      resolve(null);
    }, GM_TIMEOUT_MS);

    _pending.set(requestId, {
      resolve: (value) => {
        clearTimeout(timer);
        _pending.delete(requestId);
        resolve(value);
      },
      reject: (err) => {
        clearTimeout(timer);
        _pending.delete(requestId);
        reject(err);
      },
    });

    game.socket.emit(SOCKET_EVENT, {
      type: GM_REQUEST,
      requestId,
      op,
      payload: wirePayload,
      fromUserId: game.user.id,
    });
  });
}

async function resolveActor(data) {
  if (data.actor) return data.actor;
  if (!data.actorUuid) return null;
  return fromUuid(data.actorUuid);
}

const HANDLERS = {
  addStatusStacks: async ({ actor, actorUuid, statusName, amount, originUuid = null, origin = null }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return null;
    return a.addStatusStacks(statusName, amount, null, { originUuid: originUuid ?? origin });
  },

  addPendingStatusStacks: async ({ actor, actorUuid, statusName, amount, arrival, originUuid = null, origin = null }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return null;
    return a.addPendingStatusStacks(statusName, amount, {
      arrival,
      originUuid: originUuid ?? origin,
    });
  },

  pauseStatusToPending: async ({ actor, actorUuid, statusName, arrival }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return null;
    return a.pauseStatusToPending(statusName, { arrival });
  },

  promotePendingStatuses: async ({ actor, actorUuid, arrival }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return null;
    return a.promotePendingStatuses({ arrival });
  },

  removeStatusStacks: async ({ actor, actorUuid, statusName, amount }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return null;
    return a.removeStatusStacks(statusName, amount);
  },

  setStatusStacks: async ({ actor, actorUuid, statusName, amount }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return null;
    return a.setStatusStacks(statusName, amount);
  },

  applyDamage: async ({ actor, actorUuid, amount, options }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return null;
    return a.applyDamage(amount, sanitizeDamageOptions(options ?? {}));
  },

  applyRuntimeResource: async ({ actor, actorUuid, nounId, mode, amount }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return false;
    return applyRuntimeResourceLocal(a, nounId, { mode, amount });
  },

  recoverPool: async ({ actor, actorUuid, noun, amount }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return false;
    return recoverPoolLocal(a, noun, amount);
  },

  setStat: async ({ actor, actorUuid, statName, amount }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a || !statName) return null;
    const n = Number(amount) || 0;
    if (a.system.attributes?.[statName] !== undefined) {
      return a.update({ [`system.attributes.${statName}.value`]: n });
    }
    if (a.system.abilities?.[statName] !== undefined) {
      return a.update({ [`system.abilities.${statName}.value`]: n });
    }
    console.warn(`[EasyEffects] Unknown stat '${statName}' on ${a.name}`);
    return null;
  },

  setOutfitResistances: async ({ actor, actorUuid, overrides }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a || !overrides || typeof overrides !== "object") return false;
    const outfit = getEquippedOutfit(a);
    if (!outfit) {
      console.warn(`[EasyEffects] set resistance: no outfit on '${a.name}'`);
      return false;
    }
    const updates = {};
    for (const [key, level] of Object.entries(overrides)) {
      const lvl = normalizeResistanceLevel(level);
      if (!lvl) continue;
      const [pool, damageType] = String(key).split(".");
      if ((pool !== "hp" && pool !== "st") || !damageType) continue;
      updates[`system.resistances.${pool}.${damageType}`] = lvl;
    }
    if (!Object.keys(updates).length) return false;
    await outfit.update(updates);
    return true;
  },

  applyActorUpdate: async ({ actor, actorUuid, update }) => {
    const a = await resolveActor({ actor, actorUuid });
    const next = sanitizeActorUpdate(update);
    if (!a || !Object.keys(next).length) return false;
    await a.update(next);
    return true;
  },

  updateOwnedItem: async ({ itemUuid, update }) => {
    const item = itemUuid ? await fromUuid(itemUuid) : null;
    const next = sanitizeItemUpdate(update);
    if (!item || !Object.keys(next).length) return false;
    await item.update(next);
    return true;
  },

  grantRecycledEvade: async ({ actor, actorUuid, outfitUuid = null }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return false;
    const outfit = outfitUuid ? await fromUuid(outfitUuid) : null;
    const { grantRecycledEvadeLocal } = await import("../combat/recycled-evade.js");
    await grantRecycledEvadeLocal(a, outfit);
    return true;
  },

  bumpRecycledEvade: async ({ actor, actorUuid, outfitUuid = null }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return false;
    const outfit = outfitUuid ? await fromUuid(outfitUuid) : null;
    const { bumpRecycledEvadeLocal } = await import("../combat/recycled-evade.js");
    await bumpRecycledEvadeLocal(a, outfit);
    return true;
  },

  clearRecycledEvade: async ({ actor, actorUuid }) => {
    const a = await resolveActor({ actor, actorUuid });
    if (!a) return false;
    const { clearRecycledEvadeLocal } = await import("../combat/recycled-evade.js");
    await clearRecycledEvadeLocal(a);
    return true;
  },

  patchEEMeta: async ({ document, documentUuid, set, unset }) => {
    let doc = document ?? null;
    if (!doc && documentUuid) doc = await fromUuid(documentUuid);
    if (!isApprovedEEMetaHost(doc)) {
      console.warn(
        `[EasyEffects] patchEEMeta rejected document type '${doc?.documentName ?? "unknown"}'`
      );
      return false;
    }
    return applyEEMetaPatch(doc, { set, unset });
  },
};

export function registerGmRouteSocket() {
  ensureGmRouteSocket();
}

/*Persistent EE metadata on Actor, Item, Combat, or Combatant
* Calls local applyEEMetaPatch when the user can mutate the host, otherwise asks
* the primary GM to patch it.
*/
export async function runEEMetaPatch(doc, patch = {}) {
  ensureGmRouteSocket();

  if (!isApprovedEEMetaHost(doc)) {
    console.warn(
      `[EasyEffects] patchEEMeta rejected document type '${doc?.documentName ?? "unknown"}'`
    );
    return false;
  }

  if (canMutateEEMetaHost(doc)) {
    return applyEEMetaPatch(doc, patch);
  }

  const primary = getPrimaryGM();
  if (!primary) {
    const msg = game.i18n.localize("PMTTRPG.Dialog.easyEffectsNoGM");
    console.warn(`[EasyEffects] ${msg} (op=patchEEMeta)`);
    ui.notifications?.warn(msg);
    return null;
  }

  const requestId = foundry.utils.randomID();
  const wirePayload = {
    documentUuid: doc.uuid,
    set: patch.set && typeof patch.set === "object" ? patch.set : {},
    unset: Array.isArray(patch.unset) ? patch.unset : [],
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pending.delete(requestId);
      const msg = game.i18n.localize("PMTTRPG.Dialog.easyEffectsGmTimeout");
      console.warn(`[EasyEffects] ${msg} (op=patchEEMeta)`);
      ui.notifications?.warn(msg);
      resolve(null);
    }, GM_TIMEOUT_MS);

    _pending.set(requestId, {
      resolve: (value) => {
        clearTimeout(timer);
        _pending.delete(requestId);
        resolve(value);
      },
      reject: (err) => {
        clearTimeout(timer);
        _pending.delete(requestId);
        reject(err);
      },
    });

    game.socket.emit(SOCKET_EVENT, {
      type: GM_REQUEST,
      requestId,
      op: "patchEEMeta",
      payload: wirePayload,
      fromUserId: game.user.id,
    });
  });
}

function ensureGmRouteSocket() {
  if (_socketRegistered) return;
  if (!game?.socket) return;
  _socketRegistered = true;

  game.socket.on(SOCKET_EVENT, async (data) => {
    if (!data || typeof data !== "object") return;

    if (data.type === GM_REQUEST) {
      if (!isPrimaryGM()) return;
      if (!HANDLERS[data.op]) {
        game.socket.emit(SOCKET_EVENT, {
          type: GM_RESPONSE,
          requestId: data.requestId,
          ok: false,
          error: `Unknown op '${data.op}'`,
        });
        return;
      }

      try {
        const result = await HANDLERS[data.op](data.payload ?? {});
        game.socket.emit(SOCKET_EVENT, {
          type: GM_RESPONSE,
          requestId: data.requestId,
          ok: true,
          result: result === undefined ? null : (typeof result === "object" ? true : result),
        });
      } catch (err) {
        console.error("[EasyEffects] GM route failed", data.op, err);
        game.socket.emit(SOCKET_EVENT, {
          type: GM_RESPONSE,
          requestId: data.requestId,
          ok: false,
          error: err?.message ?? String(err),
        });
      }
      return;
    }

    if (data.type === GM_RESPONSE) {
      const pending = _pending.get(data.requestId);
      if (!pending) return;
      if (data.ok === false) {
        pending.reject(new Error(data.error || "GM route failed"));
        return;
      }
      pending.resolve(data.result ?? null);
    }
  });
}
