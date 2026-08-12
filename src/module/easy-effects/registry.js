import { parse }                                    from "./parser.js";
import { execute, executeAlwaysActive }             from "./interpreter.js";
import { emptyAlwaysActiveMods }                    from "./nouns.js";
import { isToolPresent }                            from "../inventory/slots.js";
import { uniqueStatusItems }                        from "../status/group-statuses.js";
import { isPendingStatus }                          from "../status/pending.js";
import { getActorAST, runActorEasyEffects }         from "./actor-scripts.js";
import { resolveActorClashStance }                  from "./damage-filter.js";
import { normalizeResistanceLevel, RESISTANCE_MULTIPLIERS } from "./resistances.js";

// ── Clash context factory ─────────────────────────────────────────────────────

export function emptyClashSideBonuses() {
  return {
    attackPower: 0,
    blockPower:  0,
    evadePower:  0,
    damagePower: 0,
    attackMax:   0,
    blockMax:    0,
    evadeMax:    0,
    damageMax:   0,
    regenHP:     0,
    regenST:     0,
    advantage: 0,
    disadvantage: 0,
  };
}

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
    damageType: null,
    bonuses: {
      attacker: emptyClashSideBonuses(),
      defender: emptyClashSideBonuses(),
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

function clashStartedItems({
  attackerItem,
  defenderItem,
  appliedTool,
  defenderAppliedTool,
  side = "all",
} = {}) {
  const attackerSide = [attackerItem, appliedTool].filter(Boolean);
  const defenderSide = [defenderItem, defenderAppliedTool].filter(Boolean);
  if (side === "attacker") return attackerSide;
  if (side === "defender") return defenderSide;
  return [...attackerSide, ...defenderSide];
}

function buildClashStartedContext(payload, item) {
  const {
    attacker = null,
    defender = null,
    clash = null,
  } = payload ?? {};

  let self = item?.actor ?? null;
  if (!self && item) {
    if (item === payload?.attackerItem || item === payload?.appliedTool) self = attacker;
    else if (item === payload?.defenderItem || item === payload?.defenderAppliedTool) self = defender;
  }
  if (!self) self = attacker;

  const target = self && defender && self.id === defender?.id ? attacker : defender;

  return {
    self,
    target,
    attacker,
    defender,
    ally: null,
    clash: clash ?? createClashContext(),
    clashStance: resolveActorClashStance(self, payload),
  };
}

function clashStartedActors({ attacker = null, defender = null, side = "all" } = {}) {
  const actors = [];
  if (side !== "defender" && attacker) actors.push(attacker);
  if (side !== "attacker" && defender) actors.push(defender);
  return actors;
}

function buildClashStartedActorContext(payload, self) {
  const { attacker = null, defender = null, clash = null } = payload ?? {};
  const target = self && defender && self.id === defender.id ? attacker : defender;
  return {
    self,
    target,
    attacker,
    defender,
    ally: null,
    clash: clash ?? createClashContext(),
    clashStance: resolveActorClashStance(self, payload),
  };
}

function clashWinItems({
  winner,
  attacker,
  attackerItem,
  defenderItem,
  appliedTool,
  defenderAppliedTool,
} = {}) {
  const attackerWon = winner === attacker;
  return attackerWon
    ? [attackerItem, appliedTool].filter(Boolean)
    : [defenderItem, defenderAppliedTool].filter(Boolean);
}

function clashLoseItems({
  winner,
  attacker,
  attackerItem,
  defenderItem,
  appliedTool,
  defenderAppliedTool,
} = {}) {
  const attackerWon = winner === attacker;
  return attackerWon
    ? [defenderItem, defenderAppliedTool].filter(Boolean)
    : [attackerItem, appliedTool].filter(Boolean);
}

function buildClashWinContext(payload = {}) {
  const { winner, loser, attacker, defender, attackerRoll, defenderRoll, clash } = payload;
  return {
    self: winner,
    target: loser,
    attacker: attacker ?? null,
    defender: defender ?? null,
    ally: null,
    clash: clash ?? createClashContext(attackerRoll, defenderRoll),
    clashStance: resolveActorClashStance(winner, payload),
  };
}

function buildClashLoseContext(payload = {}) {
  const { winner, loser, attacker, defender, attackerRoll, defenderRoll, clash } = payload;
  return {
    self: loser,
    target: winner,
    attacker: attacker ?? null,
    defender: defender ?? null,
    ally: null,
    // margin from loser's POV
    clash: clash
      ? { ...clash, margin: (defenderRoll ?? 0) - (attackerRoll ?? 0) }
      : createClashContext(defenderRoll, attackerRoll),
    clashStance: resolveActorClashStance(loser, payload),
  };
}

function clashStartedActorContexts(payload) {
  return clashStartedActors(payload).map((actor) => ({
    actor,
    context: buildClashStartedActorContext(payload, actor),
  }));
}

// ── Trigger definitions ───────────────────────────────────────────────────────
//
// Each entry:
//   hook         — Foundry hook name (native or custom pmttrpg.*)
//   triggerName  — the [Trigger Name] string in EasyEffects source
//   getItems     — (payload) => Item[]
//   buildContext — (payload, item?) => { self, target, ally, clash } | null
//   (registry adds `item` per effect Item before execute)

const TRIGGER_HOOKS = [

  // ── [On Clash] ──────────────────────────────────────────────────────────────
  // Fires when a clash begins, for both parties' items.
  {
    hook: "pmttrpg.clashStarted",
    triggerName: "On Clash",
    getItems: clashStartedItems,
    buildContext: buildClashStartedContext,
    getActorContexts: clashStartedActorContexts,
  },
  // ── [On Clash Start] ────────────────────────────────────────────────────────
  // Alias for [On Clash] — kept separate so authors can distinguish
  // "setup" effects (On Clash Start) from "resolution" effects (Clash Win/Lose).
  {
    hook: "pmttrpg.clashStarted",
    triggerName: "On Clash Start",
    getItems: clashStartedItems,
    buildContext: buildClashStartedContext,
    getActorContexts: clashStartedActorContexts,
  },

  // ── [Clash Win] ─────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.clashResolved",
    triggerName: "Clash Win",
    getItems: clashWinItems,
    buildContext: buildClashWinContext,
  },
  // ── [On Clash Win] ──────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.clashResolved",
    triggerName: "On Clash Win",
    getItems: clashWinItems,
    buildContext: buildClashWinContext,
  },

  // ── [Clash Lose] ────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.clashResolved",
    triggerName: "Clash Lose",
    getItems: clashLoseItems,
    buildContext: buildClashLoseContext,
  },
  // ── [On Clash Lose] ─────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.clashResolved",
    triggerName: "On Clash Lose",
    getItems: clashLoseItems,
    buildContext: buildClashLoseContext,
  },

  // ── [On Hit] ────────────────────────────────────────────────────────────────
  // Fires when an attack connects (one-sided or after Clash Win).
  {
    hook: "pmttrpg.attackConnected",
    triggerName: "On Hit",
    getItems: ({ item, appliedTool, attacker }) => {
      const out = [item, appliedTool].filter(Boolean);
      if (attacker) out.push(...uniqueStatusItems(attacker.items));
      return out;
    },
    buildContext: ({ attacker, defender, clash }) => ({
      self:   attacker,
      target: defender,
      attacker: attacker ?? null,
      ally:   null,
      clash:  clash ?? createClashContext(),
    }),
  },

  // ── [On Being Hit] ──────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.attackConnected",
    triggerName: "On Being Hit",
    getItems: ({ defender }) => {
      if (!defender) return [];
      return [...getEquippedItems(defender), ...uniqueStatusItems(defender.items)];
    },
    buildContext: ({ attacker, defender, clash }) => {
      if (!defender) return null;
      return {
        self: defender,
        target: attacker ?? null,
        attacker: attacker ?? null,
        ally: null,
        clash: clash ?? createClashContext(),
      };
    },
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

  // ── [On Gain] ───────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.statusGained",
    triggerName: "On Gain",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor, before, after, amount }) => ({
      self: actor,
      target: null,
      ally: null,
      clash: null,
      changed: { before, after, amount },
    }),
  },

  // ── [On Lose] ───────────────────────────────────────────────────────────────
  {
    hook: "pmttrpg.statusLost",
    triggerName: "On Lose",
    getItems: ({ item }) => item ? [item] : [],
    buildContext: ({ actor, before, after, amount }) => ({
      self: actor,
      target: null,
      ally: null,
      clash: null,
      changed: { before, after, amount: -Math.abs(amount) },
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

// Prevent hook listeners from rerunning awaited emitters.
let _emittingAttackConnected = false;
let _emittingClashStarted = false;
let _emittingClashResolved = false;

async function runActorScriptsForDef(def, payload) {
  let entries;
  if (def.getActorContexts) {
    entries = def.getActorContexts(payload) ?? [];
  } else {
    const context = def.buildContext(payload, null);
    entries = context?.self ? [{ actor: context.self, context }] : [];
  }

  const seen = new Set();
  for (const entry of entries) {
    const actor = entry?.actor;
    if (!actor || !entry.context || seen.has(actor.id)) continue;
    seen.add(actor.id);
    try {
      await runActorEasyEffects(actor, def.triggerName, entry.context);
    } catch (err) {
      console.error(`[EasyEffects] Actor script ${def.triggerName} failed on '${actor.name}':`, err);
    }
  }
}

// ── Hook registration ─────────────────────────────────────────────────────────

/**
 * Call once during system init:
 *   Hooks.once("init", () => registerEasyEffectsHooks());
 */
export function registerEasyEffectsHooks() {
  for (const def of TRIGGER_HOOKS) {
    Hooks.on(def.hook, async (...hookArgs) => {
      if (def.hook === "pmttrpg.attackConnected" && _emittingAttackConnected) return;
      if (def.hook === "pmttrpg.clashStarted" && _emittingClashStarted) return;
      if (def.hook === "pmttrpg.clashResolved" && _emittingClashResolved) return;

      const payload = hookArgs[0] ?? {};
      const items = def.getItems(payload);
      for (const item of items) {
        const context = def.buildContext(payload, item);
        if (!context) continue;
        await runItemEasyEffects(item, def.triggerName, context);
      }
      await runActorScriptsForDef(def, payload);
    });
  }

  console.log(
    "[EasyEffects] Registered triggers:",
    [...new Set(TRIGGER_HOOKS.map(d => d.triggerName))].join(", ")
  );
}

/**
 * @param {Item} item
 * @param {string} triggerName
 * @param {object} context
 * @returns {Promise<boolean>} true if a script ran
 */
export async function runItemEasyEffects(item, triggerName, context = {}) {
  if (!item || !triggerName) return false;
  // Pending statuses do not run scripts.
  if (isPendingStatus(item)) return false;
  const ast = getAST(item);
  if (!ast) return false;
  await execute(ast, triggerName, { ...context, item });
  return true;
}

/**
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function emitAttackConnected(payload) {
  _emittingAttackConnected = true;
  try {
    const eeDefs = TRIGGER_HOOKS.filter((d) => d.hook === "pmttrpg.attackConnected");
    for (const def of eeDefs) {
      const items = def.getItems(payload);
      for (const item of items) {
        const context = def.buildContext(payload, item);
        if (!context) continue;
        try {
          await runItemEasyEffects(item, def.triggerName, context);
        } catch (err) {
          console.error(
            `[EasyEffects] ${def.triggerName} failed on '${item?.name}':`,
            err
          );
        }
      }
      await runActorScriptsForDef(def, payload);
    }
    Hooks.callAll("pmttrpg.attackConnected", payload);
  } finally {
    _emittingAttackConnected = false;
  }
}

/**
 * @param {object} payload
 * @param {"attacker"|"defender"|"all"} [payload.side="all"]
 * @returns {Promise<object>} the clash context (same reference as payload.clash)
 */
export async function emitClashStarted(payload = {}) {
  const clash = payload.clash ?? createClashContext();
  const full = { ...payload, clash, side: payload.side ?? "all" };

  _emittingClashStarted = true;
  try {
    const eeDefs = TRIGGER_HOOKS.filter((d) => d.hook === "pmttrpg.clashStarted");
    for (const def of eeDefs) {
      for (const item of def.getItems(full)) {
        const context = def.buildContext(full, item);
        if (!context) continue;
        try {
          await runItemEasyEffects(item, def.triggerName, context);
        } catch (err) {
          console.error(
            `[EasyEffects] ${def.triggerName} failed on '${item?.name}':`,
            err
          );
        }
      }
      await runActorScriptsForDef(def, full);
    }
    Hooks.callAll("pmttrpg.clashStarted", full);
  } finally {
    _emittingClashStarted = false;
  }

  return clash;
}

/**
 * Pause resolves before [On Being Hit] burst checks.
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function emitClashResolved(payload = {}) {
  _emittingClashResolved = true;
  try {
    const eeDefs = TRIGGER_HOOKS.filter((d) => d.hook === "pmttrpg.clashResolved");
    for (const def of eeDefs) {
      for (const item of def.getItems(payload)) {
        const context = def.buildContext(payload, item);
        if (!context) continue;
        try {
          await runItemEasyEffects(item, def.triggerName, context);
        } catch (err) {
          console.error(
            `[EasyEffects] ${def.triggerName} failed on '${item?.name}':`,
            err
          );
        }
      }
      await runActorScriptsForDef(def, payload);
    }
    Hooks.callAll("pmttrpg.clashResolved", payload);
  } finally {
    _emittingClashResolved = false;
  }
}

const BURST_NEST_MAX_DEPTH = 8;

// ── [On Burst] ────────────────────────────────────────────────────────────────
// Fires when a Rupture/Tremor/other burst triggers.
// Burst state lives on context.burst (status / amount / before / after).

/**
 * @param {{
 *   statusName: string,
 *   actor: Actor,
 *   attacker?: Actor|null,
 *   clash?: object|null,
 *   sourceItem?: Item|null,
 *   depth?: number,
 * }} opts
 * @returns {Promise<boolean>} true if a burst ran
 */
export async function emitStatusBurst({
  statusName,
  actor,
  attacker = null,
  clash = null,
  sourceItem = null,
  depth = 0,
} = {}) {
  const name = String(statusName ?? "").trim();
  if (!actor || !name) return false;

  if (depth >= BURST_NEST_MAX_DEPTH) {
    console.warn(
      `[EasyEffects] Skipping burst ${name} (depth ${depth}): nested bursts exceeded limit`
    );
    return false;
  }

  const statusItem = findStatusItem(actor, name);
  if (!statusItem) {
    console.warn(`[EasyEffects] burst '${name}': no status item on ${actor.name}`);
    return false;
  }

  const stacksBefore = Number(actor.getStatusStacks?.(name) ?? statusItem.system?.stacks ?? 0) || 0;
  if (stacksBefore <= 0) return false;

  const burst = {
    status: statusItem.name || name,
    amount: stacksBefore,
    before: stacksBefore,
    after: null,
  };

  const localCtx = {
    self: actor,
    target: actor,
    attacker: attacker ?? null,
    ally: null,
    clash: clash ?? null,
    item: statusItem,
    burst,
    burstPhase: "local",
    _burstDepth: depth + 1,
  };

  try {
    await runItemEasyEffects(statusItem, "On Burst", localCtx);
  } catch (err) {
    console.error(`[EasyEffects] Local burst failed on '${statusItem.name}':`, err);
  }

  await runActorEasyEffects(actor, "On Burst", { ...localCtx, item: null });

  burst.after = Number(actor.getStatusStacks?.(name) ?? 0) || 0;

  const listeners = collectBurstListenerItems(attacker, actor, statusItem.id);
  for (const { item, owner } of listeners) {
    const globalCtx = {
      self: owner,
      target: actor,
      attacker: attacker ?? null,
      ally: null,
      clash: clash ?? null,
      item,
      burst: { ...burst },
      burstPhase: "global",
      _burstDepth: depth + 1,
    };
    try {
      await runItemEasyEffects(item, "On Burst", globalCtx);
    } catch (err) {
      console.error(`[EasyEffects] Global On ${burst.status} Burst failed on '${item?.name}':`, err);
    }
  }

  const globalOwners = [attacker, actor].filter(Boolean);
  const seenOwners = new Set();
  for (const owner of globalOwners) {
    if (seenOwners.has(owner.id)) continue;
    seenOwners.add(owner.id);
    await runActorEasyEffects(owner, "On Burst", {
      self: owner,
      target: actor,
      attacker: attacker ?? null,
      ally: null,
      clash: clash ?? null,
      item: null,
      burst: { ...burst },
      burstPhase: "global",
      _burstDepth: depth + 1,
    });
  }

  Hooks.callAll("pmttrpg.burstTriggered", {
    actor,
    target: actor,
    attacker: attacker ?? null,
    statusName: burst.status,
    burst,
    item: statusItem,
    sourceItem: sourceItem ?? null,
    clash: clash ?? null,
  });

  return true;
}

const PROC_NEST_MAX_DEPTH = 8;

// ── [On <Proc>] ───────────────────────────────────────────────────────────────
// Dynamic trigger: `On ${procName}` (e.g. On Tremor).

/**
 * @param {{
 *   procName: string,
 *   focusActor: Actor,
 *   proccer?: Actor|null,
 *   attacker?: Actor|null,
 *   target?: Actor|null,
 *   clash?: object|null,
 *   sourceItem?: Item|null,
 *   binds?: Record<string, unknown>,
 *   depth?: number,
 * }} opts
 * @returns {Promise<boolean>}
 */
export async function emitProc({
  procName,
  focusActor,
  proccer = null,
  attacker = null,
  target = null,
  clash = null,
  sourceItem = null,
  binds = {},
  depth = 0,
} = {}) {
  const name = String(procName ?? "").trim();
  if (!focusActor || !name) return false;

  if (depth >= PROC_NEST_MAX_DEPTH) {
    console.warn(
      `[EasyEffects] Skipping proc ${name} (depth ${depth}): nested procs exceeded limit`
    );
    return false;
  }

  const triggerName = `On ${name}`;
  const proc = {
    name,
    binds: { ...(binds && typeof binds === "object" ? binds : {}) },
  };

  const clashTarget = target ?? null;
  const statusItem = findStatusItem(focusActor, name);

  if (statusItem) {
    const localCtx = {
      self: focusActor,
      target: clashTarget,
      attacker: attacker ?? null,
      ally: null,
      clash: clash ?? null,
      item: statusItem,
      proc: { ...proc, binds: { ...proc.binds } },
      _procDepth: depth + 1,
    };
    try {
      await runItemEasyEffects(statusItem, triggerName, localCtx);
    } catch (err) {
      console.error(`[EasyEffects] Local proc failed on '${statusItem.name}':`, err);
    }
    await runActorEasyEffects(focusActor, triggerName, { ...localCtx, item: null });
  }

  const skipItemId = statusItem?.id ?? null;
  const listeners = collectBurstListenerItems(proccer, focusActor, skipItemId);
  for (const { item, owner } of listeners) {
    const globalCtx = {
      self: owner,
      target: clashTarget,
      attacker: attacker ?? null,
      ally: null,
      clash: clash ?? null,
      item,
      proc: { ...proc, binds: { ...proc.binds } },
      _procDepth: depth + 1,
    };
    try {
      await runItemEasyEffects(item, triggerName, globalCtx);
    } catch (err) {
      console.error(`[EasyEffects] Global ${triggerName} failed on '${item?.name}':`, err);
    }
  }

  const globalOwners = [proccer, focusActor].filter(Boolean);
  const seenOwners = new Set();
  for (const owner of globalOwners) {
    if (seenOwners.has(owner.id)) continue;
    seenOwners.add(owner.id);
    if (statusItem && owner.id === focusActor.id) continue;
    await runActorEasyEffects(owner, triggerName, {
      self: owner,
      target: clashTarget,
      attacker: attacker ?? null,
      ally: null,
      clash: clash ?? null,
      item: null,
      proc: { ...proc, binds: { ...proc.binds } },
      _procDepth: depth + 1,
    });
  }

  Hooks.callAll("pmttrpg.procTriggered", {
    procName: name,
    proc,
    focus: focusActor,
    proccer: proccer ?? null,
    attacker: attacker ?? null,
    target: clashTarget,
    item: statusItem ?? null,
    sourceItem: sourceItem ?? null,
    clash: clash ?? null,
  });

  return true;
}

function findStatusItem(actor, statusName) {
  const want = String(statusName).trim().toLowerCase();
  if (!want) return null;
  return uniqueStatusItems(actor.items).find(
    (i) => String(i.name ?? "").trim().toLowerCase() === want
  ) ?? null;
}

/**
 * @param {Actor|null|undefined} attacker
 * @param {Actor} burstee
 * @param {string} skipItemId
 * @returns {{ item: Item, owner: Actor }[]}
 */
function collectBurstListenerItems(attacker, burstee, skipItemId) {
  const out = [];
  const seen = new Set();
  for (const owner of [attacker, burstee]) {
    if (!owner?.items) continue;
    for (const item of [...getEquippedItems(owner), ...uniqueStatusItems(owner.items)]) {
      if (!item?.id || item.id === skipItemId) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push({ item, owner });
    }
  }
  return out;
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

  const actorAst = getActorAST(actor);
  if (actorAst?.blocks.some(b => b.trigger === "Always Active")) {
    mergeAlwaysActiveMods(
      merged,
      executeAlwaysActive(actorAst, { self: actor, item: null }),
      actor.name || actor.id
    );
  }

  const npcLoadout = actor.type === "npc";
  for (const item of actor.items) {
    const isStatus = item.type === "status";
    if (!isStatus && !["weapon", "outfit", "augment", "skill", "tool"].includes(item.type)) continue;
    if (isStatus) {
      if (isPendingStatus(item)) continue;
    } else if (item.type === "tool") {
      if (!item.system?.equipped || !isToolPresent(item)) continue;
    } else if (!npcLoadout && !item.system?.equipped) {
      continue;
    }

    const ast = getAST(item);
    if (!ast) continue;

    // Check if this item even has an [Always Active] block before running
    const hasAlwaysActive = ast.blocks.some(b => b.trigger === "Always Active");
    if (!hasAlwaysActive) continue;

    mergeAlwaysActiveMods(merged, executeAlwaysActive(ast, { self: actor, item }), item.name || item.id);
  }

  return merged;
}

function mergeAlwaysActiveMods(merged, mods, sourceName) {
  for (const key of Object.keys(mods)) {
    if (key === "overrides") {
      for (const [k, v] of Object.entries(mods.overrides ?? {})) {
        const n = Math.max(0, Math.round(Number(v) || 0));
        const cur = merged.overrides[k];
        if (cur === undefined || n < cur) {
          merged.overrides[k] = n;
          merged.overrideSources[k] = [sourceName];
        } else if (n === cur) {
          const list = merged.overrideSources[k] ?? (merged.overrideSources[k] = []);
          if (!list.includes(sourceName)) list.push(sourceName);
        }
      }
      continue;
    }
    if (key === "overrideSources") continue;
    if (key === "resistanceOverrideSources") continue;
    if (key === "resistanceOverrides") {
      if (!merged.resistanceOverrides) merged.resistanceOverrides = {};
      if (!merged.resistanceOverrideSources) merged.resistanceOverrideSources = {};
      for (const [cell, level] of Object.entries(mods.resistanceOverrides ?? {})) {
        const next = normalizeResistanceLevel(level);
        if (!next) continue;
        const cur = normalizeResistanceLevel(merged.resistanceOverrides[cell]);
        const nextMult = RESISTANCE_MULTIPLIERS[next] ?? 1;
        const curMult = cur != null ? (RESISTANCE_MULTIPLIERS[cur] ?? 1) : -Infinity;
        if (cur == null || nextMult > curMult) {
          merged.resistanceOverrides[cell] = next;
          merged.resistanceOverrideSources[cell] = [sourceName];
        } else if (nextMult === curMult) {
          const list = merged.resistanceOverrideSources[cell]
            ?? (merged.resistanceOverrideSources[cell] = []);
          if (!list.includes(sourceName)) list.push(sourceName);
        }
      }
      continue;
    }
    merged[key] = (merged[key] ?? 0) + (mods[key] ?? 0);
  }
}

// ── [On Taking Damage] runner ─────────────────────────────────────────────────

/**
 * Mutates `damage.amount` and `damage.afterDeltaByPool`.
 * @param {Actor} actor
 * @param {{ amount: number, pool: string|string[], source: string, damageType: string, afterDeltaByPool?: Record<string, number> }} damage
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

  await runActorEasyEffects(actor, "On Taking Damage", baseCtx);

  const items = [
    ...getEquippedItems(actor),
    ...uniqueStatusItems(actor.items),
  ];
  const seen = new Set();
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    await runItemEasyEffects(item, "On Taking Damage", baseCtx);
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
