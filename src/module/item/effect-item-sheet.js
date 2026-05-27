import { PMTTRPGItemSheet } from "./item-sheet.js";

export class PMTTRPGEffectItemSheet extends PMTTRPGItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["projectmoonttrpg", "sheet", "item", "effect"],
      width: 560,
      height: 620,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      submitOnChange: true,
    });
  }

  /** @override */
  get template() {
    const path = "systems/projectmoonttrpg/templates/items";
    return `${path}/effect-sheet.html`;
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    context.selects = context.selects || {};

    context.selects.effectAppliesTo = {
      weapon: 'TYPES.Item.weapon',
      outfit: 'TYPES.Item.outfit',
      skill: 'TYPES.Item.skill'
    };

    return context;
  }
}
