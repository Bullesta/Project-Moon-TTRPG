/**
 * Returns the HP resistance multiplier for a given damage type from the
 * target's equipped outfit.
 *
 * @param {ActorPMTTRPG} actor
 * @param {"slash"|"pierce"|"blunt"} damageType
 * @param {"hp"|"st"} resource
 * @returns {number}
 */
function getResistanceMultiplier(actor, damageType, resource = "hp") {
  const outfit = actor.items.find(i => i.type === "outfit" && i.system?.equipped) ?? null;
  const resistanceKey = outfit?.system?.resistances?.[resource]?.[damageType] ?? "normal";
  return CONFIG.PMTTRPG.resistances[resistanceKey].multiplier ?? 1;
}

// ── Full clash damage formula ─────────────────────────────────────────────────

/**
 * Computes the full HP and ST damage amounts from a clash result
 * according to the rulebook formula. Does NOT apply them — returns numbers.
 *
 * @param {object} params
 * @param {ActorPMTTRPG} params.attacker
 * @param {ActorPMTTRPG} params.defender
 * @param {string}  params.retaliationType  — "evade" | "block" | "counter" | "intercept"
 * @param {string}  params.result           — "attackWin" | "defenseWin"
 * @param {number}  params.attackRollTotal
 * @param {number}  params.defenseRollTotal
 * @param {string}  params.damageType       — "slash" | "pierce" | "blunt"
 * @param {object}  params.clashBonuses     — clash.bonuses from EasyEffects
 * @param {number}  [params.baseDamage=0]   — weapon base damage modifier (from item)
 * @returns {{ hpDamage: number, stDamage: number, stRegen: number }}
 */
export function computeClashDamage({
  attacker,
  defender,
  retaliationType,
  result,
  attackRollTotal,
  defenseRollTotal,
  damageType,
  clashBonuses = {},
  baseDamage = 0,
}) {
  // Evade win — no damage to defender; stagger regen to defender.
  if (result === "defenseWin" && retaliationType === "evade") {
    const stRegen = defenseRollTotal + (clashBonuses.regenST ?? 0);
    return { hpDamage: 0, stDamage: 0, stRegen: Math.max(0, stRegen) };
  }

  // Defense win (block or counter) - deal st damage to attacker.
  if (result === "defenseWin" && retaliationType === "block") {
    return { hpDamage: 0, stDamage: Math.max(0, defenseRollTotal - attackRollTotal), stRegen: 0 };
  }

  // ── Attack win ──────────────────────────────────────────────────────────────

  const blockRoll      = retaliationType === "block" ? defenseRollTotal : 0;
  const regenHP        = clashBonuses.regenHP ?? 0;
  const regenST        = clashBonuses.regenST ?? 0;

  const hpMultiplier = getResistanceMultiplier(defender, damageType, "hp");
  const hpBase   = Math.max(0, attackRollTotal - blockRoll);
  const hpReduct = regenHP;
  const hpDamage = Math.max(0, Math.floor(hpBase * hpMultiplier) - hpReduct);

  let stDamage = 0;
  if (retaliationType === "block") {
    const stRaw  = Math.max(0, attackRollTotal - defenseRollTotal);
    const stMult = getResistanceMultiplier(defender, damageType, "st");
    stDamage     = Math.max(0, Math.floor(stRaw * stMult) - regenST);
  }

  return { hpDamage, stDamage, stRegen: 0 };
}

// ── Per-resource damage endpoints ─────────────────────────────────────────────
//
// Each endpoint:
//   1. Fires a pre-hook (cancellable via returning false).
//   2. Clamps to valid range.
//   3. Updates the actor.
//   4. Fires a post-hook with the actual delta.

/**
 * Applies HP damage to an actor, routing through resistance and existing
 * applyDamage() scrolling-text logic.
 *
 * @param {ActorPMTTRPG} actor
 * @param {number} amount        — positive = damage
 * @param {object} [options]
 * @param {string} [options.damageType]        — "slash"|"pierce"|"blunt"
 * @param {boolean} [options.ignoreResistance] — bypass multiplier
 * @param {string} [options.source]            — label for hooks/scrolling text
 * @returns {Promise<void>}
 */
export async function applyHPDamage(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplyHPDamage", { actor, amount, options });
  if (pre === false) return;

  // Route through the existing applyDamage() which handles scrolling text,
  // context flags, and the _onUpdate hook.
  await actor.applyDamage(amount, {
    op: "full",
    ignoreArmor: options.ignoreResistance ?? false,
    dmgBonus: 0,
  });

  Hooks.callAll("pmttrpg.applyHPDamage", {
    actor,
    amount,
    options,
  });
}

/**
 * Applies ST (Stagger Threshold) damage to an actor.
 *
 * @param {ActorPMTTRPG} actor
 * @param {number} amount
 * @param {object} [options]
 * @param {boolean} [options.ignoreArmored]
 * @param {string}  [options.source]
 * @returns {Promise<void>}
 */
export async function applySTDamage(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplySTDamage", { actor, amount, options });
  if (pre === false) return;

  const current = actor.system?.attributes?.st?.value ?? 0;
  const newVal  = Math.max(0, current - amount);
  const delta   = newVal - current;

  if (delta !== 0) {
    await actor.update({ "system.attributes.st.value": newVal });
    actor.showScrollingText(delta, actor.system?.attributes?.st?.max ?? 1, game.i18n.localize("PMTTRPG.ST"));
  }

  Hooks.callAll("pmttrpg.applySTDamage", { actor, amount, newValue: newVal, delta, options });

  // Fire stagger hook if ST hits 0
  if (newVal <= 0 && current > 0) {
    Hooks.callAll("pmttrpg.actorStaggered", { actor, attacker: options.attacker ?? null });
  }
}

/**
 * Applies SP (Sanity Points) damage to an actor.
 *
 * @param {ActorPMTTRPG} actor
 * @param {number} amount
 * @param {object} [options]
 * @returns {Promise<void>}
 */
export async function applySPDamage(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplySPDamage", { actor, amount, options });
  if (pre === false) return;

  const current = actor.system?.attributes?.sp?.value ?? 0;
  const newVal  = Math.max(0, current - amount);
  const delta   = newVal - current;

  if (delta !== 0) {
    await actor.update({ "system.attributes.sp.value": newVal });
    actor.showScrollingText(delta, actor.system?.attributes?.sp?.max ?? 1, game.i18n.localize("PMTTRPG.SP"));
  }

  Hooks.callAll("pmttrpg.applySPDamage", { actor, amount, newValue: newVal, delta, options });
}

/**
 * Applies Light damage to an actor.
 *
 * @param {ActorPMTTRPG} actor
 * @param {number} amount
 * @param {object} [options]
 * @returns {Promise<void>}
 */
export async function applyLightDamage(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplyLightDamage", { actor, amount, options });
  if (pre === false) return;

  const current = actor.system?.attributes?.light?.value ?? 0;
  const newVal  = Math.max(0, current - amount);
  const delta   = newVal - current;

  if (delta !== 0) {
    await actor.update({ "system.attributes.light.value": newVal });
    actor.showScrollingText(delta, actor.system?.attributes?.light?.max ?? 1, game.i18n.localize("PMTTRPG.Light"));
  }

  Hooks.callAll("pmttrpg.applyLightDamage", { actor, amount, newValue: newVal, delta, options });
}

// ── Heal / Regen endpoints ────────────────────────────────────────────────────

/**
 * Heals HP on an actor.
 * @param {ActorPMTTRPG} actor
 * @param {number} amount
 * @param {object} [options]
 */
export async function applyHPHeal(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplyHPHeal", { actor, amount, options });
  if (pre === false) return;

  await actor.applyDamage(amount, { op: "heal" });
  Hooks.callAll("pmttrpg.applyHPHeal", { actor, amount, options });
}

/**
 * Restores ST on an actor.
 * @param {ActorPMTTRPG} actor
 * @param {number} amount
 * @param {object} [options]
 */
export async function applySTRegen(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplySTRegen", { actor, amount, options });
  if (pre === false) return;

  const current = actor.system?.attributes?.st?.value ?? 0;
  const max     = actor.system?.attributes?.st?.max   ?? current;
  const newVal  = Math.min(max, current + amount);
  const delta   = newVal - current;

  if (delta !== 0) {
    await actor.update({ "system.attributes.st.value": newVal });
    actor.showScrollingText(delta, max, game.i18n.localize("PMTTRPG.ST"));
  }

  Hooks.callAll("pmttrpg.applySTRegen", { actor, amount, newValue: newVal, delta, options });
}

/**
 * Restores SP on an actor.
 * @param {ActorPMTTRPG} actor
 * @param {number} amount
 * @param {object} [options]
 */
export async function applySPRegen(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplySPRegen", { actor, amount, options });
  if (pre === false) return;

  const current = actor.system?.attributes?.sp?.value ?? 0;
  const max     = actor.system?.attributes?.sp?.max   ?? current;
  const newVal  = Math.min(max, current + amount);
  const delta   = newVal - current;

  if (delta !== 0) {
    await actor.update({ "system.attributes.sp.value": newVal });
    actor.showScrollingText(delta, max, game.i18n.localize("PMTTRPG.SP"));
  }

  Hooks.callAll("pmttrpg.applySPRegen", { actor, amount, newValue: newVal, delta, options });
}

/**
 * Restores Light on an actor.
 * @param {ActorPMTTRPG} actor
 * @param {number} amount
 * @param {object} [options]
 */
export async function applyLightRegen(actor, amount, options = {}) {
  amount = Math.max(0, Math.round(amount));
  const pre = Hooks.call("pmttrpg.preApplyLightRegen", { actor, amount, options });
  if (pre === false) return;

  const current = actor.system?.attributes?.light?.value ?? 0;
  const max     = actor.system?.attributes?.light?.max   ?? current;
  const newVal  = Math.min(max, current + amount);
  const delta   = newVal - current;

  if (delta !== 0) {
    await actor.update({ "system.attributes.light.value": newVal });
    actor.showScrollingText(delta, max, game.i18n.localize("PMTTRPG.Light"));
  }

  Hooks.callAll("pmttrpg.applyLightRegen", { actor, amount, newValue: newVal, delta, options });
}