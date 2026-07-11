import { parse }                                    from "./parser.js";
import { execute, executeAlwaysActive }             from "./interpreter.js";

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

const TRIGGER_HOOKS = [

  // ── [On Clash] ──────────────────────────────────────────────────────────────
  // Fires when a clash begins, for both parties' items.
  // Fire for attacker items on pmttrpg.clashStarted.
  {
    hook: "pmttrpg.clashStarted",
    triggerName: "On Clash",
    getItems: ({ attackerItem, defenderItem }) =>
      [attackerItem, defenderItem].filter(Boolean),
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
    getItems: ({ attackerItem, defenderItem }) =>
      [attackerItem, defenderItem].filter(Boolean),
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
    getItems: ({ attackerItem }) => attackerItem ? [attackerItem] : [],
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
    getItems: ({ defenderItem }) => defenderItem ? [defenderItem] : [],
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
    getItems: ({ item }) => item ? [item] : [],
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
    getItems: ({ attackerItem }) => attackerItem ? [attackerItem] : [],
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

  // ── [On Action] ─────────────────────────────────────────────────────────────
  // Fires whenever the actor uses an action or reaction with this item.
  {
    hook: "pmttrpg.actorAction",
    triggerName: "On Action",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor, actionType }) => ({
      self:   actor,
      target: null,
      ally:   null,
      clash:  null,
      // actionType available as context.actionType for future flag checks
      actionType,
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
        await execute(ast, def.triggerName, context);
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
 *   data.attributes.light.max             += eeMods.lightBonus;
 *   data.attributes.toolSlots.value       += eeMods.toolSlots;
 *   // damagePower / damageMax / attackMax etc. — apply to weapon dice fields
 *
 * @param {ActorPMTTRPG} actor
 * @returns {object} merged modifier object
 */
export function applyAlwaysActiveModifiers(actor) {
  const merged = {
    attackPower: 0, blockPower: 0, evadePower: 0, damagePower: 0,
    attackMax:   0, blockMax:   0, evadeMax:   0, damageMax:   0,
    lightBonus:  0, toolSlots:  0,
  };

  const npcLoadout = actor.type === "npc";
  for (const item of actor.items) {
    if (!["weapon", "outfit", "augment", "skill"].includes(item.type)) continue;
    if (!npcLoadout && !item.system?.equipped) continue;

    const ast = getAST(item);
    if (!ast) continue;

    // Check if this item even has an [Always Active] block before running
    const hasAlwaysActive = ast.blocks.some(b => b.trigger === "Always Active");
    if (!hasAlwaysActive) continue;

    const mods = executeAlwaysActive(ast, { self: actor });
    for (const key of Object.keys(merged)) {
      merged[key] += mods[key] ?? 0;
    }
  }

  return merged;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns all equipped weapons, outfits, skills, and augments on an actor.
 */
function getEquippedItems(actor) {
  const npcLoadout = actor.type === "npc";
  return actor.items.filter(
    i => ["weapon", "outfit", "skill", "augment"].includes(i.type)
      && (npcLoadout || i.system?.equipped === true)
  );
}