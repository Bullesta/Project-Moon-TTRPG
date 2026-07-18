/**
 * Public API for the clash system. Orchestrates all phases:
 *
 *   1. initiateAttack()         — attacker rolls, attack card posted
 *   2. handleRetaliateClick()   — retaliator chosen, dialog shown
 *   3. _executeClash()          — both rolls made, result computed
 *   4. handleTakeDamageClick()  — damage applied from result card
 *
 * EasyEffects hooks fired here:
 *   pmttrpg.clashStarted       { attacker, defender, attackerItem, defenderItem, clash }
 *   pmttrpg.clashResolved      { winner, loser, attackerItem, defenderItem,
 *                                attackerRoll, defenderRoll, clash }
 *   pmttrpg.attackConnected    { attacker, defender, item, clash }
 *   pmttrpg.damageCalc         { attacker, defender, attackerItem, clash }
 *   pmttrpg.skillUseStart      { actor, skillItem }
 *   pmttrpg.skillUseEnd        { actor, skillItem }
 */

import {
  createClashState,
  CLASH_PHASES,
  CLASH_RESULTS,
  RETALIATION_TYPES,
  CLASH_FLAG_SCOPE,
  CLASH_FLAG_KEY,
  serialiseClashState,
  deserialiseClashState,
} from "./clash-state.js";

import {
  rollEvade,
  rollAttack,
  rollCounter,
  rollBlock,
  resolveClash,
} from "./clash-rolls.js";

import {
  computeClashDamage,
  applyHPDamage,
  applySTDamage,
  applySTRegen,
} from "./clash-damage.js";

import {
  postAttackCard,
  updateAttackCard,
  postResultCard,
} from "./clash-chat.js";

import {
  showRetaliationDialog,
  showInterceptConfirmDialog,
} from "./clash-dialog.js";

import { createClashContext } from "../easy-effects/registry.js";

// ── Phase 1: Initiate Attack ──────────────────────────────────────────────────

/**
 * Called when an actor makes an attack with a weapon.
 * Rolls the attack, posts the attack card, and waits for a retaliator.
 *
 * @param {AttackPayload} attackPayload
 * @returns {Promise<void>}
 */
export async function initiateAttack(attackPayload) {
  // Create a fresh clash context so EasyEffects On Clash Start can write bonuses.
  const clashCtx = createClashContext(attackPayload.roll, 0);

  // Fire On Clash Start for any [Always Active] bonus application.
  const defenderActor = attackPayload.target ?? null;
  Hooks.callAll("pmttrpg.clashStarted", {
    attacker:       attackPayload.actor,
    defender:       attackPayload.target,
    attackerItem:   attackPayload.item,
    defenderItem:   null,
    clash:          clashCtx,
  });

  // Roll the attack, applying any bonuses accumulated by On Clash Start.
  // const attackResult = await rollAttack(attacker, weaponItem, clashCtx.bonuses);

  // Update clash context with the real roll.
  clashCtx.attackerRoll  = attackPayload.roll;
  clashCtx.defenderRoll  = 0;
  clashCtx.margin        = 0;

  console.log(attackPayload);

  // Create a temporary message to get an ID, then use that ID in the state.
  // This way the buttons have data-message-id when they render.
  const tempMessage = await ChatMessage.create({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: attackPayload.actor }),
    content: "<!-- temp -->",
    flags: { [CLASH_FLAG_SCOPE]: { [CLASH_FLAG_KEY]: null } },
  });

  const state = createClashState({
    attackerActorId:   attackPayload.actorId,
    attackerTokenId:   attackPayload.actor.getActiveTokens(true)[0]?.id ?? null,
    attackerName:      attackPayload.actor.name,
    attackerImg:       attackPayload.actor.img,
    attackerItemId:    attackPayload.itemId,
    attackerItemName:  attackPayload.item.name,
    targetActorId:     attackPayload.targetActorId   ?? null,
    targetTokenId:     attackPayload.targetTokenId   ?? null,
    targetName:        attackPayload.targetName      ?? null,
    targetImg:         attackPayload.targetImg       ?? null,
    attackRollTotal:   attackPayload.roll.total,
    attackRollFormula: attackPayload.templateData.formula,
    damageType:        attackPayload.item.system?.damageType ?? "slash",
    attackMessageId:   tempMessage.id,
  });

  await postAttackCard(state, attackPayload.roll, tempMessage.id);
}

// ── Phase 2: Retaliate Button Clicked ────────────────────────────────────────

/**
 * Handles a click on "Retaliate" or "Intercept" buttons on the attack card.
 * Shows the retaliation dialog and proceeds to execute the clash.
 *
 * @param {ClashStateData} state
 * @param {object} [options]
 * @param {boolean} [options.isIntercept=false]
 * @returns {Promise<void>}
 */
export async function handleRetaliateClick(state, { isIntercept = false } = {}) {
  // Block if the clash is already in progress or resolved.
  if (state.phase !== CLASH_PHASES.PENDING) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.AlreadyRetaliating"));
    return;
  }

  // Intercept: require two-click confirmation.
  if (isIntercept) {
    const confirmed = await showInterceptConfirmDialog();
    if (!confirmed) return;
  }

  // Determine the retaliating actor from the current user's owned characters.
  const retaliatorActor = _getOwnedActor();
  if (!retaliatorActor) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.NoOwnedActor"));
    return;
  }

  const choice = await showRetaliationDialog(retaliatorActor, state, { isIntercept });
  if (!choice) return;

  // Lock the card immediately so no one else retaliates.
  state.phase               = CLASH_PHASES.ROLLING;
  state.retaliatorActorId   = retaliatorActor.id;
  state.retaliatorTokenId   = retaliatorActor.getActiveTokens(true)[0]?.id ?? null;
  state.retaliatorName      = retaliatorActor.name;
  state.retaliatorImg       = retaliatorActor.img;
  state.retaliationItemId   = choice.item?.id   ?? null;
  state.retaliatorItemName  = choice.item?.name ?? null;
  state.retaliationType     = choice.type;

  await updateAttackCard(state.attackMessageId, state);
  await _executeClash(state, retaliatorActor, choice);
}

// ── Phase 3: Execute Clash ────────────────────────────────────────────────────

/**
 * Executes both sides of the clash, resolves the result, fires EasyEffects
 * hooks, and posts the result card.
 *
 * @param {ClashStateData} state
 * @param {ActorPMTTRPG}   retaliatorActor
 * @param {RetaliationChoice} choice
 * @returns {Promise<void>}
 */
async function _executeClash(state, retaliatorActor, choice) {
  const attackerActor  = game.actors.get(state.attackerActorId);
  const attackerItem   = attackerActor?.items.get(state.attackerItemId) ?? null;

  // Skill lifecycle — fire Always Active start if retaliating with a skill.
  const isSkill = choice.type === "skill" && choice.item;
  if (isSkill) {
    Hooks.callAll("pmttrpg.skillUseStart", { actor: retaliatorActor, skillItem: choice.item });
  }

  // Rebuild clash context so EasyEffects On Clash can add bonuses before the roll.
  const clashCtx = createClashContext(state.attackRollTotal, 0);

  Hooks.callAll("pmttrpg.clashStarted", {
    attacker:     attackerActor,
    defender:     retaliatorActor,
    attackerItem,
    defenderItem: choice.item ?? null,
    clash:        clashCtx,
  });

  // Make the defense roll.
  let defenseResult;
  switch (choice.type) {
    case RETALIATION_TYPES.EVADE:
      defenseResult = await rollEvade(retaliatorActor, clashCtx.bonuses);
      break;
    case RETALIATION_TYPES.BLOCK:
      defenseResult = await rollBlock(retaliatorActor, clashCtx.bonuses);
      break;
    case RETALIATION_TYPES.COUNTER:
    case RETALIATION_TYPES.INTERCEPT:
    case "skill":
      defenseResult = await rollCounter(retaliatorActor, choice.item ?? attackerItem, clashCtx.bonuses);
      break;
    default:
      defenseResult = await rollEvade(retaliatorActor, clashCtx.bonuses);
  }

  // Update clash context with final rolls.
  clashCtx.defenderRoll = defenseResult.total;
  clashCtx.margin       = Math.abs(state.attackRollTotal - defenseResult.total);

  // Resolve winner.
  const { result, margin } = resolveClash(state.attackRollTotal, defenseResult.total);

  state.defenseRollTotal   = defenseResult.total;
  state.defenseRollFormula = defenseResult.formula;
  state.defenseRollTerms   = defenseResult.terms;
  state.result             = result;
  state.margin             = margin;

  // Fire EasyEffects On Damage Calc before computing damage so bonuses accumulate.
  Hooks.callAll("pmttrpg.damageCalc", {
    attacker:     attackerActor,
    defender:     retaliatorActor,
    attackerItem,
    clash:        clashCtx,
  });

  // Compute damage using accumulated bonuses.
  const baseDamage = Number(attackerItem?.system?.damageBonus ?? 0);
  const { hpDamage, stDamage, stRegen } = computeClashDamage({
    attacker:          attackerActor,
    defender:          retaliatorActor,
    retaliationType:   choice.type,
    result,
    attackRollTotal:   state.attackRollTotal,
    defenseRollTotal:  defenseResult.total,
    damageType:        state.damageType,
    clashBonuses:      clashCtx.bonuses,
    baseDamage,
  });

  state.hpDamage = hpDamage;
  state.stDamage = stDamage;
  state.stRegen  = stRegen;
  state.phase    = CLASH_PHASES.RESOLVED;

  // Fire clash resolution hooks for EasyEffects.
  const winner = result === CLASH_RESULTS.ATTACK_WIN ? attackerActor  : retaliatorActor;
  const loser  = result === CLASH_RESULTS.ATTACK_WIN ? retaliatorActor : attackerActor;

  Hooks.callAll("pmttrpg.clashResolved", {
    winner,
    loser,
    attackerItem,
    defenderItem:  choice.item ?? null,
    attackerRoll:  state.attackRollTotal,
    defenderRoll:  defenseResult.total,
    clash:         clashCtx,
  });

  if (result === CLASH_RESULTS.ATTACK_WIN) {
    Hooks.callAll("pmttrpg.attackConnected", {
      attacker: attackerActor,
      defender: retaliatorActor,
      item:     attackerItem,
      clash:    clashCtx,
    });
  }

  // End skill lifecycle.
  if (isSkill) {
    Hooks.callAll("pmttrpg.skillUseEnd", { actor: retaliatorActor, skillItem: choice.item });
  }

 // Post result card via placeholder pattern (same as attack card).
  // Create placeholder first so the message has an ID before rendering.
  const tempResultMessage = await ChatMessage.create({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: game.actors.get(state.attackerActorId) }),
    content: "<!-- temp -->",
    flags: { [CLASH_FLAG_SCOPE]: { [CLASH_FLAG_KEY]: null } },
  });
 
  state.resultMessageId = tempResultMessage.id;
 
  // Post the real result card content, updating the placeholder.
  await postResultCard(state, defenseResult.roll, tempResultMessage.id);
 
  // Update attack card to "resolved" state.
  await updateAttackCard(state.attackMessageId, state);
}

// ── Phase 4: Take the Damage ──────────────────────────────────────────────────

/**
 * Handles the "Take the Damage" button on the result card.
 * Applies pre-computed HP, ST, and ST regen to the appropriate actors.
 *
 * @param {ClashStateData} state
 * @param {string}         resultMessageId
 * @returns {Promise<void>}
 */
export async function handleTakeDamageClick(state, resultMessageId) {
  if (state.phase === CLASH_PHASES.CLOSED) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.AlreadyApplied"));
    return;
  }

  const defenderActor  = game.actors.get(state.retaliatorActorId);
  const attackerActor  = game.actors.get(state.attackerActorId);

  if (!defenderActor) {
    ui.notifications.error(game.i18n.localize("PMTTRPG.Clash.ActorNotFound"));
    return;
  }

  // Apply HP damage to defender.
  if (state.hpDamage > 0) {
    await applyHPDamage(defenderActor, state.hpDamage, {
      damageType: state.damageType,
      source:     "clash",
      attacker:   attackerActor,
    });
  }

  // Apply ST damage to defender.
  if (state.stDamage > 0) {
    await applySTDamage(defenderActor, state.stDamage, {
      source:   "clash",
      attacker: attackerActor,
    });
  }

  // Apply ST regen to defender (evade win).
  if (state.stRegen > 0) {
    await applySTRegen(defenderActor, state.stRegen, { source: "clash-evade" });
  }

  // Mark clash as closed and disable the button.
  state.phase = CLASH_PHASES.CLOSED;
  const resultMsg = game.messages.get(resultMessageId);
  if (resultMsg) {
    await resultMsg.update({
      [`flags.${CLASH_FLAG_SCOPE}.${CLASH_FLAG_KEY}`]: serialiseClashState(state),
    });
  }

  // Re-render the result card with the closed state (disables the button).
  const attackMsg = game.messages.get(state.attackMessageId);
  if (attackMsg) await updateAttackCard(state.attackMessageId, state);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the first actor owned by the current user that is a character.
 * Prefers actors with an active token on the current scene.
 */
function _getOwnedActor() {
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length) return controlled[0].actor ?? null;

  return game.actors.find(
    a => a.type === "character" && a.isOwner
  ) ?? null;
}

// ── Public exports ────────────────────────────────────────────────────────────

export const PMTTRPGClashAPI = {
  initiateAttack,
  handleRetaliateClick,
  handleTakeDamageClick,
};