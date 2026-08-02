/**
 * Public API for the clash system. Orchestrates all phases:
 *
 *   1. initiateAttack()         — attacker rolls, attack card posted
 *   2. handleRetaliateClick()   — retaliator chosen, dialog shown
 *   3. _executeClash()          — both rolls made, result computed
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
  postAttackCard,
  updateAttackCard,
  postResultCard,
} from "./clash-chat.js";

import {
  showRetaliationDialog,
  showInterceptConfirmDialog,
  promptRangedCounterAmmo,
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


  console.log(state);

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
  if (choice.type === RETALIATION_TYPES.COUNTER && _isRangedWeapon(choice.item)) {
    const ammoPick = await promptRangedCounterAmmo(retaliatorActor, choice.item);
    if (!ammoPick) return;
    choice.ammo = ammoPick.ammo;
    choice.consumeAmmo = ammoPick.consumeAmmo;
    choice.dryFire = ammoPick.dryFire;
  }

  console.log(choice);

  // Lock the card immediately so no one else retaliates.
  state.phase               = CLASH_PHASES.ROLLING;
  state.retaliatorActorId   = retaliatorActor.id;
  state.retaliatorTokenId   = retaliatorActor.getActiveTokens(true)[0]?.id ?? null;
  state.retaliatorName      = retaliatorActor.name;
  state.retaliatorImg       = retaliatorActor.img;
  state.retaliationItemId   = choice.item?.id   ?? null;
  state.retaliatorItemName  = choice.ammo
    ? `${choice.item?.name ?? ""} · ${choice.ammo.name}`
    : (choice.dryFire && choice.item
      ? `${choice.item.name} · ${game.i18n.localize("PMTTRPG.Clash.DryFireShort")}`
      : (choice.item?.name ?? null));
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
  const attackerActor = canvas.tokens.get(state?.attackerTokenId ?? null)?.actor ?? game.actors.get(state.attackerActorId) ?? null;
  let attackerItem   = attackerActor?.items.get(state.attackerItemId) ?? null;

  if(choice.type === RETALIATION_TYPES.ONESIDED) {
    choice.item = null;
    state.retaliationItemId = null;
    state.retaliatorItemName = null;
  }

  // Skill lifecycle — fire Always Active start if retaliating with a skill.
  const isSkill = choice.type === "skill" && choice.item;
  if (isSkill) {
    Hooks.callAll("pmttrpg.skillUseStart", { actor: retaliatorActor, skillItem: choice.item });
  }

  // Consume ammo once for the Counter Reaction.
  if (choice.ammo && choice.consumeAmmo) {
    const qty = Number(choice.ammo.system?.quantity ?? 0);
    if (qty > 0) {
      await choice.ammo.update({ "system.quantity": Math.max(0, qty - 1) });
    }
  }

  const counterDryFire = choice.type === RETALIATION_TYPES.COUNTER
    && (_isRangedWeapon(choice.item) && (choice.dryFire === true || !choice.ammo));
  const defenseRollOptions = counterDryFire ? { disadvantage: true } : {};

  // Rebuild clash context so EasyEffects On Clash can add bonuses before the roll.
  const clashCtx = createClashContext(state.attackRollTotal, 0);

  Hooks.callAll("pmttrpg.clashStarted", {
    attacker:     attackerActor,
    defender:     retaliatorActor,
    attackerItem,
    defenderItem: choice.item ?? null,
    clash:        clashCtx,
  });

  // Roll defense, then reroll both sides on ties.
  let attackTotal = state.attackRollTotal;
  let defenseResult = await _rollDefense(retaliatorActor, choice, attackerItem, clashCtx.bonuses, defenseRollOptions);
  let { result, margin } = resolveClash(attackTotal, defenseResult.total);

  while (result === CLASH_RESULTS.TIE && choice.type !== RETALIATION_TYPES.ONESIDED) {
    const attackReroll = await rollAttack(attackerActor, attackerItem, clashCtx.bonuses);
    defenseResult = await _rollDefense(retaliatorActor, choice, attackerItem, clashCtx.bonuses, defenseRollOptions);
    attackTotal = attackReroll.total;
    state.attackRollTotal = attackTotal;
    state.attackRollFormula = attackReroll.formula;
    state.attackRollTerms = attackReroll.terms;
    ({ result, margin } = resolveClash(attackTotal, defenseResult.total));
  }

  // Update clash context with final rolls.
  clashCtx.attackerRoll = attackTotal;
  clashCtx.defenderRoll = defenseResult.total;
  clashCtx.margin       = margin;

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
  // - Attack win: Block Lose reduces by margin; Counter/Evade/one-sided keep full attack.
  // - Counter win: if original attacker is in counter weapon range, they take the counter.
  // - Block win: ST rebound to attacker, except ranged attackers.
  const counterItem = choice.type === RETALIATION_TYPES.COUNTER ? (choice.item ?? null) : null;
  let counterConnects = false;

  if (result === CLASH_RESULTS.ATTACK_WIN) {
    const finalResult = state.retaliationType === RETALIATION_TYPES.BLOCK ? margin : attackTotal;
    state.hpDamage = finalResult;
    state.stDamage = finalResult;
  } else if (result === CLASH_RESULTS.DEFENSE_WIN && state.retaliationType === RETALIATION_TYPES.BLOCK) {
    state.blockWinStExempt = _isRangedWeapon(attackerItem);
  } else if (result === CLASH_RESULTS.DEFENSE_WIN && counterItem) {
    const inRange = _isTargetInWeaponRange(
      state.retaliatorTokenId,
      state.attackerTokenId,
      counterItem,
    );
    state.counterInRange = inRange;
    if (inRange) {
      counterConnects = true;
      state.hpDamage = defenseResult.total;
      state.stDamage = defenseResult.total;
      state.damageType = counterItem.system?.damageTypeFixed ? (counterItem.system?.damageType ?? state.damageType)
      : (choice.ammo?.system?.damageType ?? counterItem.system?.damageType ?? state.damageType);
    }
  }

  state.phase    = CLASH_PHASES.RESOLVED;

  // Effective DMG type for this resolution (ammo, unless the weapon has a fixed type).
  clashCtx.damageType = state.damageType;

  // Fire clash resolution hooks for EasyEffects.
  const winner = result === CLASH_RESULTS.ATTACK_WIN ? attackerActor  : retaliatorActor;
  const loser  = result === CLASH_RESULTS.ATTACK_WIN ? retaliatorActor : attackerActor;

  Hooks.callAll("pmttrpg.clashResolved", {
    winner,
    loser,
    attacker:      attackerActor,
    attackerItem:  attackerItem,
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
      damageType: state.damageType,
      clash:    clashCtx,
    });
  } else if (counterConnects) {
    // Counter connects as a normal attack from the retaliator onto the original attacker.
    Hooks.callAll("pmttrpg.attackConnected", {
      attacker: retaliatorActor,
      defender: attackerActor,
      item:     counterItem,
      damageType: state.damageType,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isRangedWeapon(weapon) {
  return weapon?.system?.weaponType === "ranged";
}

/**
 * Effective weapon range in squares.
 * Melee 1, Long melee 2, Ranged 10.
 * @param {Item|null} weapon
 * @returns {number}
 */
function _getWeaponRangeSquares(weapon) {
  if (!weapon) return 1;
  if (_isRangedWeapon(weapon)) return 10;
  if (weapon.system?.formProperty === "long") return 2;
  return 1;
}

/**
 * Grid distance in squares between two tokens.
 * @param {Token|null} tokenA
 * @param {Token|null} tokenB
 * @returns {number|null}
 */
function _tokenDistanceSquares(tokenA, tokenB) {
  if (!tokenA || !tokenB || !canvas?.grid) return null;

  const a = canvas.grid.getOffset(tokenA.center);
  const b = canvas.grid.getOffset(tokenB.center);
  if (!a || !b) return null;

  return Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
}

function _isTargetInWeaponRange(fromTokenId, toTokenId, weapon) {
  const from = fromTokenId ? canvas.tokens.get(fromTokenId) : null;
  const to   = toTokenId ? canvas.tokens.get(toTokenId) : null;
  const distance = _tokenDistanceSquares(from, to);
  if (distance == null) return true;
  return distance <= _getWeaponRangeSquares(weapon);
}

/**
 * Rolls the defender's side of a clash for the chosen retaliation type.
 * @param {ActorPMTTRPG} retaliatorActor
 * @param {RetaliationChoice} choice
 * @param {Item|null} attackerItem
 * @param {object} bonuses
 * @param {object} [rollOptions]
 * @returns {Promise<object>}
 */
async function _rollDefense(retaliatorActor, choice, attackerItem, bonuses, rollOptions = {}) {
  switch (choice.type) {
    case RETALIATION_TYPES.EVADE:
      return rollEvade(retaliatorActor, bonuses);
    case RETALIATION_TYPES.BLOCK:
      return rollBlock(retaliatorActor, bonuses);
    case RETALIATION_TYPES.COUNTER:
    case "skill":
      return rollCounter(retaliatorActor, choice.item ?? attackerItem, bonuses, rollOptions);
    case RETALIATION_TYPES.ONESIDED:
      return {
        total:   0,
        formula: "1d1-1",
        terms:   [],
      };
    default:
      return rollEvade(retaliatorActor, bonuses);
  }
}

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
};