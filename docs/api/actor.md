# actor

> **JSDoc coverage: -177/20 symbols (-885%)**

## `src/module/actor/progression.js`

### Function: `getRankFromLevel(level)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `level` | — | — |

---

### Function: `isRankUpLevel(level)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `level` | — | — |

---

### Function: `getStatCap(rank)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `rank` | — | — |

---

### `const ACTION_ECONOMY_BY_RANK`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `getActionEconomyFromRank(rank)`

@param {number} rank

**Returns** `{ actions: number, reactions: number, movement: number` — }

---

### `const RANK_UP_LEVELS`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const XP_PER_LEVEL`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### `const TACTICAL_SQUARES_BASE`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `squareTurnCap(squares)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `squares` | — | — |

---

## `src/module/actor/character-sheet.js`

### Class: `PMTTRPGCharacterSheet` *(extends `HandlebarsApplicationMixin`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `buildRow(pool, key, title)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `pool` | — | — |
| `key` | — | — |
| `title` | — | — |

---

### Function: `resize()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `seedMotes()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `draw(t)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `t` | — | — |

---

### Function: `frame(t)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `t` | — | — |

---

### Function: `buildGroupsFor(item)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `item` | — | — |

---

## `src/module/actor/actor.js`

### Function: `sourceSystemNumber(actorData, path)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actorData` | — | — |
| `path` | — | — |

---

### Function: `statusMutationOptions(options = {}, delta = 0)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `options = {}` | — | — |
| `delta = 0` | — | — |

---

### Class: `ActorPMTTRPG` *(extends `Actor`)*

Extends the basic Actor class for Project Moon TTRPG.

**@extends** — {Actor}

---

## `src/module/actor/actor-npc-sheet.js`

### Class: `PMTTRPGActorNpcSheet` *(extends `PMTTRPGCharacterSheet`)*

GM-facing NPC sheet
Extends the character sheet for shared trackers, rolls, and item actions.
