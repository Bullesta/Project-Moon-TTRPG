import { PMTTRPGTargetingAPI } from "./targeting.js";
import { uniqueStatusItems } from "./status/group-statuses.js";
import { isPendingStatus } from "./status/pending.js";

// Legacy API name as this now only emits combat hooks.
const STATUS_EVENTS = {
  onTurnStart: {
    hook: 'projectmoonttrpg.onTurnStart',
    procField: 'turnStart'
  },
  onEndOfRound: {
    hook: 'projectmoonttrpg.onEndOfRound',
    procField: 'endOfRound'
  },
  onStartOfRound: {
    hook: 'projectmoonttrpg.onStartOfRound',
    procField: 'startOfRound'
  },
  onTurnEnd: {
    hook: 'projectmoonttrpg.onEndOfRound',
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
  return actor.items.filter(item => item.type === 'status' && !isPendingStatus(item));
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

async function emitStatusEvent(eventName, payload = {}) {
  const event = STATUS_EVENTS[eventName];
  if (!event) {
    throw new Error(`[PMTTRPG][StatusEvents] Unknown event '${eventName}'`);
  }

  const actor = resolveActor(payload.actor ?? payload.actorId);
  const statusItems = getStatusItemsForEvent(actor, eventName);
  const statuses = uniqueStatusItems(statusItems);
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

  return context;
}

async function emitManualButton(statusOrId, payload = {}) {
  const status = resolveStatus(statusOrId ?? payload.status ?? payload.statusId);
  if (!status) {
    throw new Error('[PMTTRPG][StatusEvents] Manual button activation requires a status item');
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

  return context;
}

function registerEventCallback(eventName, callback) {
  const event = STATUS_EVENTS[eventName];
  if (!event) {
    throw new Error(`[PMTTRPG][StatusEvents] Unknown event '${eventName}'`);
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
  emitStatusEvent,
  registerEventCallback,
  registerManualButtonCallback,

  onEndOfRound(callback) { return registerEventCallback('onEndOfRound', callback); },
  onStartOfRound(callback) { return registerEventCallback('onStartOfRound', callback); },
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

  emitTurnStart(payload) { return emitStatusEvent('onTurnStart', payload); },
  emitEndOfRound(payload) { return emitStatusEvent('onEndOfRound', payload); },
  emitStartOfRound(payload) { return emitStatusEvent('onStartOfRound', payload); },
  emitTurnEnd(payload) { return emitStatusEvent('onEndOfRound', payload); },
  emitActionOrReaction(payload) { return emitStatusEvent('onActionOrReaction', payload); },
  emitAttackerBurst(payload) { return emitStatusEvent('onAttackerBurst', payload); },
  emitHitSelf(payload) { return emitStatusEvent('onHitSelf', payload); },
  emitHitEnemy(payload) { return emitStatusEvent('onHitEnemy', payload); },
  emitAlwaysActive(payload) { return emitStatusEvent('onAlwaysActive', payload); },
  emitSkillResource(payload) { return emitStatusEvent('onSkillResource', payload); },
  emitAttackRoll(payload) { return emitStatusEvent('onAttackRoll', payload); },
  emitManualButton(statusOrId, payload) { return emitManualButton(statusOrId, payload); },
};
