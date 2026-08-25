import { isApplyPoolNoun, resolveApplyPool } from "./nouns.js";
import { sameActor } from "./burst-roles.js";

function splitTakingDamageTokens(mid) {
  const tokens = [];
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let m;
  while ((m = re.exec(mid))) {
    if (m[1] != null) tokens.push({ value: m[1], quoted: true });
    else if (m[2] != null) tokens.push({ value: m[2], quoted: true });
    else tokens.push({ value: m[3], quoted: false });
  }
  return tokens;
}

export function isAttackDamage(damage) {
  return damage?.fromAttack === true;
}

/** Pool named on a taking-damage filter, if any. Compound filters keep it on `.pool`. */
export function filterPoolValue(filter) {
  if (!filter) return null;
  if (filter.kind === "pool") return filter.value ?? null;
  if (filter.kind === "compound") return filter.pool ?? null;
  return null;
}

function normalizePoolList(raw) {
  if (raw == null || raw === "") return [];

  const list = Array.isArray(raw) ? raw : [raw];

  return list.map((p) => String(p ?? "").toLowerCase()).filter(Boolean);
}

/**
 * Returns the pools this hit is about to touch.
 *
 * Missing pool defaults to HP.
 *
 * @param {{ pool?: string|string[] }|null|undefined} damage
 * @returns {string[]}
 */
export function pendingDamagePools(damage) {
  const list = normalizePoolList(damage?.pool);
  return list.length ? list : ["hp"];
}

/**
 * Pick the pools this `reduce/increase` line can affect.
 *
 * `all` is every pool on the hit. `pools` is the subset selected by things
 * like `[On Taking HP Attack Damage]` or `reduce hp damage`.
 *
 * @param {{ pool?: string|string[] }|null|undefined} damage
 * @param {{ damageFilter?: object|null, actionPool?: string|string[]|null }} [options]
 * @returns {{ all: string[], pools: string[] }}
 */
export function resolveDamageDeltaPools(
  damage,
  { damageFilter = null, actionPool = null } = {}
) {
  const all = pendingDamagePools(damage);
  let pools = all.slice();

  const fromAction = normalizePoolList(actionPool);
  if (fromAction.length) {
    const want = new Set(fromAction);
    pools = pools.filter((p) => want.has(p));
  }

  const fromFilter = filterPoolValue(damageFilter);
  if (fromFilter) {
    const want = String(fromFilter).toLowerCase();
    pools = pools.filter((p) => p === want);
  }

  return { all, pools };
}

/**
 * Apply one `reduce/increase` modifier to the pending hit.
 *
 * Negative delta reduces damage while positive delta increases it.
 *
 * After-resistance changes are always tracked per pool.
 *
 * Before resistance, a modifier that affects the whole hit can update
 * `damage.amount` directly. Pool-specific changes use `beforeDeltaByPool`.
 *
 * @param {object} damage Pending hit from `applyDamage`.
 * @param {number} delta Signed amount.
 * @param {{
 *   damageFilter?: object|null,
 *   actionPool?: string|string[]|null,
 *   timing?: "before"|"after",
 * }} [options]
 */
export function applyPendingDamageDelta(damage, delta, options = {}) {
  if (!damage || !Number(delta)) return;

  const timing = options.timing === "after" ? "after" : "before";
  const { all, pools } = resolveDamageDeltaPools(damage, options);

  if (!pools.length) return;

  if (timing === "after") {
    if (!damage.afterDeltaByPool || typeof damage.afterDeltaByPool !== "object") {
      damage.afterDeltaByPool = {};
    }

    for (const pool of pools) {
      damage.afterDeltaByPool[pool] =
        (Number(damage.afterDeltaByPool[pool]) || 0) + delta;
    }

    return;
  }

  const affectsAll =
    pools.length === all.length && all.every((p) => pools.includes(p));

  if (affectsAll) {
    damage.amount = Math.max(0, (Number(damage.amount) || 0) + delta);
    return;
  }

  if (!damage.beforeDeltaByPool || typeof damage.beforeDeltaByPool !== "object") {
    damage.beforeDeltaByPool = {};
  }

  for (const pool of pools) {
    damage.beforeDeltaByPool[pool] =
      (Number(damage.beforeDeltaByPool[pool]) || 0) + delta;
  }
}

function matchesPoolFilter(want, damage) {
  if (!want) return true;
  const key = String(want).toLowerCase();
  const raw = damage.pool;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.some((p) => String(p ?? "").toLowerCase() === key);
}

function matchesSourceOrTypeFilter(want, damage) {
  if (!want) return true;
  const source = String(damage.source ?? "");
  const dtype = String(damage.damageType ?? "");
  if (source && source === want) return true;
  if (dtype && dtype.toLowerCase() === want.toLowerCase()) return true;
  return false;
}

export function normalizeTakingDamageTrigger(raw) {
  const text = String(raw ?? "").trim();
  const m = text.match(/^On Taking(?:\s+(.*?))?\s+Damage$/i);
  if (!m) return { trigger: text, damageFilter: null };

  let mid = (m[1] ?? "").trim();
  if (!mid || /^any$/i.test(mid)) {
    return { trigger: "On Taking Damage", damageFilter: null };
  }

  const tokens = splitTakingDamageTokens(mid);
  let pool = null;
  let attack = false;
  let sourceOrType = null;

  for (const tok of tokens) {
    if (!tok.quoted && /^attacks?$/i.test(tok.value)) {
      attack = true;
      continue;
    }
    const poolKey = tok.value.toLowerCase();
    if (!tok.quoted && isApplyPoolNoun(poolKey) && !pool) {
      pool = resolveApplyPool(poolKey);
      continue;
    }
    sourceOrType = sourceOrType ? `${sourceOrType} ${tok.value}` : tok.value;
  }

  if (!pool && !attack && !sourceOrType) {
    return { trigger: "On Taking Damage", damageFilter: null };
  }
  if (pool && !attack && !sourceOrType) {
    return {
      trigger: "On Taking Damage",
      damageFilter: { kind: "pool", value: pool },
    };
  }
  if (attack && !pool && !sourceOrType) {
    return { trigger: "On Taking Damage", damageFilter: { kind: "attack" } };
  }
  if (!pool && !attack && sourceOrType) {
    return {
      trigger: "On Taking Damage",
      damageFilter: { kind: "sourceOrType", value: sourceOrType },
    };
  }

  return {
    trigger: "On Taking Damage",
    damageFilter: { kind: "compound", pool, attack, sourceOrType },
  };
}

/**
 * Should this `[On Taking … Damage]` block run for the pending hit?
 * HP matches when HP is anywhere on the hit, including HP+ST attacks.
 * That is "does the block fire".
 */
export function matchesDamageFilter(filter, damage) {
  if (!filter) return true;
  if (!damage) return false;
  if (filter.kind === "pool") return matchesPoolFilter(filter.value, damage);
  if (filter.kind === "attack") return isAttackDamage(damage);
  if (filter.kind === "sourceOrType") return matchesSourceOrTypeFilter(filter.value, damage);
  if (filter.kind === "compound") {
    if (filter.attack && !isAttackDamage(damage)) return false;
    if (!matchesPoolFilter(filter.pool, damage)) return false;
    return matchesSourceOrTypeFilter(filter.sourceOrType, damage);
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

/** Actor [On X Burst] waits for the global pass so it doesn't also fire locally. */
export function shouldExecuteBurstBlock(block, execContext) {
  if (!execContext?.burstPhase) return true;
  if (execContext._actorBurstLocal && block.burstFilter?.status) return false;
  return matchesBurstFilter(block.burstFilter, {
    statusName: execContext.burst?.status,
    phase: execContext.burstPhase,
  });
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

  if (payload.attacker && sameActor(actor, payload.attacker)) return "attack";
  if (payload.defender && sameActor(actor, payload.defender)) return defenderStance();
  // Win and loss payloads may omit the defender.
  if (payload.attacker && !sameActor(actor, payload.attacker)) return defenderStance();
  return null;
}

/**
 * @param {string} raw
 * @returns {{ matched: boolean, trigger: string, clashStanceFilter: { stance: "attack"|"block"|"evade"|"defense" }|null }}
 */
export function normalizeClashStanceTrigger(raw) {
  const text = String(raw ?? "").trim();
  const m = text.match(
    /^(On Clash Win Before Results|Clash Win Before Results|Before Clash Results|On Clash Start|On Clash Win|Clash Win|On Clash Lose|Clash Lose|On Clash)\s+With\s+(.+)$/i
  );
  if (!m) return { matched: false, trigger: text, clashStanceFilter: null };

  let base = m[1].trim();
  const baseLower = base.toLowerCase();
  if (baseLower === "on clash start") base = "On Clash Start";
  else if (baseLower === "on clash") base = "On Clash";
  else if (baseLower === "on clash win before results") base = "On Clash Win Before Results";
  else if (baseLower === "clash win before results") base = "Clash Win Before Results";
  else if (baseLower === "before clash results") base = "Before Clash Results";
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
