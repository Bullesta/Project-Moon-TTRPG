const { renderTemplate } = foundry.applications.handlebars;

/** @type {ReadonlyArray<"hp"|"st"|"sp">} */
export const DAMAGE_POOLS = Object.freeze(["hp", "st", "sp"]);

/** @type {ReadonlyArray<"hp"|"st"|"sp"|"light">} */
export const APPLY_POOLS = Object.freeze(["hp", "st", "sp", "light"]);

/** @type {ReadonlyArray<"slash"|"pierce"|"blunt">} */
export const DAMAGE_TYPES = Object.freeze(["slash", "pierce", "blunt"]);

export const RESISTANCE_MULTIPLIERS = Object.freeze({
  fatal: 2,
  weak: 1.5,
  normal: 1,
  endured: 0.5,
  ineffective: 0.25,
  immune: 0,
});

const POOL_LABEL_KEYS = {
  hp: "PMTTRPG.TrackerHP",
  st: "PMTTRPG.TrackerST",
  sp: "PMTTRPG.TrackerSP",
  light: "PMTTRPG.Light",
};

const DAMAGE_TYPE_LABEL_KEYS = {
  slash: "PMTTRPG.DamageTypeSlash",
  pierce: "PMTTRPG.DamageTypePierce",
  blunt: "PMTTRPG.DamageTypeBlunt",
};

const RESISTANCE_LABEL_KEYS = {
  fatal: "PMTTRPG.ResistanceFatal",
  weak: "PMTTRPG.ResistanceWeak",
  normal: "PMTTRPG.ResistanceNormal",
  endured: "PMTTRPG.ResistanceEndured",
  ineffective: "PMTTRPG.ResistanceIneffective",
  immune: "PMTTRPG.ResistanceImmune",
};

export function normalizePools(pool) {
  const list = Array.isArray(pool) ? pool : [pool ?? "hp"];
  const wanted = new Set(list.filter((p) => APPLY_POOLS.includes(p)));
  const ordered = APPLY_POOLS.filter((p) => wanted.has(p));
  return ordered.length ? ordered : ["hp"];
}

export function poolValuePath(pool) {
  return `system.attributes.${pool}.value`;
}

export function poolTempPath(pool) {
  return `system.attributes.${pool}.temp`;
}

export function tempPoolKey(pool) {
  if (pool === "hp") return "tempHp";
  if (pool === "st") return "tempSt";
  if (pool === "sp") return "tempSp";
  return null;
}

export function poolLabel(pool) {
  if (pool === "tempHp" || pool === "tempSt" || pool === "tempSp") {
    const base = pool.slice(4).toLowerCase();
    return game.i18n.format("PMTTRPG.TrackerTemp", {
      tracker: game.i18n.localize(POOL_LABEL_KEYS[base] ?? base),
    });
  }
  return game.i18n.localize(POOL_LABEL_KEYS[pool] ?? pool);
}

export function damageTypeLabel(damageType) {
  return game.i18n.localize(DAMAGE_TYPE_LABEL_KEYS[damageType] ?? damageType);
}

export function getActorWeaponDamageType(actor) {
  if (!actor) return null;
  const weapon = actor.type === "npc"
    ? actor.items.find((item) => item.type === "weapon")
    : actor.items.find((item) => item.type === "weapon" && item.system?.equipped);
  const damageType = weapon?.system?.damageType;
  return DAMAGE_TYPES.includes(damageType) ? damageType : null;
}

export function getEquippedOutfit(actor) {
  if (!actor) return null;
  if (actor.type === "npc") return actor.items.find((i) => i.type === "outfit") ?? null;
  return actor.items.find((i) => i.type === "outfit" && i.system?.equipped) ?? null;
}

export function isActorStaggered(actor) {
  if (!actor) return false;
  if (actor.system?.attributes?.staggered?.value) return true;
  if (typeof actor.getStatusStacks === "function" && actor.getStatusStacks("Staggered") > 0) return true;
  return false;
}

/**
 * Resolve HP/ST resistance for a damage type on the target.
 *
 * @param {Actor} actor
 * @param {"hp"|"st"|"sp"} pool
 * @param {string|null} damageType
 * @returns {{ key: string, multiplier: number, reason: "outfit"|"staggered"|"noOutfit"|"skipped", damageType: string|null }|null}
 */
export function resolveResistance(actor, pool, damageType) {
  if (pool !== "hp" && pool !== "st") return null;
  if (!DAMAGE_TYPES.includes(damageType)) {
    return { key: "normal", multiplier: 1, reason: "skipped", damageType: damageType || null };
  }

  if (isActorStaggered(actor)) {
    return { key: "fatal", multiplier: RESISTANCE_MULTIPLIERS.fatal, reason: "staggered", damageType };
  }

  const outfit = getEquippedOutfit(actor);
  if (!outfit) {
    return { key: "fatal", multiplier: RESISTANCE_MULTIPLIERS.fatal, reason: "noOutfit", damageType };
  }

  const key = outfit.system?.resistances?.[pool]?.[damageType] || "normal";
  const multiplier = RESISTANCE_MULTIPLIERS[key] ?? 1;
  return { key, multiplier, reason: "outfit", damageType };
}

/**
 * Build the chat statement and undo payload after a successful apply.
 * @param {Actor} actor
 * @param {{ pool: string, path: string, pre: number, post: number }[]} applied
 * @param {object[]} [breakdown]
 * @returns {{ uuid: string, isHealing: boolean, updates: object[], changes: object[], breakdown: object[], isReverted: boolean }|null}
 */
export function buildAppliedDamage(actor, applied, breakdown = []) {
  const changes = [];
  const updates = [];
  for (const entry of applied) {
    const delta = entry.pre - entry.post;
    if (delta === 0) continue;
    changes.push({ pool: entry.pool, delta });
    updates.push({ path: entry.path, value: delta });
  }
  return {
    uuid: actor.uuid,
    isHealing: changes.length ? changes.every((c) => c.delta < 0) : false,
    updates,
    changes,
    breakdown,
    isReverted: false,
  };
}

/** Turn stored damage steps into localized tooltip rows. */
export function formatBreakdownRows(breakdown = []) {
  return breakdown.map((step) => {
    switch (step.key) {
      case "source":
        return {
          label: game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.Source"),
          detail: String(step.source ?? ""),
        };
      case "damageType":
        return {
          label: game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.DamageType"),
          detail: step.damageType ? damageTypeLabel(step.damageType) : "-",
        };
      case "base":
        return {
          label: game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.Base"),
          detail: String(step.amount),
        };
      case "op": {
        const opKey = {
          half: "PMTTRPG.DamageTaken.Breakdown.Half",
          double: "PMTTRPG.DamageTaken.Breakdown.Double",
          heal: "PMTTRPG.DamageTaken.Breakdown.Heal",
          full: "PMTTRPG.DamageTaken.Breakdown.Full",
        }[step.op] ?? "PMTTRPG.DamageTaken.Breakdown.Full";
        return {
          label: game.i18n.localize(opKey),
          detail: String(step.to),
        };
      }
      case "resistance": {
        const typeLabel = step.damageType ? damageTypeLabel(step.damageType) : "-";
        const levelLabel = game.i18n.localize(RESISTANCE_LABEL_KEYS[step.level] ?? step.level);
        let reason = "";
        if (step.reason === "staggered") reason = ` (${game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.Staggered")})`;
        else if (step.reason === "noOutfit") reason = ` (${game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.NoOutfit")})`;
        else if (step.reason === "skipped") reason = ` (${game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.NoType")})`;
        const poolBit = step.pool ? `${poolLabel(step.pool)} · ` : "";
        return {
          label: poolBit + game.i18n.format("PMTTRPG.DamageTaken.Breakdown.Resistance", {
            type: typeLabel,
            level: levelLabel,
          }) + reason,
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.ResistanceDetail", {
            from: step.from,
            mult: step.multiplier,
            to: step.to,
          }),
        };
      }
      case "sourceResistance": {
        const reduction = Number(step.reduction) || 0;
        const delta = reduction >= 0 ? `−${reduction}` : `+${Math.abs(reduction)}`;
        const sourceLabel = String(step.sourceLabel ?? step.source ?? "")
          .split("-")
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
        return {
          label: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.SourceResistance", {
            source: sourceLabel || step.source || "",
          }),
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.SourceResistanceDetail", {
            from: step.from,
            delta,
            to: step.to,
          }),
        };
      }
      case "easyEffects": {
        const reduction = Number(step.reduction) || 0;
        const delta = reduction >= 0 ? `−${reduction}` : `+${Math.abs(reduction)}`;
        return {
          label: game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.EasyEffects"),
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.EasyEffectsDetail", {
            from: step.from,
            delta,
            to: step.to,
          }),
        };
      }
      case "convert": {
        const formatPools = (raw) => {
          const list = Array.isArray(raw)
            ? raw
            : String(raw ?? "").split(",").map((p) => p.trim()).filter(Boolean);
          if (!list.length) return "-";
          return list.map((p) => poolLabel(p) || p).join(", ");
        };
        return {
          label: game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.Convert"),
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.ConvertDetail", {
            fromPool: formatPools(step.fromPool),
            toPool: formatPools(step.toPool),
            fromType: step.fromType ? damageTypeLabel(step.fromType) : "-",
            toType: step.toType ? damageTypeLabel(step.toType) : "-",
          }),
        };
      }
      case "afterResistance":
        return {
          label: (step.pool ? `${poolLabel(step.pool)} · ` : "")
            + game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.AfterResistance"),
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.AfterResistanceDetail", {
            bonus: step.amount,
            to: step.to,
          }),
        };
      case "clamp": {
        const reasonKey = step.reason === "max"
          ? "PMTTRPG.DamageTaken.Breakdown.ClampMax"
          : "PMTTRPG.DamageTaken.Breakdown.ClampMin";
        return {
          label: (step.pool ? `${poolLabel(step.pool)} · ` : "")
            + game.i18n.localize(reasonKey),
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.ClampDetail", {
            from: step.from,
            to: step.to,
          }),
        };
      }
      case "temp":
        return {
          label: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.Temp", {
            pool: step.pool ? poolLabel(tempPoolKey(step.pool) ?? step.pool) : "",
          }),
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.TempDetail", {
            absorbed: step.absorbed,
            from: step.from,
            to: step.to,
          }),
        };
      case "final":
        return {
          label: game.i18n.localize("PMTTRPG.DamageTaken.Breakdown.Final"),
          detail: game.i18n.format("PMTTRPG.DamageTaken.Breakdown.FinalDetail", {
            amount: step.amount,
            pool: poolLabel(step.pool),
          }),
          final: true,
        };
      default:
        return {
          label: step.label ?? step.key ?? "",
          detail: step.detail ?? String(step.amount ?? ""),
        };
    }
  }).filter((row) => row.label || row.detail);
}

/** Attach the damage breakdown for GMs and owners. */
export async function enhanceDamageTakenCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  const appliedDamage = message?.flags?.projectmoonttrpg?.appliedDamage;
  const info = root.querySelector(".damage-taken .damage-breakdown");
  if (!appliedDamage || !info) return;

  const actor = fromUuidSync(appliedDamage.uuid);
  const canSee = game.user.isGM || actor?.isOwner;
  if (!canSee || !appliedDamage.breakdown?.length) {
    info.remove();
    return;
  }

  const rows = formatBreakdownRows(appliedDamage.breakdown);
  if (!rows.length) {
    info.remove();
    return;
  }

  const breakdownHtml = await renderTemplate(
    "systems/projectmoonttrpg/templates/chat/damage-breakdown.hbs",
    { rows }
  );
  info.dataset.tooltipHtml = breakdownHtml;
  info.dataset.tooltipClass = "projectmoonttrpg damage-breakdown-tooltip";
  info.dataset.tooltipDirection = "UP";
}

export function formatDamageTakenParts(changes) {
  return changes.map((c) => {
    const amount = Math.abs(c.delta);
    const pool = poolLabel(c.pool);
    const key = c.delta > 0 ? "PMTTRPG.DamageTaken.LossPart" : "PMTTRPG.DamageTaken.GainPart";
    return game.i18n.format(key, { amount, pool });
  }).join(", ");
}

export async function postDamageTakenMessage(actor, appliedDamage) {
  if (!appliedDamage) return null;

  const token = actor.getActiveTokens(true, true)[0] ?? null;
  const name = (token?.name ?? actor.name ?? "").replace(/[<>]/g, "");
  const changes = appliedDamage.changes ?? [];
  const hasChanges = changes.length > 0;
  let statements;
  if (!hasChanges) {
    statements = game.i18n.format(
      appliedDamage.isHealing ? "PMTTRPG.DamageTaken.NoHeal" : "PMTTRPG.DamageTaken.NoDamage",
      { name }
    );
  } else {
    const allHeal = changes.every((c) => c.delta < 0);
    const allLoss = changes.every((c) => c.delta > 0);
    if (allHeal) {
      statements = game.i18n.format("PMTTRPG.DamageTaken.RecoversSummary", { name });
    } else if (allLoss) {
      statements = game.i18n.format("PMTTRPG.DamageTaken.TakesSummary", { name });
    } else {
      statements = game.i18n.format("PMTTRPG.DamageTaken.MixedSummary", { name });
    }
  }

  const content = await renderTemplate("systems/projectmoonttrpg/templates/chat/damage-taken.hbs", {
    statements,
    canUndoDamage: hasChanges && !appliedDamage.isReverted,
    hasBreakdown: !!appliedDamage.breakdown?.length,
    changes: changes.map((c) => ({
      pool: c.pool,
      amount: Math.abs(c.delta),
      heal: c.delta < 0,
      label: poolLabel(c.pool),
    })),
  });

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ token: token?.document, actor }),
    content,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: {
      projectmoonttrpg: {
        appliedDamage,
        context: { type: "damage-taken" },
      },
    },
  });
}
