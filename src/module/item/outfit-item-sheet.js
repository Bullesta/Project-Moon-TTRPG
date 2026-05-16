import { PMTTRPGItemSheet } from "./item-sheet.js";

export class PMTTRPGOutfitItemSheet extends PMTTRPGItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "item", "outfit"],
      width: 640,
      height: 720,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      submitOnChange: true,
    });
  }

  /** @override */
  get template() {
    const path = "systems/projectmoonttrpg/templates/items";
    return `${path}/outfit-sheet.html`;
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    context.selects = context.selects || {};

    context.selects.outfitProperties = {
      none: "PMTTRPG.OutfitPropertyNone",
      armored: "PMTTRPG.OutfitPropertyArmored",
      swift: "PMTTRPG.OutfitPropertySwift",
      balanced: "PMTTRPG.OutfitPropertyBalanced"
    };

    context.selects.resistanceLevels = {
      fatal: "PMTTRPG.ResistanceFatal",
      weak: "PMTTRPG.ResistanceWeak",
      normal: "PMTTRPG.ResistanceNormal",
      endured: "PMTTRPG.ResistanceEndured",
      ineffective: "PMTTRPG.ResistanceIneffective",
      immune: "PMTTRPG.ResistanceImmune"
    };

    context.selects.damageTypes = {
      slash: "PMTTRPG.DamageTypeSlash",
      pierce: "PMTTRPG.DamageTypePierce",
      blunt: "PMTTRPG.DamageTypeBlunt"
    };

    return context;
  }
}
