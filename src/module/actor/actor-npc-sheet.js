import { PMTTRPGCharacterSheet } from "./character-sheet.js";

const TEMPLATE_ROOT = "systems/projectmoonttrpg/templates/sheet/npc";

/**
 * GM-facing NPC sheet
 * Extends the character sheet for shared trackers, rolls, and item actions.
 */
export class PMTTRPGActorNpcSheet extends PMTTRPGCharacterSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["sheet", "actor", "character-sheet-prototype", "npc-sheet"],
    position: { width: 950, height: 880 },
    window: { resizable: true, contentClasses: ["pm-sheet-body", "npc-sheet-body"] },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      tab: PMTTRPGCharacterSheet.prototype._onTabClick,
      editImage: PMTTRPGCharacterSheet.prototype._onEditImage,
      rollable: PMTTRPGCharacterSheet.prototype._onRollable,
      initiativeRoll: PMTTRPGCharacterSheet.prototype._onInitiativeRoll,
      toggleEdit: PMTTRPGCharacterSheet.prototype._onToggleEdit,
      toggleTracker: PMTTRPGCharacterSheet.prototype._onToggleTracker,
      itemCreate: PMTTRPGActorNpcSheet.prototype._onItemCreate,
      itemEdit: PMTTRPGCharacterSheet.prototype._onItemEdit,
      itemDelete: PMTTRPGCharacterSheet.prototype._onItemDelete,
      toggleDetails: PMTTRPGCharacterSheet.prototype._onToggleDetails,
      counterIncrease: PMTTRPGCharacterSheet.prototype._onCounterIncrease,
      counterDecrease: PMTTRPGCharacterSheet.prototype._onCounterDecrease,
      statusControl: PMTTRPGCharacterSheet.prototype._onStatusControl,
    },
  };

  /** @override */
  static PARTS = {
    sheet: {
      template: `${TEMPLATE_ROOT}/sheet.hbs`,
      scrollable: [".pm-sheet__left", ".tab-content.active"],
    },
  };

  /** @override */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    const strip = new Set(["nightmode", "projectmoonttrpg", "npc", "character"]);
    options.classes = options.classes.filter(c => !strip.has(c));
    if (!options.classes.includes("character-sheet-prototype")) {
      options.classes.push("character-sheet-prototype");
    }
    if (!options.classes.includes("npc-sheet")) {
      options.classes.push("npc-sheet");
    }
    return options;
  }

  /** @override */
  _getTabs() {
    const defs = [
      { id: "combat", labelKey: "PMTTRPG.TabCombat" },
      { id: "brief", labelKey: "PMTTRPG.TabBrief" },
    ];
    const tabs = {};
    for (const def of defs) {
      tabs[def.id] = {
        id: def.id,
        group: "primary",
        label: game.i18n.localize(def.labelKey),
        active: this.tabGroups.primary === def.id,
        cssClass: this.tabGroups.primary === def.id ? "active" : "",
      };
    }
    return tabs;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // NPC loadout is always active so we don't need equip filtering.
    context.loadoutWeapons = (context.allWeapons ?? []).slice();
    context.loadoutOutfits = (context.outfits ?? []).slice();
    context.equippedWeapons = context.loadoutWeapons;
    context.equippedOutfits = context.loadoutOutfits;

    const brief = context.system?.details?.gmBrief ?? {};
    context.gmBrief = {
      complexityGm: Number(brief.complexityGm) || 0,
      complexityPlayers: Number(brief.complexityPlayers) || 0,
      strength: brief.strength ?? "",
      designIntention: brief.designIntention ?? "",
      recommendedBehavior: brief.recommendedBehavior ?? "",
      lore: brief.lore ?? "",
      notes: brief.notes ?? "",
    };

    return context;
  }

  /** @override */
  _buildResistanceRows() {
    const outfit = this.actor.items.find(i => i.type === "outfit");
    const display = outfit?.system?.resistancesDisplay;
    const damageTypes = ["slash", "pierce", "blunt"];
    const assetPath = "systems/projectmoonttrpg/assets/icons/sheet";

    const buildRow = (pool, key, title) => ({
      key,
      title,
      tiles: damageTypes.map(dmg => ({
        dmg,
        icon: `${assetPath}/00_${dmg}.webp`,
        value: display?.[pool]?.[dmg] ?? "1x",
      })),
    });

    return [
      buildRow("hp", "hp-resist", game.i18n.localize("PMTTRPG.HPResistances")),
      buildRow("st", "st-resist", game.i18n.localize("PMTTRPG.STResistances")),
    ];
  }

  /** @override */
  async _prepareCharacterItems(sheetData) {
    await super._prepareCharacterItems(sheetData);

    // Skills resolve against the first loadout weapon/outfit (no equip flag).
    const weapon = this.actor.items.find(i => i.type === "weapon");
    const outfit = this.actor.items.find(i => i.type === "outfit");
    for (const s of sheetData.skills ?? []) {
      s.equippedWeaponDamageType = weapon?.system?.damageType || null;
      s.equippedWeaponOffensiveDiceComputed = weapon?.system?.offensiveDiceComputed || null;
      s.equippedOutfitBlockDiceComputed = outfit?.system?.blockDiceComputed || null;
      s.equippedOutfitEvadeDiceComputed = outfit?.system?.evadeDiceComputed || null;
    }
  }

  /** @override */
  async _onItemCreate(event, target) {
    event.preventDefault();
    const type = target.dataset.type;
    if (type === "augment" && this.actor.items.some(item => item.type === "augment")) {
      ui.notifications.warn(game.i18n.localize("PMTTRPG.AugmentOnlyOne"));
      return;
    }
    const data = foundry.utils.duplicate(target.dataset);
    const itemName = data.name || game.i18n.localize(`TYPES.Item.${type}`) || type;
    delete data.action;
    delete data.type;
    delete data.name;

    const system = { ...data };
    // NPC kit is always active so we mark loadout items equipped for shared roll/effect code paths.
    if (["weapon", "outfit", "skill", "augment"].includes(type)) {
      system.equipped = true;
    }

    await this.actor.createEmbeddedDocuments("Item", [{ name: itemName, type, system }], {});
  }

  /** @override - NPCs dont deserve the cool panel background dust so we skip it */
  _startDust() {}

  /** @override */
  _rehomePanelFx() {
    return false;
  }
}
