import { PMTTRPGItemSheet } from "./item-sheet.js";

export class PMTTRPGAmmunitionItemSheet extends PMTTRPGItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "item", "ammunition"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      submitOnChange: true,
    });
  }

  /** @override */
  get template() {
    const path = "systems/projectmoonttrpg/templates/items";
    return `${path}/ammunition-sheet.html`;
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    context.selects = context.selects || {};

    context.selects.ammoTypes = {
      standard: "PMTTRPG.AmmoStandard",
      specialized: "PMTTRPG.AmmoSpecialized"
    };

    context.selects.damageTypes = {
      slash: "PMTTRPG.DamageTypeSlash",
      pierce: "PMTTRPG.DamageTypePierce",
      blunt: "PMTTRPG.DamageTypeBlunt"
    };

    return context;
  }
}
