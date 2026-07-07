# EasyEffects — Developer Guide

This guide covers the **full non-sugar syntax**, the internal pipeline, how to extend the system, and how to wire EasyEffects into new parts of your codebase.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Full non-sugar syntax](#2-full-non-sugar-syntax)
3. [Expressions and math](#3-expressions-and-math)
4. [Natural-language desugaring](#4-natural-language-desugaring)
5. [Extending the system](#5-extending-the-system)
6. [Wiring new triggers](#6-wiring-new-triggers)
7. [API reference](#7-api-reference)

---

## 1. Architecture Overview

EasyEffects is split into four independent files:

```
module/easy-effects/
├── lexer.js        # Source text → token array
├── parser.js       # Token array → AST
├── interpreter.js  # AST × context → side effects (async)
└── registry.js     # Registers AST execution to Foundry hooks
```

The dependency graph is strictly one-directional:

```
registry.js
  └── interpreter.js
        └── parser.js
              └── lexer.js
```

Only `registry.js` imports Foundry globals. The other three files are pure JavaScript and are fully unit-testable outside of Foundry.

### Execution flow

```
item.system.easyEffects (string)
    │
    ▼ lexer.tokenize()
token array
    │
    ▼ parser.parse()
Script AST
    │  (cached per item.id, invalidated on updateItem)
    ▼ interpreter.execute(ast, triggerName, context)
side effects on ActorPMTTRPG documents
```

---

## 2. Full Non-Sugar Syntax

The canonical (non-sugar) form of every statement is:

```
[Trigger Name]
if <condLhs> <operator> <condRhs> do <verb> <noun> <argument> <amount> per (<accessor>) on <target>;
```

Every part except the trigger and the action verb+noun is optional.

### Triggers

```
[Clash Win]
[Clash Lose]
[On Hit]
[On Stagger]
[Turn Start]
```

Defined as strings in `registry.js` — see [Wiring new triggers](#6-wiring-new-triggers).

### Conditions

```
if <lhs> <op> <rhs>
```

`lhs` is either a parenthesised accessor expression or a flag keyword:

```
if (self.status.Charge) >= 3
if isStaggered target == 1
if hasStatus "Stagger Fragile" self == 0
if isPanicking target != 1
```

Operators: `>` `<` `>=` `<=` `==` `!=`

### Actions

```
do <verb> <noun> [<argument>] [<amount>] [per (<accessor>)] [on <target>]
```

| Verb | Noun | Argument | Amount | Effect |
|------|------|----------|--------|--------|
| `add` | `status` | Status name | Stack count | Add stacks via `actor.addStatusStacks()` |
| `remove` | `status` | Status name | Stack count | Remove stacks via `actor.removeStatusStacks()` |
| `deal` | `damage` | — | HP amount | `actor.applyDamage(n, { op: 'full' })` |
| `heal` | *(any)* | — | HP amount | `actor.applyDamage(n, { op: 'heal' })` |
| `set` | `stat` | Stat name | Value | `actor.update({ system.attributes/abilities.<name>.value })` |

### Action chains

```
do add status Charge 1 on self and remove status "Stagger Fragile" 1 on target;
```

`and` chains any number of actions. Each action may have its own `on <target>`; if omitted, it inherits the last explicit target in the chain (defaulting to `self`).

### Amounts

| Token | Example | Notes |
|-------|---------|-------|
| `NUMBER` | `3` | Plain integer |
| `DICE` | `1d6` | Rolled via `new Roll(formula).roll()` |
| `ACCESSOR` | `(self.rank)` | Evaluated as a math expression |

### `per` clause

```
do deal damage 2 per (target.status.Bleed) on target;
```

The resolved amount is multiplied by the per-accessor value. Evaluated after the base amount.

### Targets

| Token | Resolves to |
|-------|------------|
| `self` | `context.self` |
| `target` | `context.target` |
| `ally` | `context.ally` |
| `enemies` | All combatants with opposing token disposition |
| `allies` | All combatants with matching disposition, excluding self |
| `all` | All combatants |

Multi-targets loop over `game.combat.combatants`.

### Status names

Status names are either a bare `IDENT` (single word, no quotes) or a `STRING` (double-quoted, may contain spaces):

```
do add status Burn 1 on target;
do add status "Stagger Fragile" 1 on target;
```

### Flags

```
if isStaggered self == 1
if isPanicking target == 0
if hasStatus Burn target == 1
if hasStatus "Stagger Fragile" self == 0
```

Flags resolve to `1` (true) or `0` (false). They are compared with `==` or `!=`.

---

## 3. Expressions and Math

Anywhere a numeric value is expected — amounts, `per` clauses, condition operands — you can write a full math expression inside `( )`.

### Operators

| Operator | Meaning | Precedence |
|----------|---------|-----------|
| `+` `-` | Addition, subtraction | Low |
| `*` `/` `%` `//` | Multiply, divide, modulo, floor-div | High |

Standard operator precedence applies. Parens nest normally.

### Leaves

| Leaf | Example | Notes |
|------|---------|-------|
| `Num` | `3` | Literal integer |
| `Dice` | `1d6` | Rolled async at evaluation time |
| `Path` | `self.rank` | Dotted path resolved against context |
| `BinOp` | `self.rank * 2` | Recursive binary operation |

### Dice + math interop

Dice are valid leaves inside `BinOp` trees:

```
do deal damage (1d6 + self.rank) on target;
do deal damage (2d8 * 2) on target;
```

Evaluation is fully `async` throughout — `evaluateExpr()` in `interpreter.js` returns a `Promise<number>`.

### Path segments

A path is a dot-separated sequence of identifiers. Quoted strings are valid as path segments for multi-word status names inside expressions:

```
(self.status."Stagger Fragile" + 1)
```

### Supported paths

| Path | Resolves to |
|------|------------|
| `self.hp` / `sp` / `st` / `light` / `xp` / `slots` | `system.attributes.<name>.value` |
| `self.rank` | `system.attributes.level.value` |
| `self.attack` | `system.attributes.attackModifier.value` |
| `self.evade` | `system.attributes.evadeModifier.value` |
| `self.block` | `system.attributes.blockModifier.value` |
| `self.speed` | `system.attributes.speed.bonus` |
| `self.stat.<name>` | `system.abilities.<name>.value` |
| `self.attr.<name>` | `system.attributes.<name>.value` (generic) |
| `self.status.<Name>` | `actor.getStatusStacks(Name)` |
| `clash.margin` | `attackerRoll - defenderRoll` |
| `clash.attackerRoll` / `clash.defenderRoll` | Raw roll totals from hook payload |

Root can be `self`, `target`, or `ally`. `clash` is available only in `[Clash Win]` and `[Clash Lose]` blocks.

---

## 4. Natural-Language Desugaring

The natural-language forms are **syntactic sugar** — they parse into the same AST nodes as the non-sugar forms. The interpreter has no awareness of which syntax was used.

| Sugar | Desugars to |
|-------|------------|
| `gain N Status [on T]` | `do add status Status N [on T]` |
| `lose N Status [on T]` | `do remove status Status N [on T]` |
| `require N T Status then X` | `if (T.status.Status) >= N do X` |
| `require (expr) op rhs then X` | `if (expr) op rhs do X` |
| `spend N Status [on T] to X` | `if (T.status.Status) >= N do X and remove status Status N on T` |

`spend` specifically appends the `remove` action automatically — the condition and the stack removal are derived from the same `N` and `Status` tokens so they can never drift out of sync.

---

## 5. Extending the System

### Adding a new verb

Open `interpreter.js` and add an entry to `ACTION_HANDLERS`:

```js
const ACTION_HANDLERS = {
  // existing verbs…

  /**
   * do push <amount> on <target>
   * Applies forced movement (placeholder — wire to your movement system).
   */
  push: async (action, context, resolvedAmount) => {
    for (const actor of resolveTargets(action.target, context)) {
      // your logic here
      console.log(`[EasyEffects] Pushed ${actor.name} ${resolvedAmount} squares`);
    }
  },
};
```

The handler receives:
- `action` — the full `Action` AST node (`verb`, `noun`, `argument`, `amount`, `per`, `target`)
- `context` — `{ self, target, ally, clash }`
- `resolvedAmount` — the already-evaluated, already-`per`-scaled integer amount

### Adding a new path shorthand

Open `interpreter.js`, find `resolvePath()`, and add a branch:

```js
// Example: self.sp.max → system.attributes.sp.max
if (sub[0] === "spmax" && sub.length === 1) {
  return actor.system.attributes?.sp?.max ?? 0;
}
```

### Adding a new flag

Open `interpreter.js`, find `resolveFlag()`, and add a case:

```js
case "isBleedingOut":
  return actor.system.attributes?.bleedOut?.active ? 1 : 0;
```

Then add the keyword to the `KEYWORDS` set in `lexer.js`:

```js
const KEYWORDS = new Set([
  // …existing…
  "isBleedingOut",
]);
```

### Adding a new trigger

See [Wiring new triggers](#6-wiring-new-triggers) below.

---

## 6. Wiring New Triggers

All trigger → hook bindings live in `registry.js` in the `TRIGGER_HOOKS` array.

Each entry has three fields:

```js
{
  hook: "foundryHookName",       // Foundry hook or custom pmttrpg.* hook
  triggerName: "Display Name",   // Matches [Display Name] in EasyEffects source
  getItems: (...hookArgs) => Item[],           // Which items' scripts to run
  buildContext: (...hookArgs) => object|null,  // Build the execution context
}
```

### Example — adding `[On Panic]`

**Step 1.** Add the entry to `TRIGGER_HOOKS` in `registry.js`:

```js
{
  hook: "pmttrpg.actorPanicked",
  triggerName: "On Panic",
  getItems: ({ actor }) => getEquippedItems(actor),
  buildContext: ({ actor }) => ({
    self:   actor,
    target: null,
    ally:   null,
    clash:  null,
  }),
},
```

**Step 2.** Fire the hook from your panic logic:

```js
// Inside your panic trigger code:
Hooks.callAll("pmttrpg.actorPanicked", { actor });
```

**Step 3.** Document it in the user guide trigger table.

That's all — no changes to the lexer, parser, or interpreter.

### Built-in custom hooks

| Hook | Payload | Used by |
|------|---------|---------|
| `pmttrpg.clashResolved` | `{ winner, loser, attackerItem, defenderItem, attackerRoll, defenderRoll }` | `[Clash Win]`, `[Clash Lose]` |
| `pmttrpg.attackConnected` | `{ attacker, defender, item }` | `[On Hit]` |
| `pmttrpg.actorStaggered` | `{ actor, attacker }` | `[On Stagger]` |
| `combatTurnChange` *(native)* | `(combat, prior, current)` | `[Turn Start]` |

---

## 7. API Reference

### `parse(source: string): Script`

Tokenizes and parses a full EasyEffects source string. Returns a `Script` AST. Throws `LexError` or `ParseError` on invalid input.

```js
import { parse } from "./easy-effects/parser.js";
const ast = parse(`[Clash Win]\ngain 1 Charge;`);
```

### `execute(ast, trigger, context): Promise<void>`

Executes all blocks in the script that match `trigger`. Safe to call with a trigger that has no matching block — it silently no-ops.

```js
import { execute } from "./easy-effects/interpreter.js";
await execute(ast, "Clash Win", {
  self:   winnerActor,
  target: loserActor,
  ally:   null,
  clash:  { margin: 4, attackerRoll: 12, defenderRoll: 8 },
});
```

**Context shape:**

```ts
{
  self:   ActorPMTTRPG,
  target: ActorPMTTRPG | null,
  ally:   ActorPMTTRPG | null,
  clash:  {
    margin:       number,
    attackerRoll: number,
    defenderRoll: number,
  } | null,
}
```

### `registerEasyEffectsHooks(): void`

Registers all trigger→hook bindings. Call once during system init:

```js
import { registerEasyEffectsHooks } from "./easy-effects/registry.js";
Hooks.once("init", () => registerEasyEffectsHooks());
```

### Actor status methods (from `actor-status-methods.js`)

These are methods on `ActorPMTTRPG`. Stack count = number of owned items with `type === 'status'` and matching name.

| Method | Signature | Description |
|--------|-----------|-------------|
| `getStatusStacks` | `(name: string) → number` | Count stacks |
| `addStatusStacks` | `(name: string, amount?: number) → Promise<Item[]>` | Add stacks; auto-creates from compendium if missing |
| `removeStatusStacks` | `(name: string, amount?: number) → Promise<string[]>` | Remove stacks; clamps at 0 |
| `setStatusStacks` | `(name: string, target: number) → Promise<void>` | Set exact stack count |
| `_fetchStatusFromCompendium` | `(name: string) → Promise<object\|null>` | Static; searches all Item packs |

---

## AST Shape Reference

### `Script`
```js
{
  type: "Script",
  blocks: Block[]
}
```

### `Block`
```js
{
  type: "Block",
  trigger: string,       // e.g. "Clash Win"
  statements: Statement[]
}
```

### `Statement`
```js
{
  type: "Statement",
  condition: Condition | null,
  actions: Action[]
}
```

### `Condition`
```js
{
  type: "Condition",
  lhs: AccessorNode | FlagNode,
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=",
  rhs: { type: "NUMBER", value: number }
      | { type: "ACCESSOR", expr: ExprNode }
      | { type: "DICE", value: string }
      | { type: "IDENT", value: string }
}
```

### `Action`
```js
{
  type: "Action",
  verb:     string,             // "add" | "remove" | "deal" | "heal" | "set"
  noun:     string,             // "status" | "damage" | "stat" | …
  argument: string | null,      // status name, stat name, etc.
  amount:   AmountNode | null,  // NUMBER | DICE | ACCESSOR
  per:      ExprNode | null,    // expression for per-scaling
  target:   string | null,      // null = inherit from chain
}
```

### `ExprNode` (math expression)
```js
{ type: "Num",   value: number }
{ type: "Dice",  formula: string }
{ type: "Path",  segments: string[] }
{ type: "BinOp", op: "+" | "-" | "*" | "/" | "%" | "//", left: ExprNode, right: ExprNode }
```

### `FlagNode`
```js
{
  type:       "FLAG",
  flag:       "isStaggered" | "isPanicking" | "hasStatus",
  statusName: string | null,   // set for hasStatus only
  target:     string,          // "self" | "target" | "ally"
}
```