import { PMTTRPGTargetingAPI } from "./targeting.js";

const STATUS_EVENTS = {
  onTurnStart: {
    hook: 'projectmoonttrpg.onTurnStart',
    procField: 'turnStart'
  },
  onTurnEnd: {
    hook: 'projectmoonttrpg.onTurnEnd',
    procField: 'endOfRound'
  },
  onActionOrReaction: {
    hook: 'projectmoonttrpg.onActionOrReaction',
    procField: 'actionOrReaction'
  },
  onAttackerBurst: {
    hook: 'projectmoonttrpg.onAttackerBurst',
    procField: 'attackerBurst'
  },
  onHitSelf: {
    hook: 'projectmoonttrpg.onHitSelf',
    procField: 'onHitWhenActorHas'
  },
  onHitEnemy: {
    hook: 'projectmoonttrpg.onHitEnemy',
    procField: 'onHitWhenTargetHas'
  },
  onAlwaysActive: {
    hook: 'projectmoonttrpg.onAlwaysActive',
    procField: 'alwaysActive'
  },
  onSkillResource: {
    hook: 'projectmoonttrpg.onSkillResource',
    procField: 'skillEffect'
  },
  onAttackRoll: {
    hook: 'projectmoonttrpg.onAttackRoll',
    procField: null
  }
};

const STATUS_TRIGGER_HOOK = 'projectmoonttrpg.onStatusTrigger';
const STATUS_MANUAL_BUTTON_HOOK = 'projectmoonttrpg.onManualButton';

function resolveActor(actorOrId) {
  if (!actorOrId) return null;
  if (typeof actorOrId === 'string') {
    return game.actors?.get(actorOrId) ?? null;
  }
  return actorOrId;
}

function getStatusItems(actorOrId) {
  const actor = resolveActor(actorOrId);
  if (!actor) return [];
  return actor.items.filter(item => item.type === 'status');
}

function getStatusKey(statusItem) {
  return `${statusItem?.name ?? ''}`.trim().toLowerCase();
}

function getUniqueStatusItems(statusItems = []) {
  const grouped = new Map();

  for (const statusItem of statusItems) {
    const key = getStatusKey(statusItem) || statusItem.id;
    if (!grouped.has(key)) {
      grouped.set(key, statusItem);
    }
  }

  return Array.from(grouped.values());
}

function resolveStatus(statusOrId) {
  if (!statusOrId) return null;
  if (typeof statusOrId === 'string') {
    const document = game.items?.get(statusOrId) ?? globalThis.fromUuidSync?.(statusOrId) ?? null;
    return document?.type === 'status' ? document : null;
  }
  return statusOrId?.type === 'status' ? statusOrId : null;
}

function getStatusItemsForEvent(actorOrId, eventName) {
  const event = STATUS_EVENTS[eventName];
  const statuses = getStatusItems(actorOrId);
  if (!event?.procField) return statuses;

  return statuses.filter(status => Boolean(status.system?.proc?.[event.procField]));
}

async function runLinkedMacro(statusItem, context = {}) {
  const macroUuid = statusItem?.system?.macro?.uuid;
  if (!macroUuid) return null;

  let macro;
  try {
    macro = await fromUuid(macroUuid);
  }
  catch (err) {
    console.warn('[PMTTRPG][StatusMacros] Invalid macro UUID', macroUuid, err);
    return null;
  }

  if (!macro || macro.documentName !== 'Macro') {
    console.warn('[PMTTRPG][StatusMacros] Linked UUID is not a Macro', macroUuid);
    return null;
  }

  // Foundry Macro scope passes status metadata and trigger context to user scripts.
  return macro.execute({
    status: statusItem,
    actor: statusItem.parent ?? null,
    context,
    api: PMTTRPGStatusMacroAPI,
    targeting: PMTTRPGTargetingAPI,
  });
}

async function emitStatusEvent(eventName, payload = {}, { runMacros = true } = {}) {
  const event = STATUS_EVENTS[eventName];
  if (!event) {
    throw new Error(`[PMTTRPG][StatusMacros] Unknown event '${eventName}'`);
  }

  const actor = resolveActor(payload.actor ?? payload.actorId);
  const statusItems = getStatusItemsForEvent(actor, eventName);
  const statuses = getUniqueStatusItems(statusItems);
  const context = {
    event: eventName,
    actor,
    status: statuses[0] ?? null,
    statuses,
    statusItems,
    payload,
  };

  Hooks.callAll(event.hook, context);
  Hooks.callAll(STATUS_TRIGGER_HOOK, context);

  if (runMacros) {
    for (const status of statuses) {
      await runLinkedMacro(status, { ...context, status });
    }
  }

  return context;
}

async function emitManualButton(statusOrId, payload = {}, { runMacros = true } = {}) {
  const status = resolveStatus(statusOrId ?? payload.status ?? payload.statusId);
  if (!status) {
    throw new Error('[PMTTRPG][StatusMacros] Manual button activation requires a status item');
  }

  const actor = resolveActor(payload.actor ?? payload.actorId ?? status.parent);
  const context = {
    event: 'onManualButton',
    actor,
    status,
    statuses: [status],
    statusItems: [status],
    payload,
  };

  Hooks.callAll(STATUS_MANUAL_BUTTON_HOOK, context);
  Hooks.callAll(STATUS_TRIGGER_HOOK, context);

  if (runMacros) {
    await runLinkedMacro(status, context);
  }

  return context;
}

function registerEventCallback(eventName, callback) {
  const event = STATUS_EVENTS[eventName];
  if (!event) {
    throw new Error(`[PMTTRPG][StatusMacros] Unknown event '${eventName}'`);
  }
  return Hooks.on(event.hook, callback);
}

function registerManualButtonCallback(callback) {
  return Hooks.on(STATUS_MANUAL_BUTTON_HOOK, callback);
}

export const PMTTRPGStatusMacroAPI = {
  EVENTS: STATUS_EVENTS,
  STATUS_TRIGGER_HOOK,
  STATUS_MANUAL_BUTTON_HOOK,
  targeting: PMTTRPGTargetingAPI,

  getStatusItems,
  resolveStatus,
  getStatusItemsForEvent,
  runLinkedMacro,
  emitStatusEvent,
  registerEventCallback,
  registerManualButtonCallback,

  // Convenience wrappers for common macro-development flow.
  onTurnEnd(callback) { return registerEventCallback('onTurnEnd', callback); },
  onTurnStart(callback) { return registerEventCallback('onTurnStart', callback); },
  onActionOrReaction(callback) { return registerEventCallback('onActionOrReaction', callback); },
  onAttackerBurst(callback) { return registerEventCallback('onAttackerBurst', callback); },
  onHitSelf(callback) { return registerEventCallback('onHitSelf', callback); },
  onHitEnemy(callback) { return registerEventCallback('onHitEnemy', callback); },
  onAlwaysActive(callback) { return registerEventCallback('onAlwaysActive', callback); },
  onSkillResource(callback) { return registerEventCallback('onSkillResource', callback); },
  onAttackRoll(callback) { return registerEventCallback('onAttackRoll', callback); },
  onManualButton(callback) { return registerManualButtonCallback(callback); },

  emitTurnStart(payload, options) { return emitStatusEvent('onTurnStart', payload, options); },
  emitTurnEnd(payload, options) { return emitStatusEvent('onTurnEnd', payload, options); },
  emitActionOrReaction(payload, options) { return emitStatusEvent('onActionOrReaction', payload, options); },
  emitAttackerBurst(payload, options) { return emitStatusEvent('onAttackerBurst', payload, options); },
  emitHitSelf(payload, options) { return emitStatusEvent('onHitSelf', payload, options); },
  emitHitEnemy(payload, options) { return emitStatusEvent('onHitEnemy', payload, options); },
  emitAlwaysActive(payload, options) { return emitStatusEvent('onAlwaysActive', payload, options); },
  emitSkillResource(payload, options) { return emitStatusEvent('onSkillResource', payload, options); },
  emitAttackRoll(payload, options) { return emitStatusEvent('onAttackRoll', payload, options); },
  emitManualButton(statusOrId, payload, options) { return emitManualButton(statusOrId, payload, options); },
};
