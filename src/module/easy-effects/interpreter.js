import {
  applyResourceMod,
  applyResourceOverride,
  applyRuntimeResource,
  emptyAlwaysActiveMods,
  getMaxField,
  getPowerField,
  getRegenField,
  isRuntimeResource,
  recoverPool,
  resolvePathShorthand,
} from "./nouns.js";
import { matchesDamageFilter } from "./damage-filter.js";

async function evaluateExpr(node, context) {
  switch (node.type) {
    case "Num":   return node.value;
    case "Dice": {
      const roll = new Roll(node.formula);
      await roll.roll();
      return roll.total;
    }
    case "Path":  return resolvePath(node.segments, context);
    case "EffectN":
      return Math.max(0, Number(context.effectN) || 0);
    case "BinOp": {
      const [left, right] = await Promise.all([
        evaluateExpr(node.left, context),
        evaluateExpr(node.right, context),
      ]);
      return applyMathOp(node.op, left, right);
    }
    default:
      console.warn(`[EasyEffects] Unknown expr node type '${node.type}'`);
      return 0;
  }
}

/** Synchronous version — used for [Always Active] (no dice allowed). */
function evaluateExprSync(node, context) {
  switch (node.type) {
    case "Num":  return node.value;
    case "Dice":
      console.warn("[EasyEffects] Dice expressions are not allowed in [Always Active] — returning 0.");
      return 0;
    case "Path": return resolvePath(node.segments, context);
    case "EffectN":
      return Math.max(0, Number(context.effectN) || 0);
    case "BinOp":
      return applyMathOp(
        node.op,
        evaluateExprSync(node.left, context),
        evaluateExprSync(node.right, context)
      );
    default: return 0;
  }
}

function applyMathOp(op, left, right) {
  switch (op) {
    case "+":  return left + right;
    case "-":  return left - right;
    case "*":  return left * right;
    case "/":  return right === 0 ? (console.warn("[EasyEffects] Division by zero"), 0) : left / right;
    case "%":  return right === 0 ? (console.warn("[EasyEffects] Modulo by zero"), 0)   : left % right;
    case "//":
    case "//f":
      return right === 0 ? (console.warn("[EasyEffects] Floor-div by zero"), 0) : Math.floor(left / right);
    case "//c": return right === 0 ? (console.warn("[EasyEffects] Ceil-div by zero"), 0) : Math.ceil(left / right);
    default:   console.warn(`[EasyEffects] Unknown operator '${op}'`); return 0;
  }
}

const ITEM_PATH_FIELDS = new Set(["rank", "lightCost"]);

function resolvePath(segments, context) {
  const root = segments[0];

  if (root === "clash") {
    const clash = context.clash;
    if (!clash) { console.warn("[EasyEffects] 'clash.*' used outside clash context."); return 0; }
    const key = segments[1];
    const map = {
      margin: clash.margin ?? 0,
      attackerRoll: clash.attackerRoll ?? 0,
      defenderRoll: clash.defenderRoll ?? 0,
      // bonus reads (for conditions)
      attackPower: clash.bonuses?.attackPower ?? 0,
      blockPower:  clash.bonuses?.blockPower  ?? 0,
      evadePower:  clash.bonuses?.evadePower  ?? 0,
      damagePower: clash.bonuses?.damagePower ?? 0,
      attackMax:   clash.bonuses?.attackMax   ?? 0,
      blockMax:    clash.bonuses?.blockMax    ?? 0,
      evadeMax:    clash.bonuses?.evadeMax    ?? 0,
      damageMax:   clash.bonuses?.damageMax   ?? 0,
      regenHP:     clash.bonuses?.regenHP     ?? 0,
      regenST:     clash.bonuses?.regenST     ?? 0,
    };
    if (!(key in map)) { console.warn(`[EasyEffects] Unknown clash path 'clash.${key}'`); return 0; }
    return map[key];
  }

  if (root === "item") {
    const item = context.item;
    if (!item) { console.warn("[EasyEffects] 'item.*' used but no item in context."); return 0; }
    const key = segments[1];
    if (!ITEM_PATH_FIELDS.has(key)) {
      console.warn(`[EasyEffects] Unknown item path 'item.${key}'`);
      return 0;
    }
    return Number(item.system?.[key] ?? 0);
  }

  // incoming.* == damage.*
  if (root === "damage" || root === "incoming") {
    const dmg = context.damage;
    if (!dmg) {
      console.warn(`[EasyEffects] '${root}.*' used outside [On Taking Damage] context.`);
      return 0;
    }
    const key = segments[1];
    if (key === "amount") return Number(dmg.amount) || 0;
    if (key === "source" || key === "damageType") return dmg[key] ?? "";
    if (key === "pool") {
      const raw = dmg.pool;
      if (Array.isArray(raw)) return raw[0] ?? "";
      return raw ?? "";
    }
    console.warn(`[EasyEffects] Unknown ${root} path '${root}.${key}'`);
    return 0;
  }

  const actor = (root === "attacker" ? context.attacker : context[root]) ?? null;
  if (!actor) { console.warn(`[EasyEffects] Path root '${root}' not in context.`); return 0; }

  const sub = segments.slice(1);
  if (!sub.length) return 0;

  if (sub[0] === "status" && sub[1]) return actor.getStatusStacks(sub[1]);

  if (sub.length === 1) {
    const shorthand = resolvePathShorthand(actor, sub[0]);
    if (shorthand !== null) return shorthand;
  }

  if (sub[0] === "stat"  && sub[1]) return actor.system.abilities?.[sub[1]]?.value ?? 0;
  if (sub[0] === "attr"  && sub[1]) return actor.system.attributes?.[sub[1]]?.value ?? 0;

  console.warn(`[EasyEffects] Unknown path: '${segments.join(".")}'`);
  return 0;
}

// ── Amount resolution ─────────────────────────────────────────────────────────

async function resolveAmount(amountNode, context) {
  if (!amountNode) return 1;
  switch (amountNode.type) {
    case "NUMBER":   return amountNode.value;
    case "DICE":     { const r = new Roll(amountNode.value); await r.roll(); return r.total; }
    case "ACCESSOR": return Number(await evaluateExpr(amountNode.expr, context)) || 0;
    case "EFFECT_N": return Math.max(0, Number(context.effectN) || 0);
    case "MULTIPLIEDPATH":
      return resolvePath(amountNode.path.segments, context)
        * await resolveAmount(amountNode.multiplier, context);
    default: console.warn(`[EasyEffects] Unknown amount type '${amountNode.type}'`); return 1;
  }
}

function resolveAmountSync(amountNode, context) {
  if (!amountNode) return 1;
  switch (amountNode.type) {
    case "NUMBER":   return amountNode.value;
    case "DICE":     console.warn("[EasyEffects] Dice not allowed in [Always Active]"); return 0;
    case "ACCESSOR": return Number(evaluateExprSync(amountNode.expr, context)) || 0;
    case "EFFECT_N": return Math.max(0, Number(context.effectN) || 0);
    case "MULTIPLIEDPATH":
      return resolvePath(amountNode.path.segments, context)
        * resolveAmountSync(amountNode.multiplier, context);
    default: return 1;
  }
}

// ── Action handlers ───────────────────────────────────────────────────────────

/**
 * Writes N into the named field of clash.bonuses.
 * delta can be positive (up) or negative (down).
 */
function _applyClashBonus(context, field, delta) {
  if (!context.clash?.bonuses) {
    console.warn(`[EasyEffects] Clash bonus '${field}' used outside a clash context — ignored.`);
    return;
  }
  context.clash.bonuses[field] = (context.clash.bonuses[field] ?? 0) + delta;
}

const ACTION_HANDLERS = {
  // ── Status / resource ──────────────────────────────────────────────────────
  add: async (action, context, amount) => {
    if (action.noun === "resource") {
      if (isRuntimeResource(action.argument)) {
        for (const actor of resolveTargets(action.target, context)) {
          await applyRuntimeResource(actor, action.argument, { mode: "add", amount });
        }
        return;
      }
      console.warn(`[EasyEffects] Resource gain/lose ('${action.argument}') only applies in [Always Active].`);
      return;
    }
    if (action.noun !== "status") throw new InterpretError(`'add' only supports noun 'status'`);
    for (const actor of resolveTargets(action.target, context))
      await actor.addStatusStacks(action.argument, amount);
  },

  remove: async (action, context, amount) => {
    if (action.noun === "resource") {
      if (isRuntimeResource(action.argument)) {
        for (const actor of resolveTargets(action.target, context)) {
          await applyRuntimeResource(actor, action.argument, { mode: "remove", amount });
        }
        return;
      }
      console.warn(`[EasyEffects] Resource gain/lose ('${action.argument}') only applies in [Always Active].`);
      return;
    }
    if (action.noun !== "status") throw new InterpretError(`'remove' only supports noun 'status'`);
    for (const actor of resolveTargets(action.target, context))
      await actor.removeStatusStacks(action.argument, amount);
  },

  // ── HP / ST / SP / Light ───────────────────────────────────────────────────
  deal: async (action, context, amount) => {
    if (action.noun !== "damage") throw new InterpretError(`'deal' only supports noun 'damage'`);
    const host = context.item;
    // Status damage uses the item name as its source.
    const source = host?.type === "status" ? (host.name || null) : null;
    // Reflected damage keeps the pending pool(s) and type unless overridden.
    const inheritedPool = context.damage?.pool;
    const pool = action.pool
      || (Array.isArray(inheritedPool)
        ? (inheritedPool.length ? inheritedPool : null)
        : (inheritedPool ? String(inheritedPool) : null))
      || "hp";
    const damageType = action.damageType
      || (context.damage?.damageType ? String(context.damage.damageType) : null)
      || (context.clash?.damageType ? String(context.clash.damageType) : null)
      || null;
    // Avoid rerunning On Taking Damage for reflected hits.
    const skipEasyEffects = !!context.damage;
    for (const actor of resolveTargets(action.target, context)) {
      await actor.applyDamage(amount, {
        op: "full",
        pool,
        source,
        damageType,
        skipEasyEffects,
      });
    }
  },

  heal: async (action, context, amount) => {
    if (action.noun !== "damage") throw new InterpretError(`'heal' only supports noun 'damage'`);
    const pool = action.pool || "hp";
    for (const actor of resolveTargets(action.target, context)) {
      await actor.applyDamage(amount, {
        op: "heal",
        pool,
        skipEasyEffects: !!context.damage,
      });
    }
  },

  reduce: async (action, context, amount) => {
    if (action.noun !== "damage") throw new InterpretError(`'reduce' only supports noun 'damage'`);
    if (!context.damage) {
      console.warn("[EasyEffects] 'reduce damage' used outside [On Taking Damage]; ignored.");
      return;
    }
    const cur = Number(context.damage.amount) || 0;
    context.damage.amount = Math.max(0, cur - amount);
  },

  increase: async (action, context, amount) => {
    if (action.noun !== "damage") throw new InterpretError(`'increase' only supports noun 'damage'`);
    if (!context.damage) {
      console.warn("[EasyEffects] 'increase damage' used outside [On Taking Damage]; ignored.");
      return;
    }
    const cur = Number(context.damage.amount) || 0;
    context.damage.amount = Math.max(0, cur + amount);
  },

  // Conversion changes the pending hit without applying new damage.
  convert: async (action, context, amount) => {
    if (action.noun !== "damage") throw new InterpretError(`'convert' only supports noun 'damage'`);
    if (!context.damage) {
      console.warn("[EasyEffects] 'convert damage' used outside [On Taking Damage]; ignored.");
      return;
    }
    if (action.setAmount) {
      context.damage.amount = Math.max(0, amount);
    }
    if (action.convertKind === "pool") {
      context.damage.pool = action.convertTo;
    } else if (action.convertKind === "damageType") {
      context.damage.damageType = action.convertTo;
    }
  },

  set: async (action, context, amount) => {
    if (action.noun === "resource") {
      if (isRuntimeResource(action.argument)) {
        for (const actor of resolveTargets(action.target ?? "self", context)) {
          await applyRuntimeResource(actor, action.argument, { mode: "set", amount });
        }
        return;
      }
      console.warn("[EasyEffects] 'set maxHp/maxSt/maxSp/maxLight' only applies in [Always Active]; ignored.");
      return;
    }
    if (action.noun !== "stat") throw new InterpretError(`'set' only supports noun 'stat'`);
    for (const actor of resolveTargets(action.target, context)) {
      const name = action.argument;
      if (!name) continue;
      if (actor.system.attributes?.[name] !== undefined)
        await actor.update({ [`system.attributes.${name}.value`]: amount });
      else if (actor.system.abilities?.[name] !== undefined)
        await actor.update({ [`system.abilities.${name}.value`]: amount });
      else console.warn(`[EasyEffects] Unknown stat '${name}' on ${actor.name}`);
    }
  },

  // ── Clash bonus verbs ─────────────────────────────────────────────────────
  //
  // "power up attack 2"    → clash.bonuses.attackPower += 2
  // "power down evade 1"   → clash.bonuses.evadePower  -= 1
  // "dice max up damage 3" → clash.bonuses.damageMax   += 3
  // "regen hp 5"           → clash.bonuses.regenHP     += 5
  //
  // noun can be: attack | block | evade | damage (for power/dice max)
  //              hp | st | sp | light (for regen)

  "power up": async (action, context, amount) => {
    const field = getPowerField(action.noun);
    if (!field) { console.warn(`[EasyEffects] Unknown noun for power up/down: '${action.noun}'`); return; }
    _applyClashBonus(context, field, +amount);
  },

  "power down": async (action, context, amount) => {
    const field = getPowerField(action.noun);
    if (!field) { console.warn(`[EasyEffects] Unknown noun for power up/down: '${action.noun}'`); return; }
    _applyClashBonus(context, field, -amount);
  },

  "dice max up": async (action, context, amount) => {
    const field = getMaxField(action.noun);
    if (!field) { console.warn(`[EasyEffects] Unknown noun for dice max up/down: '${action.noun}'`); return; }
    _applyClashBonus(context, field, +amount);
  },

  "dice max down": async (action, context, amount) => {
    const field = getMaxField(action.noun);
    if (!field) { console.warn(`[EasyEffects] Unknown noun for dice max up/down: '${action.noun}'`); return; }
    _applyClashBonus(context, field, -amount);
  },

  regen: async (action, context, amount) => {
    const field = getRegenField(action.noun);
    if (field) {
      _applyClashBonus(context, field, +amount);
      return;
    }

    let supported = false;
    for (const actor of resolveTargets(action.target, context)) {
      supported = await recoverPool(actor, action.noun, amount) || supported;
    }
    if (!supported)
      console.warn(`[EasyEffects] Unknown regen pool '${action.noun}'`);
  },
};

// ── Flag and condition ────────────────────────────────────────────────────────

function resolveFlag(flagNode, context) {
  const actor = (flagNode.target === "attacker" ? context.attacker : context[flagNode.target]) ?? null;
  if (!actor) return 0;
  switch (flagNode.flag) {
    case "isStaggered": return actor.system.attributes?.staggered?.value ? 1 : 0;
    case "isPanicking": return actor.system.attributes?.panicking?.value ? 1 : 0;
    case "hasStatus":   return actor.getStatusStacks(flagNode.statusName) > 0 ? 1 : 0;
    default: console.warn(`[EasyEffects] Unknown flag '${flagNode.flag}'`); return 0;
  }
}

async function resolveLhs(lhs, context) {
  if (lhs.type === "ACCESSOR") return evaluateExpr(lhs.expr, context);
  if (lhs.type === "FLAG")     return resolveFlag(lhs, context);
  return 0;
}

async function resolveRhs(rhs, context) {
  if (rhs.type === "NUMBER")   return rhs.value;
  if (rhs.type === "ACCESSOR") return evaluateExpr(rhs.expr, context);
  if (rhs.type === "IDENT" || rhs.type === "STRING") return rhs.value;
  return 0;
}

async function evaluateCondition(condition, context) {
  const lhs = await resolveLhs(condition.lhs, context);
  const rhs = await resolveRhs(condition.rhs, context);
  switch (condition.operator) {
    case ">":  return lhs >  rhs;
    case "<":  return lhs <  rhs;
    case ">=": return lhs >= rhs;
    case "<=": return lhs <= rhs;
    case "==": return lhs === rhs;
    case "!=": return lhs !== rhs;
    default: throw new InterpretError(`Unknown operator '${condition.operator}'`);
  }
}

// ── Target resolution ─────────────────────────────────────────────────────────

const SINGLE_TARGETS = new Set(["self", "target", "ally", "attacker"]);

function resolveTargets(targetName, context) {
  if (SINGLE_TARGETS.has(targetName)) {
    const actor = (targetName === "attacker" ? context.attacker : context[targetName]) ?? null;
    if (!actor) { console.warn(`[EasyEffects] Target '${targetName}' not in context.`); return []; }
    return [actor];
  }
  const combat = game.combat;
  if (!combat) { console.warn("[EasyEffects] Multi-target used but no active combat."); return []; }
  const self = context.self;
  const all  = combat.combatants.map(c => c.actor).filter(Boolean);
  switch (targetName) {
    case "enemies": return all.filter(a => !self || (a.id !== self.id && _isEnemy(a, self)));
    case "allies":  return all.filter(a => self && a.id !== self.id && !_isEnemy(a, self));
    case "all":     return all;
    default: console.warn(`[EasyEffects] Unknown target '${targetName}'`); return [];
  }
}

function _isEnemy(other, self) {
  const st = self.getActiveTokens(true)[0];
  const ot = other.getActiveTokens(true)[0];
  if (!st || !ot) return false;
  return ot.document.disposition !== st.document.disposition;
}

// ── Main async entry point ────────────────────────────────────────────────────

/**
 * Execute all statements in a Script that match the given trigger.
 *
 * @param {object} ast
 * @param {string} trigger
 * @param {object} context — { self, target, ally, item?, clash? }
 */
export async function execute(ast, trigger, context) {
  for (const block of ast.blocks) {
    if (block.trigger !== trigger) continue;
    if (block.damageFilter && !matchesDamageFilter(block.damageFilter, context.damage)) continue;

    for (const stmt of block.statements) {
      try {
        // Skip effect-template branches for the other polarity.
        if (stmt.polarity && stmt.polarity !== context.effectMode) continue;
        if (stmt.condition && !(await evaluateCondition(stmt.condition, context))) continue;

        let inheritedTarget = "self";
        for (const action of stmt.actions) {
          const effectiveTarget = action.target ?? inheritedTarget;
          if (action.target) inheritedTarget = action.target;

          let amount = await resolveAmount(action.amount, context);
          if (action.per) amount *= await resolveAmount(action.per, context);
          amount = Math.max(0, Math.round(amount));

          const handler = ACTION_HANDLERS[action.verb];
          if (!handler) { console.warn(`[EasyEffects] Unknown verb '${action.verb}'`); continue; }
          await handler({ ...action, target: effectiveTarget }, context, amount);
        }
      } catch (err) {
        console.error(`[EasyEffects] Error in statement:`, stmt, err);
        ui.notifications?.error(`EasyEffects error: ${err.message}`);
      }
    }
  }
}

// ── [Always Active] synchronous entry point ───────────────────────────────────

/**
 * Runs all [Always Active] blocks in the AST synchronously.
 * Returns a modifier object to be merged by prepareData().
 * Dice and async operations are NOT allowed here.
 *
 * @param {object} ast
 * @param {object} prepareContext — { self: actor, item? } (no clash, no target)
 * @returns {Record<string, number>}
 */
export function executeAlwaysActive(ast, prepareContext) {
  const mods = emptyAlwaysActiveMods();

  // [Always Active] context has no clash and no target
  const context = {
    self: prepareContext.self,
    target: null,
    ally: null,
    item: prepareContext.item ?? null,
    clash: null,
  };

  for (const block of ast.blocks) {
    if (block.trigger !== "Always Active") continue;
    for (const stmt of block.statements) {
      try {
        // Condition (sync eval only — no dice)
        if (stmt.condition) {
          const lhs = stmt.condition.lhs.type === "ACCESSOR"
            ? evaluateExprSync(stmt.condition.lhs.expr, context)
            : resolveFlag(stmt.condition.lhs, context);
          const rhs = stmt.condition.rhs.type === "NUMBER"
            ? stmt.condition.rhs.value
            : evaluateExprSync(stmt.condition.rhs.expr, context);

          let pass = false;
          switch (stmt.condition.operator) {
            case ">":  pass = lhs >  rhs; break;
            case "<":  pass = lhs <  rhs; break;
            case ">=": pass = lhs >= rhs; break;
            case "<=": pass = lhs <= rhs; break;
            case "==": pass = lhs === rhs; break;
            case "!=": pass = lhs !== rhs; break;
          }
          if (!pass) continue;
        }

        for (const action of stmt.actions) {
          const amount = Math.max(0, Math.round(resolveAmountSync(action.amount, context)));

          switch (action.verb) {
            case "power up": {
              const f = getPowerField(action.noun);
              if (f) mods[f] = (mods[f] ?? 0) + amount;
              else console.warn(`[EasyEffects] Unknown noun for power up: '${action.noun}'`);
              break;
            }
            case "power down": {
              const f = getPowerField(action.noun);
              if (f) mods[f] = (mods[f] ?? 0) - amount;
              else console.warn(`[EasyEffects] Unknown noun for power down: '${action.noun}'`);
              break;
            }
            case "dice max up": {
              const f = getMaxField(action.noun);
              if (f) mods[f] = (mods[f] ?? 0) + amount;
              else console.warn(`[EasyEffects] Unknown noun for dice max up: '${action.noun}'`);
              break;
            }
            case "dice max down": {
              const f = getMaxField(action.noun);
              if (f) mods[f] = (mods[f] ?? 0) - amount;
              else console.warn(`[EasyEffects] Unknown noun for dice max down: '${action.noun}'`);
              break;
            }
            case "add":
              if (action.noun === "resource") {
                if (!applyResourceMod(mods, action.argument, +amount))
                  console.warn(`[EasyEffects] [Always Active] unknown resource '${action.argument}'`);
              } else {
                console.warn(`[EasyEffects] Verb '${action.verb}' is not supported in [Always Active] for noun '${action.noun}'.`);
              }
              break;
            case "remove":
              if (action.noun === "resource") {
                if (!applyResourceMod(mods, action.argument, -amount))
                  console.warn(`[EasyEffects] [Always Active] unknown resource '${action.argument}'`);
              } else {
                console.warn(`[EasyEffects] Verb '${action.verb}' is not supported in [Always Active] for noun '${action.noun}'.`);
              }
              break;
            case "set":
              if (action.noun === "resource") {
                if (!applyResourceOverride(mods, action.argument, amount))
                  console.warn(`[EasyEffects] [Always Active] cannot set '${action.argument}' (use maxHp/maxSt/maxSp/maxLight)`);
              } else {
                console.warn(`[EasyEffects] Verb 'set' in [Always Active] only supports resource maxes.`);
              }
              break;
            case "regen": {
              console.warn(
                `[EasyEffects] [Always Active] regen '${action.noun}' is not a derived mod; `
                + "use gain on a resource noun (e.g. gain 1 maxLight)."
              );
              break;
            }
            default:
              console.warn(`[EasyEffects] Verb '${action.verb}' is not supported in [Always Active].`);
          }
        }
      } catch (err) {
        console.error("[EasyEffects] Error in [Always Active] statement:", stmt, err);
      }
    }
  }

  return mods;
}

export class InterpretError extends Error {
  constructor(message) {
    super(`[EasyEffects Interpreter] ${message}`);
  }
}