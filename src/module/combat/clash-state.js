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
  EVADE:          "evade",
  RECYCLED_EVADE: "recycledEvade",
  BLOCK:          "block",
  COUNTER:        "counter",
  ONESIDED:       "onesided"
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
 * @param {number|null} [params.attackRollTotal]
 * @param {string|null} [params.attackRollFormula]
 * @param {object[]|null} [params.attackRollTerms]
 * @param {"slash"|"pierce"|"blunt"|"none"} params.damageType
 * @param {string} params.attackMessageId
 * @param {object|null} [params.clashBonuses]
 * @param {object[]} [params.attackRollBreakdown]
 * @param {string|null} [params.appliedToolId]
 * @param {string|null} [params.attackerSkillId]
 * @param {string|null} [params.attackerAmmoId]
 * @param {boolean} [params.consumeSkillLight]
 * @param {boolean} [params.attackerDryFire]
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
  attackRollTotal = null,
  attackRollFormula = null,
  attackRollTerms = null,
  damageType      = "none",
  attackMessageId,
  clashBonuses    = null,
  attackRollBreakdown = null,
  appliedToolId   = null,
  attackerSkillId = null,
  attackerAmmoId  = null,
  consumeSkillLight = false,
  attackerDryFire = false,
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
    appliedToolId: appliedToolId ?? null,
    attackerSkillId: attackerSkillId ?? null,
    attackerAmmoId: attackerAmmoId ?? null,
    consumeSkillLight: !!consumeSkillLight,
    attackerDryFire: !!attackerDryFire,

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
    attackRollBreakdown: attackRollBreakdown ?? null,
    defenseRollBreakdown: null,

    clashBonuses: clashBonuses ?? null,

    // Result
    result:   null,   // CLASH_RESULTS value
    margin:   null,   // Math.abs(attacker - defender)
    damageType,

    // Damage calc (populated after result, read by Take the Damage)
    hpDamage:  null,
    stDamage:  null,

    // Counter Win range gate
    counterInRange: null,

    // Ranged attackers take no Block Win ST rebound
    blockWinStExempt: null,

    // Linked chat messages
    attackMessageId,
    resultMessageId: null,
  };
}

/**
 * Combatant who caused the HP/ST on the result card, if any.
 * Evade regen, Counter out of range, and ranged Block exemption have no source.
 *
 * @param {object|null|undefined} state
 * @returns {{ actorId: string|null, tokenId: string|null }|null}
 */
export function getClashDamageSourceRef(state) {
  if (!state) return null;

  const attackerWon = state.result === "attackWin";
  const defenderWon = state.result === "defenseWin";
  const type = state.retaliationType;
  const counterHit = defenderWon && type === "counter" && state.counterInRange === true;
  const blockWinSt = defenderWon && type === "block" && !state.blockWinStExempt;

  if (attackerWon) {
    if (!state.attackerActorId && !state.attackerTokenId) return null;
    return {
      actorId: state.attackerActorId ?? null,
      tokenId: state.attackerTokenId ?? null,
    };
  }

  if (counterHit || blockWinSt) {
    const actorId = state.retaliatorActorId ?? state.targetActorId ?? null;
    const tokenId = state.retaliatorTokenId ?? state.targetTokenId ?? null;
    if (!actorId && !tokenId) return null;
    return { actorId, tokenId };
  }

  return null;
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