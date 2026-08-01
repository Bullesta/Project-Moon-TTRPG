import { parse }                                    from "./parser.js";
import { execute, executeAlwaysActive }             from "./interpreter.js";
import { emptyAlwaysActiveMods }                    from "./nouns.js";
import { isToolPresent }                            from "../inventory/slots.js";
import { uniqueStatusItems }                        from "../status/group-statuses.js";

// ── Clash context factory ─────────────────────────────────────────────────────

/**
 * Creates a fresh clash context object for one clash.
 * Pass the same reference through every hook in that clash so bonuses
 * accumulate correctly across [On Clash Start] → [On Damage Calc] etc.
 *
 * @param {number} attackerRoll
 * @param {number} defenderRoll
 * @returns {object}
 */
export function createClashContext(attackerRoll = 0, defenderRoll = 0) {
  return {
    attackerRoll,
    defenderRoll,
    margin: attackerRoll - defenderRoll,
    bonuses: {
      attackPower:  0,
      blockPower:   0,
      evadePower:   0,
      damagePower:  0,
      attackMax:    0,
      blockMax:     0,
      evadeMax:     0,
      damageMax:    0,
      regenHP:      0,
      regenST:      0,
    },
  };
}

// ── AST cache ─────────────────────────────────────────────────────────────────

const _astCache = new Map(); // item.id → { source: string, ast: object }

function getAST(item) {
  const source = item.system?.easyEffects ?? "";
  if (!source.trim()) return null;

  const cached = _astCache.get(item.id);
  if (cached?.source === source) return cached.ast;

  try {
    const ast = parse(source);
    _astCache.set(item.id, { source, ast });
    return ast;
  } catch (err) {
    console.error(`[EasyEffects] Parse error on '${item.name}':`, err.message);
    ui.notifications?.warn(`EasyEffects parse error on '${item.name}': ${err.message}`);
    return null;
  }
}

Hooks.on("updateItem", (item) => _astCache.delete(item.id));

// ── Trigger definitions ───────────────────────────────────────────────────────
//
// Each entry:
//   hook         — Foundry hook name (native or custom pmttrpg.*)
//   triggerName  — the [Trigger Name] string in EasyEffects source
//   getItems     — (...hookArgs) => Item[]
//   buildContext — (...hookArgs) => { self, target, ally, clash } | null
//   (registry adds `item` per effect Item before execute)

const TRIGGER_HOOKS = [

  // ── [On Clash] ──────────────────────────────────────────────────────────────
  // Fires when a clash begins, for both parties' items.
  // Fire for attacker items on pmttrpg.clashStarted.
  {
    hook: "pmttrpg.clashStarted",
    triggerName: "On Clash",
    getItems: ({ attackerItem, defenderItem, appliedTool, defenderAppliedTool }) =>
      [attackerItem, defenderItem, appliedTool, defenderAppliedTool].filter(Boolean),
    buildContext: ({ attacker, defender, clash }) => ({
      self:   attacker,
      target: defender,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [On Clash Start] ────────────────────────────────────────────────────────
  // Alias for [On Clash] — kept separate so authors can distinguish
  // "setup" effects (On Clash Start) from "resolution" effects (Clash Win/Lose).
  {
    hook: "pmttrpg.clashStarted",
    triggerName: "On Clash Start",
    getItems: ({ attackerItem, defenderItem, appliedTool, defenderAppliedTool }) =>
      [attackerItem, defenderItem, appliedTool, defenderAppliedTool].filter(Boolean),
    buildContext: ({ attacker, defender, clash }) => ({
      self:   attacker,
      target: defender,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [Clash Win] ─────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.clashResolved",
    triggerName: "Clash Win",
    getItems: ({ attackerItem, appliedTool }) =>
      [attackerItem, appliedTool].filter(Boolean),
    buildContext: ({ winner, loser, attackerRoll, defenderRoll, clash }) => ({
      self:   winner,
      target: loser,
      ally:   null,
      clash:  clash ?? createClashContext(attackerRoll, defenderRoll),
    }),
  },

  // ── [Clash Lose] ────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.clashResolved",
    triggerName: "Clash Lose",
    getItems: ({ defenderItem, defenderAppliedTool }) =>
      [defenderItem, defenderAppliedTool].filter(Boolean),
    buildContext: ({ winner, loser, attackerRoll, defenderRoll, clash }) => ({
      self:   loser,
      target: winner,
      ally:   null,
      // margin from loser's POV
      clash:  clash
        ? { ...clash, margin: (defenderRoll ?? 0) - (attackerRoll ?? 0) }
        : createClashContext(defenderRoll, attackerRoll),
    }),
  },

  // ── [On Hit] ────────────────────────────────────────────────────────────────
  // Fires when an attack connects (one-sided or after Clash Win).
  {
    hook: "pmttrpg.attackConnected",
    triggerName: "On Hit",
    getItems: ({ item, appliedTool }) =>
      [item, appliedTool].filter(Boolean),
    buildContext: ({ attacker, defender, clash }) => ({
      self:   attacker,
      target: defender,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [On Damage Calc] ────────────────────────────────────────────────────────
  // Fires during damage calculation. Effects here write into clash.bonuses,
  // which your damage-calc code reads immediately after.
  {
    hook: "pmttrpg.damageCalc",
    triggerName: "On Damage Calc",
    getItems: ({ attackerItem, appliedTool }) =>
      [attackerItem, appliedTool].filter(Boolean),
    buildContext: ({ attacker, defender, clash }) => ({
      self:   attacker,
      target: defender,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [On Instant] ────────────────────────────────────────────────────────────
  // Fires for [Instant] effects — after clash resolution, before Crit/Devastation.
  {
    hook: "pmttrpg.instantEffect",
    triggerName: "On Instant",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor, clash }) => ({
      self:   actor,
      target: null,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [On Burst] ──────────────────────────────────────────────────────────────
  // Fires when a Rupture/Tremor/other burst triggers.
  // burstType is available in context as clash.burstType.
  {
    hook: "pmttrpg.burstTriggered",
    triggerName: "On Burst",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor, target, clash, burstType }) => ({
      self:   actor,
      target: target ?? null,
      ally:   null,
      clash:  clash
        ? { ...clash, burstType }
        : { ...createClashContext(), burstType },
    }),
  },

  // ── [On Critical] ───────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.criticalHit",
    triggerName: "On Critical",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ attacker, defender, clash }) => ({
      self:   attacker,
      target: defender,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [On Devastation] ────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.devastatingHit",
    triggerName: "On Devastation",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ attacker, defender, clash }) => ({
      self:   attacker,
      target: defender,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [On Use] ────────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.toolUsed",
    triggerName: "On Use",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor, target }) => ({
      self:   actor,
      target: target ?? null,
      ally:   null,
      clash:  null,
    }),
  },

  // ── [On Action] ─────────────────────────────────────────────────────────────
  // Fires whenever the actor uses an action or reaction with this item.
  {
    hook: "pmttrpg.actorAction",
    triggerName: "On Action",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor, target }) => ({
      self:   actor,
      target: target ?? null,
      ally:   null,
      clash:  null,
    }),
  },

  // ── [On Stagger] ────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.actorStaggered",
    triggerName: "On Stagger",
    getItems: ({ actor }) => getEquippedItems(actor),
    buildContext: ({ actor, attacker }) => ({
      self:   actor,
      target: attacker ?? null,
      ally:   null,
      clash:  null,
    }),
  },

  // ── [On Applied] ────────────────────────────────────────────────────────────
  // Fires when the status effect is applied.
  {
    hook: "pmttrpg.statusApplied",
    triggerName: "On Applied",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor }) => ({
      self:   actor,
      target: null,
      ally:   null,
      clash:  null,
    }),
  },

  // ── [On Removed] ────────────────────────────────────────────────────────────
  // Fires when the status effect is removed.
  {
    hook: "pmttrpg.statusRemoved",
    triggerName: "On Removed",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor }) => ({
      self:   actor,
      target: null,
      ally:   null,
      clash:  null,
    }),
  },

  // ── [Turn Start] ────────────────────────────────────────────────────────────
  // Fired from combat.js next to statusMacros.emitTurnStart.
  {
    hook: "pmttrpg.turnStart",
    triggerName: "Turn Start",
    getItems: ({ actor }) => actor ? getEquippedItems(actor) : [],
    buildContext: ({ actor }) => {
      if (!actor) return null;
      return { self: actor, target: null, ally: null, clash: null };
    },
  },

  // ── [End of Round] ──────────────────────────────────────────────────────────
  // Fired from combat.js when the round counter advances (once per combatant).
  {
    hook: "pmttrpg.endOfRound",
    triggerName: "End of Round",
    getItems: ({ actor }) => {
      if (!actor) return [];
      return [...getEquippedItems(actor), ...uniqueStatusItems(actor.items)];
    },
    buildContext: ({ actor }) => {
      if (!actor) return null;
      return { self: actor, target: null, ally: null, clash: null };
    },
  },

];

// ── Hook registration ─────────────────────────────────────────────────────────

/**
 * Call once during system init:
 *   Hooks.once("init", () => registerEasyEffectsHooks());
 */
export function registerEasyEffectsHooks() {
  for (const def of TRIGGER_HOOKS) {
    Hooks.on(def.hook, async (...hookArgs) => {
      const context = def.buildContext(...hookArgs);
      if (!context) return;

      const items = def.getItems(...hookArgs);
      for (const item of items) {
        const ast = getAST(item);
        if (!ast) continue;
        await execute(ast, def.triggerName, { ...context, item });
      }
    });
  }

  console.log(
    "[EasyEffects] Registered triggers:",
    [...new Set(TRIGGER_HOOKS.map(d => d.triggerName))].join(", ")
  );
}

// ── [Always Active] integration ───────────────────────────────────────────────

/**
 * Call at the END of _prepareCharacterData(), after all base values are set.
 * Iterates all equipped items, runs their [Always Active] blocks synchronously,
 * and returns a merged modifier object.
 *
 * Usage in actor.js:
 *
 *   // At the end of _prepareCharacterData():
 *   const eeMods = applyAlwaysActiveModifiers(actorData);
 *   data.attributes.attackModifier.value  += eeMods.attackPower;
 *   data.attributes.evadeModifier.value   += eeMods.evadePower;
 *   data.attributes.blockModifier.value   += eeMods.blockPower;
 *   applyResourceModsToSystem(data, eeMods);
 *   // damagePower / damageMax / attackMax etc. — apply to weapon dice fields
 *
 * @param {ActorPMTTRPG} actor
 * @returns {object} merged modifier object
 */
export function applyAlwaysActiveModifiers(actor) {
  const merged = emptyAlwaysActiveMods();

  const npcLoadout = actor.type === "npc";
  for (const item of actor.items) {
    if (!["weapon", "outfit", "augment", "skill", "tool"].includes(item.type)) continue;
    if (item.type === "tool") {
      if (!item.system?.equipped || !isToolPresent(item)) continue;
    } else if (!npcLoadout && !item.system?.equipped) {
      continue;
    }

    const ast = getAST(item);
    if (!ast) continue;

    // Check if this item even has an [Always Active] block before running
    const hasAlwaysActive = ast.blocks.some(b => b.trigger === "Always Active");
    if (!hasAlwaysActive) continue;

    const mods = executeAlwaysActive(ast, { self: actor, item });
    const itemName = item.name || item.id;
    for (const key of Object.keys(mods)) {
      if (key === "overrides") {
        for (const [k, v] of Object.entries(mods.overrides ?? {})) {
          const n = Math.max(0, Math.round(Number(v) || 0));
          const cur = merged.overrides[k];
          if (cur === undefined || n < cur) {
            merged.overrides[k] = n;
            merged.overrideSources[k] = [itemName];
          } else if (n === cur) {
            const list = merged.overrideSources[k] ?? (merged.overrideSources[k] = []);
            if (!list.includes(itemName)) list.push(itemName);
          }
        }
        continue;
      }
      if (key === "overrideSources") continue;
      merged[key] = (merged[key] ?? 0) + (mods[key] ?? 0);
    }
  }

  return merged;
}

// ── [On Taking Damage] runner ─────────────────────────────────────────────────

/**
 * Run defender [On Taking Damage] scripts. Mutates `damage.amount`.
 *
 * @param {Actor} actor  Defender
 * @param {{ amount: number, pool: string|string[], source: string, damageType: string }} damage
 * @param {{ attacker?: Actor|null }} [options]
 */
export async function runOnTakingDamage(actor, damage, options = {}) {
  if (!actor || !damage) return;

  const baseCtx = {
    self: actor,
    target: options.attacker ?? null,
    attacker: options.attacker ?? null,
    ally: null,
    clash: null,
    damage,
  };

  for (const item of getEquippedItems(actor)) {
    const ast = getAST(item);
    if (!ast?.blocks.some((b) => b.trigger === "On Taking Damage")) continue;
    await execute(ast, "On Taking Damage", {
      ...baseCtx,
      item,
    });
  }

  Hooks.callAll("pmttrpg.takingDamage", { actor, damage, attacker: options.attacker ?? null });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns all equipped weapons, outfits, skills, tools, and augments on an actor.
 */
function getEquippedItems(actor) {
  const npcLoadout = actor.type === "npc";
  return actor.items.filter(i => {
    if (!["weapon", "outfit", "skill", "augment", "tool"].includes(i.type)) return false;
    if (i.type === "tool") return !!i.system?.equipped && isToolPresent(i);
    return npcLoadout || i.system?.equipped === true;
  });
}
