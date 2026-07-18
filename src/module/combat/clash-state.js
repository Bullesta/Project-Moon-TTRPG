/**
 * ClashState is the canonical data object for a single clash lifecycle.
 * It is created when an attack is initiated, passed through every phase,
 * serialised into chat message flags for persistence, and rehydrated when
 * a player clicks a chat button.
 *
 * Nothing in this file touches Foundry documents directly — it only
 * describes shape and serialisation. All mutation happens in clash.js.
 *
 * Phases:
 *   "pending"   — attack roll posted, waiting for a retaliator
 *   "rolling"   — retaliator chosen, rolls pending
 *   "resolved"  — clash winner determined, result card posted
 *   "closed"    — damage taken / action completed
 */

export const CLASH_PHASES = Object.freeze({
  PENDING:  "pending",
  ROLLING:  "rolling",
  RESOLVED: "resolved",
  CLOSED:   "closed",
});

export const RETALIATION_TYPES = Object.freeze({
  EVADE:     "evade",
  BLOCK:     "block",
  COUNTER:   "counter",
  INTERCEPT: "intercept",
});

export const CLASH_RESULTS = Object.freeze({
  ATTACK_WIN: "attackWin",
  DEFENSE_WIN: "defenseWin",
  TIE: "tie",
});

/**
 * Creates a fresh ClashState for a new incoming attack.
 *
 * @param {object} params
 * @param {string} params.attackerActorId
 * @param {string} params.attackerTokenId
 * @param {string} params.attackerName
 * @param {string} params.attackerImg
 * @param {string} params.attackerItemId       — weapon/skill used to attack
 * @param {string} params.attackerItemName
 * @param {string|null} params.targetActorId   — null if no target was set
 * @param {string|null} params.targetTokenId
 * @param {string|null} params.targetName
 * @param {string|null} params.targetImg
 * @param {number} params.attackRollTotal
 * @param {string} params.attackRollFormula
 * @param {object[]} params.attackRollTerms    — Roll#terms serialised for reconstruction
 * @param {string} params.damageType           — "slash" | "pierce" | "blunt"
 * @param {string} params.attackMessageId      — the initial chat card message id
 * @returns {ClashStateData}
 */
export function createClashState({
  attackerActorId,
  attackerTokenId,
  attackerName,
  attackerImg,
  attackerItemId,
  attackerItemName,
  targetActorId   = null,
  targetTokenId   = null,
  targetName      = null,
  targetImg       = null,
  attackRollTotal,
  attackRollFormula,
  attackRollTerms,
  damageType      = "slash",
  attackMessageId,
}) {
  return {
    phase: CLASH_PHASES.PENDING,

    // Attacker
    attackerActorId,
    attackerTokenId,
    attackerName,
    attackerImg,
    attackerItemId,
    attackerItemName,

    // Primary target (may be overridden by an interceptor)
    targetActorId,
    targetTokenId,
    targetName,
    targetImg,

    // The actual retaliator (set when someone clicks Retaliate)
    retaliatorActorId:   null,
    retaliatorTokenId:   null,
    retaliatorName:      null,
    retaliatorImg:       null,
    retaliatorItemId:    null,
    retaliatorItemName:  null,
    retaliationType:     null,   // RETALIATION_TYPES value

    // Rolls
    attackRollTotal,
    attackRollFormula,
    attackRollTerms,
    defenseRollTotal:    null,
    defenseRollFormula:  null,
    defenseRollTerms:    null,

    // Result
    result:   null,   // CLASH_RESULTS value
    margin:   null,   // Math.abs(attacker - defender)
    damageType,

    // Damage calc (populated after result, read by Take the Damage)
    hpDamage:  null,
    stDamage:  null,

    // Linked chat messages
    attackMessageId,
    resultMessageId: null,
  };
}

/**
 * Serialises a ClashState to a plain object safe to store in message flags.
 * Currently a no-op (state is already plain) but provides an extension point.
 *
 * @param {ClashStateData} state
 * @returns {object}
 */
export function serialiseClashState(state) {
  return foundry.utils.deepClone(state);
}

/**
 * Deserialises a ClashState from message flags.
 *
 * @param {object} raw
 * @returns {ClashStateData}
 */
export function deserialiseClashState(raw) {
  return foundry.utils.deepClone(raw);
}

/** Flag namespace used on ChatMessage documents. */
export const CLASH_FLAG_SCOPE = "projectmoonttrpg";
export const CLASH_FLAG_KEY   = "clashState";