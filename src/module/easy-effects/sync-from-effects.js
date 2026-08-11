import { getEffectStack } from "../effects/effect-summary.js";

// The lexer ignores these marker lines.
export const SYNC_START = "# >>> synced effects";
export const SYNC_END = "# <<< synced effects";

const START_RE = /^#\s*>>>\s*synced effects\s*$/i;
const END_RE = /^#\s*<<<\s*synced effects\s*$/i;

/**

 * @returns {{ trigger: string|null, usesResult: boolean }}
 */
function resolveClashResultTrigger(trigger, resultWord) {
  if (!/\bRESULT\b/i.test(trigger)) return { trigger, usesResult: false };
  if (!resultWord) return { trigger: null, usesResult: true };
  return {
    trigger: trigger.replace(/\bRESULT\b/gi, resultWord),
    usesResult: true,
  };
}

/**
 * Bake an effect template for one polarity, intensity, and clash result.
 * Template-only tokens: bare `N`, `positive:` / `negative:`, and `RESULT` in triggers.
 */
export function stampEffectEasyEffects(source, {
  mode = "positive",
  n = 1,
  procResult = "none",
} = {}) {
  const text = typeof source === "string" ? source : "";
  if (!text.trim()) return "";

  const intensity = Math.max(0, Math.round(Number(n) || 0));
  const wantMode = mode === "negative" ? "negative" : "positive";
  const resultKey = String(procResult ?? "none").toLowerCase();
  const resultWord = resultKey === "win" ? "Win" : resultKey === "lose" ? "Lose" : null;
  const lines = text.split(/\r?\n/);
  const out = [];
  let polarity = null; // null = unscoped (kept for any mode)
  let pendingTrigger = null;
  let skipBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!skipBlock && out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (trimmed.startsWith("#")) continue;

    if (/^\[.+\]$/.test(trimmed)) {
      polarity = null;
      const resolved = resolveClashResultTrigger(trimmed, resultWord);
      if (resolved.usesResult && !resolved.trigger) {
        pendingTrigger = null;
        skipBlock = true;
        continue;
      }
      pendingTrigger = resolved.trigger;
      skipBlock = false;
      continue;
    }

    if (skipBlock) continue;

    const polOnly = trimmed.match(/^(positive|negative)\s*:$/i);
    if (polOnly) {
      polarity = polOnly[1].toLowerCase();
      continue;
    }

    let emit = line;
    const polInline = trimmed.match(/^(positive|negative)\s*:\s*(.+)$/i);
    if (polInline) {
      polarity = polInline[1].toLowerCase();
      emit = polInline[2];
    }

    if (polarity && polarity !== wantMode) continue;

    if (pendingTrigger) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(pendingTrigger);
      pendingTrigger = null;
    }

    out.push(String(emit).replace(/\bN\b/g, String(intensity)));
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export async function resolveEffectDocument(entry) {
  const uuid = entry?.effectUuid || entry?.uuid || "";
  if (!uuid) return null;
  try {
    const doc = await fromUuid(uuid);
    return doc?.type === "effect" ? doc : null;
  } catch (err) {
    console.warn("[EasyEffects] Could not resolve effect uuid", uuid, err);
    return null;
  }
}

export function normalizeEasyEffectsText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

// Split out the managed region without touching custom text around it.
export function splitManagedRegion(script) {
  const lines = String(script ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && START_RE.test(lines[i].trim())) start = i;
    else if (start >= 0 && END_RE.test(lines[i].trim())) {
      end = i;
      break;
    }
  }

  if (start < 0 || end < 0) {
    return { hasRegion: false, before: "", managedInner: "", after: "" };
  }

  return {
    hasRegion: true,
    before: lines.slice(0, start).join("\n"),
    managedInner: lines.slice(start + 1, end).join("\n"),
    after: lines.slice(end + 1).join("\n"),
  };
}

export function wrapSyncedRegion(body) {
  const inner = normalizeEasyEffectsText(body);
  if (!inner) return `${SYNC_START}\n${SYNC_END}`;
  return `${SYNC_START}\n${inner}\n${SYNC_END}`;
}

function joinScriptParts(before, wrappedRegion, after) {
  const parts = [];
  const b = String(before ?? "").replace(/\s+$/g, "");
  const a = String(after ?? "").replace(/^\s+/g, "");
  if (b) parts.push(b);
  if (wrappedRegion != null) parts.push(wrappedRegion);
  if (a) parts.push(a);
  return parts.join("\n\n");
}

// Replace the managed region while preserving custom text around it.
export function applySyncedRegion(script, expectedInner, {
  preserveUnmarked = true,
  legacyMatch = null,
} = {}) {
  const body = normalizeEasyEffectsText(expectedInner);
  const wrapped = body ? wrapSyncedRegion(body) : null;
  const parsed = splitManagedRegion(script);

  if (parsed.hasRegion) {
    if (!body) return joinScriptParts(parsed.before, null, parsed.after);
    return joinScriptParts(parsed.before, wrapped, parsed.after);
  }

  const whole = normalizeEasyEffectsText(script);
  if (!whole) return body ? wrapped : "";
  if (whole === body) return wrapped;
  if (legacyMatch != null && whole === normalizeEasyEffectsText(legacyMatch)) {
    return body ? wrapped : "";
  }

  if (preserveUnmarked && whole) {
    if (!body) return String(script ?? "");
    return `${wrapped}\n\n${String(script).replace(/\s+$/g, "")}`;
  }

  return body ? wrapped : "";
}

// Treat the current or previous generated block as clean.
export function isEasyEffectsSyncDirty(script, expectedInner, previousInner = null) {
  const expected = normalizeEasyEffectsText(expectedInner);
  const previous = previousInner == null ? null : normalizeEasyEffectsText(previousInner);
  const parsed = splitManagedRegion(script);

  if (parsed.hasRegion) {
    const inner = normalizeEasyEffectsText(parsed.managedInner);
    if (inner === expected) return false;
    if (previous != null && inner === previous) return false;
    return true;
  }

  const whole = normalizeEasyEffectsText(script);
  if (!whole) return false;
  if (whole === expected) return false;
  if (previous != null && whole === previous) return false;
  return true;
}

export async function buildEasyEffectsFromEffects(effects = []) {
  const chunks = [];
  for (const entry of effects ?? []) {
    const effectItem = await resolveEffectDocument(entry);
    const template = effectItem?.system?.easyEffects ?? "";
    if (!String(template).trim()) continue;

    const stamped = stampEffectEasyEffects(template, {
      mode: entry?.mode === "negative" ? "negative" : "positive",
      n: getEffectStack(entry),
      procResult: entry?.procResult ?? "none",
    });
    if (!stamped.trim()) continue;

    const label = effectItem?.name ?? entry?.name ?? "Effect";
    chunks.push(`# ${label}\n${stamped.trim()}`);
  }
  return chunks.join("\n\n");
}

export async function buildEasyEffectsFromHostEffects(hostItem) {
  return buildEasyEffectsFromEffects(hostItem?.system?.effects ?? []);
}

/**
 * Sync linked effect templates into the host's managed region.
 * Automatic sync skips hand-edited regions only.
 * @returns {Promise<{ script: string, skipped: boolean, dirty: boolean, changed: boolean }>}
 */
export async function syncEasyEffectsFromHostEffects(hostItem, {
  force = false,
  previousEffects = undefined,
} = {}) {
  if (!hostItem) {
    return { script: "", skipped: true, dirty: false, changed: false };
  }

  const current = String(hostItem.system?.easyEffects ?? "");
  const expectedInner = await buildEasyEffectsFromHostEffects(hostItem);
  const previousInner = previousEffects !== undefined
    ? await buildEasyEffectsFromEffects(previousEffects)
    : null;

  const dirty = isEasyEffectsSyncDirty(current, expectedInner, previousInner);
  if (!force && dirty) {
    return { script: current, skipped: true, dirty: true, changed: false };
  }

  const next = applySyncedRegion(current, expectedInner, {
    preserveUnmarked: Boolean(force && dirty),
    legacyMatch: previousInner,
  });

  if (next === current) {
    return { script: current, skipped: false, dirty: false, changed: false };
  }

  await hostItem.update({ "system.easyEffects": next });
  return { script: next, skipped: false, dirty: false, changed: true };
}
