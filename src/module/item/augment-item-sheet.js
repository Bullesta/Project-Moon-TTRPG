import { PMTTRPGItemSheet } from "./item-sheet.js";

export class PMTTRPGAugmentItemSheet extends PMTTRPGItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "item", "augment"],
      width: 620,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      submitOnChange: true,
    });
  }

  /** @override */
  get template() {
    const path = "systems/projectmoonttrpg/templates/items";
    return `${path}/augment-sheet.html`;
  }
}