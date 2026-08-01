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
