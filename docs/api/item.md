# item

> **JSDoc coverage: -278/28 symbols (-993%)**

## `src/module/item/weapon-item-sheet.js`

### Class: `PMTTRPGWeaponItemSheet` *(extends `PMTTRPGItemSheet`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/item/tool-use.js`

### Function: `getToolUsesRemaining(tool)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |

---

### Function: `isToolUsable(tool)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |

---

### Function: `toolConsumesByDefault(tool)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |

---

### Function: `canUseTool(tool)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |

---

### Function: `consumeToolUse(tool, { consume = true } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |
| `{ consume = true } = {}` | — | — |

---

### Function: `getPreferredToolTargetActor()`

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/item/tool-item-sheet.js`

### Class: `PMTTRPGToolItemSheet` *(extends `PMTTRPGItemSheet`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/item/standalone-tool.js`

### Function: `getActorStatValue(actor, statKey)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `statKey` | — | — |

---

### Function: `abilityLabel(statKey)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `statKey` | — | — |

---

### Function: `effectLines(tool, mode)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |
| `mode` | — | — |

---

## `src/module/item/skill-item-sheet.js`

### Class: `PMTTRPGSkillItemSheet` *(extends `PMTTRPGItemSheet`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/item/outfit-item-sheet.js`

### Class: `PMTTRPGOutfitItemSheet` *(extends `PMTTRPGItemSheet`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/item/item.js`

### Function: `getEffectSignature(entry)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `entry` | — | — |

---

### Class: `ItemPMTTRPG` *(extends `Item`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

### Function: `formatMultiplier(m)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `m` | — | — |

---

## `src/module/item/item-sheet.js`

### Class: `PMTTRPGItemSheet` *(extends `HandlebarsApplicationMixin`)*

Extend the basic ItemSheet with some very simple modifications

**@extends** — {ItemSheetV2}

---

## `src/module/item/effect-item-sheet.js`

### Class: `PMTTRPGEffectItemSheet` *(extends `PMTTRPGItemSheet`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/item/declare-skill.js`

### Function: `getDeclareSkillOptions(actor, skillType = "attack")`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `skillType = "attack"` | — | — |

---

### Function: `buildDeclaredSkillTemplateData(skill, consumeLight = true)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `skill` | — | — |
| `consumeLight = true` | — | — |

---

## `src/module/item/augment-item-sheet.js`

### Class: `PMTTRPGAugmentItemSheet` *(extends `PMTTRPGItemSheet`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*

---

## `src/module/item/applied-tool.js`

### Function: `isAppliedToolEligible(tool, applyTo)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |
| `applyTo` | — | — |

---

### Function: `getAppliedToolOptions(actor, applyTo)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `actor` | — | — |
| `applyTo` | — | — |

---

### Function: `buildAppliedToolTemplateData(tool)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |

---

### Function: `maybeConsumeAppliedTool(tool, { consume = true } = {})`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |
| `{ consume = true } = {}` | — | — |

---

### Function: `canConsumeAppliedTool(tool, consume = true)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tool` | — | — |
| `consume = true` | — | — |

---

### Function: `damageTypeLabel(type)`

> [WARNING] *No JSDoc comment — signature extracted from source.*

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `type` | — | — |

---

## `src/module/item/ammunition-item-sheet.js`

### Class: `PMTTRPGAmmunitionItemSheet` *(extends `PMTTRPGItemSheet`)*

> [WARNING] *No JSDoc comment — signature extracted from source.*

*No description provided.*
