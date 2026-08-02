/**
 * All dice roll logic for the clash system.
 * Returns plain result objects — does not touch chat or Foundry documents.
 *
 * Roll anatomy (all clash rolls):
 *   Attack:  weapon offensive dice + attackModifier
 *   Evade:   1d12 (or outfit evadeDice) + evadeModifier
 *   Block:   1d10 (or outfit blockDice) + blockModifier
 *   Counter: chosen weapon offensive dice + attackModifier
 */

/**
 * @typedef {object} RollResult
 * @property {number}   total
 * @property {string}   formula
 * @property {Roll}     roll       — live Roll instance (for rendering)
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the equipped outfit for an actor, or null.
 * @param {ActorPMTTRPG} actor
 * @returns {Item|null}
 */
function getEquippedOutfit(actor) {
  return actor.items.find(i => i.type === "outfit" && i.system?.equipped) ?? null;
}

/**
 * Returns the computed evade dice string from the actor's equipped outfit,
 * falling back to the system default.
 * @param {ActorPMTTRPG} actor
 * @returns {string}
 */
function getEvadeDiceFormula(actor) {
  const outfit = getEquippedOutfit(actor);
  return outfit?.system?.evadeDiceComputed ?? "todef";
}

/**
 * Returns the computed block dice string from the actor's equipped outfit.
 * @param {ActorPMTTRPG} actor
 * @returns {string}
 */
function getBlockDiceFormula(actor) {
  const outfit = getEquippedOutfit(actor);
  return outfit?.system?.blockDiceComputed ?? "todef";
}

/**
 * Builds and evaluates a Roll, returning a RollResult.
 * @param {string} formula
 * @param {object} rollData
 * @returns {Promise<RollResult>}
 */
async function evaluate(formula, rollData = {}) {
  const roll = await new Roll(formula, rollData).evaluate();
  return {
    total:   roll.total,
    formula: roll.formula,
    terms:   roll.toJSON().terms,
    roll,
  };
}


/**
 * Rolls an attack with the given weapon item.
 * Formula: offensiveDice + attackModifier
 *
 * @param {ActorPMTTRPG} actor
 * @param {Item} weaponItem
 * @param {object} [bonuses]  — clash.bonuses from EasyEffects (attackPower, attackMax)
 * @returns {Promise<RollResult>}
 */
export async function rollAttack(actor, weaponItem, bonuses = {}) {
  let baseDice = weaponItem.system?.offensiveDice ?? "todef";
  let modifier = 0;
  if(baseDice === "todef") {
    modifier = Number(actor.system?.attributes?.attackModifier?.value ?? 0)
    baseDice = "1d10+0";
  };
  const powerUp = Number(bonuses.attackPower ?? 0);
  const maxUp = Number(bonuses.attackMax   ?? 0);
 
  // Power up/down changes the dice tier; max up changes the max face.
  // For now we apply powerUp as a flat bonus and maxUp as an additive bonus.
  // Wire to your dice-tier system when ready.
  const bonusStr = buildBonusString(modifier + powerUp + maxUp);
  const formula  = `${baseDice}${bonusStr}`;
  return evaluate(formula, actor.getRollData());
}
 
/**
 * Rolls an evade with the actor's equipped outfit dice.
 * Formula: evadeDice + evadeModifier
 *
 * @param {ActorPMTTRPG} actor
 * @param {object} [bonuses]
 * @returns {Promise<RollResult>}
 */
export async function rollEvade(actor, bonuses = {}) {
  let baseDice = getEvadeDiceFormula(actor);
  let modifier;
  if(baseDice === "todef") {
    modifier = Number(actor.system?.attributes?.evadeModifier?.value ?? 0);
    baseDice = "1d12+0"; 
  };
  const powerUp  = Number(bonuses.evadePower ?? 0);
  const maxUp    = Number(bonuses.evadeMax   ?? 0);
  const formula  = `${baseDice}${buildBonusString(modifier + powerUp + maxUp)}`;
  return evaluate(formula, actor.getRollData());
}
 
/**
 * Rolls a block with the actor's equipped outfit dice.
 * Formula: blockDice + blockModifier
 *
 * @param {ActorPMTTRPG} actor
 * @param {object} [bonuses]
 * @returns {Promise<RollResult>}
 */
export async function rollBlock(actor, bonuses = {}) {
  let baseDice = getBlockDiceFormula(actor);
  let modifier;
  if(baseDice === "todef") {
    modifier = Number(actor.system?.attributes?.blockModifier?.value ?? 0);
    baseDice = "1d10+0"; 
  };
  const powerUp  = Number(bonuses.blockPower ?? 0);
  const maxUp    = Number(bonuses.blockMax   ?? 0);
  const formula  = `${baseDice}${buildBonusString(modifier + powerUp + maxUp)}`;
  return evaluate(formula, actor.getRollData());
}
 
/**
 * Rolls a counter-attack with a chosen weapon.
 * Mechanically identical to rollAttack.
 *
 * @param {ActorPMTTRPG} actor
 * @param {Item} weaponItem
 * @param {object} [bonuses]
 * @returns {Promise<RollResult>}
 */
export async function rollCounter(actor, weaponItem, bonuses = {}) {
  return rollAttack(actor, weaponItem, bonuses);
}

// ── Clash resolution ──────────────────────────────────────────────────────────

/**
 * Compares attack and defense rolls and returns the clash result.
 *
 * Rules:
 *   Attack wins  → attackTotal > defenseTotal
 *   Defense wins → defenseTotal > attackTotal
 *   Tie          → equal totals (rerolls both sides)
 *
 * @param {number} attackTotal
 * @param {number} defenseTotal
 * @returns {{ result: string, margin: number }}
 */
export function resolveClash(attackTotal, defenseTotal) {
  const margin = Math.abs(attackTotal - defenseTotal);
  if (attackTotal === defenseTotal) {
    return { result: "tie", margin: 0 };
  }
  if (attackTotal > defenseTotal) {
    return { result: "attackWin", margin };
  }
  return { result: "defenseWin", margin };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Converts a numeric modifier to a string suitable for appending to a dice formula.
 * e.g.  3  → "+3"
 *       -2 → "-2"
 *        0 → ""
 */
function buildBonusString(value) {
  if (!value) return "";
  return value >= 0 ? `+${value}` : `${value}`;
}