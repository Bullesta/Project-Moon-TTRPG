import { PMTTRPGUtility } from "./utility.js";

const { renderTemplate } = foundry.applications.handlebars;

function getInitiativeMisc(actor, miscType) {
  return Number(foundry.utils.getProperty(actor, `flags.projectmoonttrpg.initiative.${miscType}`) ?? 0) || 0;
}

function computeInitiativeFormulaParts(actor, { macroMisc = null, manualMisc = null } = {}) {
  const justice = Number(actor?.system?.abilities?.jus?.mod ?? actor?.system?.abilities?.jus?.value ?? 0) || 0;
  const resolvedMacroMisc = Number.isFinite(Number(macroMisc)) ? Number(macroMisc) : getInitiativeMisc(actor, 'macroMisc');
  const resolvedManualMisc = Number.isFinite(Number(manualMisc)) ? Number(manualMisc) : getInitiativeMisc(actor, 'manualMisc');

  return {
    justice,
    macroMisc: resolvedMacroMisc,
    manualMisc: resolvedManualMisc,
    formula: `1d6${justice >= 0 ? `+${justice}` : justice}${resolvedMacroMisc >= 0 ? `+${resolvedMacroMisc}` : resolvedMacroMisc}${resolvedManualMisc >= 0 ? `+${resolvedManualMisc}` : resolvedManualMisc}`,
  };
}

async function applyInitiativeMisc(actor, { macroMisc = null, manualMisc = null } = {}) {
  if (!actor) return null;

  const updates = {};
  if (macroMisc !== null && macroMisc !== undefined) {
    updates['flags.projectmoonttrpg.initiative.macroMisc'] = Number(macroMisc) || 0;
  }
  if (manualMisc !== null && manualMisc !== undefined) {
    updates['flags.projectmoonttrpg.initiative.manualMisc'] = Number(manualMisc) || 0;
  }

  if (Object.keys(updates).length) {
    await actor.update(updates);
  }

  return actor;
}

function getCombatants(combat = game.combat) {
  if (!combat) return [];

  if (Array.isArray(combat.turns) && combat.turns.length) {
    return combat.turns;
  }

  const combatants = combat.combatants;
  if (!combatants) return [];

  if (Array.isArray(combatants)) {
    return combatants;
  }

  if (typeof combatants.values === 'function') {
    return Array.from(combatants.values());
  }

  return Array.from(combatants);
}

function getCombatantImage(combatant) {
  return combatant?.token?.texture?.src
    ?? combatant?.token?.img
    ?? combatant?.tokenDocument?.texture?.src
    ?? combatant?.actor?.img
    ?? 'icons/svg/mystery-man.svg';
}

function getCombatantInitiative(combatant) {
  const initiative = Number(combatant?.initiative ?? NaN);
  return Number.isFinite(initiative) ? initiative : null;
}

function isCombatantVisible(combatant) {
  if (game.user.isGM || combatant?.isOwner) return true;

  const token = combatant?.token ?? combatant?.tokenDocument ?? null;
  if (!token) return true;

  return !token.hidden;
}

function buildCombatantTarget(combatant, { actorId = null } = {}) {
  if (!combatant?.actor) return null;

  const actor = combatant.actor;
  const token = combatant.token ?? combatant.tokenDocument ?? null;
  const initiative = getCombatantInitiative(combatant);

  return {
    combatant,
    combatantId: combatant.id ?? null,
    actor,
    actorId: actor.id ?? null,
    token,
    tokenId: token?.id ?? null,
    name: combatant.name ?? actor.name ?? '',
    img: getCombatantImage(combatant),
    initiative,
    initiativeLabel: initiative ?? '-',
    isCurrent: game.combat?.combatant?.id === combatant.id,
    isSelf: actorId ? actor.id === actorId : false,
  };
}

export function getCombatantTargetOptions({ combat = game.combat, actorId = null, includeHidden = false } = {}) {
  return getCombatants(combat)
    .filter(combatant => Boolean(combatant?.actor))
    .filter(combatant => includeHidden || isCombatantVisible(combatant))
    .map(combatant => buildCombatantTarget(combatant, { actorId }))
    .filter(Boolean);
}

export function resolveCombatantTarget(combatantId, { combat = game.combat, actorId = null } = {}) {
  if (!combatantId) return null;
  const combatant = getCombatants(combat).find(entry => entry.id === combatantId) ?? null;
  return combatant ? buildCombatantTarget(combatant, { actorId }) : null;
}

function getUserTargetedTokens() {
  return Array.from(game.user?.targets ?? []).filter(token => token?.actor);
}

function getTokenId(token) {
  return token?.id ?? token?.document?.id ?? null;
}

function resolveCombatantForToken(token, combat = game.combat) {
  if (!token || !combat) return null;

  const tokenId = getTokenId(token);
  const byToken = token.combatant
    ?? token.document?.combatant
    ?? (tokenId ? getCombatants(combat).find(entry => (entry.tokenId ?? entry.token?.id) === tokenId) : null);
  if (byToken) return byToken;

  const actorId = token.actor?.id ?? null;
  const baseActorId = token.document?.actorId ?? token.actor?.id ?? null;
  return getCombatants(combat).find(entry => {
    const combatantActorId = entry.actorId ?? entry.actor?.id ?? null;
    return combatantActorId && (combatantActorId === actorId || combatantActorId === baseActorId);
  }) ?? null;
}

function buildTargetFromToken(token, { actorId = null, combat = game.combat } = {}) {
  if (!token?.actor) return null;

  const combatant = resolveCombatantForToken(token, combat);
  if (combatant) return buildCombatantTarget(combatant, { actorId });

  const actor = token.actor;
  const tokenDoc = token.document ?? token;
  return {
    combatant: null,
    combatantId: null,
    actor,
    actorId: actor.id ?? null,
    token: tokenDoc,
    tokenId: getTokenId(token),
    name: token.name ?? actor.name ?? '',
    img: tokenDoc?.texture?.src ?? actor.img ?? 'icons/svg/mystery-man.svg',
    initiative: null,
    initiativeLabel: '-',
    isCurrent: false,
    isSelf: actorId ? actor.id === actorId : false,
  };
}

function getUserTargetCombatantIds(options = [], combat = game.combat) {
  const optionIds = new Set(options.map(option => option.combatantId).filter(Boolean));
  return getUserTargetedTokens()
    .map(token => resolveCombatantForToken(token, combat)?.id ?? null)
    .filter(id => id && optionIds.has(id));
}

function getSelectedCombatantId(options = [], preferredCombatantId = null, combat = game.combat) {
  if (preferredCombatantId && options.some(option => option.combatantId === preferredCombatantId)) {
    return preferredCombatantId;
  }

  const targetedIds = getUserTargetCombatantIds(options, combat);
  if (targetedIds.length) return targetedIds[0];

  return options[0]?.combatantId ?? null;
}

export async function promptTargetSelection({
  actor = null,
  combat = game.combat,
  title = game.i18n.localize('PMTTRPG.Dialog.targetingTitle'),
  hint = game.i18n.localize('PMTTRPG.Dialog.chooseTargetHint'),
  sourceName = '',
  sourceImg = '',
  allowNone = false,
  includeHidden = false,
  preferredCombatantId = null,
} = {}) {
  const options = getCombatantTargetOptions({ combat, actorId: actor?.id ?? null, includeHidden });
  const targetedTokens = getUserTargetedTokens();

  // One crosshair target does not need a picker.
  if (targetedTokens.length === 1) {
    return buildTargetFromToken(targetedTokens[0], { actorId: actor?.id ?? null, combat });
  }

  if (!options.length) return undefined;

  const selectedCombatantId = getSelectedCombatantId(options, preferredCombatantId, combat);
  const dialogData = {
    title,
    hint,
    source: {
      name: sourceName,
      img: sourceImg,
    },
    options: options.map(option => ({
      ...option,
      isDefault: option.combatantId === selectedCombatantId,
    })),
    selectedCombatantId,
    allowNone,
  };

  const html = await renderTemplate('systems/projectmoonttrpg/templates/dialog/target-roll-dialog.html', dialogData);
  const dlgOptions = {
    classes: ['projectmoonttrpg', 'PMTTRPG-dialog']
  };

  if (PMTTRPGUtility.nightmode) dlgOptions.classes.push('nightmode');

  const buttons = [{
    action: 'select',
    label: game.i18n.localize('PMTTRPG.Dialog.selectTarget'),
    default: true,
    callback: (event, button, dialog) => {
      const form = dialog.element.querySelector('form');
      const combatantId = form.combatantId?.value ?? selectedCombatantId;
      return resolveCombatantTarget(combatantId, { combat, actorId: actor?.id ?? null });
    }
  }, {
    action: 'cancel',
    label: game.i18n.localize('PMTTRPG.Dialog.cancel'),
    callback: () => null
  }];

  if (allowNone) {
    buttons.push({
      action: 'none',
      label: game.i18n.localize('PMTTRPG.Dialog.noTarget'),
      callback: () => null
    });
  }

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: dlgOptions.classes,
    content: html,
    buttons,
    rejectClose: false
  });
}

export async function rollInitiative(actor, { macroMisc = null, manualMisc = null } = {}) {
  if (!actor) return false;

  const parts = computeInitiativeFormulaParts(actor, { macroMisc, manualMisc });
  const roll = await (new Roll(parts.formula, actor.getRollData())).evaluate();
  const rollPMTTRPG = await roll.render();

  const templateData = {
    actor,
    title: game.i18n.localize('PMTTRPG.InitiativeRoll'),
    flavor: game.i18n.localize('PMTTRPG.InitiativeRollHint'),
    details: game.i18n.format('PMTTRPG.InitiativeFormula', { formula: parts.formula }),
    resultLabel: game.i18n.localize('PMTTRPG.Initiative'),
    resultDetails: game.i18n.format('PMTTRPG.InitiativeFormula', { formula: parts.formula }),
    rollType: 'initiative',
    rollPMTTRPG,
    roll,
  };

  const chatData = {
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderTemplate('systems/projectmoonttrpg/templates/chat/chat-move.html', templateData),
  };

  let rollMode = "publicroll";
  switch(game.release.generation) {
    case 13:
      rollMode = game.settings.get("core", "rollMode");
      break;
    // assume latest version
    default:
      rollMode = game.settings.get("core", "messageMode");
      break;
  }
  
  if (["gm", "blind"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients('GM');
  if (rollMode === 'self') chatData.whisper = [game.user.id];
  if (rollMode === 'blind') chatData.blind = true;

  await ChatMessage.create(chatData);

  const combat = game.combat;
  if (combat) {
    const tokenId = actor.token?.id ?? null;
    const combatant = tokenId
      ? combat.combatants.find(entry => entry.tokenId === tokenId)
      : combat.combatants.find(entry => entry.actorId === actor.id) ?? null;

    if (combatant) {
      await combatant.update({ initiative: roll.total });
    }
  }

  return roll;
}

export function buildAttackContextPayload({ actor = null, item = null, roll = null, templateData = {}, target = null } = {}) {
  const payload = {
    actor,
    actorId: actor?.id ?? null,
    item,
    itemId: item?.id ?? null,
    roll,
    templateData,
  };

  if (!target) return payload;

  payload.target = target;
  payload.targetActor = target.actor ?? null;
  payload.targetActorId = target.actorId ?? null;
  payload.targetCombatant = target.combatant ?? null;
  payload.targetCombatantId = target.combatantId ?? null;
  payload.targetToken = target.token ?? null;
  payload.targetTokenId = target.tokenId ?? null;
  payload.targetName = target.name ?? '';
  payload.targetImg = target.img ?? '';
  payload.targetInitiative = target.initiative ?? null;

  return payload;
}

export function getInitiativeFormulaParts(actor, options = {}) {
  return computeInitiativeFormulaParts(actor, options);
}

export function setInitiativeMisc(actor, options = {}) {
  return applyInitiativeMisc(actor, options);
}

export const PMTTRPGTargetingAPI = {
  getCombatantTargetOptions,
  resolveCombatantTarget,
  promptTargetSelection,
  buildAttackContextPayload,
  getInitiativeFormulaParts,
  setInitiativeMisc,
  rollInitiative,
};
