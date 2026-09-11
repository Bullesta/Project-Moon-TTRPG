const RESERVED_PROC_NAMES = new Set([
  "hit",
  "being hit",
  "hit before results",
  "being hit before results",
  "clash",
  "clash start",
  "clash win",
  "clash lose",
  "damage calc",
  "instant",
  "clash win before results",
  "before clash results",
  "burst",
  "use",
  "equip",
  "unequip",
  "action",
  "stagger",
  "applied",
  "gain",
  "lose",
  "removed",
  "turn start",
  "start of turn",
  "end of turn",
  "end of round",
  "start of round",
  "combat start",
  "start of combat",
  "combat end",
  "end of combat",
  "move",
  "taking damage",
  "dealing damage",
  "before dealing damage",
  "heal",
  "being healed",
  "depleted",
  "always active",
  "dialog answer",
  "roll",
]);

export const RESERVED_PROC_BIND_NAMES = new Set([
  "self", "target", "ally", "attacker", "originator", "burster", "burstee", "healer",
  "enemies", "allies", "all",
  "damage", "incoming", "heal", "item", "clash", "changed", "burst",   "depleted", "roll",
  "pendingRoll",
  "proc", "N", "moved", "round", "combat",
  "event", "flag",
]);

export function canonicalizeProcName(name) {
  return String(name ?? "").trim();
}

/** Lifecycle trigger names cannot be used as `proc <Name>`. */
export function isReservedProcName(name) {
  const raw = String(name ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (RESERVED_PROC_NAMES.has(raw)) return true;
  if (raw.startsWith("roll ")) return true;
  if (raw.startsWith("dialog answer")) return true;
  if (raw.startsWith("taking ") && raw.endsWith(" damage")) return true;
  if (raw.startsWith("dealing ") && raw.endsWith(" damage")) return true;
  if (raw.startsWith("before dealing ") && raw.endsWith(" damage")) return true;
  if (raw === "heal" || raw.startsWith("heal ")) return true;
  if (raw === "being healed" || raw.startsWith("being healed")) return true;
  if (raw.startsWith("depleted ")) return true;
  if (raw.endsWith(" burst")) return true;
  return false;
}

/** Bind names that would collide with path roots (`self`, `heal`, `event`, …). */
export function isReservedProcBindName(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return true;
  return RESERVED_PROC_BIND_NAMES.has(raw) || RESERVED_PROC_BIND_NAMES.has(raw.toLowerCase());
}

/**
 * `[On <Name>]` when `<Name>` is not a reserved lifecycle trigger.
 * Dialog / Roll / Burst mids are left unmatched so those parsers own them.
 */
export function normalizeProcTrigger(raw) {
  const text = String(raw ?? "").trim();
  if (/^On Dialog Answer\b/i.test(text)) {
    return { matched: false, trigger: text };
  }
  if (/^On Roll$/i.test(text) || /^On Roll\s+/i.test(text)) {
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
