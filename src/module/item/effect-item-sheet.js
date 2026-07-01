import { PMTTRPGItemSheet } from "./item-sheet.js";

export class PMTTRPGEffectItemSheet extends PMTTRPGItemSheet {

  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    PMTTRPGItemSheet.DEFAULT_OPTIONS,
    {
      classes: ["projectmoonttrpg", "sheet", "item", "effect"],
      position: { width: 560, height: 620 },
    },
    { inplace: false }
  );

  static PARTS = {
    body: { template: "systems/projectmoonttrpg/templates/items/effect-sheet.html", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.selects = context.selects || {};

    context.selects.effectAppliesTo = {
      weapon: 'TYPES.Item.weapon',
      outfit: 'TYPES.Item.outfit',
      skill: 'TYPES.Item.skill',
      augment: 'TYPES.Item.augment'
    };

    return context;
  }
}
