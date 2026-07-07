# EasyEffects — Internals

This document explains how the EasyEffects pipeline works under the hood — useful if you're debugging a parse error, modifying a core file, or just want to understand what happens between a script string and a Foundry actor update.

---

## Pipeline Overview

```
Source string
    │
    ▼  lexer.tokenize()
Token stream (flat array)
    │
    ├──► [ACCESSOR raw string] ──► lexer.tokenizeExpression()
    │                                    │
    │                                    ▼  parser.ExprParser
    │                              Expression AST (ExprNode)
    │
    ▼  parser.Parser
Script AST
    │
    ▼  (cached in registry.js per item.id)
    │
    ▼  interpreter.execute(ast, trigger, context)
Side effects on ActorPMTTRPG
```

---

## Stage 1 — Lexer (`lexer.js`)

### Responsibilities

The lexer converts raw source text into a flat array of typed tokens. It has **no understanding of grammar** — it only knows what individual tokens look like.

### Token types

| Type | Example | Notes |
|------|---------|-------|
| `TRIGGER` | `[Clash Win]` | Content between `[` and `]`, trimmed |
| `KEYWORD` | `if`, `do`, `gain`, `spend` | Fixed set defined in `KEYWORDS` |
| `IDENT` | `Poise`, `add`, `status` | Alphanumeric, not in KEYWORDS |
| `STRING` | `"Stagger Fragile"` | Double-quoted; value stored without quotes |
| `NUMBER` | `3` | Integer |
| `DICE` | `1d6` | Checked before NUMBER — starts with digit, contains `d` |
| `ACCESSOR` | `(self.hp + 2)` | Entire content captured raw (nested parens handled) |
| `OPERATOR` | `>=`, `!=` | Two-char operators checked before one-char |
| `SEMICOLON` | `;` | Statement terminator |
| `EOF` | — | Sentinel appended at end |

### Two-pass accessor handling

Accessor content `(...)` is **not tokenized inline** — the raw text is captured as a single `ACCESSOR` token and re-tokenized later by `tokenizeExpression()`. This keeps the top-level grammar simple (accessors are always one token) and lets the expression sub-grammar be completely separate.

Nested parentheses inside an accessor are handled by a depth counter, so `(self.hp + (2 * 3))` is captured correctly as one token.

### `tokenizeExpression(source)`

A second, separate tokenizer for the content of accessor strings. Produces a different token set:

| Type | Example |
|------|---------|
| `IDENT` | `self`, `status`, `Charge` |
| `NUMBER` | `3` |
| `DICE` | `1d6` |
| `MATHOP` | `+`, `-`, `*`, `/`, `%`, `//` |
| `DOT` | `.` |
| `LPAREN` / `RPAREN` | `(` `)` |
| `STRING` | `"Stagger Fragile"` |
| `EOF` | — |

Floor division `//` is matched before single `/` to avoid ambiguity.

---

## Stage 2 — Parser (`parser.js`)

The parser consumes the flat token stream and produces a nested AST. It uses **recursive descent** — one method per grammar rule, each calling others as needed.

### Top-level grammar

```
script     → block* EOF
block      → TRIGGER statement*
statement  → spend_statement
           | natural_statement
           | do_statement
```

Statement dispatch happens by peeking at the first keyword:

- `spend` → `parseSpendStatement()`
- `require` / `gain` / `lose` → `parseNaturalStatement()`
- anything else → `parseDoStatement()` (which may start with `if`)

### `parseAccessorExpression(raw)`

Called whenever an `ACCESSOR` token is consumed. Calls `tokenizeExpression(raw)` and runs a separate `ExprParser` instance on the result.

`ExprParser` implements **precedence climbing**:

```
parseExpr()   → parseTerm() { (+ | -) parseTerm() }*
parseTerm()   → parseFactor() { (* | / | % | //) parseFactor() }*
parseFactor() → "-" parseFactor()        (unary minus → BinOp(0 - x))
              | "(" parseExpr() ")"      (grouping)
              | NUMBER                   → Num node
              | DICE                     → Dice node
              | IDENT ("." IDENT|STRING)* → Path node
```

This ensures `2 + 3 * 4` is parsed as `2 + (3 * 4)`, not `(2 + 3) * 4`.

### Natural-language desugaring

Natural forms parse into identical AST nodes as the standard form. The desugar happens **inside the parser** — by the time the AST leaves `parser.js`, there is no distinction. Example:

```
gain 1 Poise on self;
```
Produces exactly:
```js
{
  type: "Action",
  verb: "add", noun: "status", argument: "Poise",
  amount: { type: "NUMBER", value: 1 },
  per: null, target: "self"
}
```

### `spend` desugaring

`spend N Status to <actions>` is the most complex desugar. The parser:

1. Records `spendAmount` and `statusName` and `spendTarget`
2. Builds a `Condition` node: `spendTarget.status.statusName >= spendAmount`
3. Parses the `to` clause as a natural action chain
4. Appends a synthetic `remove status` action with the same amount and target
5. Returns a normal `Statement` node

The interpreter is completely unaware this happened.

---

## Stage 3 — Interpreter (`interpreter.js`)

The interpreter walks the `Script` AST and executes matching blocks against live Foundry actors.

### `execute(ast, trigger, context)`

```
for each Block in ast.blocks:
  if block.trigger !== trigger → skip

  for each Statement in block.statements:
    if condition present:
      evaluate condition → boolean
      if false → skip statement

    inheritedTarget = "self"

    for each Action in statement.actions:
      effectiveTarget = action.target ?? inheritedTarget
      if action.target set → update inheritedTarget

      resolvedAmount = await resolveAmount(action.amount, context)
      if action.per → resolvedAmount *= await evaluateExpr(action.per, context)
      resolvedAmount = Math.max(0, Math.round(resolvedAmount))

      handler = ACTION_HANDLERS[action.verb]
      await handler(action with effectiveTarget, context, resolvedAmount)
```

### `evaluateExpr(node, context)`

Fully async recursive evaluator for `ExprNode` trees:

```js
switch node.type:
  "Num"   → node.value
  "Dice"  → (await new Roll(node.formula).roll()).total
  "Path"  → resolvePath(node.segments, context)
  "BinOp" → applyMathOp(op, await evaluateExpr(left), await evaluateExpr(right))
```

Because `BinOp` awaits both children, dice anywhere in a tree are fully supported:

```
(1d6 + self.rank)   →  BinOp(+, Dice("1d6"), Path(["self","rank"]))
```

Both the dice roll and the path resolution happen concurrently via `Promise.all` semantics (they're `await`ed in sequence here, which is fine for correctness — parallelising them is a possible future optimization).

### `resolvePath(segments, context)`

Maps dotted path segments to actor data. The first segment is the root: `self`, `target`, `ally`, or `clash`.

For actor roots, the remaining segments are matched against a shorthand table first, then fall through to `system.attributes.<name>` or `system.abilities.<name>` for `attr.*` and `stat.*` respectively.

### `resolveTargets(targetName, context)`

Returns an `Actor[]`. For single targets (`self`/`target`/`ally`), returns `[context[targetName]]` or `[]` if null.

For multi-targets, pulls `game.combat.combatants`, maps to actors, then filters by `_isEnemy()` (token disposition comparison).

---

## Stage 4 — Registry (`registry.js`)

The registry is the only file that touches Foundry globals directly.

### AST cache

```js
const _astCache = new Map();  // item.id → { source, ast }
```

`getAST(item)` checks whether the cached source matches the current `item.system.easyEffects`. If not, re-parses and updates the cache. Parse errors are caught here and surfaced as `ui.notifications.warn` — they never crash the hook.

Cache entries are invalidated via:
```js
Hooks.on("updateItem", (item) => _astCache.delete(item.id));
```

### Hook registration

`registerEasyEffectsHooks()` iterates `TRIGGER_HOOKS` and calls `Hooks.on()` for each entry. Multiple entries can share the same Foundry hook (e.g. `pmttrpg.clashResolved` drives both `[Clash Win]` and `[Clash Lose]`).

For each hook fire:
1. `buildContext(...hookArgs)` constructs the execution context
2. `getItems(...hookArgs)` returns the items whose scripts should run
3. For each item: `getAST(item)` → `execute(ast, triggerName, context)`

---

## Error handling

| Stage | Error type | Behaviour |
|-------|-----------|-----------|
| Lexer | `LexError` | Thrown with position info; caught in registry's `getAST()` |
| Parser | `ParseError` | Thrown with offending token; caught in `getAST()` |
| Interpreter | `InterpretError` | Thrown for unknown verbs/nouns; caught per-statement in `execute()` |
| All | Runtime JS errors | Caught per-statement; logged + `ui.notifications.error` |

Individual statement errors never abort the rest of the block — the loop continues after logging.

---

## Adding a new file to the pipeline

If you need to add a pre-processing step (e.g. a macro-expansion pass or a type-checker), the cleanest place is between the parser and the interpreter:

```js
// In registry.js getAST():
const ast = parse(source);
const checkedAst = typeCheck(ast);   // your new step
_astCache.set(item.id, { source, ast: checkedAst });
```

This keeps the cache invalidation and error surface in one place.