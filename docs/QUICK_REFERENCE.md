# Project Moon TTRPG System - Quick Reference Guide

This guide provides quick access to common tasks and file locations.

## Quick Navigation

### Find What You Need

**I want to modify...**

| What | Location | Key Functions |
|------|----------|---|
| Ability scores | `src/yaml/template.yml` → abilities | `actor.js` → `_prepareCharacterData()` |
| Roll mechanics | `src/module/rolls.js` | `getRollFormula()`, `rollMove()` |
| Character sheet layout | `src/module/actor/actor-sheet.js` + `src/templates/sheet/` | `getData()`, event listeners |
| NPC sheet | `src/module/actor/actor-npc-sheet.js` + templates | Same as character sheet |
| Equipment/items | `src/module/item/item.js` + `src/templates/items/` | `prepareData()`, roll methods |
| Game settings | `src/module/projectmoonttrpg.js` | `Hooks.once('init')` |
| Styling (CSS) | `src/styles/src/` (SCSS) | Compile with `npm run compile` |
| Chat messages | `src/module/chat.js` + `src/templates/chat/` | Message hooks |
| Compendium content | `src/packs/` (YAML files) | Edit `.yml`, run `npm run compilePacks` |
| System configuration | `src/module/config.js` | `TTRPG` object definitions |
| Helper functions | `src/module/utility.js` | String cleanup, calculations |
| Template rendering | `src/module/templates.js` | Preload list |

---

## File-by-File Reference

### Core Initialization

**`src/module/projectmoonttrpg.js`**
- **Purpose:** System entry point
- **When to edit:** Adding game settings, registering new sheets, changing initialization logic
- **Key code:** `Hooks.once('init', ...)` block (lines 30-100)

---

### Configuration

**`src/module/config.js`**
- **Purpose:** System-wide constants and enums
- **When to edit:** Changing ability names, roll result ranges, adding new categories
- **Exports:**
  - `TTRPG.abilities` - 6 ability scores
  - `TTRPG.debilities` - Ability debuffs
  - `TTRPG.rollResults` - 2d6 result ranges
  - `DwClassList` - Class utilities

---

### Data Schema

**`src/yaml/template.yml`**
- **Purpose:** Defines actor/item structure
- **When to edit:** Adding new actor/item types, new properties, new fields
- **Format:** YAML defining nested data structure
- **Compiled to:** Foundry's data model automatically

**`src/yaml/system.yml`**
- **Purpose:** System manifest for Foundry
- **When to edit:** Changing version, compatibility, adding packs, adding stylesheets
- **Key sections:**
  - `id` - System identifier
  - `version` - Current version
  - `esmodules` - JS files to load
  - `styles` - CSS files to load
  - `packs` - Compendium packs
  - `scripts` - Non-modular scripts

---

### Actor System

**`src/module/actor/actor.js`**
- **Purpose:** Base Actor class for all characters/NPCs
- **Key methods:**
  - `prepareData()` - Called whenever actor changes, calculates derived values
  - `_prepareCharacterData()` - Character-specific calculations (ability mods, weight)
- **When to edit:** Adding derived calculations, changing character data logic
- **Data access:** `this.system` for all properties defined in template.yml

**`src/module/actor/actor-sheet.js`**
- **Purpose:** Player Character sheet UI
- **Key methods:**
  - `getData()` - Prepare data for template rendering
  - `activateListeners()` - Attach click/change handlers
  - `_onDragStart()` - Handle drag/drop
- **When to edit:** Changing sheet layout, adding new UI sections, new interactions
- **Template:** `src/templates/sheet/character-sheet.hbs`

**`src/module/actor/actor-npc-sheet.js`**
- **Purpose:** NPC sheet UI
- **Similar structure** to actor-sheet.js but simplified
- **Template:** `src/templates/sheet/npc-sheet.hbs`

---

### Item System

**`src/module/item/item.js`**
- **Purpose:** Base Item class for moves, equipment, spells
- **Key methods:**
  - `prepareData()` - Item initialization
  - `getRollData()` - Merge actor + item data for formulas
  - `roll()` - Trigger move roll
- **When to edit:** Adding item-specific logic, new roll types

**`src/module/item/item-sheet.js`**
- **Purpose:** Generic item sheet (moves, equipment, spells)
- **Similar to actor-sheet.js** with item-specific handlers
- **Template:** `src/templates/items/item-sheet.hbs`

**`src/module/item/class-item-sheet.js`**
- **Purpose:** Specialized sheet for class items
- **When to edit:** Changing how classes are displayed/edited
- **Template:** `src/templates/items/class-sheet.hbs`

---

### Roll System

**`src/module/rolls.js`**
- **Purpose:** All roll mechanics (2d6 system, move resolution)
- **Key methods:**
  - `getRollFormula(defaultFormula)` - Build roll formula (where to add advantage/disadvantage)
  - `getModifiers(actor)` - Get forward/ongoing bonuses
  - `rollMove(options)` - Main roll resolution
- **When to edit:** Changing roll mechanics, adding advantage/disadvantage, changing result interpretation
- **Roll flow:**
  1. Build formula: `2d6 + [modifiers]`
  2. Execute roll
  3. Interpret result (failure/partial/success)
  4. Post to chat with outcome

**Key Formula Building:**
```javascript
// Example: Add advantage
if (game.settings.get('projectmoonttrpg', 'advForward')) {
  return '3d6kh2';  // Roll 3d6, keep highest 2
}
```

---

### Utility & Helpers

**`src/module/utility.js`**
- **Purpose:** General-purpose helper functions
- **Key functions:**
  - `cleanClass(string)` - Sanitize strings to CSS class names
  - `isEmpty(arg)` - Check for empty values
  - `getEquipment(update)` - Load equipment items with caching
  - `getAbilityMod(abilityScore)` - Convert score to modifier
  - `getAbilityScore(abilityMod)` - Convert modifier to score
- **When to edit:** Adding new calculations, modifying existing helpers
- **Caching:** Equipment cached in `game.projectmoonttrpg.equipment`

**`src/module/handlebars.js`**
- **Purpose:** Register Handlebars template helpers
- **When to edit:** Adding new template functions
- **Example helpers:**
  - `eq` - Equality comparison
  - `neq` - Inequality comparison
  - `ternary` - Ternary operator
  - Custom formatting functions

**`src/module/templates.js`**
- **Purpose:** Preload all Handlebars templates
- **When to edit:** Adding new template files to the preload list
- **Format:** Array of template paths to load on startup

---

### Chat System

**`src/module/chat.js`**
- **Purpose:** Chat message handling and hooks
- **When to edit:** Customizing chat messages, adding chat commands, modifying roll output
- **Hooks:** Listen to chat creation/rendering events

---

### Combat System

**`src/combat/combat.js`**
- **Purpose:** Combat tracker UI and logic
- **When to edit:** Changing combat mechanics, tracker display
- **Integrates with:** Combat sidebar in Foundry

---

### Migrations

**`src/module/migrate/migrate.js`**
- **Purpose:** Handle data migration between versions
- **When to edit:** Need to update saved actor/item data for new version
- **Key concept:** Version checking and selective data updates

---

## Template Files

All templates use **Handlebars** syntax and are located in `src/templates/`:

### Sheet Templates
- `sheet/character-sheet.hbs` - PC character sheet main layout
- `sheet/npc-sheet.hbs` - NPC sheet layout
- `items/item-sheet.hbs` - Generic item sheet
- `items/class-sheet.hbs` - Class item sheet

### Part Templates (reusable)
- `parts/ability-scores.hbs` - 6 ability score display
- `parts/moves.hbs` - Move list display
- `parts/equipment.hbs` - Equipment list
- `parts/resources.hbs` - Forward/hold/ongoing/custom resource

### Chat Templates
- `chat/roll-result.hbs` - Roll outcome display
- `chat/move-card.hbs` - Move card in chat

### Dialog Templates
- `dialog/ability-check.hbs` - Ability choice dialog
- `dialog/move-selector.hbs` - Move selection dialog

---

## Styling

**CSS/SCSS Files:**
- **Source:** `src/styles/src/` (SCSS files)
- **Output:** `src/styles/dist/projectmoonttrpg.css` (compiled)
- **Compile command:** `npm run compile`
- **Auto-compile:** `npm run watch`

**Key SCSS organization:**
- Variables and mixins
- Component styles (sheets, dialogs, etc.)
- Responsive layouts
- Print styles

**CSS classes for targeting:**
```css
.projectmoonttrpg { /* System root */ }
.actor-sheet { /* Actor sheet */ }
.item-sheet { /* Item sheet */ }
.TTRPG-dialog { /* Dialog windows */ }
.character { /* Character-specific */ }
.npc { /* NPC-specific */ }
.move { /* Move items */ }
.equipment { /* Equipment items */ }
```

---

## Compendium Content

**Location:** `src/packs/` - All `.yml` files

**Content organization:**
- `basic-moves/` - Core book moves
- `classes/` - Character classes
- `the-*-moves/` - Class-specific moves
- `the-*-spells/` - Class spells
- `equipment-*.db/` - Equipment by category
- `monsters-*.db/` - Pre-built enemies
- `tags/` - Tag definitions

**To edit content:**
1. Edit `.yml` files in `src/packs/`
2. Run `npm run compilePacks`
3. `.db` files are automatically updated
4. Foundry loads updated content

**YAML item format:**
```yaml
- id: item_id_here
  type: move
  name: "Move Name"
  data:
    description: "What triggers this move..."
    moveType: ability  # or formula
    rollType: "DEX"    # which ability
    moveResults:
      failure: "GM makes a move"
      partial: "Success but..."
      success: "Success!"
```

---

## Common Code Patterns

### Accessing Actor Data
```javascript
// In any sheet or class with access to actor
const actor = this.actor;  // Or this.document if Actor extended class

// Get system data
const abilities = actor.system.abilities;
const str = actor.system.abilities.str.value;
const strMod = actor.system.abilities.str.mod;

// Get items
const moves = actor.items.filter(i => i.type === 'move');

// Get computed values (from prepareData)
const weight = actor.system.attributes.weight.value;
```

### Building Roll Formulas
```javascript
// Basic roll
let formula = '2d6';

// Add modifier
formula += ' + ' + actor.system.abilities.str.mod;

// Add bonuses
formula += ' + ' + forward;

// Roll it
const roll = new Roll(formula, actor.getRollData());
await roll.evaluate();
const total = roll.total;
```

### Registering Event Handlers
```javascript
// In activateListeners(html)
html.find('button.attack').click(this._onAttack.bind(this));
html.find('input.name').change(this._onNameChange.bind(this));

// Handler method
_onAttack(event) {
  event.preventDefault();
  const actorId = event.currentTarget.dataset.actorId;
  // Do something
}
```

### Template Rendering
```javascript
// In any class
const template = 'systems/projectmoonttrpg/templates/chat/roll-result.hbs';
const html = await renderTemplate(template, {
  roll: rollObject,
  actor: actorData,
  customData: someData
});

// Post to chat
await ChatMessage.create({
  content: html,
  speaker: ChatMessage.getSpeaker()
});
```

### Settings Access
```javascript
// Register (in projectmoonttrpg.js init)
game.settings.register("projectmoonttrpg", "mySettingKey", {
  name: "Setting Name",
  hint: "Description",
  scope: "world",  // or "client"
  config: true,
  type: Boolean,
  default: false
});

// Get value anywhere
const value = game.settings.get("projectmoonttrpg", "mySettingKey");

// Set value
await game.settings.set("projectmoonttrpg", "mySettingKey", true);
```

---

## Build Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run build` | Build everything (CSS, templates, etc.) |
| `npm run compile` | Compile SCSS to CSS only |
| `npm run watch` | Watch files and rebuild on change |
| `npm run yaml` | Convert YAML templates to JSON |
| `npm run compilePacks` | Compile YAML packs to `.db` files |
| `npm run extractPacks` | Extract `.db` files back to YAML |
| `npm run patch` | Bump version patch (1.0.0 → 1.0.1) |
| `npm run minor` | Bump version minor (1.0.0 → 1.1.0) |
| `npm run major` | Bump version major (1.0.0 → 2.0.0) |
| `npm run symlinks:create` | Create symlink for local Foundry development |

---

## Debugging Checklist

- [ ] Did you run `npm run watch` or `npm run build`?
- [ ] Did you hard-refresh Foundry? (Ctrl+Shift+R)
- [ ] Check browser console for JavaScript errors
- [ ] Verify file paths and template names are correct
- [ ] Check YAML syntax if editing `template.yml` or `system.yml`
- [ ] Verify Handlebars helper is registered if using custom helper
- [ ] Check that properties exist in template data
- [ ] Look for typos in property names (case-sensitive!)
- [ ] Verify CSS is in `dist/` folder and listed in `system.yml`
- [ ] Test in a fresh Foundry world to isolate version issues

---

## File Size Reference

**Key files by importance:**

1. **Critical (modify carefully):**
   - `src/yaml/template.yml` - Data structure
   - `src/module/actor/actor.js` - Data calculations
   - `src/module/rolls.js` - Core mechanic
   
2. **Important (safe to modify):**
   - Sheet `.js` files - UI logic
   - Template `.hbs` files - Layout
   - `src/module/config.js` - Constants

3. **Style (easy to modify):**
   - `src/styles/src/*.scss` - Styling
   - `src/templates/**/*.hbs` - Layout
   - Language files - Text

---

## Tips for Common Tasks

### To add a game mechanic:
1. Add property to `template.yml`
2. Calculate in `actor.js` prepareData()
3. Display in sheet template
4. Add setting if configurable
5. Update rolls if affects rolling

### To change sheet appearance:
1. Edit sheet template (`.hbs` file)
2. Modify CSS in `.scss` file
3. Run `npm run compile`
4. Refresh Foundry

### To add new content (moves, equipment):
1. Create/edit `.yml` file in `src/packs/`
2. Run `npm run compilePacks`
3. Content appears in compendiums

### To create new feature:
1. Add data structure to `template.yml`
2. Add sheet UI template
3. Add display/calculation logic
4. Add event handlers if interactive
5. Test thoroughly

---

## Useful Links

- [SYSTEM_INTERNALS.md](./SYSTEM_INTERNALS.md) - Full documentation
- [system.yml](./src/yaml/system.yml) - System manifest
- [template.yml](./src/yaml/template.yml) - Data schema
- [projectmoonttrpg.js](./src/module/projectmoonttrpg.js) - System init
- [gulpfile.js](./gulpfile.js) - Build configuration
