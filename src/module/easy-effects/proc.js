const RESERVED_PROC_NAMES = new Set([
  "hit",
  "being hit",
  "clash",
  "clash start",
  "clash win",
  "clash lose",
  "damage calc",
  "instant",
  "burst",
  "use",
  "action",
  "stagger",
  "applied",
  "gain",
  "lose",
  "removed",
  "turn start",
  "end of round",
  "start of round",
  "move",
  "taking damage",
  "depleted",
  "always active",
  "dialog answer",
]);

export const RESERVED_PROC_BIND_NAMES = new Set([
  "self", "target", "ally", "attacker", "originator",
  "enemies", "allies", "all",
  "damage", "incoming", "item", "clash", "changed", "burst",   "depleted", "roll",
  "proc", "N", "moved", "round", "combat",
]);

/** @param {string} name @returns {string} */
export function canonicalizeProcName(name) {
  return String(name ?? "").trim();
}

/** @param {string} name @returns {boolean} */
export function isReservedProcName(name) {
  const raw = String(name ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (RESERVED_PROC_NAMES.has(raw)) return true;
  if (raw.startsWith("dialog answer")) return true;
  if (raw.startsWith("taking ") && raw.endsWith(" damage")) return true;
  if (raw.startsWith("depleted ")) return true;
  if (raw.endsWith(" burst")) return true;
  return false;
}

/** @param {string} name @returns {boolean} */
export function isReservedProcBindName(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return true;
  return RESERVED_PROC_BIND_NAMES.has(raw) || RESERVED_PROC_BIND_NAMES.has(raw.toLowerCase());
}

/**
 * @param {string} raw
 * @returns {{ matched: boolean, trigger: string }}
 */
export function normalizeProcTrigger(raw) {
  const text = String(raw ?? "").trim();
  if (/^On Dialog Answer\b/i.test(text)) {
    return { matched: false, trigger: text };
  }
  if (/^On Burst$/i.test(text) || /^On\s+.+\s+Burst$/i.test(text)) {
    return { matched: false, trigger: text };
  }

  const m = text.match(/^On\s+(.+)$/i);
  if (!m) return { matched: false, trigger: text };

  let mid = (m[1] ?? "").trim();
  const quoted = mid.match(/^"([^"]+)"$/) || mid.match(/^'([^']+)'$/);
  if (quoted) mid = quoted[1].trim();
  if (!mid) return { matched: false, trigger: text };

  if (isReservedProcName(mid)) {
    return { matched: false, trigger: text };
  }

  const name = canonicalizeProcName(mid);
  return { matched: true, trigger: `On ${name}` };
}
