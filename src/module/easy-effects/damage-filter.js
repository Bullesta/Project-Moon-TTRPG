import { isApplyPoolNoun, resolveApplyPool } from "./nouns.js";

export function normalizeTakingDamageTrigger(raw) {
  const text = String(raw ?? "").trim();
  const m = text.match(/^On Taking(?:\s+(.*?))?\s+Damage$/i);
  if (!m) return { trigger: text, damageFilter: null };

  let mid = (m[1] ?? "").trim();
  if (!mid || /^any$/i.test(mid)) {
    return { trigger: "On Taking Damage", damageFilter: null };
  }

  const quoted = mid.match(/^"([^"]+)"$/) || mid.match(/^'([^']+)'$/);
  if (quoted) mid = quoted[1].trim();

  const poolKey = mid.toLowerCase();
  if (isApplyPoolNoun(poolKey)) {
    return {
      trigger: "On Taking Damage",
      damageFilter: { kind: "pool", value: resolveApplyPool(poolKey) },
    };
  }

  return {
    trigger: "On Taking Damage",
    damageFilter: { kind: "sourceOrType", value: mid },
  };
}

/** Runtime check for block.damageFilter vs context.damage. */
export function matchesDamageFilter(filter, damage) {
  if (!filter) return true;
  if (!damage) return false;
  if (filter.kind === "pool") {
    const want = String(filter.value).toLowerCase();
    const raw = damage.pool;
    const list = Array.isArray(raw) ? raw : [raw];
    return list.some((p) => String(p ?? "").toLowerCase() === want);
  }
  if (filter.kind === "sourceOrType") {
    const want = String(filter.value);
    const source = String(damage.source ?? "");
    const dtype = String(damage.damageType ?? "");
    if (source && source === want) return true;
    if (dtype && dtype.toLowerCase() === want.toLowerCase()) return true;
    return false;
  }
  return true;
}

/**
 * @param {string} raw
 * @returns {{ matched: boolean, trigger: string, depletedFilter: { pool: string }|null }}
 */
export function normalizeDepletedTrigger(raw) {
  const text = String(raw ?? "").trim();
  if (/^On Depleted$/i.test(text)) {
    return { matched: true, trigger: "On Depleted", depletedFilter: null };
  }

  const m = text.match(/^On Depleted\s+(.+)$/i);
  if (!m) return { matched: false, trigger: text, depletedFilter: null };

  let mid = (m[1] ?? "").trim();
  const quoted = mid.match(/^"([^"]+)"$/) || mid.match(/^'([^']+)'$/);
  if (quoted) mid = quoted[1].trim();

  const poolKey = mid.toLowerCase();
  if (/^any$/i.test(poolKey)) {
    return { matched: true, trigger: "On Depleted", depletedFilter: null };
  }
  if (!isApplyPoolNoun(poolKey)) {
    return { matched: false, trigger: text, depletedFilter: null };
  }

  return {
    matched: true,
    trigger: "On Depleted",
    depletedFilter: { pool: resolveApplyPool(poolKey) },
  };
}

export function matchesDepletedFilter(filter, depleted) {
  if (!filter) return true;
  if (!depleted) return false;
  return String(depleted.pool ?? "").toLowerCase() === String(filter.pool).toLowerCase();
}

/**
 * @param {string} raw
 * @returns {{ matched: boolean, trigger: string, burstFilter: { status: string }|null }}
 */
export function normalizeBurstTrigger(raw) {
  const text = String(raw ?? "").trim();
  if (/^On Dialog Answer\b/i.test(text)) {
    return { matched: false, trigger: text, burstFilter: null };
  }
  if (/^On Burst$/i.test(text)) {
    return { matched: true, trigger: "On Burst", burstFilter: null };
  }

  const m = text.match(/^On\s+(.+?)\s+Burst$/i);
  if (!m) return { matched: false, trigger: text, burstFilter: null };

  let mid = (m[1] ?? "").trim();
  const quoted = mid.match(/^"([^"]+)"$/) || mid.match(/^'([^']+)'$/);
  if (quoted) mid = quoted[1].trim();
  if (!mid) return { matched: false, trigger: text, burstFilter: null };

  return {
    matched: true,
    trigger: "On Burst",
    burstFilter: { status: mid },
  };
}

/**
 * @param {{ status?: string }|null|undefined} filter
 * @param {{ statusName?: string, phase?: "local"|"global" }} opts
 */
export function matchesBurstFilter(filter, { statusName = "", phase = "local" } = {}) {
  const want = String(statusName ?? "").toLowerCase();
  const got = String(filter?.status ?? "").toLowerCase();

  if (phase === "global") {
    if (!filter?.status) return false;
    return got === want;
  }

  if (!filter) return true;
  return got === want;
}

const CLASH_STANCE_ALIASES = {
  attack: "attack",
  attacks: "attack",
  offensive: "attack",
  counter: "attack",
  block: "block",
  blocks: "block",
  evade: "evade",
  evades: "evade",
  defense: "defense",
  defenses: "defense",
  defensive: "defense",
};

/**
 * @param {string|null|undefined} retaliationType
 * @param {Item|null|undefined} defenderItem
 * @param {Item|null|undefined} [defenderSkill]
 * @returns {"attack"|"block"|"evade"|null}
 */
export function resolveDefenderClashStance(retaliationType, defenderItem = null, defenderSkill = null) {
  const kind = String(retaliationType ?? "").toLowerCase();
  if (kind === "block") return "block";
  if (kind === "evade" || kind === "recycledevade") return "evade";
  if (kind === "counter") return "attack";
  if (kind === "skill") {
    const skillType = String((defenderSkill ?? defenderItem)?.system?.skillType ?? "attack").toLowerCase();
    if (skillType === "block") return "block";
    if (skillType === "evade") return "evade";
    return "attack";
  }
  return null;
}

/**
 * @param {Actor|null|undefined} actor
 * @param {{
 *   attacker?: Actor|null,
 *   defender?: Actor|null,
 *   side?: "attacker"|"defender"|"all"|null,
 *   retaliationType?: string|null,
 *   defenderItem?: Item|null,
 *   defenderSkill?: Item|null,
 * }} payload
 * @returns {"attack"|"block"|"evade"|null}
 */
export function resolveActorClashStance(actor, payload = {}) {
  if (!actor) return null;

  const defenderStance = () => resolveDefenderClashStance(
    payload.retaliationType,
    payload.defenderItem,
    payload.defenderSkill,
  );

  if (payload.side === "attacker") return "attack";
  if (payload.side === "defender") return defenderStance();

  if (payload.attacker && actor.id === payload.attacker.id) return "attack";
  if (payload.defender && actor.id === payload.defender.id) return defenderStance();
  // Win and loss payloads may omit the defender.
  if (payload.attacker && actor.id !== payload.attacker.id) return defenderStance();
  return null;
}

/**
 * @param {string} raw
 * @returns {{ matched: boolean, trigger: string, clashStanceFilter: { stance: "attack"|"block"|"evade"|"defense" }|null }}
 */
export function normalizeClashStanceTrigger(raw) {
  const text = String(raw ?? "").trim();
  const m = text.match(
    /^(On Clash Start|On Clash Win|Clash Win|On Clash Lose|Clash Lose|On Clash)\s+With\s+(.+)$/i
  );
  if (!m) return { matched: false, trigger: text, clashStanceFilter: null };

  let base = m[1].trim();
  const baseLower = base.toLowerCase();
  if (baseLower === "on clash start") base = "On Clash Start";
  else if (baseLower === "on clash") base = "On Clash";
  else if (baseLower === "on clash win") base = "On Clash Win";
  else if (baseLower === "clash win") base = "Clash Win";
  else if (baseLower === "on clash lose") base = "On Clash Lose";
  else if (baseLower === "clash lose") base = "Clash Lose";

  let mid = (m[2] ?? "").trim();
  const quoted = mid.match(/^"([^"]+)"$/) || mid.match(/^'([^']+)'$/);
  if (quoted) mid = quoted[1].trim();

  const stance = CLASH_STANCE_ALIASES[mid.toLowerCase()];
  if (!stance) return { matched: false, trigger: text, clashStanceFilter: null };

  return {
    matched: true,
    trigger: base,
    clashStanceFilter: { stance },
  };
}

// Defense matches Block or Evade.
export function matchesClashStanceFilter(filter, clashStance) {
  if (!filter) return true;
  if (!clashStance) return false;
  const got = String(clashStance).toLowerCase();
  const want = String(filter.stance).toLowerCase();
  if (want === "defense") return got === "block" || got === "evade";
  return got === want;
}
