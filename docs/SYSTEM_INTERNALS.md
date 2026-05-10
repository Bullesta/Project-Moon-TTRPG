# Project Moon TTRPG System - Internal Documentation

This guide explains how the Project Moon TTRPG Foundry VTT system works internally, allowing you to understand and modify it effectively.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [Key Concepts](#key-concepts)
7. [Common Modifications](#common-modifications)
8. [Development Setup](#development-setup)

---

## System Overview

This is a **Foundry VTT System Module** for the Project Moon TTRPG TTRPG (Tabletop RPG). It's built as a JavaScript/CSS system that integrates with Foundry VTT's framework, providing:

- Character sheets for PCs (Player Characters)
- NPC (Non-Player Character) sheets
- A rollable move system (core mechanic: 2d6 + modifier)
- Spell and equipment management
- Class-based character progression
- Compendium content (moves, classes, equipment, etc.)

**Technology Stack:**
- **Framework:** Foundry VTT v13
- **Language:** JavaScript (ES6 modules)
- **Styling:** SCSS compiled to CSS
- **Templates:** Handlebars
- **Data Format:** YAML (for metadata), JSON (for storage)

---

## Architecture

### High-Level Structure

```
┌─────────────────────────────────────────────────────────┐
│            Foundry VTT Core Framework                    │
├─────────────────────────────────────────────────────────┤
│  System Registration & Configuration (projectmoonttrpg.js)  │
├─────────────────────────────────────────────────────────┤
│                Document Classes                          │
│  ┌────────────────┐         ┌────────────────┐          │
│  │   ActorDw      │         │    ItemDw      │          │
│  │  (Characters)  │         │  (Moves, etc)  │          │
│  └────────────────┘         └────────────────┘          │
├─────────────────────────────────────────────────────────┤
│                 Sheet Applications                       │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │PC Sheet  │  │NPC Sheet │  │Class Item Sheet     │   │
│  └──────────┘  └──────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│           Utility & Support Systems                      │
│  ┌────────┐ ┌─────┐ ┌──────────┐ ┌──────────┐         │
│  │Rolls   │ │Chat │ │Utility   │ │Handlebars│         │
│  │System  │ │Sys  │ │Functions │ │Helpers   │         │
│  └────────┘ └─────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── module/                       # Main JavaScript modules
│   ├── projectmoonttrpg.js          # Main entry point - Foundry initialization
│   ├── config.js                # System configuration (abilities, roll results)
│   ├── utility.js               # Utility functions (string cleaning, calculations)
│   ├── rolls.js                 # Roll system and resolution
│   ├── chat.js                  # Chat message handling
│   ├── handlebars.js            # Handlebars template helpers
│   ├── templates.js             # Template preloading
│   │
│   ├── actor/                   # Character/NPC system
│   │   ├── actor.js             # Base Actor class - data preparation
│   │   ├── actor-sheet.js       # PC character sheet UI
│   │   └── actor-npc-sheet.js   # NPC sheet UI
│   │
│   ├── item/                    # Moves, equipment, spells system
│   │   ├── item.js              # Base Item class
│   │   ├── item-sheet.js        # Generic item sheet UI
│   │   └── class-item-sheet.js  # Class item sheet UI
│   │
│   ├── combat/                  # Combat system
│   │   └── combat.js            # Combat tracker UI
│   │
│   └── migrate/                 # Data migration utilities
│       └── migrate.js           # Version migration handling
│
├── templates/                   # Handlebars HTML templates
│   ├── sheet/                   # Sheet layouts
│   ├── items/                   # Item display templates
│   ├── parts/                   # Reusable template parts
│   ├── dialog/                  # Dialog templates
│   ├── chat/                    # Chat message templates
│   └── combat/                  # Combat templates
│
├── styles/                      # Styling
│   ├── src/                     # SCSS source files
│   └── lib/                     # CSS libraries (Tagify)
│   └── dist/                    # Compiled CSS output
│
├── packs/                       # Compendium data
│   ├── classes.db              # Character classes
│   ├── basic-moves.db          # Basic moves from the book
│   ├── the-*-moves.db          # Class-specific moves
│   ├── the-*-spells.db         # Spells
│   ├── equipment-*.db          # Equipment by category
│   ├── monsters-*.db           # Pre-built monsters
│   └── tags.db                 # Tag definitions
│
├── yaml/                        # YAML metadata files
│   ├── system.yml              # System manifest
│   └── template.yml            # Data schema definition
│
├── assets/                      # Static assets
│   ├── icons/                  # Icon sets
│   └── tokens/                 # Token art
│
└── scripts/                     # Build scripts
    ├── lib/                    # Script libraries
    └── migrate/                # Migration scripts
```

---

## Core Components

### 1. Main Entry Point: `projectmoonttrpg.js`

**Purpose:** Initializes the system when Foundry loads

**Key Responsibilities:**
- Registers document classes (ActorDw, ItemDw)
- Registers sheet applications (character, NPC, items, classes)
- Loads configuration
- Sets up Handlebars helpers
- Registers game settings
- Loads templates

**Key Code Sections:**
```javascript
Hooks.once("init", async function() {
  // Register classes
  CONFIG.Actor.documentClass = ActorDw;
  CONFIG.Item.documentClass = ItemDw;
  
  // Register sheets
  Actors.registerSheet("projectmoonttrpg", DwActorSheet, {...});
  
  // Set up game settings
  game.settings.register("projectmoonttrpg", "xpFormula", {...});
});
```

### 2. Configuration: `config.js`

**Purpose:** Central location for system configuration

**Contains:**
- `TTRPG.abilities` - The six ability scores (STR, DEX, CON, INT, WIS, CHA)
- `TTRPG.debilities` - Ability score debuffs
- `TTRPG.rollResults` - Roll result ranges (failure: 1-6, partial: 7-9, success: 10+)
- `DwClassList` - Class management utility

**Example:**
```javascript
TTRPG.rollResults = {
  failure: { start: null, end: 6, label: 'TTRPG.failure' },
  partial: { start: 7, end: 9, label: 'TTRPG.partial' },
  success: { start: 10, end: null, label: 'TTRPG.success' }
};
```

### 3. Data Schema: `template.yml`

**Purpose:** Defines the structure of Actor and Item documents

**Structure:**
- **Actors:** character, npc
  - Templates: base (shared data)
  - Attributes: HP, AC, XP, coin, weight, resources
  - Abilities: str, dex, con, int, wis, cha (each with value, mod, debility)
  
- **Items:** move, npcMove, equipment, spell, bond, tag, class
  - Each with specific fields (description, rollFormula, tags, etc.)

**How It Works:**
- Foundry uses this YAML file to auto-generate the document schema
- Becomes accessible as `actor.system` or `item.system`

### 4. Actor Class: `actor/actor.js`

**Purpose:** Extends Foundry's Actor class with TTRPG-specific logic

**Key Method: `prepareData()`**
- Runs whenever actor data changes
- Calculates derived values
- Converts between ability scores and ability modifiers
- Calculates weight from equipped items
- Parses item tags

**Key Method: `_prepareCharacterData(actorData)`**
- Character-specific data preparation
- Handles ability score to modifier conversion
- Manages debilities (reduces modifier by 1)
- Calculates carry weight and armor bonuses

**Data Flow:**
```
Raw Actor Data → prepareData() → Derived Values
                    ↓
              Character-specific calculations
                    ↓
              Final prepared data ready for sheets
```

### 5. Item Class: `item/item.js`

**Purpose:** Extends Foundry's Item class with TTRPG-specific logic

**Key Methods:**
- `prepareData()` - Clean up broken data structures
- `getRollData()` - Merge actor data with item data for rolls
- `roll()` - Triggers the move rolling system

### 6. Roll System: `rolls.js`

**Purpose:** Handles all rolling mechanics

**Core Mechanic: 2d6 + Modifiers**
- `getRollFormula()` - Gets the base formula (2d6)
- `getModifiers()` - Applies forward/ongoing bonuses
- `rollMove()` - Main roll resolution function

**Roll Types:**
1. **Ability Rolls** - 2d6 + ability modifier
2. **Move Rolls** - 2d6 + relevant ability modifier, with outcomes
3. **NPC Moves** - Uses custom formulas

**Result Interpretation:**
- **Failure (1-6):** GM makes a move
- **Partial Success (7-9):** Partial success with complications
- **Success (10+):** Intended outcome achieved

**Example Flow:**
```
Player clicks "Attack" move
  ↓
rollMove() retrieves move data
  ↓
Calculates: 2d6 + Strength + Forward + Ongoing
  ↓
Rolls and interprets result
  ↓
Posts to chat with appropriate outcome
```

### 7. Sheet Applications

**Character Sheet (actor-sheet.js):**
- PC-specific display
- Shows abilities, moves, equipment, spells
- Resource tracking (forward, hold, ongoing, custom)
- Character builder integration

**NPC Sheet (actor-npc-sheet.js):**
- Simplified NPC display
- Power tags system
- Less resource tracking

**Item Sheets:**
- Generic item sheet for moves, equipment, spells
- Class item sheet for detailed class data including equipment choices

### 8. Utility System: `utility.js`

**Provides Helper Functions:**
- `cleanClass()` - Sanitizes strings for CSS classes
- `isEmpty()` - Checks for empty/falsy values
- `getEquipment()` - Loads equipment from game items and compendiums
- `getAbilityMod()` - Converts ability score to modifier
- `getAbilityScore()` - Converts modifier back to score

**Caching:**
- Equipment is cached in `game.projectmoonttrpg.equipment` to improve performance

---

## Data Flow

### 1. System Initialization Flow

```
1. Foundry Loads
    ↓
2. projectmoonttrpg.js - Hooks.once('init')
    ↓
3. Register Document Classes (ActorDw, ItemDw)
    ↓
4. Register Sheet Classes
    ↓
5. Load Templates (preloadHandlebarsTemplates())
    ↓
6. Register Handlebars Helpers (DwRegisterHelpers.init())
    ↓
7. Register Game Settings
    ↓
8. System Ready
```

### 2. Actor Creation & Preparation Flow

```
Actor Created with template.yml defaults
    ↓
Actor.prepareData() called
    ↓
├─ If Character Type:
│   ├─ Ability Scores → Modifiers conversion
│   ├─ Apply Debilities (reduce mod by 1)
│   ├─ Calculate Weight
│   └─ Parse Item Tags
│
└─ If NPC Type:
    └─ Parse tags
    ↓
Prepared data ready for sheets
    ↓
Sheet renders with all calculated values
```

### 3. Move Rolling Flow

```
User clicks "Activate Move" button on sheet
    ↓
item.roll() triggered
    ↓
rollMove() called with actor and item data
    ↓
Determine roll type:
├─ Ability Move: Use ability modifier
├─ Formula Move: Use custom formula
└─ NPC Move: Use formula
    ↓
Calculate: 2d6 + modifiers + forward + ongoing
    ↓
Roll 2d6
    ↓
Total = Result
    ↓
Interpret result:
├─ 1-6: Failure
├─ 7-9: Partial Success
└─ 10+: Success
    ↓
Post to chat with move description and result
    ↓
Render appropriate outcome template
```

### 4. Sheet Rendering Flow

```
Sheet.render() called
    ↓
Collect all data:
├─ Actor/Item system data (from prepareData)
├─ Game settings
└─ Handlebars helper context
    ↓
Render sheet template with data
├─ Get actor abilities
├─ Get actor items (filtered by type)
└─ Format resources and tracking
    ↓
HTML rendered to screen
    ↓
Attach event listeners (click, change, drag)
    ↓
Sheet displayed to user
```

---

## Key Concepts

### Ability Scores & Modifiers

**Project Moon TTRPG uses 2d6 system:**
- Each ability has a **score** (3-20, default 10)
- Score is converted to a **modifier** (-3 to +3)

**Conversion Table:**
```
Score:   3-5  6-8   9-12  13-15  16-17  18-20
Modifier: -2   -1     0     +1     +2     +3
```

**Debilities:**
Each ability can have a debility, which reduces its modifier by 1:
- STR: Weak
- DEX: Clumsy
- CON: Sick
- INT: Confused
- WIS: Scarred
- CHA: Resentful

### Move System

**Three Move Types:**

1. **Ability Moves** - Trigger ability check
   - Formula: `2d6 + [Ability Modifier]`
   - Example: "Defy Danger + DEX"

2. **Formula Moves** - Custom formula
   - Example: `2d6 + @abilities.str.mod + 1`
   - Supports rollData formula syntax

3. **NPC Moves** - For non-player character actions
   - Uses custom formulas

**Move Structure:**
```javascript
{
  name: "Defy Danger",
  description: "When you act despite an imminent threat...",
  choices: "What do you do?",
  moveType: "ability", // or "formula", "npc"
  rollType: "DEX",     // ability to use
  moveResults: {
    failure: "You suffer the consequence",
    partial: "You succeed, but...",
    success: "You succeed fully"
  }
}
```

### Equipment & Weight

**Weight System:**
- Each item has weight and quantity
- Total weight = (item_weight × quantity) + coin_weight
- Exceeding max weight applies penalties

**Coin Weight:**
- Configurable - default: 1 coin = 1 weight unit
- Formula: `weight += Math.floor(coin / coinWeight)`

**Equipped vs Unequipped:**
- Only equipped items count toward weight
- Weapons apply armor-ignoring and piercing bonuses when equipped

### Compendiums

**Structure:**
- Located in `packs/` directory
- Loaded as `.db` files
- Contain items (moves, equipment, classes, etc.)
- Can be overridden by items in game world

**Loading:**
```javascript
// From config.js
packs:
  - name: classes
    label: Classes
    path: "./packs/classes.db"
    type: Item
```

**Accessing:**
```javascript
const classCompendium = game.packs.get('projectmoonttrpg.classes');
const classItems = await classCompendium.getDocuments();
```

### Handlebars Helpers

Registered in `handlebars.js` to provide template utilities:
- `eq` - Equality check
- `neq` - Inequality check
- `ternary` - Ternary operator
- Custom formatters for dice, rolls, etc.

---

## Common Modifications

### 1. Add a New Ability Score

**Files to modify:**
1. `src/yaml/template.yml` - Add ability to character/npc templates
2. `src/module/config.js` - Add to `TTRPG.abilities`
3. `src/module/actor/actor.js` - Update prepareData if needed
4. Sheet templates - Add UI for new ability
5. Localization files - Add labels

**Example:**
```yaml
# template.yml
abilities:
  str:
    value: 10
    # ... existing properties
  luck:  # NEW
    value: 10
    min: 3
    mod: 0
    debility: false
```

```javascript
// config.js
TTRPG.abilities = {
  "str": "TTRPG.AbilityStr",
  // ...
  "luck": "TTRPG.AbilityLuck"  // NEW
};
```

### 2. Modify Roll Formula

**Located in:** `src/module/rolls.js`

**Key function: `getRollFormula()`**
```javascript
static getRollFormula(defaultFormula = '2d6') {
  // Modify this to add advantage/disadvantage
  // Example: if (game.settings.get('projectmoonttrpg', 'advForward')) {
  //   return '3d6kh2';  // Roll 3d6, keep highest 2
  // }
  return defaultFormula;
}
```

**Key function: `getModifiers(actor)`**
```javascript
static getModifiers(actor) {
  // This adds forward and ongoing
  // Modify to add other bonuses
  let result = '';
  // Add custom modifiers here
  return result;
}
```

### 3. Add New Item Type

**Steps:**

1. **Update schema** in `src/yaml/template.yml`:
```yaml
Item:
  types:
    - move
    - npcMove
    - equipment
    - spell
    - bond
    - tag
    - class
    - custom     # NEW
  custom:
    templates:
      - base
    customField: ''
```

2. **Create sheet** in `src/module/item/`:
```javascript
export class DwCustomItemSheet extends ItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions(), {
      classes: ["projectmoonttrpg", "sheet", "item", "custom"],
      template: "systems/projectmoonttrpg/templates/items/custom-sheet.hbs",
      width: 500,
      height: 500
    });
  }
}
```

3. **Register sheet** in `projectmoonttrpg.js`:
```javascript
Items.registerSheet("projectmoonttrpg", DwCustomItemSheet, {
  types: ['custom'],
  makeDefault: true
});
```

4. **Create template** in `src/templates/items/custom-sheet.hbs`

### 4. Modify Character Sheet Layout

**Located in:** `src/module/actor/actor-sheet.js` and sheet templates

**Key areas to modify:**
- `getData()` - Prepare data for template
- Template file - HTML/Handlebars layout
- Event listeners - Button/input handlers

**Example - Add new section:**
```javascript
// In actor-sheet.js getData()
const data = super.getData();
data.customSection = await this.getCustomData();
return data;
```

```handlebars
{{!-- In template --}}
<section class="custom-section">
  {{#each customSection}}
    <div>{{this.name}}</div>
  {{/each}}
</section>
```

### 5. Add New Game Setting

**Location:** `src/module/projectmoonttrpg.js` in `Hooks.once('init')`

**Example:**
```javascript
game.settings.register("projectmoonttrpg", "customSetting", {
  name: "Custom Setting Name",
  hint: "Description of what this setting does",
  scope: "world",      // or "client"
  config: true,        // Show in settings menu
  type: Boolean,       // String, Number, Boolean, etc.
  default: false
});
```

**Accessing:**
```javascript
const value = game.settings.get("projectmoonttrpg", "customSetting");
game.settings.set("projectmoonttrpg", "customSetting", newValue);
```

### 6. Modify Roll Results Display

**Located in:** `src/templates/chat/` - Chat message templates

**Update result interpretation in:** `src/module/rolls.js`

**Example:**
```javascript
// In rollMove()
if (rollTotal >= 10) {
  // Success - customize here
  // Modify templateData to add custom info
  templateData.successMessage = "Custom success!";
}
```

---

## Development Setup

### Prerequisites
- Node.js 14+
- npm or yarn
- Git

### Build Tools

**Available Commands:**
```bash
npm run build          # Build everything (CSS, templates, etc)
npm run compile       # Compile SCSS to CSS
npm run watch         # Watch for changes and rebuild
npm run yaml          # Convert YAML to JSON
npm run compilePacks  # Convert YAML packs to DB
npm run extractPacks  # Extract DB packs back to YAML
npm run patch         # Bump patch version (1.0.0 → 1.0.1)
npm run minor         # Bump minor version (1.0.0 → 1.1.0)
npm run major         # Bump major version (1.0.0 → 2.0.0)
```

**gulpfile.js contains:**
- SCSS compilation pipeline
- YAML to database compilation
- File watching setup
- Version bumping tasks

### Workflow

**For Development:**
1. Run `npm run watch` in a terminal
2. Make changes to files
3. Changes automatically rebuild
4. Refresh Foundry to see changes

**For CSS Changes:**
1. Edit SCSS files in `src/styles/src/`
2. Watch automatically compiles to `src/styles/dist/projectmoonttrpg.css`

**For Template Changes:**
1. Edit Handlebars files in `src/templates/`
2. Rebuild and refresh Foundry

**For YAML Content Changes:**
1. Edit YAML files in `src/packs/`
2. Run `npm run compilePacks`
3. Foundry loads updated compendiums

### Project Dependencies

**Build Tools:**
- `gulp` - Task runner
- `gulp-sass` - SCSS compiler
- `gulp-yaml` - YAML processor
- `gulp-webp` - Image conversion
- `js-yaml` - YAML parser
- `yargs` - CLI argument parser

**Runtime:**
- None required - Foundry provides all APIs

### System Manifest

Located in: `src/yaml/system.yml`

**Key sections:**
- `id` - System identifier
- `version` - Current version
- `compatibility` - Supported Foundry versions
- `esmodules` - JS files to load
- `styles` - CSS files to load
- `packs` - Compendium packs to load
- `scripts` - Non-modular scripts

### Adding to Foundry

**Installation Methods:**

1. **Manifest URL:**
   - System URL: `https://asacolips-artifacts.s3.amazonaws.com/projectmoonttrpg/latest/system.json`
   - Use this in Foundry's "Install System" dialog

2. **Local Development Symlink:**
   ```bash
   npm run symlinks:create
   ```
   - Creates symlink in Foundry's systems folder
   - Allows live development without reinstalling

3. **Manual:**
   - Copy project folder to Foundry's `systems/` directory
   - Restart Foundry

---

## Debugging Tips

### 1. Console Logging
```javascript
// In any module
console.log("Actor:", this.actor);
console.log("System Data:", this.actor.system);
```

### 2. Access Game Objects
```javascript
// In browser console
game.actors.getName("Character Name")
game.items.getName("Item Name")
game.packs.get("projectmoonttrpg.classes")
```

### 3. Check Configuration
```javascript
console.log("TTRPG Config:", CONFIG.TTRPG);
console.log("Game Settings:", game.settings.get("projectmoonttrpg", "settingName"));
```

### 4. Debug Sheets
- Add to sheet options: `{ makeDefault: true }` to see your sheet
- Use browser DevTools to inspect elements
- Check browser console for errors

### 5. Test Rolls
```javascript
// In console
const actor = game.actors.getName("Test");
const move = actor.items.getName("Defy Danger");
move.roll();
```

---

## Common Issues & Solutions

### Issue: Changes not appearing
**Solution:** 
1. Rebuild with `npm run watch` or `npm run build`
2. Hard refresh Foundry (Ctrl+Shift+R)
3. Check browser console for errors

### Issue: Style changes not applying
**Solution:**
1. Verify SCSS compiled to CSS in `src/styles/dist/`
2. Check style is listed in `system.yml`
3. Clear browser cache
4. Hard refresh

### Issue: Template errors
**Solution:**
1. Check template files for syntax errors
2. Verify handlebars helpers are registered
3. Check console for missing helper errors
4. Verify data passed to template exists

### Issue: Broken migrations
**Solution:**
1. Check `src/module/migrate/migrate.js`
2. Add migration for new version
3. Update `systemMigrationVersion` setting
4. Test on fresh character

---

## Resources for Further Learning

### Foundry VTT Documentation
- [Official Docs](https://foundryvtt.com/article/system-development/)
- [API Reference](https://foundryvtt.com/api/)

### Code References
- `Actor` class - [actor.js](../actor/actor.js)
- `Item` class - [item.js](../item/item.js)
- `Roll System` - [rolls.js](../rolls.js)
- `Configuration` - [config.js](../config.js)

### YAML Files (Data Definitions)
- Actor/Item Schema - `src/yaml/template.yml`
- System Config - `src/yaml/system.yml`

### Localization
- Add new strings to language files
- Reference with `game.i18n.localize("KEY")`

---

## Version History

- **v1.9.0** - Current version
- Supports Foundry v13
- Last updated: May 2026

---

**Happy modifying!** This system is flexible and designed to be extended. Start with small changes, test thoroughly, and gradually add more complex modifications.
