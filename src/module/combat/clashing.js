/**
 * Public API for the clash system. Orchestrates all phases:
 *
 *   1. initiateAttack()         — attack card posted, waiting for a retaliator
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

import { createClashContext, emitAttackConnected, emitClashStarted, emitClashResolved } from "../easy-effects/registry.js";
import { exhaustRemainingSquares } from "./movement.js";
import {
  bumpRecycledEvade,
  clearRecycledEvade,
  getRecycledEvade,
  grantRecycledEvade,
  recycledPowerPenalty,
} from "./recycled-evade.js";

const REACTIONS_THAT_CLEAR_RECYCLED = new Set([
  RETALIATION_TYPES.EVADE,
  RETALIATION_TYPES.BLOCK,
  RETALIATION_TYPES.COUNTER,
]);

// ── Phase 1: Initiate Attack ──────────────────────────────────────────────────

/**
 * Called when an actor makes an attack with a weapon.
 * Posts the attack card and waits for a retaliator (rolls happen in _executeClash).
 *
 * @param {AttackPayload} attackPayload
 * @returns {Promise<void>}
 */
export async function initiateAttack(attackPayload) {
  // Create a temporary message to get an ID, then use that ID in the state.
  // This way the buttons have data-message-id when they render.
  const tempMessage = await ChatMessage.create({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: attackPayload.actor }),
    content: "<!-- temp -->",
    flags: { [CLASH_FLAG_SCOPE]: { [CLASH_FLAG_KEY]: null } },
  });

  const dryFireShort = game.i18n.localize("PMTTRPG.Clash.DryFireShort");
  let attackerItemName = attackPayload.templateData?.dryFire
    ? `${attackPayload.item.name} · ${dryFireShort}`
    : (attackPayload.templateData?.ammoName
      ? `${attackPayload.item.name} · ${attackPayload.templateData.ammoName}`
      : attackPayload.item.name);
  const skillName = attackPayload.templateData?.skillName;
  if (skillName) attackerItemName = `${attackerItemName} · ${skillName}`;

  const attackerSkillId = attackPayload.templateData?.skillId ?? null;
  const consumeSkillLight = !!attackerSkillId && attackPayload.templateData?.consumeSkillLight !== false;

  if (consumeSkillLight) {
    const skill = attackPayload.actor?.items.get(attackerSkillId) ?? null;
    await _spendSkillLight(attackPayload.actor, skill);
  }

  if (_rangedAttackConsumesMovement(attackPayload.item)) {
    try {
      await exhaustRemainingSquares(attackPayload.actor);
    } catch (error) {
      console.warn("[PMTTRPG] exhaust remaining squares failed", error);
    }
  }

  const state = createClashState({
    attackerActorId:   attackPayload.actorId,
    attackerTokenId:   attackPayload.actor.getActiveTokens(true)[0]?.id ?? null,
    attackerName:      attackPayload.actor.name,
    attackerImg:       attackPayload.actor.img,
    attackerItemId:    attackPayload.itemId,
    attackerItemName,
    targetActorId:     attackPayload.targetActorId   ?? null,
    targetTokenId:     attackPayload.targetTokenId   ?? null,
    targetName:        attackPayload.targetName      ?? null,
    targetImg:         attackPayload.targetImg       ?? null,
    attackRollTotal:   null,
    attackRollFormula: null,
    attackRollTerms:   null,
    damageType:        attackPayload.templateData?.damageType
      || attackPayload.item.system?.damageType
      || "none",
    attackMessageId:   tempMessage.id,
    clashBonuses:      null,
    attackRollBreakdown: null,
    appliedToolId:     attackPayload.templateData?.appliedToolId ?? null,
    attackerSkillId,
    consumeSkillLight,
    attackerDryFire:   attackPayload.templateData?.dryFire === true,
  });

  await postAttackCard(state, null, tempMessage.id);
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
  if (choice.type === RETALIATION_TYPES.RECYCLED_EVADE && !getRecycledEvade(retaliatorActor)) {
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.RecycledEvadeGone"));
    return;
  }

  if (choice.type === RETALIATION_TYPES.COUNTER && _isRangedWeapon(choice.item)) {
    const ammoPick = await promptRangedCounterAmmo(retaliatorActor, choice.item);
    if (!ammoPick) return;
    choice.ammo = ammoPick.ammo;
    choice.consumeAmmo = ammoPick.consumeAmmo;
    choice.dryFire = ammoPick.dryFire;
  }

  // Lock the card immediately so no one else retaliates.
  state.phase               = CLASH_PHASES.ROLLING;
  state.retaliatorActorId   = retaliatorActor.id;
  state.retaliatorTokenId   = retaliatorActor.getActiveTokens(true)[0]?.id ?? null;
  state.retaliatorName      = retaliatorActor.name;
  state.retaliatorImg       = retaliatorActor.img;
  state.retaliationItemId   = choice.item?.id ?? null;
  state.retaliatorItemName  = _retaliatorItemLabel(choice);
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
  const appliedTool  = state.appliedToolId
    ? (attackerActor?.items.get(state.appliedToolId) ?? null)
    : null;
  const attackerSkill = state.attackerSkillId
    ? (attackerActor?.items.get(state.attackerSkillId) ?? null)
    : null;

  if(choice.type === RETALIATION_TYPES.ONESIDED) {
    choice.item = null;
    choice.skillItem = null;
    state.retaliationItemId = null;
    state.retaliatorItemName = null;
  }

  let isRecycled = choice.type === RETALIATION_TYPES.RECYCLED_EVADE || choice.recycled === true;
  if (isRecycled && !getRecycledEvade(retaliatorActor)) {
    isRecycled = false;
    choice.type = RETALIATION_TYPES.EVADE;
    choice.recycled = false;
    state.retaliationType = RETALIATION_TYPES.EVADE;
    ui.notifications.warn(game.i18n.localize("PMTTRPG.Clash.RecycledEvadeGone"));
  }
  if (!isRecycled && REACTIONS_THAT_CLEAR_RECYCLED.has(choice.type)) {
    await clearRecycledEvade(retaliatorActor);
  }

  const defenderSkill = choice.skillItem ?? null;
  if (attackerSkill) {
    Hooks.callAll("pmttrpg.skillUseStart", { actor: attackerActor, skillItem: attackerSkill });
  }
  if (defenderSkill) {
    Hooks.callAll("pmttrpg.skillUseStart", { actor: retaliatorActor, skillItem: defenderSkill });
  }
  if (defenderSkill && choice.consumeSkillLight !== false) {
    await _spendSkillLight(retaliatorActor, defenderSkill);
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

  // Rebuild clash context so EasyEffects On Clash can add bonuses before the roll.
  const clashCtx = createClashContext();
  clashCtx.isRecycledEvade = isRecycled;
  const defenderItem = choice.item ?? null;
  const clashPayloadBase = {
    attacker:     attackerActor,
    defender:     retaliatorActor,
    attackerItem,
    defenderItem,
    appliedTool,
    attackerSkill,
    defenderSkill,
    retaliationType: choice.type,
    isRecycledEvade: isRecycled,
    clash:        clashCtx,
  };

  await emitClashStarted({ ...clashPayloadBase, side: "attacker" });
  await emitClashStarted({ ...clashPayloadBase, side: "defender" });

  if (state.attackerDryFire) {
    clashCtx.bonuses.attacker.disadvantage =
      (Number(clashCtx.bonuses.attacker.disadvantage) || 0) + 1;
  }
  if (counterDryFire) {
    clashCtx.bonuses.defender.disadvantage =
      (Number(clashCtx.bonuses.defender.disadvantage) || 0) + 1;
  }
  if (isRecycled) {
    clashCtx.bonuses.defender.evadePower =
      (Number(clashCtx.bonuses.defender.evadePower) || 0) + recycledPowerPenalty(retaliatorActor);
  }

  state.clashBonuses = foundry.utils.deepClone(clashCtx.bonuses);

  let [attackResult, defenseResult] = await Promise.all([
    rollAttack(attackerActor, attackerItem, clashCtx.bonuses.attacker),
    _rollDefense(
      retaliatorActor,
      choice,
      attackerItem,
      clashCtx.bonuses.defender,
    ),
  ]);

  let attackTotal = attackResult.total;
  state.attackRollTotal = attackTotal;
  state.attackRollFormula = attackResult.formula;
  state.attackRollTerms = attackResult.terms;
  state.attackRollBreakdown = attackResult.breakdown ?? null;

  try {
    await game.projectmoonttrpg?.statusMacros?.emitAttackRoll({
      actor: attackerActor,
      actorId: attackerActor?.id ?? null,
      item: attackerItem,
      itemId: attackerItem?.id ?? null,
      roll: attackResult.roll,
      clash: clashCtx,
      clashBonuses: clashCtx.bonuses,
      rollBreakdown: attackResult.breakdown ?? [],
      targetActorId: retaliatorActor?.id ?? state.targetActorId,
      targetTokenId: state.retaliatorTokenId ?? state.targetTokenId,
      targetName: retaliatorActor?.name ?? state.targetName,
    });
  } catch (error) {
    console.warn("[PMTTRPG] Attack roll hook failed", error);
  }

  let { result, margin } = resolveClash(attackTotal, defenseResult.total);

  while (result === CLASH_RESULTS.TIE && choice.type !== RETALIATION_TYPES.ONESIDED) {
    const [attackReroll, defenseReroll] = await Promise.all([
      rollAttack(attackerActor, attackerItem, clashCtx.bonuses.attacker),
      _rollDefense(
        retaliatorActor,
        choice,
        attackerItem,
        clashCtx.bonuses.defender,
      ),
    ]);
    attackResult = attackReroll;
    defenseResult = defenseReroll;
    attackTotal = attackReroll.total;
    state.attackRollTotal = attackTotal;
    state.attackRollFormula = attackReroll.formula;
    state.attackRollTerms = attackReroll.terms;
    state.attackRollBreakdown = attackReroll.breakdown ?? state.attackRollBreakdown;
    ({ result, margin } = resolveClash(attackTotal, defenseResult.total));
  }

  // Update clash context with final rolls.
  clashCtx.attackerRoll = attackTotal;
  clashCtx.defenderRoll = defenseResult.total;
  clashCtx.margin       = margin;

  state.defenseRollTotal   = defenseResult.total;
  state.defenseRollFormula = defenseResult.formula;
  state.defenseRollTerms   = defenseResult.terms;
  state.defenseRollBreakdown = defenseResult.breakdown ?? null;
  state.result             = result;
  state.margin             = margin;

  // Fire EasyEffects On Damage Calc before computing damage so bonuses accumulate.
  Hooks.callAll("pmttrpg.damageCalc", {
    attacker:     attackerActor,
    defender:     retaliatorActor,
    attackerItem,
    appliedTool,
    attackerSkill,
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
      state.damageType = (counterItem.system?.damageTypeFixed
        ? (counterItem.system?.damageType || state.damageType)
        : (choice.ammo?.system?.damageType || counterItem.system?.damageType || state.damageType)
      ) || "none";
    }
  }

  state.phase    = CLASH_PHASES.RESOLVED;

  // Effective DMG type for this resolution (ammo, unless the weapon has a fixed type).
  clashCtx.damageType = state.damageType;

  // Post result card on the attack message
  state.resultMessageId = state.attackMessageId;
  await postResultCard(
    state,
    defenseResult.roll ?? null,
    state.attackMessageId,
    attackResult.roll ?? null,
  );

  // Fire clash resolution hooks for EasyEffects.
  const winner = result === CLASH_RESULTS.ATTACK_WIN ? attackerActor  : retaliatorActor;
  const loser  = result === CLASH_RESULTS.ATTACK_WIN ? retaliatorActor : attackerActor;

  await emitClashResolved({
    winner,
    loser,
    attacker:      attackerActor,
    defender:      retaliatorActor,
    attackerItem:  attackerItem,
    defenderItem,
    appliedTool,
    attackerSkill,
    defenderSkill,
    retaliationType: choice.type,
    isRecycledEvade: isRecycled,
    attackerRoll:  state.attackRollTotal,
    defenderRoll:  defenseResult.total,
    clash:         clashCtx,
  });

  if (attackerSkill) {
    Hooks.callAll("pmttrpg.skillUseEnd", { actor: attackerActor, skillItem: attackerSkill });
  }
  if (defenderSkill) {
    Hooks.callAll("pmttrpg.skillUseEnd", { actor: retaliatorActor, skillItem: defenderSkill });
  }

  if (isRecycled && result === CLASH_RESULTS.ATTACK_WIN) {
    await clearRecycledEvade(retaliatorActor);
  } else if (result === CLASH_RESULTS.DEFENSE_WIN && _isEvadeLike(choice)) {
    if (isRecycled) await bumpRecycledEvade(retaliatorActor);
    else await grantRecycledEvade(retaliatorActor);
  }

  if (result === CLASH_RESULTS.ATTACK_WIN) {
    await emitAttackConnected({
      attacker: attackerActor,
      defender: retaliatorActor,
      item:     attackerItem,
      appliedTool,
      attackerSkill,
      damageType: state.damageType,
      clash:    clashCtx,
    });
  } else if (counterConnects) {
    await emitAttackConnected({
      attacker: retaliatorActor,
      defender: attackerActor,
      item:     counterItem,
      attackerSkill: defenderSkill,
      damageType: state.damageType,
      clash:    clashCtx,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isRangedWeapon(weapon) {
  return weapon?.system?.weaponType === "ranged";
}

function _rangedAttackConsumesMovement(weapon) {
  return _isRangedWeapon(weapon) && weapon.system?.formProperty !== "lowCaliber";
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
    case RETALIATION_TYPES.RECYCLED_EVADE:
      return rollEvade(retaliatorActor, bonuses, rollOptions);
    case RETALIATION_TYPES.BLOCK:
      return rollBlock(retaliatorActor, bonuses, rollOptions);
    case RETALIATION_TYPES.COUNTER:
      return rollCounter(retaliatorActor, choice.item ?? attackerItem, bonuses, rollOptions);
    case RETALIATION_TYPES.ONESIDED:
      return {
        total:   0,
        formula: "1d1-1",
        terms:   [],
        breakdown: [],
        rollMode: "normal",
      };
    default:
      return rollEvade(retaliatorActor, bonuses, rollOptions);
  }
}

function _isEvadeLike(choice) {
  if (!choice) return false;
  return choice.type === RETALIATION_TYPES.EVADE || choice.type === RETALIATION_TYPES.RECYCLED_EVADE;
}

function _retaliatorItemLabel(choice) {
  if (choice?.ammo) {
    return `${choice.item?.name ?? ""} · ${choice.ammo.name}`;
  }
  if (choice?.dryFire && choice.item) {
    return `${choice.item.name} · ${game.i18n.localize("PMTTRPG.Clash.DryFireShort")}`;
  }
  if (choice?.type === RETALIATION_TYPES.RECYCLED_EVADE) {
    const recycledTag = game.i18n.localize("PMTTRPG.Clash.RecycledEvadeShort");
    const outfitName = choice.item?.name?.trim();
    const base = outfitName
      ? game.i18n.format("PMTTRPG.Clash.RecycledEvadeItem", { item: outfitName, tag: recycledTag })
      : recycledTag;
    return choice.skillItem ? `${base} · ${choice.skillItem.name}` : base;
  }
  const itemName = choice?.item?.name ?? null;
  if (itemName && choice?.skillItem?.name) return `${itemName} · ${choice.skillItem.name}`;
  return itemName;
}

async function _spendSkillLight(actor, skill) {
  const lightCost = Math.max(0, Number(skill?.system?.lightCost ?? 0));
  if (!actor || lightCost <= 0) return;
  const currentLight = Number(actor.system?.attributes?.light?.value ?? 0);
  await actor.update({
    "system.attributes.light.value": Math.max(0, currentLight - lightCost),
  });
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