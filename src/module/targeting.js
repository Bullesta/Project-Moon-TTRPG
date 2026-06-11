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

function getSelectedCombatantId(options = [], preferredCombatantId = null) {
  if (preferredCombatantId && options.some(option => option.combatantId === preferredCombatantId)) {
    return preferredCombatantId;
  }

  const targetedIds = Array.from(game.user?.targets ?? [])
    .map(token => token?.combatant?.id ?? token?.document?.combatant?.id ?? token?.document?.combatantId ?? null)
    .filter(Boolean);

  for (const targetId of targetedIds) {
    if (options.some(option => option.combatantId === targetId)) {
      return targetId;
    }
  }

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
  if (!options.length) return undefined;

  const selectedCombatantId = getSelectedCombatantId(options, preferredCombatantId);
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

  return new Promise(resolve => {
    const buttons = {
      select: {
        label: game.i18n.localize('PMTTRPG.Dialog.selectTarget'),
        callback: html => {
          const form = html[0].querySelector('form');
          const combatantId = form.combatantId?.value ?? selectedCombatantId;
          resolve(resolveCombatantTarget(combatantId, { combat, actorId: actor?.id ?? null }));
        }
      },
      cancel: {
        label: game.i18n.localize('PMTTRPG.Dialog.cancel'),
        callback: () => resolve(null)
      }
    };

    if (allowNone) {
      buttons.none = {
        label: game.i18n.localize('PMTTRPG.Dialog.noTarget'),
        callback: () => resolve(null),
      };
    }

    new Dialog({
      title,
      content: html,
      buttons,
      close: () => resolve(null)
    }, dlgOptions).render(true);
  });
}

export async function rollInitiative(actor, { macroMisc = null, manualMisc = null } = {}) {
  if (!actor) return false;

  const parts = computeInitiativeFormulaParts(actor, { macroMisc, manualMisc });
  const roll = await (new Roll(parts.formula, actor.getRollData())).evaluate({ async: true });
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
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderTemplate('systems/projectmoonttrpg/templates/chat/chat-move.html', templateData),
  };

  const rollMode = game.settings.get('core', 'rollMode');
  if (["gmroll", "blindroll"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients('GM');
  if (rollMode === 'selfroll') chatData.whisper = [game.user.id];
  if (rollMode === 'blindroll') chatData.blind = true;

  await ChatMessage.create(chatData);

  const combat = game.combat;
  if (combat) {
    const combatant = combat.combatants.find(entry => entry.actor?.id === actor.id) ?? null;
    if (combatant) {
      await combat.updateEmbeddedDocuments('Combatant', [{ _id: combatant.id, initiative: roll.total }]);
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