/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [
    "systems/projectmoonttrpg/templates/parts/chat-buttons.html",
    "systems/projectmoonttrpg/templates/parts/initiative-character.html",
    "systems/projectmoonttrpg/templates/parts/effects-list.html",
    // Character sheet (AppV2) partials referenced by sheet.hbs
    "systems/projectmoonttrpg/templates/sheet/character/partials/tracker.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/resists.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/header.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/attributes.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tabs.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/panel-fx.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-combat.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-skills.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-equipment.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-weapons.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-outfits.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-ammunition.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-augment.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/tab-bio.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/bios.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/augment.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-controls-equipment.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-controls-skill.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-controls-augment.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-controls-ammunition.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/damage-type-icon.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-thumb.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-attack-dice.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-defense-dice.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-resist-tile.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-resist-strip.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-row-weapon.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-row-outfit.hbs",
    "systems/projectmoonttrpg/templates/sheet/character/partials/item-row-skill.hbs"
  ];

  // Load the template parts
  return foundry.applications.handlebars.loadTemplates(templatePaths);
};
