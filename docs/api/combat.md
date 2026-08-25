# combat

> **JSDoc coverage: -616/87 symbols (-708%)**

## `src/module/combat/recycled-evade.js`

### Function: `recycledEvadeStep(outfit)`

if the outfit has the swift property, the penalty is 1 instead of 2

---

### Function: `getRecycledEvade(actor)`

@param {Actor|null|undefined} actor

**Returns** `{ active: boolean, penalty: number` — |null}

---

### Function: `grantRecycledEvade(actor, outfit = null)`

@param {Actor} actor @param {Item|null} [outfit]

---

### Function: `bumpRecycledEvade(actor, outfit = null)`

@param {Actor} actor @param {Item|null} [outfit]

---

### Function: `clearRecycledEvade(actor)`

@param {Actor} actor

---

### Function: `recycledPowerPenalty(actor)`

@param {Actor|null|undefined} actor

**Returns** `number` — —

---

## `src/module/combat/movement.js`

### Function: `combatantForToken(tokenDoc)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenDoc` | — | — |

---

### Function: `actorCombatToken(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `paidHistory(tokenDoc)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenDoc` | — | — |

---

### Function: `measureWaypointSpaces(tokenDoc, waypoints)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenDoc` | — | — |
| `waypoints` | — | — |

---

### Function: `paidWaypoints(waypoints)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `waypoints` | — | — |

---

### Function: `chunkSpaceCost(tokenDoc, chunk)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenDoc` | — | — |
| `chunk` | — | — |

---

### Function: `tokenHistorySquareCost(tokenDoc)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenDoc` | — | — |

---

### Function: `actorHistorySquareCost(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `actorSquaresExhausted(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `exhaustRemainingSquares(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `refreshActorFromToken(tokenDoc)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenDoc` | — | — |

---

### Function: `isUndoMovement(movement, operation)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `movement` | — | — |
| `operation` | — | — |

---

### Function: `isFreeMovement(movement)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `movement` | — | — |

---

### Function: `registerCombatDocument()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Class: `CombatPMTTRPG` *(extends `Base`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `registerCombatMovement()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/combat/combat.js`

### Class: `CombatSidebarPMTTRPG`

Helper class to handle rendering the custom combat tracker.

---

### Function: `eachCombatActor(fn)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `fn` | — | — |

---

## `src/module/combat/clashing.js`

### Function: `initiateAttack(attackPayload)`

Called when an actor makes an attack with a weapon.
Posts the attack card and waits for a retaliator (rolls happen in _executeClash).

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `attackPayload` | `AttackPayload` | — |

**Returns** `Promise<void>` — —

---

### Function: `handleRetaliateClick(state, { isIntercept = false } = {})`

Handles a click on "Retaliate" or "Intercept" buttons on the attack card.
Shows the retaliation dialog and proceeds to execute the clash.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `state` | `ClashStateData` | — |
| `options` *(optional)* | `object` | — |
| `options.isIntercept` *(optional, default: `false`)* | `boolean` | — |

**Returns** `Promise<void>` — —

---

### Function: `_isRangedWeapon(weapon)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `weapon` | — | — |

---

### Function: `_rangedAttackConsumesMovement(weapon)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `weapon` | — | — |

---

### Function: `_getWeaponRangeSquares(weapon)`

Effective weapon range in squares.
Melee 1, Long melee 2, Ranged 10.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `weapon` | `Item|null` | — |

**Returns** `number` — —

---

### Function: `_tokenDistanceSquares(tokenA, tokenB)`

Grid distance in squares between two tokens.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenA` | `Token|null` | — |
| `tokenB` | `Token|null` | — |

**Returns** `number|null` — —

---

### Function: `_isTargetInWeaponRange(fromTokenId, toTokenId, weapon)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `fromTokenId` | — | — |
| `toTokenId` | — | — |
| `weapon` | — | — |

---

### Function: `_isEvadeLike(choice)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `choice` | — | — |

---

### Function: `_retaliatorItemLabel(choice)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `choice` | — | — |

---

### Function: `_getOwnedActor()`

Returns the first actor owned by the current user that is a character.
Prefers actors with an active token on the current scene.

---

### `const PMTTRPGClashAPI`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/combat/clash-state.js`

### `const CLASH_PHASES`

ClashState is the canonical data object for a single clash lifecycle.
It is created when an attack is initiated, passed through every phase,
serialised into chat message flags for persistence, and rehydrated when
a player clicks a chat button.

Nothing in this file touches Foundry documents directly — it only
describes shape and serialisation. All mutation happens in clash.js.

Phases:
  "pending"   — attack roll posted, waiting for a retaliator
  "rolling"   — retaliator chosen, rolls pending
  "resolved"  — clash winner determined, result card posted
  "closed"    — damage taken / action completed

---

### `const RETALIATION_TYPES`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const CLASH_RESULTS`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `serialiseClashState(state)`

Serialises a ClashState to a plain object safe to store in message flags.
Currently a no-op (state is already plain) but provides an extension point.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `state` | `ClashStateData` | — |

**Returns** `object` — —

---

### Function: `deserialiseClashState(raw)`

Deserialises a ClashState from message flags.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `raw` | `object` | — |

**Returns** `ClashStateData` — —

---

### `const CLASH_FLAG_SCOPE`

Flag namespace used on ChatMessage documents.

---

### `const CLASH_FLAG_KEY`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/combat/clash-rolls.js`

### Function: `getEquippedOutfit(actor)`

Returns the equipped outfit for an actor, or null.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `ActorPMTTRPG` | — |

**Returns** `Item|null` — —

---

### Function: `signed(n)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `n` | — | — |

---

### Function: `pushRow(rows, key, labelKey, detail, extra = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `rows` | — | — |
| `key` | — | — |
| `labelKey` | — | — |
| `detail` | — | — |
| `extra = {}` | — | — |

---

### Function: `formMaxBonus(formProperty)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `formProperty` | — | — |

---

### Function: `handPowerBonus(handProperty)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `handProperty` | — | — |

---

### Function: `formLabel(formProperty)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `formProperty` | — | — |

---

### Function: `handLabel(handProperty)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `handProperty` | — | — |

---

### Function: `buildOffensiveDiceParts(actor, weaponItem, clashBonuses = {})`

Returns the computed evade dice string from the actor's equipped outfit,
falling back to the system default.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `ActorPMTTRPG` | — |

**Returns** `{ formula: string, breakdown: RollBreakdownRow[]` — }

---

### Function: `buildDefenseDiceParts(actor, kind, clashBonuses = {})`

Returns the computed block dice string from the actor's equipped outfit.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `ActorPMTTRPG` | — |

**Returns** `{ formula: string, breakdown: RollBreakdownRow[]` — }

---

### Function: `resolveClashRollMode(bonuses = {}, options = {})`

Advantage and Disadvantage cancel

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bonuses` *(optional)* | `object` | — |
| `options` *(optional)* | `object` | — |
| `options.advantage` *(optional)* | `boolean` | — |
| `options.disadvantage` *(optional)* | `boolean` | — |

**Returns** `"normal"|"advantage"|"disadvantage"|"canceled"` — —

---

### Function: `wrapFormulaForRollMode(formula, mode)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `formula` | — | — |
| `mode` | — | — |

---

### Function: `poolSubtotals(roll)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `roll` | — | — |

---

### Function: `walk(terms)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `terms` | — | — |

---

### Function: `rollDataForActor(actor)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |

---

### Function: `rollAttack(actor, weaponItem, bonuses = {}, options = {})`

@param {ActorPMTTRPG} actor

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `weaponItem` | `Item` | — |
| `bonuses` *(optional)* | `object` | attackPower and attackMax for one clash side |
| `options` *(optional)* | `object` | — |
| `options.advantage` *(optional)* | `boolean` | — |
| `options.disadvantage` *(optional)* | `boolean` | — |

**Returns** `Promise<RollResult>` — —

---

### Function: `rollEvade(actor, bonuses = {}, options = {})`

@param {ActorPMTTRPG} actor

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bonuses` *(optional)* | `object` | — |
| `options` *(optional)* | `object` | — |

**Returns** `Promise<RollResult>` — —

---

### Function: `rollBlock(actor, bonuses = {}, options = {})`

@param {ActorPMTTRPG} actor

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `bonuses` *(optional)* | `object` | — |
| `options` *(optional)* | `object` | — |

**Returns** `Promise<RollResult>` — —

---

### Function: `rollCounter(actor, weaponItem, bonuses = {}, options = {})`

@param {ActorPMTTRPG} actor

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `weaponItem` | `Item` | — |
| `bonuses` *(optional)* | `object` | — |
| `options` *(optional)* | `object` | — |

**Returns** `Promise<RollResult>` — —

---

### Function: `resolveClash(attackTotal, defenseTotal)`

@param {number} attackTotal

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `defenseTotal` | `number` | — |

**Returns** `{ result: string, margin: number` — }

---

## `src/module/combat/clash-dialog.js`

### Function: `showInterceptConfirmDialog()`

Shows a two-click "Are you sure you want to intercept?" confirmation.

**Returns** `Promise<boolean>` — —

---

### Function: `showRetaliationDialog(actor, state, { isIntercept = false } = {})`

Shows the retaliation option dialog.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `ActorPMTTRPG` | — the actor who is retaliating |
| `state` | `ClashStateData` | — |
| `options` *(optional)* | `object` | — |
| `options.isIntercept` *(optional, default: `false`)* | `boolean` | — |

**Returns** `Promise<RetaliationChoice|null>` — —

---

### Function: `_buildRetaliationOptions(weapons, outfits, recycled)`

Builds the ordered list of retaliation options for the template.

---

### Function: `_skillTypeForRetaliation(type)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `type` | — | — |

---

### Function: `_readRetaliationForm(dialog, actor)`

Reads and validates the submitted retaliation form.
Returns a RetaliationChoice or null.

---

### Function: `promptRangedAmmo(actor, weapon, { shootLabel } = {})`

Prompt ammo and dry-fire for ranged attacks.

**@param** — {{ shootLabel?: string }} [options]

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | `ActorPMTTRPG` | — |
| `weapon` | `Item` | — |

**Returns** `Promise<{ ammo: Item|null, consumeAmmo: boolean, dryFire: boolean` — |null>}

---

### Function: `promptRangedCounterAmmo(actor, weapon)`

@deprecated Prefer {@link promptRangedAmmo}

---

### Function: `_bindRetaliationDialogListeners(dialog)`

Wires show/hide of the item picker sub-list based on which option is selected.

---

### Function: `refreshPicker()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `refreshConsume()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `_dialogClasses()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/combat/clash-chat.js`

### Function: `postAttackCard(state, attackRoll = null, messageId = null)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `state` | — | — |
| `attackRoll = null` | — | — |
| `messageId = null` | — | — |

---

### Function: `updateAttackCard(messageId, updatedState)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `messageId` | — | — |
| `updatedState` | — | — |

---

### Function: `postResultCard(state, defenseRoll = null, messageId = null, attackRoll = null)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `state` | — | — |
| `defenseRoll = null` | — | — |
| `messageId = null` | — | — |
| `attackRoll = null` | — | — |

---

### Function: `enhanceClashRollBreakdown(message, html)`

@param {ChatMessage} message

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `html` | `HTMLElement` | — |

---

### `const tips`

/** @type {{ el: Element, rows: object[]|null|undefined }[]}

---

### Function: `registerClashChatListeners()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `getClashStateFromMessage(messageId)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `messageId` | — | — |

---

### Function: `getClashApplyTarget(state)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `state` | — | — |

---

### Function: `resolveClashCombatant(actorId, tokenId)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actorId` | — | — |
| `tokenId` | — | — |

---

### Function: `_tokenDocument(tokenId)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tokenId` | — | — |

---

### Function: `_dsnUserForCombatant(actorId, tokenId)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actorId` | — | — |
| `tokenId` | — | — |

---

### Function: `_dsnSpeakerForCombatant(actorId, tokenId)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actorId` | — | — |
| `tokenId` | — | — |

---

### Function: `_showClashDice(roll, actorId, tokenId)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `roll` | — | — |
| `actorId` | — | — |
| `tokenId` | — | — |

---

### Function: `_attackCardI18n(state)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `state` | — | — |

---

### Function: `_resultCardI18n(state, applyTarget = null)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `state` | — | — |
| `applyTarget = null` | — | — |
