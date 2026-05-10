# Project Moon TTRPG System - Modification Guide

This guide provides step-by-step instructions for common modifications.

## Table of Contents
1. [Before You Start](#before-you-start)
2. [Simple Modifications](#simple-modifications)
3. [Sheet Modifications](#sheet-modifications)
4. [Roll System Modifications](#roll-system-modifications)
5. [Content Modifications](#content-modifications)
6. [Advanced Modifications](#advanced-modifications)

---

## Before You Start

### Setup Development Environment

```bash
# 1. Clone/navigate to project
cd Project-Moon-TTRPG

# 2. Install dependencies
npm install

# 3. Start watching for changes
npm run watch

# In another terminal, start Foundry
# Then refresh Foundry (Ctrl+Shift+R) to see changes
```

### Important Workflow

1. **Make change** to file
2. **Run `npm run watch`** in terminal (watches for changes automatically)
3. **Refresh Foundry** (Ctrl+Shift+R in browser - hard refresh!)
4. **Test the change**
5. **Check browser console** for any errors
6. **Repeat** for next change

---

## Simple Modifications

### 1. Change Ability Score Names

**Goal:** Rename STR to "Might"

**Step 1:** Edit `src/yaml/template.yml`

The template uses the standard ability names. You don't need to change the template itself, as it's just a data structure.

**Step 2:** Edit `src/module/config.js`

```javascript
// Find this section (around line 4)
export const TTRPG = {};

TTRPG.abilities = {
  "str": "TTRPG.AbilityStr",       // ← This is the KEY
  "dex": "TTRPG.AbilityDex",
  // ... etc
};

// The value is a LOCALIZATION KEY that maps to actual text
// Keys are used for multi-language support
```

**Step 3:** Edit language files

Localization files are typically in a `lang/` folder. For English:

**In localization file (e.g., `src/yaml/lang/en.yml` or similar):**

```yaml
TTRPG:
  AbilityStr: "Might"     # Changed from "Strength"
  AbilityDex: "Dexterity"
  # ...
```

**Or in JSON format:**
```json
{
  "TTRPG.AbilityStr": "Might",
  "TTRPG.AbilityDex": "Dexterity"
}
```

**Step 4:** Rebuild and test

```bash
npm run build
# Refresh Foundry
```

**Expected result:** Character sheets now show "Might" instead of "Strength"

---

### 2. Change Default Ability Scores

**Goal:** Start characters with 8 in all abilities instead of 10

**Step 1:** Edit `src/yaml/template.yml`

Find the character template:

```yaml
# Before
character:
  abilities:
    str:
      value: 10      # ← Change this
      min: 3
      mod: 0
      debility: false

# After
character:
  abilities:
    str:
      value: 8       # Changed to 8
      min: 3
      mod: 0
      debility: false
```

Do this for all 6 abilities: str, dex, con, int, wis, cha

**Step 2:** Rebuild

```bash
npm run build
```

**Step 3:** Test

Create a new character - should start with 8s in all abilities

---

### 3. Change Default Maximum HP

**Goal:** Characters start with 12 HP instead of 10

**Step 1:** Edit `src/yaml/template.yml`

```yaml
# In base template (shared by all actors)
templates:
  base:
    attributes:
      hp:
        value: 10      # ← Current max
        min: 0
        max: 10        # ← Change these
```

**After:**
```yaml
templates:
  base:
    attributes:
      hp:
        value: 12      # Changed to 12
        min: 0
        max: 12        # Changed to 12
```

**Step 2:** Rebuild and test

```bash
npm run build
```

---

### 4. Add a New Custom Resource

**Goal:** Add "Inspiration" resource tracking (like "Forward" and "Hold")

**Step 1:** Edit `src/yaml/template.yml`

Find character attributes section:

```yaml
character:
  attributes:
    hp:
      value: 10
      min: 0
      max: 10
    # ... other attributes ...
    resource1:
      label: Custom Resource
      value: 0
      max: 0
    # Add new one:
    inspiration:      # ← NEW
      label: Inspiration
      value: 0
      max: 5
```

**Step 2:** Edit sheet template to display it

Find `src/templates/sheet/character-sheet.hbs` and locate the resources section:

```handlebars
{{!-- Find existing resources section --}}
<section class="resources">
  {{partial 'systems/projectmoonttrpg/templates/parts/resources.hbs'}}
</section>

{{!-- Or add directly --}}
<div class="resource-section">
  <label>Forward: 
    <input type="number" name="system.attributes.forward.value" 
           value="{{actor.system.attributes.forward.value}}" />
  </label>
  
  {{!-- Add this for inspiration --}}
  <label>Inspiration: 
    <input type="number" name="system.attributes.inspiration.value" 
           value="{{actor.system.attributes.inspiration.value}}" 
           max="{{actor.system.attributes.inspiration.max}}" />
  </label>
</div>
```

**Step 3:** Rebuild and test

```bash
npm run build
```

Create a character and verify the new resource appears on the sheet.

---

### 5. Change Roll Result Labels

**Goal:** Change "Partial Success" to "Mixed Success"

**Step 1:** Edit `src/module/config.js`

```javascript
// Find this section
TTRPG.rollResults = {
  failure: {
    start: null,
    end: 6,
    label: 'TTRPG.failure'          // Localization key
  },
  partial: {
    start: 7,
    end: 9,
    label: 'TTRPG.partial'          // ← This is the key
  },
  success: {
    start: 10,
    end: null,
    label: 'TTRPG.success'
  }
};
```

**Step 2:** Update localization

In your language file:

```json
{
  "TTRPG.partial": "Mixed Success"    // Changed from "Partial Success"
}
```

**Step 3:** Rebuild and test

```bash
npm run build
```

Roll a move and get a 7-9 result to verify the label changed.

---

## Sheet Modifications

### 6. Add a New Section to Character Sheet

**Goal:** Add an "Inventory Management" section

**Step 1:** Edit the character sheet template

Find `src/templates/sheet/character-sheet.hbs`

```handlebars
{{!-- Find where sections are defined, typically something like: --}}
<div class="sheet-body">
  <section class="sheet-section abilities">
    {{!-- Ability scores --}}
  </section>
  
  <section class="sheet-section moves">
    {{!-- Moves --}}
  </section>
  
  {{!-- ADD NEW SECTION HERE --}}
  <section class="sheet-section inventory-management">
    <h2>Inventory Management</h2>
    <div class="inventory-info">
      <p>Current Weight: {{actor.system.attributes.weight.value}} / {{actor.system.attributes.weight.max}}</p>
      <p>Coin: {{actor.system.attributes.coin.value}}</p>
      <div class="weight-bar">
        <div class="weight-fill" style="width: {{math (actor.system.attributes.weight.value / actor.system.attributes.weight.max * 100) 0}}%"></div>
      </div>
    </div>
  </section>
</div>
```

**Step 2:** Add styling (optional)

Edit `src/styles/src/components/_character-sheet.scss`:

```scss
.sheet-section.inventory-management {
  border: 1px solid #ccc;
  padding: 10px;
  margin: 10px 0;
  
  .weight-bar {
    width: 100%;
    height: 20px;
    background: #eee;
    border: 1px solid #999;
    border-radius: 3px;
    
    .weight-fill {
      height: 100%;
      background: linear-gradient(to right, #0f0, #ff0, #f00);
      transition: width 0.3s ease;
    }
  }
}
```

**Step 3:** Rebuild and test

```bash
npm run build
```

---

### 7. Hide a Section from the Sheet

**Goal:** Hide the "Bonds" section from display

**Step 1:** Find the bonds section in the template

`src/templates/sheet/character-sheet.hbs` probably has something like:

```handlebars
<section class="sheet-section bonds">
  <h2>Bonds</h2>
  {{!-- Bond content --}}
</section>
```

**Step 2:** Add display: none

Method 1 - CSS (recommended):

Edit `src/styles/src/components/_character-sheet.scss`:

```scss
.sheet-section.bonds {
  display: none;  // Hides this section
}
```

Method 2 - Template:

```handlebars
{{!-- Comment out the section --}}
{{!-- <section class="sheet-section bonds">
  <h2>Bonds</h2>
  ...
</section> --}}
```

**Step 3:** Rebuild and verify

```bash
npm run build
```

---

## Roll System Modifications

### 8. Add Advantage/Disadvantage

**Goal:** Add the ability to roll with advantage (roll 3d6, keep highest 2)

**Step 1:** Add new setting

Edit `src/module/projectmoonttrpg.js`, find the settings registration section (around line 80):

```javascript
// Add this setting
game.settings.register("projectmoonttrpg", "enableAdvantage", {
  name: "Enable Advantage/Disadvantage",
  hint: "Allow 3d6kh2/3d6kl2 rolls instead of 2d6",
  scope: "world",
  config: true,
  type: Boolean,
  default: false
});
```

**Step 2:** Modify roll formula

Edit `src/module/rolls.js`, find `getRollFormula()`:

```javascript
// Before
static getRollFormula(defaultFormula = '2d6') {
  return defaultFormula;
}

// After
static getRollFormula(defaultFormula = '2d6', advantage = 0) {
  if (!game.settings.get('projectmoonttrpg', 'enableAdvantage')) {
    return defaultFormula;
  }
  
  if (advantage > 0) {
    return '3d6kh2';  // Advantage: roll 3, keep highest 2
  } else if (advantage < 0) {
    return '3d6kl2';  // Disadvantage: roll 3, keep lowest 2
  }
  
  return defaultFormula;
}
```

**Step 3:** Update roll calls

In `rollMove()`, when building the formula, add advantage parameter:

```javascript
// Find where getRollFormula is called
let dice = this.getRollFormula('2d6', 0);  // Add advantage parameter

// To make it work with buttons:
// dice = this.getRollFormula('2d6', event.currentTarget.dataset.advantage);
```

**Step 4:** Add UI buttons (optional)

In sheet template, add advantage buttons:

```handlebars
<div class="roll-buttons">
  <button class="roll-btn" data-advantage="-1">Roll (Disadvantage)</button>
  <button class="roll-btn" data-advantage="0">Roll</button>
  <button class="roll-btn" data-advantage="1">Roll (Advantage)</button>
</div>
```

**Step 5:** Rebuild and test

```bash
npm run build
```

---

### 9. Modify Roll Result Thresholds

**Goal:** Change success threshold from 10+ to 9+

**Step 1:** Edit `src/module/config.js`

```javascript
// Before
TTRPG.rollResults = {
  failure: {
    start: null,
    end: 6,
    label: 'TTRPG.failure'
  },
  partial: {
    start: 7,
    end: 9,
    label: 'TTRPG.partial'
  },
  success: {
    start: 10,      // ← Change this
    end: null,
    label: 'TTRPG.success'
  }
};

// After
TTRPG.rollResults = {
  failure: {
    start: null,
    end: 6,
    label: 'TTRPG.failure'
  },
  partial: {
    start: 7,
    end: 8,         // Changed from 9
    label: 'TTRPG.partial'
  },
  success: {
    start: 9,       // Changed from 10
    end: null,
    label: 'TTRPG.success'
  }
};
```

**Step 2:** Update roll interpretation in `src/module/rolls.js`

Find where results are interpreted (search for "rollResults"):

```javascript
// Update the logic that interprets the roll
if (rollTotal >= CONFIG.TTRPG.rollResults.success.start) {
  // Success
} else if (rollTotal >= CONFIG.TTRPG.rollResults.partial.start) {
  // Partial
} else {
  // Failure
}
```

**Step 3:** Rebuild and test

```bash
npm run build
```

---

## Content Modifications

### 10. Add a New Move

**Goal:** Create a custom move "Special Attack"

**Step 1:** Create YAML file

Create `src/packs/basic-moves/Special_Attack_XXX.yml`:

```yaml
# File: src/packs/basic-moves/Special_Attack_custom123.yml
name: Special Attack
type: move
id: special-attack-custom123
system:
  description: "When you attempt a devastating attack..."
  moveType: ability
  rollType: "str"  # Uses STR ability
  moveResults:
    failure:
      value: "The enemy counters. Take 1d6 damage."
    partial:
      value: "You hit, dealing normal damage, but expose yourself."
    success:
      value: "You hit, dealing 2d6 damage instead of normal."
  choices: "How do you attack?"
```

**Step 2:** Compile packs

```bash
npm run compilePacks
```

**Step 3:** Add to Foundry

The move will appear in the "Basic Moves" compendium. GMs can drag it into characters' inventories.

---

### 11. Add Equipment

**Goal:** Add "Holy Sword" equipment

**Step 1:** Create YAML file

Create `src/packs/equipment-weapons/Holy_Sword_XXX.yml`:

```yaml
name: Holy Sword
type: equipment
id: holy-sword-custom123
system:
  description: "A sword blessed by the gods"
  class: null
  quantity: 1
  equipped: false
  weight: 2
  price: "1500gp"
  itemType: weapon
  tags: "[{\"value\": \"+1 damage\"}, {\"value\": \"2 piercing\"}]"
  magic: true
```

**Step 2:** Compile packs

```bash
npm run compilePacks
```

---

## Advanced Modifications

### 12. Add a Custom Ability (Luck)

**Step 1:** Edit `src/yaml/template.yml`

```yaml
character:
  abilities:
    str:
      value: 10
      min: 3
      mod: 0
      debility: false
    # ... other abilities ...
    luck:           # ← NEW
      value: 10
      min: 3
      mod: 0
      debility: false
```

**Step 2:** Edit `src/module/config.js`

```javascript
TTRPG.abilities = {
  "str": "TTRPG.AbilityStr",
  "dex": "TTRPG.AbilityDex",
  "con": "TTRPG.AbilityCon",
  "int": "TTRPG.AbilityInt",
  "wis": "TTRPG.AbilityWis",
  "cha": "TTRPG.AbilityCha",
  "luck": "TTRPG.AbilityLuck"  // ← NEW
};

TTRPG.debilities = {
  // ... existing ...
  "luck": "TTRPG.DebilityLuck"  // ← NEW
};
```

**Step 3:** Update sheet template

In `src/templates/sheet/character-sheet.hbs`, find abilities section:

```handlebars
{{!-- Find the abilities grid --}}
<div class="abilities-grid">
  {{#each actor.system.abilities as |ability key|}}
    <div class="ability {{key}}">
      <label>{{ability.label}}</label>
      <input type="number" name="system.abilities.{{key}}.value" 
             value="{{ability.value}}" />
      <span class="mod">{{ability.mod}}</span>
    </div>
  {{/each}}
</div>
```

This will automatically show the new ability!

**Step 4:** Add localization

In language file:

```json
{
  "TTRPG.AbilityLuck": "Luck",
  "TTRPG.DebilityLuck": "Unlucky"
}
```

**Step 5:** Rebuild and test

```bash
npm run build
```

Create a character and verify "Luck" appears in the abilities section.

---

### 13. Add Custom Sheet Tab

**Goal:** Add a "Notes" tab to the character sheet

**Step 1:** Edit sheet class

Edit `src/module/actor/actor-sheet.js`:

```javascript
// Find getData() method and add to the data object
getData() {
  const data = super.getData();
  // ... existing code ...
  
  // Add notes data
  data.notes = {
    tab: this.currentTab || 'abilities'  // Track active tab
  };
  
  return data;
}

// Add event handler
activateListeners(html) {
  super.activateListeners(html);
  
  // Tab switching
  html.find('.sheet-tabs a').click(ev => {
    const tab = $(ev.currentTarget).attr('data-tab');
    this.currentTab = tab;
    this.render();
  });
}
```

**Step 2:** Edit template

Edit `src/templates/sheet/character-sheet.hbs`:

```handlebars
<div class="sheet-tabs">
  <a class="tab {{#eq currentTab 'abilities'}}active{{/eq}}" data-tab="abilities">Abilities</a>
  <a class="tab {{#eq currentTab 'moves'}}active{{/eq}}" data-tab="moves">Moves</a>
  <a class="tab {{#eq currentTab 'notes'}}active{{/eq}}" data-tab="notes">Notes</a>
</div>

<div class="sheet-body">
  {{#eq currentTab 'abilities'}}
    {{!-- Abilities section --}}
  {{/eq}}
  
  {{#eq currentTab 'moves'}}
    {{!-- Moves section --}}
  {{/eq}}
  
  {{#eq currentTab 'notes'}}
    <div class="notes-section">
      <textarea name="system.details.biography" placeholder="Character notes...">
        {{actor.system.details.biography}}
      </textarea>
    </div>
  {{/eq}}
</div>
```

**Step 3:** Rebuild and test

```bash
npm run build
```

---

### 14. Create New Item Type

**Goal:** Add "Bond" item type with special display

**Step 1:** Edit `src/yaml/template.yml`

```yaml
Item:
  types:
    - move
    - npcMove
    - equipment
    - spell
    - bond         # ← Already exists
    - tag
    - class
    # Add new type:
    - custom-item
  
  # Add schema for new type
  custom-item:
    templates:
      - base
    customField: ''
    importance: 0
```

**Step 2:** Create new sheet class

Create `src/module/item/custom-item-sheet.js`:

```javascript
import { DwItemSheet } from "./item-sheet.js";

export class DwCustomItemSheet extends DwItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions(), {
      classes: ["projectmoonttrpg", "sheet", "item", "custom-item"],
      template: "systems/projectmoonttrpg/templates/items/custom-item-sheet.hbs",
      width: 550,
      height: 550
    });
  }
}
```

**Step 3:** Register sheet

Edit `src/module/projectmoonttrpg.js`:

```javascript
// In Hooks.once('init')
import { DwCustomItemSheet } from "./item/custom-item-sheet.js";

// Add registration:
Items.registerSheet("projectmoonttrpg", DwCustomItemSheet, {
  types: ['custom-item'],
  makeDefault: true
});
```

**Step 4:** Create template

Create `src/templates/items/custom-item-sheet.hbs`

**Step 5:** Rebuild and test

```bash
npm run build
```

---

## Testing Your Modifications

### Checklist

- [ ] Ran `npm run build` or `npm run watch`
- [ ] Hard-refreshed Foundry (Ctrl+Shift+R)
- [ ] Checked browser console (F12) for errors
- [ ] Tested on a new character/item
- [ ] Tested data persistence (reload Foundry)
- [ ] Verified all sheets still work
- [ ] Checked mobile/responsive (if applicable)

### Debugging

**If changes don't appear:**
1. Check console for JavaScript errors (F12)
2. Verify file was actually edited (reopen file)
3. Clear Foundry cache (close Foundry, delete cache folder)
4. Check `system.yml` if adding files (must be listed)

**If styles don't apply:**
1. Verify `.scss` compiled to `.css`
2. Check CSS file is in `dist/` folder
3. Verify it's listed in `system.yml`
4. Try removing old CSS with browser DevTools
5. Hard-refresh (Ctrl+Shift+R)

**If data is lost:**
1. Check migrations in `migrate.js`
2. Verify property names match exactly
3. Ensure template.yml is valid YAML
4. Test with fresh actor/item

---

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Edited file but changes don't appear | Run `npm run build` and hard refresh |
| CSS doesn't load | Check it's in `dist/` and listed in `system.yml` |
| Template shows undefined | Property doesn't exist - check prepareData() |
| YAML won't compile | Check syntax - YAML is whitespace-sensitive |
| Sheet breaks completely | Check browser console for JavaScript error |
| Character loses data | May need migration function |
| Handlebars helper not found | Check it's registered in `handlebars.js` |

---

## Next Steps

1. **Pick a modification** from this guide
2. **Follow the steps** carefully
3. **Test thoroughly** on new character/item
4. **Save your work** (git commit if using version control)
5. **Move to next modification**

Each modification builds on your understanding of the system. Start simple and work your way to more complex changes.

---

**Remember:** Always make backups before major changes, test in a new world before applying to existing ones, and consult the [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) guide if something is unclear!
