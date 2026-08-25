# easy-effects

> **JSDoc coverage: -1380/193 symbols (-715%)**

## `src/module/easy-effects/sync-from-effects.js`

### `const SYNC_START`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const SYNC_END`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `resolveClashResultTrigger(trigger, resultWord)`

@returns {{ trigger: string|null, usesResult: boolean }}

---

### Function: `stripChoiceFromTrigger(trigger)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `trigger` | — | — |

---

### Function: `resolveChoiceText(text, choiceWord, { inTrigger = false } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `text` | — | — |
| `choiceWord` | — | — |
| `{ inTrigger = false } = {}` | — | — |

---

### Function: `resolveEffectDocument(entry)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `entry` | — | — |

---

### Function: `normalizeEasyEffectsText(text)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `text` | — | — |

---

### Function: `splitManagedRegion(script)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `script` | — | — |

---

### Function: `wrapSyncedRegion(body)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `body` | — | — |

---

### Function: `joinScriptParts(before, wrappedRegion, after)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `before` | — | — |
| `wrappedRegion` | — | — |
| `after` | — | — |

---

### Function: `isEasyEffectsSyncDirty(script, expectedInner, previousInner = null)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `script` | — | — |
| `expectedInner` | — | — |
| `previousInner = null` | — | — |

---

### Function: `pendingStampHint(template, { procResult = "none" } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `template` | — | — |
| `{ procResult = "none" } = {}` | — | — |

---

### Function: `buildEasyEffectsFromEffects(effects = [])`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `effects = []` | — | — |

---

### Function: `buildEasyEffectsFromHostEffects(hostItem)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `hostItem` | — | — |

---

## `src/module/easy-effects/resistances.js`

### `const DAMAGE_TYPES`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const RESISTANCE_MULTIPLIERS`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const RESISTANCE_LEVELS`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `normalizeResistanceLevel(raw)`

@param {string} raw

---

### Function: `normalizeDamageType(raw)`

@param {string} raw

---

### Function: `isResistanceNoun(raw)`

@param {string} raw

---

### Function: `buildResistanceOverrideMap({ pools, damageTypes, level } = {})`

@returns {Record<string, string>|null}

**@param** — {{ pools?: string[], damageTypes?: string[], level: string }} spec

---

### Function: `mergeResistanceOverrideMaps(into, from)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `into` | — | — |
| `from` | — | — |

---

### Function: `formatResistanceMultiplier(multiplier)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `multiplier` | — | — |

---

## `src/module/easy-effects/registry.js`

### Function: `emptyClashSideBonuses()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `createClashContext(attackerRoll = 0, defenderRoll = 0)`

Creates a fresh clash context object for one clash.
Pass the same reference through every hook in that clash so bonuses
accumulate correctly across [On Clash Start] → [On Damage Calc] etc.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `attackerRoll` | `number` | — |
| `defenderRoll` | `number` | — |

**Returns** `object` — —

---

### Function: `getAST(item)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `item` | — | — |

---

### Function: `documentId(doc)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `doc` | — | — |

---

### Function: `sameDocument(a, b)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `a` | — | — |
| `b` | — | — |

---

### Function: `resolveOwnedItem(actor, item)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `item` | — | — |

---

### Function: `isPassiveClashItem(item)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `item` | — | — |

---

### Function: `itemIsLoadoutActive(item, actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `item` | — | — |
| `actor` | — | — |

---

### Function: `addUniqueItem(out, seen, item)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `out` | — | — |
| `seen` | — | — |
| `item` | — | — |

---

### Function: `collectSideClashItems(actor, usedItem, appliedTool, declaredSkill)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `usedItem` | — | — |
| `appliedTool` | — | — |
| `declaredSkill` | — | — |

---

### Function: `usedStatBlockItems(usedItem, appliedTool, declaredSkill)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `usedItem` | — | — |
| `appliedTool` | — | — |
| `declaredSkill` | — | — |

---

### Function: `isDesignatedClashWeapon(item, payload = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `item` | — | — |
| `payload = {}` | — | — |

---

### Function: `buildClashStartedContext(payload, item)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload` | — | — |
| `item` | — | — |

---

### Function: `clashStartedActors({ attacker = null, defender = null, side = "all" } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `{ attacker = null` | — | — |
| `defender = null` | — | — |
| `side = "all" } = {}` | — | — |

---

### Function: `buildClashStartedActorContext(payload, self)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload` | — | — |
| `self` | — | — |

---

### Function: `isOneSidedRetaliation(payload)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload` | — | — |

---

### Function: `attackerWonClash({ winner, attacker } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `{ winner` | — | — |
| `attacker } = {}` | — | — |

---

### Function: `buildClashWinContext(payload = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload = {}` | — | — |

---

### Function: `buildClashLoseContext(payload = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload = {}` | — | — |

---

### Function: `clashStartedActorContexts(payload)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload` | — | — |

---

### Function: `registerEasyEffectsHooks()`

Call once during system init:
  Hooks.once("init", () => registerEasyEffectsHooks());

---

### Function: `runItemEasyEffects(item, triggerName, context = {})`

@param {Item} item

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `triggerName` | `string` | — |
| `context` | `object` | — |

**Returns** `Promise<boolean>` — true if a script ran

---

### Function: `emitActorAction(payload)`

@param {object} payload

**Returns** `Promise<void>` — —

---

### Function: `emitTokenMoved(payload)`

@param {object} payload

**Returns** `Promise<void>` — —

---

### Function: `emitAttackConnected(payload)`

@param {object} payload

**Returns** `Promise<void>` — —

---

### Function: `emitClashStarted(payload = {})`

@param {object} payload

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload.side` *(optional, default: `"all"`)* | `"attacker"|"defender"|"all"` | — |

**Returns** `Promise<object>` — the clash context (same reference as payload.clash)

---

### Function: `emitClashResolved(payload = {})`

Pause resolves before [On Being Hit] burst checks.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `payload` | `object` | — |

**Returns** `Promise<void>` — —

---

### Function: `collectUsedSkills(owner, usedSkills)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `owner` | — | — |
| `usedSkills` | — | — |

---

### Function: `collectBurstListenerItems(attacker, burstee, skipItemId, usedSkills = [])`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `attacker` | — | — |
| `burstee` | — | — |
| `skipItemId` | — | — |
| `usedSkills = []` | — | — |

---

### Function: `findStatusItem(actor, statusName)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `statusName` | — | — |

---

### Function: `applyAlwaysActiveModifiers(actor)`

Call at the END of _prepareCharacterData(), after all base values are set.
Iterates all equipped items, runs their [Always Active] blocks synchronously,
and returns a merged modifier object.

Usage in actor.js:

  // At the end of _prepareCharacterData():
  const eeMods = applyAlwaysActiveModifiers(actorData);
  data.attributes.attackModifier.value  += eeMods.attackPower;
  data.attributes.evadeModifier.value   += eeMods.evadePower;
  data.attributes.blockModifier.value   += eeMods.blockPower;
  applyResourceModsToSystem(data, eeMods);
  // damagePower / damageMax / attackMax etc. — apply to weapon dice fields

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `ActorPMTTRPG` | — |

**Returns** `object` — merged modifier object

---

### Function: `mergeAlwaysActiveMods(merged, mods, sourceName)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `merged` | — | — |
| `mods` | — | — |
| `sourceName` | — | — |

---

### Function: `runOnTakingDamage(actor, damage, options = {})`

Mutates `damage.amount` and `damage.afterDeltaByPool`.

**@param** — {{ amount: number, pool: string|string[], source: string, damageType: string, fromAttack?: boolean, afterDeltaByPool?: Record<string, number> }} damage  
**@param** — {{ attacker?: Actor|null }} [options]

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `Actor` | — |

---

### Function: `getEquippedItems(actor)`

Returns all equipped weapons, outfits, skills, tools, and augments on an actor.

---

## `src/module/easy-effects/proc.js`

### `const RESERVED_PROC_BIND_NAMES`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `canonicalizeProcName(name)`

@param {string} name @returns {string}

---

### Function: `isReservedProcName(name)`

@param {string} name @returns {boolean}

---

### Function: `isReservedProcBindName(name)`

@param {string} name @returns {boolean}

---

### Function: `normalizeProcTrigger(raw)`

@param {string} raw

**Returns** `{ matched: boolean, trigger: string` — }

---

## `src/module/easy-effects/parser.js`

### Function: `packConditions(conditions)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `conditions` | — | — |

---

### Function: `parse(source)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `source` | — | — |

---

### Class: `Parser`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `_canStartExprFactor(tok)`

True when a token can begin a factor (so `%` is modulo and not a postfix percent).

---

### Function: `parseAccessorExpression(raw)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `raw` | — | — |

---

### Class: `ExprParser`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Class: `ParseError` *(extends `Error`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/easy-effects/nouns.js`

### `const NOUNS`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `lookupNoun(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `isResourceNoun(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `isAlwaysActiveResource(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `isRuntimeResource(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `readActorSystemPath(actor, path)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `path` | — | — |

---

### Function: `applyRuntimeResourceLocal(actor, nounId, { mode, amount } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `nounId` | — | — |
| `{ mode` | — | — |
| `amount } = {}` | — | — |

---

### Function: `applyRuntimeResource(actor, nounId, { mode, amount } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `nounId` | — | — |
| `{ mode` | — | — |
| `amount } = {}` | — | — |

---

### Function: `nounAllowsOp(name, op)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |
| `op` | — | — |

---

### Function: `isReservedNoun(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `isBonusNoun(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `isRegenNoun(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `isApplyPoolNoun(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `resolveApplyPool(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `getPowerFields(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `getPowerField(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `getMaxFields(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `getMaxField(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `getRegenField(name)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |

---

### Function: `recoverPoolLocal(actor, name, amount)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `name` | — | — |
| `amount` | — | — |

---

### Function: `recoverPool(actor, name, amount)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `name` | — | — |
| `amount` | — | — |

---

### Function: `resolvePathShorthand(actor, segment)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `segment` | — | — |

---

### Function: `emptyAlwaysActiveMods()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `applyResourceMod(mods, nounId, signedAmount)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `mods` | — | — |
| `nounId` | — | — |
| `signedAmount` | — | — |

---

### Function: `applyResourceOverride(mods, nounId, value)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `mods` | — | — |
| `nounId` | — | — |
| `value` | — | — |

---

### Function: `applyResourceModsToSystem(systemData, eeMods)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `systemData` | — | — |
| `eeMods` | — | — |

---

### Function: `applyResourceOverridesToSystem(systemData, eeMods)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `systemData` | — | — |
| `eeMods` | — | — |

---

### Function: `formatOverrideSourceNames(names)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `names` | — | — |

---

## `src/module/easy-effects/lexer.js`

### Function: `readFloorOperator(source, index)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `source` | — | — |
| `index` | — | — |

---

### Function: `readKeepDropSuffixes(source, index)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `source` | — | — |
| `index` | — | — |

---

### Function: `readNumberOrDice(source, index, diceError)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `source` | — | — |
| `index` | — | — |
| `diceError` | — | — |

---

### Function: `tokenize(source)`

@param {string} source

**Returns** `{ type: string, value: string` — []}

---

### Function: `tokenizeExpression(source)`

Tokenizes the interior of an accessor for math-expression parsing.

---

### Class: `LexError` *(extends `Error`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/easy-effects/interpreter.js`

### Function: `evaluateExprSync(node, context)`

Synchronous version — used for [Always Active] (no dice allowed).

---

### Function: `applyMathOp(op, left, right)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `op` | — | — |
| `left` | — | — |
| `right` | — | — |

---

### Function: `resolvePercentExpr(inner, context, evalFn)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `inner` | — | — |
| `context` | — | — |
| `evalFn` | — | — |

---

### Function: `resolvePathPoolPercent(segments, context)`

@returns {number|null}

---

### Function: `ensureRollsBag(context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | — | — |

---

### Function: `applyRollToContext(formula, context, bind = null)`

@param {string} formula

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | `object` | — |
| `bind` | `string|null` | — |

**Returns** `Promise<number>` — —

---

### Function: `evaluateDiceFormula(formula, context = null)`

@param {string} formula

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` *(optional)* | `object` | — |

**Returns** `Promise<number>` — —

---

### Function: `resolveActorFromUuid(uuid)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `uuid` | — | — |

---

### Function: `resolveOriginator(context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | — | — |

---

### Function: `resolveContextActor(name, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `name` | — | — |
| `context` | — | — |

---

### Function: `resolveEffectSourceLabel(context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | — | — |

---

### Function: `resolveEncounterCombat(context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | — | — |

---

### Function: `resolveCombatRound(context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | — | — |

---

### Function: `resolvePath(segments, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `segments` | — | — |
| `context` | — | — |

---

### Function: `walkObjectPath(root, segments)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `root` | — | — |
| `segments` | — | — |

---

### Function: `walkActorPath(actor, segments)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `segments` | — | — |

---

### Function: `coerceActorPathValue(value)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `value` | — | — |

---

### Function: `resolveAmountSync(amountNode, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `amountNode` | — | — |
| `context` | — | — |

---

### Function: `_resolveClashBonusSide(context, actionTarget)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | — | — |
| `actionTarget` | — | — |

---

### Function: `_clashBonusBagForSelf(context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `context` | — | — |

---

### Function: `_applyClashBonus(context, field, delta, actionTarget = "self")`

Writes N into the named field of clash.bonuses (attacker/defender bag when sided).
delta can be positive (up) or negative (down).

---

### Function: `resolveFlag(flagNode, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `flagNode` | — | — |
| `context` | — | — |

---

### Function: `resolveRhsSync(rhs, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `rhs` | — | — |
| `context` | — | — |

---

### Function: `compareValues(operator, lhs, rhs)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `operator` | — | — |
| `lhs` | — | — |
| `rhs` | — | — |

---

### Function: `evaluateConditionSync(condition, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `condition` | — | — |
| `context` | — | — |

---

### Function: `resolveTargets(targetName, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `targetName` | — | — |
| `context` | — | — |

---

### Function: `_isEnemy(other, self)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `other` | — | — |
| `self` | — | — |

---

### Function: `applyAfterResistanceDelta(damage, delta, damageFilter = null)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `damage` | — | — |
| `delta` | — | — |
| `damageFilter = null` | — | — |

---

### Function: `execute(ast, trigger, context)`

Execute all statements in a Script that match the given trigger.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `ast` | `object` | — |
| `trigger` | `string` | — |
| `context` | `object` | — { self, target, ally, item?, clash? } |

---

### Function: `resolveDialogAudience(audience, context)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `audience` | — | — |
| `context` | — | — |

---

### Function: `escapeHtml(text)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `text` | — | — |

---

### Function: `formatMessageValue(value)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `value` | — | — |

---

### Function: `interpolateMessageTemplate(template, context)`

Fill `(…)` slots in a message string. `\(` `\)` `\\` escape literals.

**Returns** `Promise<string>` — —

---

### Function: `executeAlwaysActive(ast, prepareContext)`

Runs all [Always Active] blocks in the AST synchronously.
Returns a modifier object to be merged by prepareData().
Dice and async operations are NOT allowed here.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `ast` | `object` | — |
| `prepareContext` | `object` | — { self: actor, item? } (no clash, no target) |

**Returns** `Record<string, number>` — —

---

### Class: `InterpretError` *(extends `Error`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/easy-effects/highlight.js`

### Function: `escapeHtml(text)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `text` | — | — |

---

### Function: `span(cls, text)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `cls` | — | — |
| `text` | — | — |

---

### Function: `highlightEasyEffects(source)`

@param {string} source

---

### Function: `bindEasyEffectsHighlighter(root, { signal } = {})`

@param {ParentNode} root

**@param** — {{ signal?: AbortSignal }} [options]

---

### Function: `paint()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `syncScroll()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/easy-effects/gm-route.js`

### `const _pending`

@type {Map<string, { resolve: (v: any) => void, reject: (e: Error) => void }>}

---

### Function: `canMutateActor(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `getPrimaryGM()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `isPrimaryGM()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `runAsOwnerOrGM(actor, op, payload = {})`

Routes actor mutations through an owner or active GM.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `Actor` | — |
| `op` | `string` | — |
| `payload` *(optional)* | `object` | — |

**Returns** `Promise<any>` — —

---

### Function: `sanitizeDamageOptions(options = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `options = {}` | — | — |

---

### Function: `registerGmRouteSocket()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `ensureGmRouteSocket()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/easy-effects/dice-formula.js`

### Function: `applyDiceMaxFloor(baseSides, maxDelta = 0)`

Max below d1 becomes a Power penalty.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `baseSides` | `number` | — |
| `maxDelta` | `number` | — |

**Returns** `{ sides: number, powerAdjust: number` — }

---

### Function: `parseSimpleDiceFormula(formula)`

@param {string} formula

**Returns** `{ count: number, sides: number, power: number` — |null}

---

### Function: `formatDiceFormula(count, sides, power)`

@param {number} count

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `sides` | `number` | — |
| `power` | `number` | — |

**Returns** `string` — —

---

### Function: `expandSimpleDiceByMultiplier(formula, times)`

Multiplies die count; flat Power applies once.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `formula` | `string` | — |
| `times` | `number` | — |

**Returns** `string|null` — —

---

### Function: `resolveDiceBonuses(baseFormula, bonuses = {})`

Max changes die size; Power stays flat.

**@param** — {{ power?: number, max?: number }} [bonuses]

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `baseFormula` | `string` | — |

**Returns** `{ formula: string, sides: number, power: number, powerAdjust: number, maxDelta: number` — }

---

### Function: `applyDiceBonuses(baseFormula, bonuses = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `baseFormula` | — | — |
| `bonuses = {}` | — | — |

---

## `src/module/easy-effects/damage-filter.js`

### Function: `splitTakingDamageTokens(mid)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `mid` | — | — |

---

### Function: `isAttackDamage(damage)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `damage` | — | — |

---

### Function: `filterPoolValue(filter)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filter` | — | — |

---

### Function: `matchesPoolFilter(want, damage)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `want` | — | — |
| `damage` | — | — |

---

### Function: `matchesSourceOrTypeFilter(want, damage)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `want` | — | — |
| `damage` | — | — |

---

### Function: `normalizeTakingDamageTrigger(raw)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `raw` | — | — |

---

### Function: `matchesDamageFilter(filter, damage)`

Runtime check for block.damageFilter vs context.damage.

---

### Function: `normalizeDepletedTrigger(raw)`

@param {string} raw

**Returns** `{ matched: boolean, trigger: string, depletedFilter: { pool: string` — |null }}

---

### Function: `matchesDepletedFilter(filter, depleted)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filter` | — | — |
| `depleted` | — | — |

---

### Function: `normalizeBurstTrigger(raw)`

@param {string} raw

**Returns** `{ matched: boolean, trigger: string, burstFilter: { status: string` — |null }}

---

### Function: `matchesBurstFilter(filter, { statusName = "", phase = "local" } = {})`

@param {{ status?: string }|null|undefined} filter

**@param** — {{ statusName?: string, phase?: "local"|"global" }} opts

---

### Function: `resolveDefenderClashStance(retaliationType, defenderItem = null, defenderSkill = null)`

@param {string|null|undefined} retaliationType

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `defenderItem` | `Item|null|undefined` | — |
| `defenderSkill` *(optional)* | `Item|null|undefined` | — |

**Returns** `"attack"|"block"|"evade"|null` — —

---

### Function: `resolveActorClashStance(actor, payload = {})`

@param {Actor|null|undefined} actor

**@param** — {{
  attacker?: Actor|null,
  defender?: Actor|null,
  side?: "attacker"|"defender"|"all"|null,
  retaliationType?: string|null,
  defenderItem?: Item|null,
  defenderSkill?: Item|null,
}} payload

**Returns** `"attack"|"block"|"evade"|null` — —

---

### Function: `defenderStance()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `normalizeClashStanceTrigger(raw)`

@param {string} raw

**Returns** `{ matched: boolean, trigger: string, clashStanceFilter: { stance: "attack"|"block"|"evade"|"defense"` — |null }}

---

### Function: `matchesClashStanceFilter(filter, clashStance)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filter` | — | — |
| `clashStance` | — | — |

---

## `src/module/easy-effects/choice-dialog.js`

### `const _pending`

@type {Map<string, { resolve: (id: string|null) => void }>}

---

### Function: `promptChoiceDialog({ prompt, choices, actor = null } = {})`

@param {{
  prompt: string,
  choices: { id: string, label: string }[],
  actor?: Actor|null,
}} options

**Returns** `Promise<string|null>` — —

---

### Function: `resolvePromptUser(actor)`

Player owner first, then any owner, then an active GM.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `Actor|null|undefined` | — |

**Returns** `User` — —

---

### Function: `requestRemoteChoice({ userId, prompt, choices })`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `{ userId` | — | — |
| `prompt` | — | — |
| `choices }` | — | — |

---

### Function: `registerChoiceDialogSocket()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `ensureChoiceSocket()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/easy-effects/actor-scripts.js`

### `const SYSTEM_ID`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const WORLD_SCRIPT_SETTING`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const DEFAULT_WORLD_EASY_EFFECTS`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `getWorldEasyEffects()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `isActorWorldSynced(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `resolveActorEasyEffects(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `clearActorScriptCache(actorId = null)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actorId = null` | — | — |

---

### Function: `getActorAST(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `actorHasTrigger(actor, triggerName)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `triggerName` | — | — |

---

### Function: `registerActorScriptHooks()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `runActorEasyEffects(actor, triggerName, context = {})`

@param {Actor} actor

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `triggerName` | `string` | — |
| `context` | `object` | — |

**Returns** `Promise<boolean>` — true if a script ran

---

### Function: `runDepletedEasyEffects(actor, depleted)`

@param {Actor} actor

**@param** — {{ pool: string, before: number, max: number }} depleted

---

### Function: `runActorEasyEffectsFor(actors, triggerName, buildContext)`

@param {Array<Actor|null>} actors

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `triggerName` | `string` | — |
| `buildContext` | `(actor: Actor) => object` | — |
